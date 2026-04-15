import { useCallback, useEffect, useRef, useState } from "react";
import { generateId } from "@/lib/core/utils";
import { cleanMfContent } from "@/lib/ai/action-parser";
import type { Message, ToolCallEntry, Settings } from "@/lib/core/types";

// Slash command names that the API recognizes
const KNOWN_SLASH_COMMANDS = [
  "explain", "fix", "tests", "doc", "review", "new", "newNotebook",
  "semanticSearch", "setupTests", "compact", "clear", "remember",
  "jcl", "cobol", "datasets", "analyze", "deploy", "debug", "test",
  "fix-error", "query", "secure", "integrate", "analytics", "dashboard",
  "terminal", "migrate", "performance", "api", "accessibility",
  "internationalization", "feature", "architecture", "compliance",
];

function parseSlashCommand(text: string): { command?: string; cleanText: string } {
  const trimmed = text.trim();
  if (!trimmed.startsWith("/")) return { cleanText: text };
  const match = trimmed.match(/^\/(\w+)\s*/);
  if (!match) return { cleanText: text };
  const command = match[1];
  if (!KNOWN_SLASH_COMMANDS.includes(command)) return { cleanText: text };
  const cleanText = trimmed.slice(match[0].length).trim();
  return { command, cleanText };
}

interface UseChatOptions {
  settings: Settings;
  sshCredentials?: { host: string; username: string; password: string; port: number };
  activeId: string | null;
  onAuthError?: () => void;
}

interface UseChatReturn {
  messages: Record<string, Message[]>;
  loading: boolean;
  sendMessage: (text: string, conversationId: string, model?: string) => Promise<void>;
  stopGeneration: () => void;
  setMessages: React.Dispatch<React.SetStateAction<Record<string, Message[]>>>;
}

export function useChat(options: UseChatOptions): UseChatReturn {
  const { settings, sshCredentials, activeId, onAuthError } = options;
  
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [loading, setLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const loadingRef = useRef(false);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  
  const currentMessages = activeId ? messages[activeId] ?? [] : [];

  // Load messages from database when conversation changes
  const loadedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!activeId) return;
    // Skip if already loaded in this session
    if (loadedRef.current.has(activeId)) return;
    // Skip if we already have messages in memory
    if (messages[activeId]?.length) {
      loadedRef.current.add(activeId);
      return;
    }

    const loadMessages = async () => {
      try {
        const res = await fetch(`/api/conversations/${activeId}/messages`, {
          credentials: "include",
        });
        if (!res.ok) return;
        const data = await res.json();
        const dbMessages: Array<{
          id: string;
          role: string;
          content: string;
          thinking?: string;
          model?: string;
          created_at: string;
          tool_calls?: string;
        }> = data.messages ?? [];

        if (dbMessages.length === 0) {
          loadedRef.current.add(activeId);
          return;
        }

        const parsed: Message[] = dbMessages.map(m => {
          let toolCalls: ToolCallEntry[] | undefined;
          if (m.tool_calls) {
            try {
              const raw = JSON.parse(m.tool_calls);
              if (Array.isArray(raw)) {
                toolCalls = raw.map((tc: Record<string, unknown>) => ({
                  id: (tc.id as string) ?? generateId(),
                  name: (tc.name as string) ?? "unknown",
                  input: (tc.input as Record<string, unknown>) ?? {},
                  output: tc.output as string | undefined,
                  state: (tc.state as "running" | "done" | "error") ?? "done",
                }));
              }
            } catch { /* ignore parse error */ }
          }
          return {
            id: m.id,
            role: m.role as "user" | "assistant" | "tool",
            content: m.content,
            thinking: m.thinking || undefined,
            model: m.model || undefined,
            createdAt: new Date(m.created_at),
            toolCalls,
          };
        });

        setMessages(prev => ({ ...prev, [activeId]: parsed }));
        loadedRef.current.add(activeId);
      } catch (err) {
        console.error("[useChat] Failed to load messages:", err);
      }
    };

    loadMessages();
  }, [activeId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Save message to database
  const saveMessage = async (conversationId: string, msg: Message) => {
    try {
      await fetch(`/api/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: msg.role,
          content: msg.content,
          thinking: msg.thinking,
          model: msg.model,
          tool_calls: msg.toolCalls,
        }),
        credentials: "include",
      });
    } catch (err) {
      console.error("[useChat] saveMessage error:", err);
    }
  };

  const sendMessage = useCallback(async (text: string, conversationId: string, model?: string) => {
    if (!text.trim() || loadingRef.current) return;
    
    loadingRef.current = true;
    setLoading(true);
    
    const userMsg: Message = {
      id: generateId(),
      role: "user",
      content: text,
      createdAt: new Date(),
    };
    
    const assistantId = generateId();
    const assistantPlaceholder: Message = {
      id: assistantId,
      role: "assistant",
      content: "",
      createdAt: new Date(),
    };
    
    setMessages(prev => ({
      ...prev,
      [conversationId]: [...(prev[conversationId] ?? []), userMsg, assistantPlaceholder],
    }));
    
    saveMessage(conversationId, userMsg);
    
    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
    
    try {
      const conversationHistory = messagesRef.current[conversationId] ?? [];
      const apiMessages = [
        ...conversationHistory.filter(m => m.role === 'user' || m.role === 'assistant'),
        userMsg,
      ].map(m => ({
        role: m.role,
        content: m.content,
      }));
      
      const { command: slashCommand } = parseSlashCommand(text);
      
      abortControllerRef.current = new AbortController();
      
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        signal: abortControllerRef.current.signal,
        body: JSON.stringify({
          messages: apiMessages,
          model: model || settings.model,
          mode: settings.mode,
          temperature: settings.temperature,
          stream: true,
          sshCredentials,
          slashCommand,
          memory: settings.memory,
          contextFiles: settings.contextFiles,
          customInstructions: settings.customInstructions || undefined,
          thinkingBudgetTokens: settings.thinkingBudgetTokens,
          enableTools: settings.tools,
          followUpSuggestions: settings.followUpSuggestions,
          modelCapabilities: {
            supportsThinking: settings.thinkingBudgetTokens > 0,
            supportsTools: settings.tools,
            supportsVision: false,
          },
        }),
      });
      
      if (!res.ok) {
        const errText = await res.text();
        
        if (res.status === 401) {
          if (onAuthError) onAuthError();
          throw new Error("Authentication required - please sign in");
        }
        
        throw new Error(`API error ${res.status}: ${errText}`);
      }
      
      reader = res.body?.getReader() ?? null;
      if (!reader) throw new Error("No response body");
      
      const decoder = new TextDecoder();
      let buf = "";
      let accContent = "";
      let accThinking: string | undefined = undefined;
      let accToolCalls: ToolCallEntry[] = [];
      let isDone = false;
      
      while (!isDone) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buf += decoder.decode(value, { stream: true });
        
        let eventEnd: number;
        while ((eventEnd = buf.indexOf("\n\n")) !== -1) {
          const eventBlock = buf.slice(0, eventEnd);
          buf = buf.slice(eventEnd + 2);
          
          for (const line of eventBlock.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6).trim();
            
            if (payload === "[DONE]") {
              isDone = true;
              break;
            }
            
            try {
              const chunk = JSON.parse(payload);
              
              if (chunk.text) {
                accContent += chunk.text;
              }
              
              if (chunk.thinking_start && accThinking === undefined) {
                accThinking = "";
              }
              if (chunk.thinking) {
                accThinking = (accThinking ?? "") + chunk.thinking;
              }
              
              if (chunk.tool_call_start?.name) {
                accToolCalls.push({
                  id: chunk.tool_call_start.id ?? `tc-${accToolCalls.length}`,
                  name: chunk.tool_call_start.name,
                  input: {},
                  output: chunk.tool_call_start.result || undefined,
                  state: chunk.tool_call_start.state || "running",
                });
              }
              
              if (chunk.usage) {
                // Token usage tracked
              }
            } catch {
              // Skip malformed JSON chunks
            }
          }
          
          if (isDone) break;
        }
        
        if (accContent || accThinking || accToolCalls.length) {
          setMessages(prev => ({
            ...prev,
            [conversationId]: (prev[conversationId] ?? []).map(m =>
              m.id === assistantId
                ? {
                    ...m,
                    content: cleanMfContent(accContent),
                    thinking: accThinking,
                    toolCalls: accToolCalls.length ? accToolCalls : undefined,
                    model: model || settings.model,
                  }
                : m
            ),
          }));
        }
      }
      
      setMessages(prev => ({
        ...prev,
        [conversationId]: (prev[conversationId] ?? []).map(m =>
          m.id === assistantId
            ? {
                ...m,
                content: cleanMfContent(accContent),
                thinking: accThinking,
                toolCalls: accToolCalls.length ? accToolCalls : undefined,
                model: model || settings.model,
              }
            : m
        ),
      }));
      
      const finalMsg: Message = {
        id: assistantId,
        role: "assistant",
        content: cleanMfContent(accContent),
        thinking: accThinking,
        toolCalls: accToolCalls.length ? accToolCalls : undefined,
        model: model || settings.model,
        createdAt: new Date(),
      };
      saveMessage(conversationId, finalMsg);
      
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error("[useChat] sendMessage error:", errorMsg);
      setMessages(prev => ({
        ...prev,
        [conversationId]: (prev[conversationId] ?? []).map(m =>
          m.id === assistantId
            ? { ...m, content: `Error: ${errorMsg}` }
            : m
        ),
      }));
    } finally {
      try {
        reader?.releaseLock();
      } catch {
        // Reader may already be released
      }
      setLoading(false);
      loadingRef.current = false;
      abortControllerRef.current = null;
    }
  }, [settings, sshCredentials, onAuthError]);

  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setLoading(false);
    loadingRef.current = false;
  }, []);

  return {
    messages,
    loading,
    sendMessage,
    stopGeneration,
    setMessages,
  };
}
