/**
 * Agentic Loop — Autonomous multi-step tool execution.
 *
 * The loop:
 * 1. Send user message + tools to AI model
 * 2. If model returns tool calls → execute them
 * 3. Feed tool results back to model
 * 4. Repeat until model responds with text only (no more tools)
 */

import { randomUUID } from 'crypto';
import { buildMainframeCopilotPrompt, type ScreenContext } from '@/lib/ai/prompt';
import { COBOL_TOOL_DEFINITIONS } from '@/lib/cobol/tools';
import { ZOS_TOOL_DEFINITIONS } from '@/lib/zos/tools';
import { FILE_TOOL_DEFINITIONS } from '@/lib/files/tools';
import { executeCobolTool, type AgentContext } from '@/lib/cobol/agent';
import { executeBatch, type ToolCall as BatchToolCall } from '@/lib/batch';
import { toOpenAITools } from '@/lib/tools/definitions';
import { getCopilotToken } from '@/lib/auth/copilot-token';
import { getSession } from '@/lib/auth/session';

// ── Constants ──────────────────────────────────────────────────────────────

const LOOP_TIMEOUT_MS = 120_000;
const API_TIMEOUT_MS = 90_000;
const MAX_TOKENS = 8192;
const TAG = '[Agent]';

// ── Types ──────────────────────────────────────────────────────────────────

export interface AgentConfig {
  credentials: {
    host: string;
    port?: number;
    username: string;
    password?: string;
    privateKey?: string;
    passphrase?: string;
  };
  model: string;
  temperature?: number;
  maxIterations?: number;
  maxFiles?: number;
}

export interface AgentMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolCallId?: string;
  name?: string;
  toolCalls?: AgentToolCall[];
}

export interface AgentToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown> | string;
  output?: string;
  state?: 'running' | 'done' | 'error';
}

export interface AgentResult {
  success: boolean;
  message: string;
  finalContent?: string;
  thinking?: string;
  toolCalls?: AgentToolCall[];
  iterations: number;
  error?: string;
}

// ── Logger ─────────────────────────────────────────────────────────────────

function log(level: 'info' | 'warn' | 'error', msg: string, data?: unknown): void {
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  if (data !== undefined) {
    fn(`${TAG} ${msg}`, data);
  } else {
    fn(`${TAG} ${msg}`);
  }
}

// ── Tool validation ────────────────────────────────────────────────────────

interface NormalizedTool {
  type: 'function';
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

/** Filter out tools with empty/invalid names and normalize structure. */
function normalizeTools(rawTools: readonly Record<string, unknown>[]): NormalizedTool[] {
  return rawTools
    .filter((t) => {
      const name = typeof t?.name === 'string' ? t.name.trim() : '';
      return name.length > 0;
    })
    .map((t) => ({
      type: 'function' as const,
      name: (t.name as string).trim(),
      description: (t.description as string) || '',
      parameters: (t.parameters as Record<string, unknown>) || { type: 'object', properties: {} },
    }));
}

// ── SSE streaming parser ──────────────────────────────────────────────────

interface ParsedStream {
  content: string;
  thinking: string;
  toolCalls: AgentToolCall[];
}

/** Parse an SSE stream from either Claude or OpenAI into text + tool calls. */
async function parseSSEStream(body: ReadableStream<Uint8Array>): Promise<ParsedStream> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let content = '';
  let thinking = '';
  const toolCalls: AgentToolCall[] = [];
  let currentEvent = '';
  let currentData = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed) {
        if (currentData) {
          processSSEChunk(currentEvent, currentData, { content: (v) => content += v, thinking: (v) => thinking += v, toolCalls });
        }
        currentEvent = '';
        currentData = '';
        continue;
      }

      if (trimmed.startsWith('event: ')) {
        currentEvent = trimmed.slice(7).trim();
      } else if (trimmed.startsWith('data: ')) {
        currentData = trimmed.slice(6).trim();
      } else if (trimmed.startsWith('data:')) {
        currentData = trimmed.slice(5).trim();
      }
    }
  }

  // Process remaining data
  if (currentData) {
    processSSEChunk(currentEvent, currentData, { content: (v) => content += v, thinking: (v) => thinking += v, toolCalls });
  }

  // Normalize tool arguments from string to object
  for (const tc of toolCalls) {
    if (typeof tc.arguments === 'string' && tc.arguments.trim()) {
      try { tc.arguments = JSON.parse(tc.arguments); } catch { /* keep as string */ }
    }
  }

  return { content, thinking, toolCalls };
}

/** Process a single SSE event/data pair. */
function processSSEChunk(
  event: string,
  data: string,
  acc: { content: (v: string) => void; thinking: (v: string) => void; toolCalls: AgentToolCall[] }
): void {
  let chunk: Record<string, unknown>;
  try { chunk = JSON.parse(data); } catch { return; }

  // ── Claude format ──
  if (event === 'content_block_delta') {
    const delta = chunk.delta as Record<string, unknown> | undefined;
    if (delta?.type === 'text_delta' && delta.text) acc.content(delta.text as string);
    if (delta?.type === 'thinking_delta' && delta.thinking) acc.thinking(delta.thinking as string);
    if (delta?.type === 'input_json_delta') {
      const last = acc.toolCalls[acc.toolCalls.length - 1];
      if (last) {
        const incoming = (delta.partial_json || delta.input_json || '') as string;
        last.arguments = (typeof last.arguments === 'string' ? last.arguments : '') + incoming;
      }
    }
  }

  if (event === 'content_block_start') {
    const block = chunk.content_block as Record<string, unknown> | undefined;
    if (block?.type === 'tool_use') {
      acc.toolCalls.push({
        id: (block.id as string) || `tool-${acc.toolCalls.length}`,
        name: (block.name as string) || '',
        arguments: '',
      });
    }
  }

  // ── OpenAI format ──
  const choices = chunk.choices as Array<Record<string, unknown>> | undefined;
  if (choices?.[0]) {
    const delta = choices[0].delta as Record<string, unknown> | undefined;
    if (delta?.content) acc.content(delta.content as string);

    const tcArr = delta?.tool_calls as Array<Record<string, unknown>> | undefined;
    if (tcArr) {
      for (const tc of tcArr) {
        const fn = tc.function as Record<string, unknown> | undefined;
        if (fn?.name) {
          acc.toolCalls.push({
            id: (tc.id as string) || `tool-${acc.toolCalls.length}`,
            name: fn.name as string,
            arguments: (fn.arguments as string) || '',
          });
        } else if (fn?.arguments) {
          const last = acc.toolCalls[acc.toolCalls.length - 1];
          if (last) {
            last.arguments = (typeof last.arguments === 'string' ? last.arguments : '') + (fn.arguments as string);
          }
        }
      }
    }
  }
}

// ── File tool execution ────────────────────────────────────────────────────

async function executeFileTool(
  toolName: string,
  args: Record<string, unknown>
): Promise<{ success: boolean; content: string; error?: string }> {
  if (toolName === 'get_file_formats') {
    return {
      success: true,
      content: 'Supported formats: docx, xlsx, pdf, md, csv, json, txt, cob, jcl, sql. Files saved to your configured directory.', // Set via FILE_DOWNLOAD_PATH env var
    };
  }

  if (toolName === 'create_document') {
    const { format, title, content, filename, sections, table, sheets } = args as {
      format: string; title: string; content: string; filename?: string;
      sections?: Array<{ heading: string; content: string }>;
      table?: { headers: string[]; rows: string[][] };
      sheets?: Array<{ name: string; headers: string[]; rows: string[][] }>;
    };

    if (!format || !title || !content) {
      return { success: false, content: '', error: 'Missing required fields: format, title, or content' };
    }

    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3011';
      const res = await fetch(`${appUrl}/api/files/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format, title, content, filename, sections, table, sheets }),
      });

      if (!res.ok) {
        const errText = await res.text();
        return { success: false, content: '', error: `File API returned ${res.status}: ${errText}` };
      }

      const data = await res.json() as { success: boolean; filePath?: string; fileName?: string; fileSize?: number; error?: string };
      return data.success
        ? { success: true, content: `Document created: ${data.fileName} (${data.fileSize} bytes)` }
        : { success: false, content: '', error: data.error || 'Failed to create document' };
    } catch (err) {
      return { success: false, content: '', error: err instanceof Error ? err.message : 'Failed to create document' };
    }
  }

  return { success: false, content: '', error: `Unknown file tool: ${toolName}` };
}

// ── AI API call ────────────────────────────────────────────────────────────

interface AIResponse {
  content?: string;
  thinking?: string;
  toolCalls?: AgentToolCall[];
  error?: string;
  apiErrorBody?: string;
}

/** Call the AI API (Claude or OpenAI) with tools and return parsed response. */
async function callAI(
  model: string,
  messages: AgentMessage[],
  authToken: string,
  temperature: number,
  rawTools: readonly Record<string, unknown>[]
): Promise<AIResponse | null> {
  const tools = normalizeTools(rawTools);
  if (tools.length === 0) return { error: 'No valid tools' };

  const isClaude = model.toLowerCase().includes('claude');
  const apiUrl = isClaude
    ? 'https://api.githubcopilot.com/v1/messages'
    : 'https://api.githubcopilot.com/chat/completions';

  const requestBody = isClaude
    ? buildClaudeRequest(model, messages, tools, temperature)
    : buildOpenAIRequest(model, messages, tools, temperature);

  log('info', `Calling ${isClaude ? 'Claude' : 'OpenAI'} with ${tools.length} tools`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
        'X-Interaction-Type': 'conversation-panel',
        'OpenAI-Intent': 'conversation-panel',
        'X-GitHub-Api-Version': '2025-05-01',
        'Editor-Version': 'vscode/1.0',
        'User-Agent': 'Copilot-Agent/1.0',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '(could not read body)');
      log('error', `API error ${response.status}: ${errText.substring(0, 200)}`);
      return { error: `API error ${response.status}`, apiErrorBody: errText };
    }

    // Check if response is streaming (SSE) or JSON
    const contentType = response.headers.get('content-type') || '';
    const isStreaming = contentType.includes('text/event-stream');

    // Parse streaming response
    if (response.body && isStreaming) {
      const parsed = await parseSSEStream(response.body);
      if (parsed.content || parsed.toolCalls.length > 0 || parsed.thinking) {
        return {
          content: parsed.content || undefined,
          thinking: parsed.thinking || undefined,
          toolCalls: parsed.toolCalls.length > 0 ? parsed.toolCalls : undefined,
        };
      }
      // SSE returned no content — body already consumed
      log('warn', 'SSE returned no content and no tool calls');
      return { error: 'AI returned empty streaming response (no content or tool calls)' };
    }

    // Non-streaming response — parse as JSON
    try {
      const json = await response.json() as Record<string, unknown>;
      const result = parseJSONResponse(json, isClaude);
      if (!result) {
        log('error', `JSON parsing returned null. Response keys: ${Object.keys(json).join(', ')}`);
        return { error: 'AI returned empty response (no content or tool calls)' };
      }
      return result;
    } catch (jsonErr) {
      log('error', `JSON parse failed: ${jsonErr instanceof Error ? jsonErr.message : String(jsonErr)}`);
      return { error: 'AI returned invalid JSON response' };
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      log('error', 'API call timed out');
      return { error: 'API call timed out after 90s' };
    }
    const errMsg = err instanceof Error ? err.message : String(err);
    log('error', `API call failed: ${errMsg}`);
    return { error: `API call failed: ${errMsg}` };
  } finally {
    clearTimeout(timeoutId);
  }
}

function buildClaudeRequest(
  model: string,
  messages: AgentMessage[],
  tools: NormalizedTool[],
  temperature: number
): Record<string, unknown> {
  const systemMsgs = messages.filter(m => m.role === 'system');
  const claudeMessages: Array<Record<string, unknown>> = [];
  let pendingToolResults: Array<Record<string, unknown>> = [];

  for (const m of messages) {
    if (m.role === 'system') continue;

    if (m.role === 'tool') {
      pendingToolResults.push({ type: 'tool_result', tool_use_id: m.toolCallId, content: m.content });
    } else {
      if (pendingToolResults.length > 0) {
        claudeMessages.push({ role: 'user', content: pendingToolResults });
        pendingToolResults = [];
      }

      if (m.role === 'assistant' && m.toolCalls?.length) {
        const blocks: Array<Record<string, unknown>> = [];
        if (m.content?.trim()) blocks.push({ type: 'text', text: m.content });
        for (const tc of m.toolCalls) {
          const input = typeof tc.arguments === 'string' ? JSON.parse(tc.arguments || '{}') : (tc.arguments || {});
          blocks.push({ type: 'tool_use', id: tc.id, name: tc.name, input });
        }
        claudeMessages.push({ role: 'assistant', content: blocks });
      } else {
        claudeMessages.push({ role: m.role, content: m.content });
      }
    }
  }

  if (pendingToolResults.length > 0) {
    claudeMessages.push({ role: 'user', content: pendingToolResults });
  }

  return {
    model,
    messages: claudeMessages,
    ...(systemMsgs.length > 0 ? { system: systemMsgs[0].content } : {}),
    temperature: 1, // Required for extended thinking
    tools: tools.map(t => ({ name: t.name, description: t.description, input_schema: t.parameters })),
    tool_choice: { type: 'auto' },
    max_tokens: MAX_TOKENS + 10240, // Must be > thinking budget_tokens
    thinking: { type: 'enabled', budget_tokens: 10240 },
  };
}

function buildOpenAIRequest(
  model: string,
  messages: AgentMessage[],
  tools: NormalizedTool[],
  temperature: number
): Record<string, unknown> {
  return {
    model,
    temperature,
    messages: messages.map(m => {
      const msg: Record<string, unknown> = {
        role: m.role,
        content: m.content,
      }
      if (m.name) msg.name = m.name
      if (m.toolCallId) msg.tool_call_id = m.toolCallId
      // OpenAI requires tool_calls array on assistant messages
      if (m.role === 'assistant' && m.toolCalls?.length) {
        msg.tool_calls = m.toolCalls.map(tc => ({
          id: tc.id,
          type: 'function',
          function: {
            name: tc.name,
            arguments: typeof tc.arguments === 'string' ? tc.arguments : JSON.stringify(tc.arguments),
          }
        }))
      }
      return msg
    }),
    tools: tools.map(t => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.parameters },
    })),
    tool_choice: 'auto',
    max_tokens: MAX_TOKENS,
  };
}

function parseJSONResponse(data: Record<string, unknown>, isClaude: boolean): AIResponse | null {
  if (isClaude) {
    const blocks = data.content as Array<Record<string, unknown>> | undefined;
    if (!blocks?.length) return null;

    let content = '';
    let thinking = '';
    const toolCalls: AgentToolCall[] = [];

    for (const block of blocks) {
      if (block.type === 'text' && block.text) content += block.text;
      if (block.type === 'thinking' && block.thinking) thinking += block.thinking;
      if (block.type === 'tool_use') {
        toolCalls.push({
          id: (block.id as string) || `tool-${toolCalls.length}`,
          name: (block.name as string) || '',
          arguments: (block.input as Record<string, unknown>) || {},
        });
      }
    }

    return {
      content: content || undefined,
      thinking: thinking || undefined,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    };
  }

  // OpenAI format
  const choice = (data.choices as Array<Record<string, unknown>> | undefined)?.[0]?.message as Record<string, unknown> | undefined;
  if (!choice) return null;

  const toolCalls = ((choice.tool_calls as Array<Record<string, unknown>>) || []).map((tc) => ({
    id: tc.id as string,
    name: ((tc.function as Record<string, unknown>)?.name as string) || '',
    arguments: JSON.parse(((tc.function as Record<string, unknown>)?.arguments as string) || '{}'),
  }));

  return {
    content: (choice.content as string) || undefined,
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
  };
}

// ── Main agentic loop ─────────────────────────────────────────────────────

/** Run the autonomous agentic loop: send message → execute tools → repeat. */
export async function runAgenticLoop(
  userMessage: string,
  config: AgentConfig,
  screenContext?: ScreenContext,
  conversationHistory?: Array<{ role: string; content: string }>
): Promise<AgentResult> {
  const { credentials, model, temperature = 0.7, maxIterations = 10, maxFiles = 50 } = config;

  log('info', `Starting loop — model: ${model}, maxIter: ${maxIterations}`);

  // Auth
  const session = await getSession().catch(() => null);
  if (!session?.github_token) {
    return { success: false, message: 'Authentication required', iterations: 0, error: 'Agent mode requires GitHub Copilot authentication' };
  }

  let authToken: string;
  try {
    authToken = await getCopilotToken(session.github_token);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: 'Token retrieval failed', iterations: 0, error: msg };
  }

  // Build prompt
  const systemPrompt = buildMainframeAgentPrompt(screenContext);
  const messages: AgentMessage[] = [{ role: 'system', content: systemPrompt }];

  if (conversationHistory?.length) {
    for (const h of conversationHistory) {
      messages.push({ role: h.role as AgentMessage['role'], content: h.content });
    }
  }
  messages.push({ role: 'user', content: userMessage });

  // Tool definitions
  const allTools = [...COBOL_TOOL_DEFINITIONS, ...ZOS_TOOL_DEFINITIONS, ...FILE_TOOL_DEFINITIONS] as unknown as Record<string, unknown>[];

  // Loop
  const startTime = Date.now();
  let iterations = 0;
  let finalMessage = '';
  const isClaude = model.toLowerCase().includes('claude');
  let thinkingContent = isClaude ? '' : `[Agent Mode: ${model}]\n\n`;
  const allToolCalls: AgentToolCall[] = [];

  while (iterations < maxIterations) {
    iterations++;
    if (Date.now() - startTime > LOOP_TIMEOUT_MS) {
      log('warn', `Timeout after ${Date.now() - startTime}ms`);
      break;
    }

    const response = await callAI(model, messages, authToken, temperature, allTools);

    if (!response) {
      return { success: false, message: 'AI call failed', iterations, error: 'No response from AI (unexpected null)' };
    }
    if (response.error) {
      log('error', `AI API error: ${response.error}`);
      return { success: false, message: 'AI API error', iterations, error: response.apiErrorBody || response.error };
    }

    if (response.thinking) thinkingContent += response.thinking + '\n';
    if (response.content) finalMessage += response.content + '\n';

    const assistantMsg: AgentMessage = { role: 'assistant', content: response.content || '' };

    if (response.toolCalls?.length) {
      assistantMsg.toolCalls = response.toolCalls;
      messages.push(assistantMsg);

      const { validCalls, batchCalls } = prepareToolCalls(response.toolCalls);
      const results = await executeBatch(batchCalls, {
        sshHost: credentials.host,
        sshPort: credentials.port || 22,
        userId: credentials.username,
        password: credentials.password || '',
      });

      for (let i = 0; i < validCalls.length; i++) {
        const tc = validCalls[i];
        const result = results[i] || { success: false, content: '', error: 'No result' };

        allToolCalls.push(tc);
        tc.output = result.success && result.content?.trim() ? result.content : result.error || `Tool ${tc.name} completed with no output.`;
        tc.state = result.success ? 'done' : 'error';

        // Add execution step to thinking (for GPT which has no native thinking)
        const argsPreview = typeof tc.arguments === 'object' ? JSON.stringify(tc.arguments).substring(0, 100) : String(tc.arguments).substring(0, 100);
        thinkingContent += `Executing ${tc.name} with ${argsPreview}\n`;
        if (result.success) {
          thinkingContent += `✓ ${tc.name} completed: ${tc.output.substring(0, 200)}\n\n`;
        } else {
          thinkingContent += `✗ ${tc.name} failed: ${(result.error || 'Unknown error').substring(0, 200)}\n\n`;
        }

        messages.push({
          role: 'tool',
          content: `Tool ${tc.name} result:\n${tc.output}`,
          toolCallId: tc.id,
          name: tc.name,
        });
      }
      continue;
    }

    // No tool calls
    if (response.content) {
      messages.push(assistantMsg);
      break;
    }

    if (iterations >= 2) break;
  }

  return {
    success: true,
    message: finalMessage,
    finalContent: finalMessage,
    thinking: thinkingContent || undefined,
    toolCalls: allToolCalls,
    iterations,
  };
}

function prepareToolCalls(rawCalls: AgentToolCall[]): { validCalls: AgentToolCall[]; batchCalls: BatchToolCall[] } {
  const validCalls: AgentToolCall[] = [];
  const batchCalls: BatchToolCall[] = [];

  for (const tc of rawCalls) {
    if (!tc?.name?.trim()) continue;

    if (typeof tc.arguments === 'string') {
      try { tc.arguments = JSON.parse(tc.arguments); } catch { continue; }
    }
    if (!tc.arguments || typeof tc.arguments !== 'object') continue;

    validCalls.push(tc);
    batchCalls.push({ id: tc.id, name: tc.name, arguments: tc.arguments as Record<string, unknown> });
  }

  return { validCalls, batchCalls };
}

// ── System prompt ──────────────────────────────────────────────────────────

function buildMainframeAgentPrompt(screenContext?: ScreenContext): string {
  if (screenContext && screenContext.screenType !== 'DISCONNECTED') {
    return buildMainframeCopilotPrompt(screenContext, {});
  }

  return `You are a mainframe developer assistant. Use tools to help users.

TOOLS: Datasets, Jobs, USS, CICS, DB2, VSAM, RACF, Storage, Network, Files.
PARAMS: Dataset ops need datasetName. Jobs need jobName. USS needs path. DB2 needs subsystem + sqlQuery.
EXTRACT: "YOUR.LIBRARY" → datasetName. "(MYPROG)" → member. "YOUR.*" → pattern. "ABC123" after "job" → jobName.
Always call tools. If unclear, ask. If fails, try alternative.`;
}

// ── Single tool execution ──────────────────────────────────────────────────

/** Execute a single tool by name (used by the standalone agent endpoint). */
export async function executeSingleTool(
  toolName: string,
  args: Record<string, unknown>,
  credentials: AgentConfig['credentials']
): Promise<{ success: boolean; content: string; error?: string }> {
  const context: AgentContext = {
    credentials,
    sessionId: randomUUID(),
    maxIterations: 1,
    maxFiles: 50,
  };
  return executeCobolTool(toolName, args, context);
}
