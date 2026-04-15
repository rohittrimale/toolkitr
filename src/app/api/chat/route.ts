/**
 * POST /api/chat
 * Routes to the correct Copilot API endpoint based on model:
 *   - Claude models  ? POST https://api.githubcopilot.com/v1/messages  (Anthropic Messages API)
 *   - o1/o3/gpt-5*   ? POST https://api.githubcopilot.com/responses     (OpenAI Responses API)
 *   - Default        ? POST https://api.githubcopilot.com/chat/completions
 *
 * Mirrors the routing logic in vscode-copilot-chat:
 *   src/platform/networking/common/networking.ts
 *   src/extension/prompts/node/panel/panelChatBasePrompt.tsx
 */
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getCopilotToken, invalidateCopilotToken } from "@/lib/auth/copilot-token";
import { enforceRateLimit } from "@/lib/auth/rate-limit-middleware";

import {
  buildPanelBaseSystem,
  buildPanelBaseSystemWithCodebase,
  getSystemPromptForCommand,
  AGENT_BASE_INSTRUCTIONS,
  FOLLOW_UP_INSTRUCTIONS,
  type SlashCommand,
} from "@/lib/ai/prompt";
import { buildMainframeCopilotPrompt, type ScreenContext, type PromptOptions } from "@/lib/ai/prompt";
import { TOOL_DEFINITIONS, TOOL_SETS, toOpenAITools, toAnthropicTools, type ToolDefinition } from "@/lib/tools/definitions";
import { COBOL_TOOL_DEFINITIONS } from "@/lib/cobol/tools";
import { ZOS_TOOL_DEFINITIONS } from "@/lib/zos/tools";
import { runAgenticLoop, type AgentConfig } from "@/lib/ai/agentic-loop";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

// Stable per-server-instance IDs (not per-request)
const SESSION_ID = randomUUID();
const MACHINE_ID = randomUUID();

// --- Types --------------------------------------------------------------------

interface ChatMessage {
  role: string;
  content: string | AnthropicContent[];
}

interface AnthropicContent {
  type: string;
  text?: string;
  source?: {
    type: "base64";
    media_type: string;
    data: string;
  };
}

interface OpenAIImageContent {
  type: "image_url";
  image_url: { url: string };
}

interface OpenAITextContent {
  type: "text";
  text: string;
}

interface RequestBody {
  messages: ChatMessage[];
  model: string;
  mode?: string;
  temperature?: number;
  customInstructions?: string;
  stream?: boolean;
  slashCommand?: string;
  useCodebase?: boolean;
  memory?: boolean;
  contextFiles?: boolean;
  previousResponseId?: string;
  thinkingBudgetTokens?: number;
  maxOutputTokens?: number;       // per-model cap from /api/models
  enableTools?: boolean;
  // --- FIX #1: Model capabilities passed from client ---
  modelCapabilities?: {
    supportsThinking?: boolean;   // Claude 3.5+ with extended thinking
    supportsVision?: boolean;     // Vision-capable models
    supportsTools?: boolean;      // Tool/function calling support
  };
  // --- New features ---
  imageAttachments?: Array<{
    base64: string;   // raw base64 (no data: prefix)
    mimeType: string; // e.g. "image/png"
    label?: string;   // optional display label
  }>;
  memoriesContext?: string[];     // facts from persistent memory
  followUpSuggestions?: boolean;  // inject follow-up suggestions instruction
  webSearchContext?: string;      // pre-fetched web search results as text
  // --- Mainframe screen context ---
  screenContext?: ScreenContext;  // live 3270 screen state from the terminal
  inputMode?: "TYPED" | "VOICE";  // voice or keyboard input
  // --- BYOK (Bring Your Own Key) -----
  settings?: {
    anthropicApiKey?: string;     // user's Anthropic API key
    openaiApiKey?: string;        // user's OpenAI API key
  };
  // --- Mainframe SSH credentials for COBOL tools -----
  sshCredentials?: {
    host: string;
    port?: number;
    username: string;
    password?: string;
    privateKey?: string;
    passphrase?: string;
  };
}

// --- Endpoint routing ---------------------------------------------------------

type ApiRoute = "completions" | "responses" | "messages";

function getApiRoute(modelId: string): ApiRoute {
  const id = modelId.toLowerCase();
  if (id.includes("claude")) return "messages";
  if (/^(o1|o3|o4|gpt-5|gpt5)/.test(id)) return "responses";
  return "completions";
}

function getApiUrl(route: ApiRoute): string {
  const BASE = "https://api.githubcopilot.com";
  switch (route) {
    case "messages":
      return `${BASE}/v1/messages`;
    case "responses":
      return `${BASE}/responses`;
    default:
      return `${BASE}/chat/completions`;
  }
}

// --- BYOK (Bring Your Own Key) provider routing ------------------------------

type ProviderType = "copilot" | "anthropic" | "openai";

interface ByokContext {
  provider: ProviderType;
  apiKey?: string;
  anthropicApiKey?: string;
  openaiApiKey?: string;
}

/**
 * Determine which provider (Copilot, Anthropic, or OpenAI) to use based on
 * available BYOK keys and model type. Returns the provider and key (if BYOK).
 */
function getProviderContext(
  model: string,
  anthropicApiKey?: string,
  openaiApiKey?: string
): ByokContext {
  const modelLower = model.toLowerCase();

  // Anthropic: use if Claude model and Anthropic key present
  if (modelLower.includes("claude") && anthropicApiKey) {
    return { provider: "anthropic", apiKey: anthropicApiKey, anthropicApiKey };
  }

  // OpenAI: use if GPT/o-series model and OpenAI key present
  if (/^(o1|o3|o4|gpt-5|gpt5|gpt-4|gpt-4o|gpt-3\.5)/.test(modelLower) && openaiApiKey) {
    return { provider: "openai", apiKey: openaiApiKey, openaiApiKey };
  }

  // Default: use Copilot
  return { provider: "copilot", anthropicApiKey, openaiApiKey };
}

/**
 * Get the API URL for the given provider and route.
 * BYOK providers use their standard endpoints; Copilot uses GitHub endpoint.
 */
function getProviderUrl(
  provider: ProviderType,
  route: ApiRoute
): string {
  switch (provider) {
    case "anthropic":
      return "https://api.anthropic.com/v1/messages";
    case "openai":
      return "https://api.openai.com/v1/chat/completions";
    default:
      // Copilot or fallback
      return getApiUrl(route);
  }
}

/**
 * Build request headers for the given provider type.
 * Different providers require different Authorization headers and metadata.
 */
function buildProviderHeaders(
  provider: ProviderType,
  apiKey: string,
  requestId: string,
  extra?: Record<string, string>
): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Request-Id": requestId,
  };

  switch (provider) {
    case "anthropic":
      headers.Authorization = `Bearer ${apiKey}`;
      headers["anthropic-version"] = "2023-06-01";
      if (extra?.["anthropic-beta"]) {
        headers["anthropic-beta"] = extra["anthropic-beta"];
      }
      break;
    case "openai":
      headers.Authorization = `Bearer ${apiKey}`;
      headers["User-Agent"] = "Copilot/1.0";
      break;
    case "copilot":
      // Copilot-specific headers
      headers.Authorization = `Bearer ${apiKey}`;
      headers["X-Interaction-Type"] = "conversation-panel";
      headers["OpenAI-Intent"] = "conversation-panel";
      headers["X-GitHub-Api-Version"] = "2025-05-01";
      headers["Editor-Version"] = "vscode/1.100.0";
      headers["Editor-Plugin-Version"] = "copilot-chat/1.300.0";
      headers["Copilot-Integration-Id"] = "vscode-chat";
      headers["User-Agent"] = "Assistent/1.0";
      headers["VScode-SessionId"] = SESSION_ID;
      headers["VScode-MachineId"] = MACHINE_ID;
      if (extra) Object.assign(headers, extra);
      break;
  }

  return headers;
}

// --- Node-compatible AbortSignal combiner (AbortSignal.any requires Node 20.3+) --
function combineSignals(signals: AbortSignal[]): AbortSignal {
  if (typeof (AbortSignal as unknown as { any?: unknown }).any === "function") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (AbortSignal as any).any(signals) as AbortSignal;
  }
  const ctrl = new AbortController();
  for (const sig of signals) {
    if (sig.aborted) { ctrl.abort(sig.reason); return ctrl.signal; }
    sig.addEventListener("abort", () => ctrl.abort(sig.reason), { once: true });
  }
  return ctrl.signal;
}

// --- Common Copilot request headers ------------------------------------------

function copilotHeaders(copilotToken: string, requestId: string, extra?: Record<string, string>): Record<string, string> {
  return {
    Authorization: `Bearer ${copilotToken}`,
    "Content-Type": "application/json",
    "X-Request-Id": requestId,
    "X-Interaction-Type": "conversation-panel",
    "OpenAI-Intent": "conversation-panel",
    "X-GitHub-Api-Version": "2025-05-01",
    "Editor-Version": "vscode/1.100.0",
    "Editor-Plugin-Version": "copilot-chat/1.300.0",
    "Copilot-Integration-Id": "vscode-chat",
    "User-Agent": "Assistent/1.0",
    "VScode-SessionId": SESSION_ID,
    "VScode-MachineId": MACHINE_ID,
    ...extra,
  };
}

// --- Tool activation ----------------------------------------------------------

function getToolsForMode(
  mode: string, 
  enableTools = true, 
  screenContext?: ScreenContext,
  sshCredentials?: RequestBody['sshCredentials']
): ToolDefinition[] {
  if (!enableTools) return [];
  // Only send tools in Agent/Edit mode � in Ask mode the model will attempt
  // tool calls we cannot fulfil (no VS Code context), leaving every reply blank.
  let names: string[];
  switch (mode) {
    case "Agent":
      names = TOOL_SETS.agent;
      break;
    case "Edit":
      names = [...TOOL_SETS.read, ...TOOL_SETS.edit];
      break;
    default:
      return []; // Ask / Explain / etc. ? no tools
  }
  const tools = TOOL_DEFINITIONS.filter((t) => names.includes(t.name));
  
  // Add COBOL tools when:
  // 1. screenContext is present (connected to mainframe via TN3270)
  // 2. sshCredentials are provided (direct mainframe access)
  // 3. In Agent mode (always include for mainframe agent capabilities)
  const hasMainframeAccess = 
    (screenContext && screenContext.screenType !== "DISCONNECTED") ||
    (sshCredentials && sshCredentials.host && sshCredentials.username) ||
    mode === "Agent";
  
  if (hasMainframeAccess) {
    const cobolTools = COBOL_TOOL_DEFINITIONS.map((tool) => ({
      type: "function" as const,
      name: tool.name || '',
      description: tool.description || '',
      parameters: tool.parameters || { type: "object", properties: {} },
    }));
    
    const zosTools = ZOS_TOOL_DEFINITIONS.map((tool) => ({
      type: "function" as const,
      name: tool.name || '',
      description: tool.description || '',
      parameters: tool.parameters || { type: "object", properties: {} },
    }));
    
    const allTools = [...tools, ...cobolTools, ...zosTools];
    return allTools.filter((t): t is typeof t & { name: string } => 
      typeof t.name === 'string' && t.name.trim().length > 0
    ) as ToolDefinition[];
  }
  
  return tools;
}

// --- Build request bodies per API type ---------------------------------------

function buildCompletionsBody(
  model: string,
  messages: ChatMessage[],
  stream: boolean,
  temperature: number,
  mode: string,
  maxOutputTokens?: number,
  enableTools = true,
  screenContext?: ScreenContext,
  sshCredentials?: RequestBody['sshCredentials']
) {
  const tools = getToolsForMode(mode, enableTools, screenContext, sshCredentials);
  return {
    model,
    messages,
    stream,
    temperature,
    max_tokens: maxOutputTokens ?? 4096,
    stream_options: stream ? { include_usage: true } : undefined,
    ...(tools.length > 0 ? { tools: toOpenAITools(tools), tool_choice: "auto" } : {}),
  };
}

function buildResponsesBody(
  model: string,
  messages: ChatMessage[],
  stream: boolean,
  temperature: number,
  mode: string,
  previousResponseId?: string,
  enableTools = true,
  screenContext?: ScreenContext,
  sshCredentials?: RequestBody['sshCredentials']
) {
  const tools = getToolsForMode(mode, enableTools, screenContext, sshCredentials);
  const systemMsg = messages.find((m) => m.role === "system");
  const userMessages = messages.filter((m) => m.role !== "system");
  return {
    model,
    input: userMessages,
    ...(systemMsg ? { instructions: systemMsg.content } : {}),
    stream,
    // ?? o1/o3 models don't support temperature parameter
    reasoning: { effort: "medium", summary: "auto" },
    truncation: "auto",
    include: ["reasoning.encrypted_content"],
    ...(previousResponseId ? { previous_response_id: previousResponseId } : {}),
    ...(tools.length > 0 ? { tools: toOpenAITools(tools), tool_choice: "auto" } : {}),
  };
}

function buildMessagesBody(
  model: string,
  messages: ChatMessage[],
  stream: boolean,
  temperature: number,
  mode: string,
  thinkingBudgetTokens = 0,
  maxOutputTokens?: number,
  enableTools = true,
  screenContext?: ScreenContext,
  sshCredentials?: RequestBody['sshCredentials']
) {
  const systemMsg = messages.find((m) => m.role === "system");
  const nonSystem = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role,
      content: typeof m.content === "string"
        ? [{ type: "text", text: m.content }]
        : m.content,
    }));
  const tools = getToolsForMode(mode, enableTools, screenContext, sshCredentials);
  // Extended thinking: when budget > 0, enable thinking block.
  // Anthropic requires temperature === 1 when thinking is active.
  const useThinking = thinkingBudgetTokens > 0;
  const defaultMaxTokens = maxOutputTokens ?? 8192;
  return {
    model,
    messages: nonSystem,
    ...(systemMsg ? { system: [{ type: "text", text: systemMsg.content }] } : {}),
    stream,
    temperature: useThinking ? 1 : temperature,
    max_tokens: useThinking
      ? Math.max(thinkingBudgetTokens + 4096, 16384)   // output cap must exceed budget
      : defaultMaxTokens,
    ...(useThinking ? { thinking: { type: "enabled", budget_tokens: thinkingBudgetTokens } } : {}),
    ...(tools.length > 0 ? { tools: toAnthropicTools(tools), tool_choice: { type: "auto" } } : {}),
  };
}

// --- System prompt construction -----------------------------------------------

function buildSystemMessage(
  mode: string,
  slashCommand: string | undefined,
  customInstructions: string | undefined,
  useCodebase: boolean,
  memory: boolean,
  contextFiles: boolean,
  memoriesContext?: string[],
  followUpSuggestions?: boolean,
  webSearchContext?: string,
  screenContext?: ScreenContext,
  inputMode?: PromptOptions["inputMode"],
  userMessage?: string,
  // --- FIX #2: Model-aware prompts ---
  model?: string,
  modelCapabilities?: { supportsThinking?: boolean; supportsVision?: boolean; supportsTools?: boolean }
): string {
  const os = "Windows";
  const date = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // -- Mainframe mode: if a live screen context was provided, use the
  // Master Brain Prompt instead of the generic panel prompt.
  if (screenContext && screenContext.screenType !== "DISCONNECTED") {
    return buildMainframeCopilotPrompt(screenContext, { inputMode, userMessage });
  }

  if (slashCommand && !["ask", "clear", "compact", "remember"].includes(slashCommand)) {
    const { system, instruction } = getSystemPromptForCommand(
      slashCommand as SlashCommand,
      os,
      date,
      customInstructions,
      // --- FIX #3: Pass model and capabilities to prompt selection ---
      model,
      modelCapabilities
    );
    return instruction ? `${system}\n\n${instruction}` : system;
  }

  const base = useCodebase
    ? buildPanelBaseSystemWithCodebase(os, date, customInstructions)
    : buildPanelBaseSystem(os, date, customInstructions);

  const extras: string[] = [];
  if (memory) {
    extras.push("Memory is enabled. Proactively remember user preferences, names, and past context mentioned in prior messages to give personalised responses.");
  }
  if (contextFiles) {
    extras.push("Context Files are enabled. You may reference file paths and editor context provided by the user in your responses.");
  }

  // Inject stored memory facts
  if (memoriesContext && memoriesContext.length > 0) {
    const lines = memoriesContext.map((f) => `- ${f}`).join("\n");
    extras.push(`## Remembered Facts (from user's persistent memory)\nUse these to personalise your responses:\n${lines}`);
    
    // If user's name is in the stored memories, add a reminder to use it
    const hasUserName = memoriesContext.some((f) => f.toLowerCase().includes('user\'s name') || f.toLowerCase().includes('name is'));
    if (hasUserName) {
      extras.push(`### Important: Use Stored User Identity\nIf the user asks you questions about their own information (like their name), refer to the remembered facts above. Do NOT attempt to look up this information from system credentials or external services. When asked "What is my name?" respond with the name they provided to you.`);
    }
  }

  // Inject web search results
  if (webSearchContext) {
    extras.push(`## Web Search Results\nThe following search results were retrieved to help answer the user's question. Use them as supporting context:\n${webSearchContext}`);
  }

  // Follow-up suggestions
  if (followUpSuggestions && !slashCommand) {
    extras.push(FOLLOW_UP_INSTRUCTIONS);
  }

  const extraBlock = extras.length > 0 ? `\n\n${extras.join("\n\n")}` : "";

  if (mode === "Agent") {
    return `${base}${extraBlock}\n\n${AGENT_BASE_INSTRUCTIONS}`;
  }
  return `${base}${extraBlock}`;
}

// --- SSE streaming helpers ----------------------------------------------------

/** Stream OpenAI Chat Completions format (delta.content) */
async function streamOpenAI(
  apiRes: Response,
  controller: ReadableStreamDefaultController
) {
  const reader = apiRes.body?.getReader();
  if (!reader) { controller.close(); return; }
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      let stop = false;
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const payload = line.slice(6).trim();
        if (payload === "[DONE]") { stop = true; break; }
        try {
          const chunk = JSON.parse(payload);
          const text = chunk.choices?.[0]?.delta?.content;
          if (text) {
            controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ text })}\n\n`));
            // Throttle: 20ms between text chunks prevents TCP buffering and improves UX
            await new Promise(resolve => setTimeout(resolve, 1));
          }
          const toolCallsDelta = chunk.choices?.[0]?.delta?.tool_calls;
          if (toolCallsDelta) {
            for (const tc of toolCallsDelta) {
              if (tc.function?.name) {
                controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ tool_call_start: { id: tc.id ?? `tc-${tc.index}`, name: tc.function.name } })}\n\n`));
              }
            }
          }
          if (chunk.usage?.prompt_tokens) {
            controller.enqueue(new TextEncoder().encode(
              `data: ${JSON.stringify({ usage: { input: chunk.usage.prompt_tokens, output: chunk.usage.completion_tokens ?? 0 } })}\n\n`
            ));
          }
        } catch { /* skip malformed */ }
      }
      if (stop) break;
    }
  } finally {
    try { controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n")); } catch { /* already closed */ }
    try { await reader.cancel(); } catch { /* ignore */ }
    reader.releaseLock();
    try { controller.close(); } catch { /* already closed */ }
  }
}

/** Stream OpenAI Responses API format (response.output_text.delta events) */
async function streamResponses(
  apiRes: Response,
  controller: ReadableStreamDefaultController
) {
  const reader = apiRes.body?.getReader();
  if (!reader) { controller.close(); return; }
  const decoder = new TextDecoder();
  let buffer = "";
  let usage = { input: 0, output: 0 };
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      let stop = false;
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const payload = line.slice(6).trim();
        if (payload === "[DONE]") { stop = true; break; }
        try {
          const event = JSON.parse(payload);
          if (event.type === "response.output_item.added" && event.item?.type === "reasoning") {
            controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ thinking_start: true })}\n\n`));
          }
          if (event.type === "response.reasoning_summary_text.delta" && event.delta) {
            controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ thinking: event.delta })}\n\n`));
            // Throttle: 15ms between thinking chunks
            await new Promise(resolve => setTimeout(resolve, 1));
          }
          if (event.type === "response.output_text.delta" && event.delta) {
            controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ text: event.delta })}\n\n`));
            // Throttle: 20ms between text chunks prevents TCP buffering and improves UX
            await new Promise(resolve => setTimeout(resolve, 1));
          }
          if (event.type === "response.done") {
            if (event.response?.usage) {
              usage.input = event.response.usage.input_tokens ?? 0;
              usage.output = event.response.usage.output_tokens ?? 0;
              controller.enqueue(new TextEncoder().encode(
                `data: ${JSON.stringify({ usage })}\n\n`
              ));
            }
            if (event.response?.id) {
              controller.enqueue(new TextEncoder().encode(
                `data: ${JSON.stringify({ response_id: event.response.id })}\n\n`
              ));
            }
          }
        } catch { /* skip malformed */ }
      }
      if (stop) break;
    }
  } finally {
    try { controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n")); } catch { /* already closed */ }
    try { await reader.cancel(); } catch { /* ignore */ }
    reader.releaseLock();
    try { controller.close(); } catch { /* already closed */ }
  }
}

async function streamAnthropic(
  apiRes: Response,
  controller: ReadableStreamDefaultController,
  sendDone: boolean = true
) {
  const reader = apiRes.body?.getReader();
  if (!reader) { if (sendDone) controller.close(); return; }
  const decoder = new TextDecoder();
  let buffer = "";
  let inputTokens = 0;
  let outputTokens = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      let stop = false;
      for (const line of lines) {
        // Anthropic sends event type as "event: message_stop" (not data:)
        if (line.startsWith("event: ") && line.includes("message_stop")) {
          stop = true;
        }
        if (!line.startsWith("data: ")) continue;
        const payload = line.slice(6).trim();
        try {
          const event = JSON.parse(payload);
          if (event.type === "message_stop") {
            stop = true;
          }
          if (event.type === "message_start" && event.message?.usage) {
            inputTokens = event.message.usage.input_tokens ?? 0;
            outputTokens = event.message.usage.output_tokens ?? 0;
          }
          if (event.type === "message_delta" && event.usage?.output_tokens) {
            outputTokens = event.usage.output_tokens;
          }
          if (event.type === "content_block_start") {
            if (event.content_block?.type === "thinking") {
              controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ thinking_start: true })}\n\n`));
            }
            if (event.content_block?.type === "tool_use") {
              controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ tool_call_start: event.content_block })}\n\n`));
            }
          }
          if (event.type === "content_block_delta") {
            if (event.delta?.type === "text_delta" && event.delta.text) {
              controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`));
              await new Promise(resolve => setTimeout(resolve, 1));
            }
            if (event.delta?.type === "thinking_delta" && event.delta.thinking) {
              controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ thinking: event.delta.thinking })}\n\n`));
              await new Promise(resolve => setTimeout(resolve, 1));
            }
            if (event.delta?.type === "redacted_thinking") {
              controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ thinking: "\u{1f6ab}[thinking block redacted by safety filter]" })}\n\n`));
            }
          }
        } catch { /* skip malformed */ }
      }
      if (stop) break;
    }
    // Emit usage
    controller.enqueue(new TextEncoder().encode(
      `data: ${JSON.stringify({ usage: { input: inputTokens, output: outputTokens } })}\n\n`
    ));
  } finally {
    try { await reader.cancel(); } catch { /* ignore */ }
    reader.releaseLock();
    if (sendDone) {
      try { controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n")); } catch { /* already closed */ }
      try { controller.close(); } catch { /* already closed */ }
    }
  }
}

/**
 * Stream Anthropic response while capturing tool calls for execution.
 * This allows us to execute tools on the server and send follow-up requests.
 */
async function streamAnthropicWithToolCapture(
  apiRes: Response,
  controller: ReadableStreamDefaultController,
  toolCalls: Array<{ id: string; name: string; input: Record<string, unknown> }>,
  assistantToolUseBlocks: Array<{ type: string; id: string; name: string; input: Record<string, unknown> }>,
  onTextChunk?: (text: string) => void
) {
  const reader = apiRes.body?.getReader();
  if (!reader) { controller.close(); return; }
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";
  let inputTokens = 0;
  let outputTokens = 0;
  
  // Track current tool call being built
  let currentToolCall: { id: string; name: string; inputJson: string } | null = null;
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      
      let stop = false;
      for (const line of lines) {
        // Anthropic sends event type as "event: message_stop" (not data:)
        if (line.startsWith("event: ") && line.includes("message_stop")) {
          stop = true;
        }
        if (!line.startsWith("data: ")) continue;
        const payload = line.slice(6).trim();
        try {
          const event = JSON.parse(payload);
          if (event.type === "message_stop") {
            stop = true;
          }
          
          if (event.type === "message_start" && event.message?.usage) {
            inputTokens = event.message.usage.input_tokens ?? 0;
            outputTokens = event.message.usage.output_tokens ?? 0;
          }
          if (event.type === "message_delta" && event.usage?.output_tokens) {
            outputTokens = event.usage.output_tokens;
          }
          
          // Capture tool_use start
          if (event.type === "content_block_start" && event.content_block?.type === "tool_use") {
            currentToolCall = {
              id: event.content_block.id || `tc-${toolCalls.length}`,
              name: event.content_block.name || '',
              inputJson: '',
            };
            // Forward to frontend
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ tool_call_start: { id: currentToolCall.id, name: currentToolCall.name } })}\n\n`));
          }

          // Send thinking_start for thinking blocks
          if (event.type === "content_block_start" && event.content_block?.type === "thinking") {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ thinking_start: true })}\n\n`));
          }
          
          // Capture tool input delta
          if (event.type === "content_block_delta" && event.delta?.type === "input_json_delta" && currentToolCall) {
            currentToolCall.inputJson += event.delta.partial_json || '';
          }
          
          // Capture tool_use stop - finalize the tool call
          if (event.type === "content_block_stop" && currentToolCall && currentToolCall.inputJson) {
            try {
              const input = currentToolCall.inputJson ? JSON.parse(currentToolCall.inputJson) : {};
              toolCalls.push({ id: currentToolCall.id, name: currentToolCall.name, input });
              // Also build the Anthropic-format tool_use block for the follow-up
              assistantToolUseBlocks.push({ type: 'tool_use', id: currentToolCall.id, name: currentToolCall.name, input });
            } catch {
              toolCalls.push({ id: currentToolCall.id, name: currentToolCall.name, input: {} });
              assistantToolUseBlocks.push({ type: 'tool_use', id: currentToolCall.id, name: currentToolCall.name, input: {} });
            }
            currentToolCall = null;
          }
          
          // Stream text content
          if (event.type === "content_block_delta") {
            if (event.delta?.type === "text_delta" && event.delta.text) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`));
              if (onTextChunk) onTextChunk(event.delta.text);
              await new Promise(resolve => setTimeout(resolve, 1));
            }
            if (event.delta?.type === "thinking_delta" && event.delta.thinking) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ thinking: event.delta.thinking })}\n\n`));
              await new Promise(resolve => setTimeout(resolve, 1));
            }
          }
        } catch { /* skip malformed */ }
      }
      if (stop) break;
    }
    
    // Emit usage
    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ usage: { input: inputTokens, output: outputTokens } })}\n\n`));
  } finally {
    // Do NOT send [DONE] here - let the main stream handle it
    try { await reader.cancel(); } catch { /* ignore */ }
    reader.releaseLock();
    // Do NOT close controller here - follow-up stream may need it
  }
}

// --- Main handler -------------------------------------------------------------

export async function POST(req: NextRequest) {
  // --- RATE LIMITING: Enforce API limits -----------------------------------
  const rateLimitResult = await enforceRateLimit(req);
  if (rateLimitResult.response) return rateLimitResult.response;

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized � please sign in with GitHub" }, { status: 401 });
  }

  let body: RequestBody;
  try {
    body = await req.json() as RequestBody;
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Invalid request body: " + errorMsg }, { status: 400 });
  }

  const {
    messages,
    model,
    mode = "Ask",
    temperature = 1.0,
    customInstructions,
    stream = true,
    slashCommand,
    useCodebase = false,
    memory = false,
    contextFiles = false,
    previousResponseId,
    thinkingBudgetTokens: rawThinkingBudget = 0,
    maxOutputTokens,
    enableTools = true,
    // --- FIX #1: Extract model capabilities from request ---
    modelCapabilities,
    imageAttachments,
    memoriesContext,
    followUpSuggestions = false,
    webSearchContext,
    screenContext,
    inputMode,
    settings,
    sshCredentials,
  } = body;
  // Enforce Anthropic minimum of 1,024 tokens; 0 means disabled
  // --- FIX #6: Auto-enable extended thinking for complex tasks ---
  // For reasoning models with complex mainframe tasks, auto-enable thinking
  let thinkingBudgetTokens = rawThinkingBudget > 0
    ? Math.max(rawThinkingBudget, 1024)
    : 0;
  
  // Performance: DISABLED auto-enable thinking - adds 2-5s per request
  // Only enable thinking if user explicitly requests it via thinkingBudgetTokens setting
  // if (thinkingBudgetTokens === 0 && modelCapabilities?.supportsThinking) {
  //   const complexCommands = ["jcl", "cobol", "fix", "review"];
  //   if (slashCommand && complexCommands.includes(slashCommand)) {
  //     thinkingBudgetTokens = 4096;
  //     console.log(`[Chat] Auto-enabled extended thinking for /${slashCommand} on reasoning model`);
  //   }
  // }

  // --- Determine provider and auth -------------------------------------------
  let byokContext: ByokContext;
  let authToken: string;
  
  byokContext = getProviderContext(model, settings?.anthropicApiKey, settings?.openaiApiKey);
  
  if (byokContext.provider === "copilot") {
    // Copilot internal API doesn't work from third-party OAuth apps (returns 404)
    // Try it anyway, but fall back to error with clear instructions
    try {
      authToken = await getCopilotToken(session!.github_token);
      console.log('[Chat] Got Copilot token');
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error('[Chat] Copilot token exchange failed:', errMsg);
      return NextResponse.json({
        error: `Copilot API is not accessible from third-party apps. Please use a direct API key instead.`,
        hint: "Add ANTHROPIC_API_KEY or OPENAI_API_KEY to your .env.local file, then restart the server.",
        details: errMsg,
      }, { status: 401 });
    }
  } else {
    authToken = byokContext.apiKey || "";
    if (!authToken) {
      return NextResponse.json(
        {
          error: `No API key configured for provider "${byokContext.provider}".`,
          hint: `Add ${byokContext.provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY'} to your .env.local file.`,
        },
        { status: 401 }
      );
    }
  }

  // Build system message with error handling
  let systemContent: string;
  try {
    systemContent = buildSystemMessage(
      mode, 
      slashCommand, 
      customInstructions, 
      useCodebase, 
      memory, 
      contextFiles, 
      memoriesContext, 
      followUpSuggestions, 
      webSearchContext, 
      screenContext, 
      inputMode, 
      messages.at(-1)?.content as string | undefined,
      // --- FIX #2: Pass model and capabilities ---
      model,
      modelCapabilities
    );
    console.log('[Chat] System message built successfully, length:', systemContent.length);
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    console.error('[Chat] Failed to build system message:', error, 'stack:', err instanceof Error ? err.stack : 'N/A');
    return NextResponse.json({ error: "Failed to build system message: " + error }, { status: 500 });
  }

  // -- Inject image attachments into the last user message ------------------
  let processedMessages = [...messages];
  if (imageAttachments && imageAttachments.length > 0) {
    const lastUserIdx = [...processedMessages].map((m, i) => ({ m, i })).reverse().find(({ m }) => m.role === "user")?.i;
    if (lastUserIdx !== undefined) {
      const lastUser = processedMessages[lastUserIdx];
      const isClaudeModel = model.toLowerCase().includes("claude");
      if (isClaudeModel) {
        // Anthropic vision: array of content blocks
        const textBlocks: AnthropicContent[] = [];
        
        // Add text content only if it's non-empty
        const text = typeof lastUser.content === "string" ? lastUser.content : "";
        if (text.trim()) {
          textBlocks.push({ type: "text", text });
        }
        
        // Add image blocks
        const imageBlocks: AnthropicContent[] = imageAttachments.map((img) => ({
          type: "image",
          source: { type: "base64", media_type: img.mimeType, data: img.base64 },
        }));
        
        // Combine: images first, then text
        const contentBlocks = [...imageBlocks, ...textBlocks];
        
        // If we have no content blocks at all, keep original text
        if (contentBlocks.length === 0) {
          // No images uploaded or no text - keep original
          processedMessages = processedMessages.map((m, i) =>
            i === lastUserIdx
              ? { ...m, content: text || "[empty message]" }
              : m
          );
        } else {
          processedMessages = processedMessages.map((m, i) =>
            i === lastUserIdx
              ? { ...m, content: contentBlocks as AnthropicContent[] }
              : m
          );
        }
      } else {
        // OpenAI vision: content array with image_url items
        const textContent = typeof lastUser.content === "string" ? lastUser.content : "";
        const contentArr: (OpenAITextContent | OpenAIImageContent)[] = [
          { type: "text", text: textContent || "[empty message]" },
          ...imageAttachments.map((img) => ({
            type: "image_url" as const,
            image_url: { url: `data:${img.mimeType};base64,${img.base64}` },
          })),
        ];
        processedMessages = processedMessages.map((m, i) =>
          i === lastUserIdx ? { ...m, content: contentArr as unknown as string } : m
        );
      }
    }
  }

  const allMessages: ChatMessage[] = [
    { role: "system", content: systemContent },
    ...processedMessages.filter(m => {
      // Filter out messages with empty content
      const content = m.content;
      if (typeof content === "string") {
        const hasContent = content.trim().length > 0;
        if (!hasContent) {
          console.log('[Chat] Filtering out empty message:', m.role);
        }
        return hasContent;
      } else if (Array.isArray(content)) {
        // For content arrays, check if there's at least one non-empty block
        const hasContent = content.some(block => {
          if (block.type === "text" && block.text) {
            return (block as any).text.trim().length > 0;
          }
          return true; // images, etc are OK
        });
        if (!hasContent) {
          console.log('[Chat] Filtering out message with no non-empty content blocks:', m.role);
        }
        return hasContent;
      }
      return true;
    })
  ];

  console.log('[Chat] allMessages length:', allMessages.length, 'structure:');
  allMessages.forEach((m, i) => {
    const contentPreview = typeof m.content === "string" 
      ? m.content.substring(0, 50) 
      : Array.isArray(m.content) 
        ? `[array with ${m.content.length} blocks]` 
        : "?";
    console.log(`  [${i}] role=${m.role}, content=${contentPreview}`);
  });
  console.log('[Chat] About to build request body...');

  const route = getApiRoute(model);
  const apiUrl = getProviderUrl(byokContext.provider, route);
  const requestId = randomUUID();

  // When connected to a mainframe, keep tools enabled � z/OS tools (read dataset,
  // list jobs, etc.) can be executed via SSH. Only suppress tools in Ask mode
  // where no execution context is available.
  const isMainframeConnected = !!(screenContext?.screenType && screenContext.screenType !== "DISCONNECTED");
  const effectiveEnableTools = enableTools;
  // Agentic mainframe actions require determinism: writing to row/col, submitting JCL,
  // or sending a keystroke with temperature=1.0 introduces needless randomness and can
  // produce wrong coordinates or incorrect commands. Cap at 0.1 when connected.
  const effectiveTemperature = isMainframeConnected ? Math.min(temperature, 0.1) : temperature;

  // --- Build request body appropriate for provider --------------------------
  // For BYOK OpenAI (including o1/o3), always use completions format
  // For BYOK Anthropic (Claude), use messages format
  // For Copilot proxy: route based on model type (Claude?messages, o-series?responses, etc)
  let requestBody: unknown;
  let effectiveRoute = route;
  try {
    if (byokContext.provider === "openai") {
      // OpenAI BYOK always uses chat/completions endpoint
      effectiveRoute = "completions";
      requestBody = buildCompletionsBody(model, allMessages, stream, effectiveTemperature, mode, maxOutputTokens, effectiveEnableTools, screenContext, sshCredentials);
    } else {
      // Anthropic BYOK or Copilot: use route-specific body builders
      // Both providers support Anthropic API features (thinking, tools format, etc.)
      switch (route) {
        case "messages":
          // Claude model: include extended thinking budget if set
          requestBody = buildMessagesBody(model, allMessages, stream, effectiveTemperature, mode, thinkingBudgetTokens, maxOutputTokens, effectiveEnableTools, screenContext, sshCredentials);
          break;
        case "responses":
          // o1/o3 models: reasoning is handled at the model level, not via requests
          requestBody = buildResponsesBody(model, allMessages, stream, effectiveTemperature, mode, previousResponseId, effectiveEnableTools, screenContext, sshCredentials);
          break;
        default:
          // Other models: standard completions
          requestBody = buildCompletionsBody(model, allMessages, stream, effectiveTemperature, mode, maxOutputTokens, effectiveEnableTools, screenContext, sshCredentials);
      }
    }
    console.log('[Chat] Request body built successfully');
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[Chat] Failed to build request body:', errorMsg);
    return NextResponse.json({ error: "Failed to build request: " + errorMsg }, { status: 400 });
  }

  // --- Agent Mode: Execute Agentic Loop with Tools -------------------------
  // If in Agent mode with SSH credentials, use the agentic loop for tool execution
  // instead of a single API call. This enables iterative tool calling and execution.
  if (mode === "Agent" && sshCredentials?.host && sshCredentials?.username) {
    console.log('[Chat] Agent mode with SSH credentials detected - using agentic loop');
    
    try {
      const userMessage = messages.at(-1)?.content as string | undefined;
      if (!userMessage) {
        return NextResponse.json({ error: "No user message found for agent mode" }, { status: 400 });
      }
      
      // Pass full conversation history for context awareness
      const conversationHistory = processedMessages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({ role: m.role, content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }));
      
      const agentConfig: AgentConfig = {
        credentials: sshCredentials,
        model,
        temperature: effectiveTemperature,
        maxIterations: 10,
        maxFiles: 50
      };
      
      const agentResult = await runAgenticLoop(userMessage, agentConfig, screenContext, conversationHistory);
      
      console.log('[Chat] Agentic loop completed:', {
        success: agentResult.success,
        iterations: agentResult.iterations,
        toolCallsCount: agentResult.toolCalls?.length || 0
      });
      
      if (!agentResult.success) {
        console.error('[Chat] Agent mode failed:', agentResult);
        const errorMessage = agentResult.error || agentResult.message || 'Unknown agent error';
        return NextResponse.json(
          { 
            error: `Agent mode error: ${errorMessage}`,
            details: agentResult
          },
          { status: 400 }  // Use 400 for client errors instead of 500
        );
      }
      
      // Stream agentic results with character-by-character streaming
      if (stream) {
        const readable = new ReadableStream({
          async start(controller) {
            const encoder = new TextEncoder();
            
            try {
              // Stream tool calls with results (all completed by this point)
              if (agentResult.toolCalls && agentResult.toolCalls.length > 0) {
                for (const toolCall of agentResult.toolCalls) {
                  const resultText = toolCall.output || "";
                  const toolState = toolCall.state || "done";
                  controller.enqueue(encoder.encode(
                    `data: ${JSON.stringify({
                      tool_call_start: {
                        id: toolCall.id,
                        name: toolCall.name,
                        result: resultText.substring(0, 500),
                        state: toolState,
                      }
                    })}\n\n`
                  ));
                }
              }
              
              // Stream thinking blocks
              if (agentResult.thinking) {
                controller.enqueue(encoder.encode(
                  `data: ${JSON.stringify({ thinking_start: true })}\n\n`
                ));
                // Stream thinking in large chunks (no artificial delay)
                const thinkingText = agentResult.thinking;
                const chunkSize = 200;
                for (let i = 0; i < thinkingText.length; i += chunkSize) {
                  const chunk = thinkingText.slice(i, i + chunkSize);
                  controller.enqueue(encoder.encode(
                    `data: ${JSON.stringify({ thinking: chunk })}\n\n`
                  ));
                }
              }

              // Stream the final content in large chunks (no artificial delay)
              if (agentResult.finalContent) {
                const fullText = agentResult.finalContent;
                const chunkSize = 200;

                for (let i = 0; i < fullText.length; i += chunkSize) {
                  const chunk = fullText.slice(i, i + chunkSize);
                  controller.enqueue(encoder.encode(
                    `data: ${JSON.stringify({ text: chunk })}\n\n`
                  ));
                }
              }
              
              // Final usage info
              controller.enqueue(encoder.encode(
                `data: ${JSON.stringify({ usage: { iterations: agentResult.iterations } })}\n\n`
              ));
              
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              controller.close();
            } catch (err) {
              console.error('[Chat] Error streaming agentic results:', err);
              try {
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              } catch {}
              controller.close();
            }
          }
        });
        return new Response(readable, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive"
          }
        });
      } else {
        // Non-streaming response
        return NextResponse.json({
          content: agentResult.finalContent,
          thinking: agentResult.thinking,
          toolCalls: agentResult.toolCalls,
          iterations: agentResult.iterations
        });
      }
    } catch (agentErr: unknown) {
      const errMsg = agentErr instanceof Error ? agentErr.message : String(agentErr);
      console.error('[Chat] Agentic loop error:', errMsg, agentErr);
      return NextResponse.json({ error: "Agent execution failed: " + errMsg }, { status: 500 });
    }
  }

  // --- Add provider-specific headers -----------------------------------------
  // Extended thinking requires the anthropic-beta header when enabled
  const extraHeaders: Record<string, string> = {};
  if ((byokContext.provider === "anthropic" || route === "messages") && thinkingBudgetTokens > 0) {
    extraHeaders["anthropic-beta"] = "interleaved-thinking-2025-05-14";
  }

  console.log('[Chat] Calling API:', apiUrl, 'route:', effectiveRoute);
  let apiRes: Response;
  try {
    apiRes = await fetch(apiUrl, {
      method: "POST",
      headers: buildProviderHeaders(byokContext.provider, authToken, requestId, extraHeaders),
      body: JSON.stringify(requestBody),
      signal: combineSignals([req.signal, AbortSignal.timeout(90_000)]),
    });
    console.log('[Chat] API response status:', apiRes.status);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[Chat] API call failed:', errorMsg, 'err details:', err);
    return NextResponse.json({ error: "API call failed: " + errorMsg }, { status: 502 });
  }

  if (!apiRes.ok) {
    const errBody = await apiRes.text();
    console.error('[Chat] API error response:', 'status:', apiRes.status, 'body:', errBody);
    if (apiRes.status === 401 && byokContext.provider === "copilot" && session?.github_token) {
      invalidateCopilotToken(session.github_token);
    }
    // Parse error message based on provider
    let apiMsg = errBody;
    try {
      const parsed = JSON.parse(errBody) as { message?: string; error?: string | { message?: string } };
      apiMsg = parsed.message
        ?? (typeof parsed.error === "string" ? parsed.error : parsed.error?.message)
        ?? errBody;
    } catch { /* keep raw text */ }
    
    const providerName = byokContext.provider === "anthropic" ? "Anthropic" : byokContext.provider === "openai" ? "OpenAI" : "Copilot";
    const hint = apiRes.status === 404
      ? ` � model "${model}" may not be available on your ${providerName} plan. Try switching models in the picker.`
      : "";
    return NextResponse.json(
      { error: `${providerName} API error (${apiRes.status}): ${apiMsg}${hint}` },
      { status: apiRes.status }
    );
  }

  if (!stream) {
    const data = await apiRes.json() as {
      choices?: { message?: { content?: string } }[];
      content?: { text?: string }[];
      output?: { content?: { text?: string }[] }[];
    };
    let content = "";
    if (effectiveRoute === "messages") {
      content = data.content?.find((b) => b.text)?.text ?? "";
    } else if (effectiveRoute === "responses") {
      content = data.output?.[0]?.content?.[0]?.text ?? "";
    } else {
      content = data.choices?.[0]?.message?.content ?? "";
    }
    return NextResponse.json({ content });
  }

  // Import tool executor for SSH operations
  const { executeZosTool } = await import('@/lib/zos/tool-executor');
  const { getCredentialsFromRequest } = await import('@/lib/zos/credentials');

  const readable = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const collectedToolCalls: Array<{ id: string; name: string; input: Record<string, unknown> }> = [];
      let assistantContent = '';
      let assistantToolUseBlocks: Array<{ type: string; id: string; name: string; input: Record<string, unknown> }> = [];
      
      // Stream the initial response and collect tool calls
      if (route === "messages") {
        await streamAnthropicWithToolCapture(apiRes, controller, collectedToolCalls, assistantToolUseBlocks, (s) => { assistantContent += s; });
      } else if (route === "responses") {
        await streamResponses(apiRes, controller);
      } else {
        await streamOpenAI(apiRes, controller);
      }
      
      // If tool calls were collected, execute them and get follow-up response
      if (collectedToolCalls.length > 0) {
        console.log(`[Chat] Executing ${collectedToolCalls.length} tool call(s)...`);
        
        const toolResults: Array<{ type: string; tool_use_id: string; content: string }> = [];
        
        for (const toolCall of collectedToolCalls) {
          try {
            // Send tool execution event to frontend
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
              thinking: `\n?? Executing: ${toolCall.name}...`
            })}\n\n`));
            
            // Convert credentials format
            const creds = getCredentialsFromRequest({
              host: sshCredentials?.host,
              port: sshCredentials?.port,
              username: sshCredentials?.username,
              password: sshCredentials?.password,
            });
            
            // Execute the tool - handle file tools vs z/OS tools
            let result: { success: boolean; content: string; error?: string };
            
            if (toolCall.name === 'create_document' || toolCall.name === 'get_file_formats') {
              // File creation tool - call internal API
              const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3009';
              if (toolCall.name === 'get_file_formats') {
                result = {
                  success: true,
                  content: 'Supported formats: docx, xlsx, pdf, md, csv, json, txt, cob, jcl, sql. Files saved to FILE_DOWNLOAD_PATH env var.',
                };
              } else {
                const { format, title, content, filename, sections, table, sheets } = toolCall.input as {
                  format: string;
                  title: string;
                  content: string;
                  filename?: string;
                  sections?: Array<{ heading: string; content: string }>;
                  table?: { headers: string[]; rows: string[][] };
                  sheets?: Array<{ name: string; headers: string[]; rows: string[][] }>;
                };
                try {
                  const fileRes = await fetch(`${appUrl}/api/files/create`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ format, title, content, filename, sections, table, sheets }),
                  });
                  const fileData = await fileRes.json() as { success: boolean; filePath?: string; fileName?: string; fileSize?: number; error?: string };
                  result = fileData.success
                    ? { success: true, content: `Document created: ${fileData.fileName} at ${fileData.filePath} (${fileData.fileSize} bytes)` }
                    : { success: false, content: '', error: fileData.error || 'Failed to create document' };
                } catch (fileErr) {
                  result = { success: false, content: '', error: fileErr instanceof Error ? fileErr.message : 'File creation failed' };
                }
              }
            } else {
              // z/OS tool - execute via SSH
              result = await executeZosTool(toolCall.name, toolCall.input, creds);
            }
            
            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolCall.id,
              content: result.success ? result.content : `Error: ${result.error || result.content}`,
            });
            
            // Send result event to frontend
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
              thinking: result.success ? ` ? Done` : ` ? Failed: ${result.error}`
            })}\n\n`));
            
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolCall.id,
              content: `Error: ${errMsg}`,
            });
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
              thinking: ` ? Error: ${errMsg}`
            })}\n\n`));
          }
        }
        
        // Check if all tool calls failed
        const allFailed = toolResults.length > 0 && toolResults.every(r => r.content.startsWith('Error:'));
        
        if (allFailed) {
          // All tools failed — send a clear error to the user, skip follow-up
          const failedTools = collectedToolCalls.map(tc => tc.name).join(', ');
          const firstError = toolResults[0]?.content || 'Unknown error';
          const errorResponse = `I tried to call ${failedTools} but the tool execution failed.\n\n${firstError}\n\nPlease check your mainframe connection settings and try again.`;
          
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: errorResponse })}\n\n`));
          
        } else {
        // Build follow-up request with proper format for the provider
        // Anthropic: tool_use + tool_result content blocks
        // OpenAI: assistant tool_calls + tool role messages
        try {
          // Get non-system messages from the conversation
          const conversationMessages = allMessages.filter(m => m.role !== 'system');
          
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let followUpBody: any;
          
          if (route === "messages") {
            // -- Anthropic format ----------------------------------------
            const followUpMessages = [
              ...conversationMessages,
              { role: 'assistant', content: assistantToolUseBlocks },
              { role: 'user', content: toolResults },
            ];
            followUpBody = {
              model: (requestBody as Record<string, unknown>).model as string,
              max_tokens: (requestBody as Record<string, unknown>).max_tokens as number,
              temperature: (requestBody as Record<string, unknown>).temperature as number,
              system: (requestBody as Record<string, unknown>).system,
              messages: followUpMessages,
              stream: true,
            };
          } else {
            // -- OpenAI completions format ------------------------------
            // Build tool_calls array for the assistant message
            const assistantToolCalls = collectedToolCalls.map(tc => ({
              id: tc.id,
              type: "function" as const,
              function: {
                name: tc.name,
                arguments: JSON.stringify(tc.input),
              },
            }));
            // Build tool result messages
            const toolResultMessages = toolResults.map(tr => ({
              role: "tool" as const,
              tool_call_id: tr.tool_use_id,
              content: tr.content,
            }));
            const followUpMessages = [
              ...conversationMessages,
              { role: 'assistant', content: assistantContent || undefined, tool_calls: assistantToolCalls },
              ...toolResultMessages,
            ];
            followUpBody = {
              model: (requestBody as Record<string, unknown>).model as string,
              max_tokens: (requestBody as Record<string, unknown>).max_tokens as number,
              temperature: (requestBody as Record<string, unknown>).temperature as number,
              messages: followUpMessages,
              stream: true,
            };
          }
          
          const followUpRes = await fetch(apiUrl, {
            method: "POST",
            headers: buildProviderHeaders(byokContext.provider, authToken, randomUUID(), extraHeaders),
            body: JSON.stringify(followUpBody),
            signal: AbortSignal.timeout(120_000),
          });
          
          if (followUpRes.ok) {
            // Stream the follow-up response - do NOT send [DONE], we send it at the end
            if (route === "messages") {
              await streamAnthropic(followUpRes, controller, false);
            } else {
              await streamOpenAI(followUpRes, controller);
            }
          } else {
            const errText = await followUpRes.text();
            console.error('[Chat] Follow-up request failed:', followUpRes.status, errText);
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: '\n\n[Tool follow-up failed: ' + followUpRes.status + ']' })}\n\n`));
          }
        } catch (followUpErr) {
          console.error('[Chat] Follow-up request failed:', followUpErr);
          const errMsg = followUpErr instanceof Error ? followUpErr.message : 'Connection error';
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: `\n\nI executed the tool but the follow-up request failed: ${errMsg}. Please try again.` })}\n\n`));
        }
        } // end else (not all failed)
      }
      
      // Send final [DONE] only once at the very end
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      try { controller.close(); } catch { /* already closed */ }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
