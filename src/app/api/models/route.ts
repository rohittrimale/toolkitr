/**
 * GET /api/models
 * Fetches available models from GitHub Copilot API.
 * Mirrors: GET https://api.githubcopilot.com/models
 * With same headers as the VS Code extension.
 */
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getCopilotToken } from "@/lib/auth/copilot-token";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  family: string;
  isDefault: boolean;
  isFallback: boolean;
  isPremium: boolean;
  isPreview: boolean;
  supportsTools: boolean;
  supportsVision: boolean;
  supportsThinking: boolean;
  maxOutputTokens?: number;
  maxContextTokens?: number;
  pickerEnabled: boolean;
}

function providerFromFamily(family: string): string {
  const f = family.toLowerCase();
  if (f.startsWith("claude")) return "Anthropic";
  if (f.startsWith("gemini") || f.startsWith("google")) return "Google";
  if (f.startsWith("o1") || f.startsWith("o3") || f.startsWith("o4") ||
      f.startsWith("gpt") || f.startsWith("chatgpt")) return "OpenAI";
  if (f.startsWith("llama") || f.startsWith("meta")) return "Meta";
  if (f.startsWith("mistral") || f.startsWith("mixtral")) return "Mistral";
  if (f.startsWith("phi") || f.startsWith("microsoft")) return "Microsoft";
  if (f.startsWith("grok") || f.startsWith("xai")) return "xAI";
  if (f.startsWith("command") || f.startsWith("cohere")) return "Cohere";
  if (f.startsWith("deepseek")) return "DeepSeek";
  if (f.startsWith("ai21")) return "AI21 Labs";
  return "Other";
}

// Static fallback models when Copilot API is unavailable
function getStaticModels(): ModelInfo[] {
  return [
    { id: "claude-sonnet-4-5", name: "Claude Sonnet 4.5", provider: "Anthropic", family: "claude", isDefault: true, isFallback: true, isPremium: false, isPreview: false, supportsTools: true, supportsVision: true, supportsThinking: true, maxOutputTokens: 8192, maxContextTokens: 200000, pickerEnabled: true },
    { id: "gpt-4o", name: "GPT-4o", provider: "OpenAI", family: "gpt", isDefault: false, isFallback: true, isPremium: false, isPreview: false, supportsTools: true, supportsVision: true, supportsThinking: false, maxOutputTokens: 16384, maxContextTokens: 128000, pickerEnabled: true },
    { id: "gemini-2-0-flash", name: "Gemini 2.0 Flash", provider: "Google", family: "gemini", isDefault: false, isFallback: true, isPremium: false, isPreview: false, supportsTools: true, supportsVision: true, supportsThinking: false, maxOutputTokens: 8192, maxContextTokens: 1000000, pickerEnabled: true },
  ];
}

export async function GET() {
  const session = await getSession();
  
  if (!session || !session.github_token) {
    console.log('[Models] No session, returning error');
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let copilotToken: string;
  try {
    copilotToken = await getCopilotToken(session.github_token);
    console.log('[Models] Got Copilot token');
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('[Models] Copilot token error:', errMsg);
    return NextResponse.json({ error: errMsg }, { status: 401 });
  }

  console.log('[Models] Fetching from Copilot API...');
  const res = await fetch("https://api.githubcopilot.com/models", {
    headers: {
      Authorization: `Bearer ${copilotToken}`,
      "X-Request-Id": randomUUID(),
      "X-Interaction-Type": "model-access",
      "OpenAI-Intent": "model-access",
      "X-GitHub-Api-Version": "2025-05-01",
      "Editor-Version": "vscode/1.100.0",
      "Editor-Plugin-Version": "copilot-chat/1.300.0",
      "User-Agent": "Assistent/1.0",
    },
  });

  if (!res.ok) {
    const body = await res.text();
    console.error('[Models] API error:', res.status, body);
    return NextResponse.json({ error: `Models fetch failed (${res.status}): ${body}` }, { status: res.status });
  }

  const data = await res.json() as {
    data: Array<{
      id: string;
      name: string;
      version?: string;
      model_picker_enabled?: boolean;
      preview?: boolean;
      is_chat_default?: boolean;
      is_chat_fallback?: boolean;
      billing?: { is_premium?: boolean };
      capabilities: {
        family: string;
        type: string;
        limits?: {
          max_output_tokens?: number;
          max_context_window_tokens?: number;
        };
        supports?: {
          tool_calls?: boolean;
          vision?: boolean;
          thinking?: boolean;
        };
      };
    }>;
  };

  const models: ModelInfo[] = data.data
    .filter((m) => m.capabilities?.type === "chat" && m.model_picker_enabled !== false)
    .map((m) => ({
      id: m.id,
      name: m.name || m.id,
      provider: providerFromFamily(m.capabilities.family),
      family: m.capabilities.family,
      isDefault: m.is_chat_default ?? false,
      isFallback: m.is_chat_fallback ?? false,
      isPremium: m.billing?.is_premium ?? false,
      isPreview: m.preview ?? false,
      supportsTools: m.capabilities.supports?.tool_calls ?? false,
      supportsVision: m.capabilities.supports?.vision ?? false,
      supportsThinking: m.capabilities.supports?.thinking ?? false,
      maxOutputTokens: m.capabilities.limits?.max_output_tokens,
      maxContextTokens: m.capabilities.limits?.max_context_window_tokens,
      pickerEnabled: m.model_picker_enabled ?? true,
    }))
    .sort((a, b) => {
      if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
      if (a.provider !== b.provider) return a.provider.localeCompare(b.provider);
      return a.name.localeCompare(b.name);
    });

  console.log('[Models] Got', models.length, 'models:', models.map(m => m.id).join(', '));
  return NextResponse.json({ models, fallback: false });
}
