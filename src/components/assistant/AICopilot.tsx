"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { MarkdownText } from "./components";
import { useChat } from "./hooks/useChat";
import { useConversations } from "./hooks/useConversations";
import { useStore } from "@/store";
import { MODES, SETTINGS_DEFAULTS, MODE_DESCRIPTIONS, SLASH_COMMANDS } from "@/lib/core/data";
import type { Settings } from "@/lib/core/types";

// ─── Model type from API ──────────────────────────────────────────────────────
interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  family: string;
  isDefault: boolean;
  isPremium: boolean;
  isPreview: boolean;
  supportsTools: boolean;
  supportsVision: boolean;
  supportsThinking: boolean;
  maxOutputTokens?: number;
  maxContextTokens?: number;
}

// ─── Icons ────────────────────────────────────────────────────────────────────
const Icons = {
  Send: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="m22 2-10 10"/></svg>,
  Plus: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>,
  Bot: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>,
  User: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  Wrench: () => <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>,
  Brain: () => <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/></svg>,
  Eye: () => <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>,
  Check: () => <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>,
  X: () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>,
  ChevronDown: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>,
  Paperclip: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>,
  Sparkles: () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>,
  MessageSquare: () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  Clock: () => <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  History: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>,
  Gem: () => <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h12l4 6-10 13L2 9Z"/><path d="M11 3 8 9l4 13 4-13-3-6"/><path d="M2 9h20"/></svg>,
  Copy: () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>,
  RefreshCw: () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>,
  Edit3: () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>,
  Sun: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>,
  Moon: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>,
};

// ─── SSH Credentials (from Zustand store) ──────────────────────────────────

// ─── Props ────────────────────────────────────────────────────────────────────
interface AICopilotProps {
  onToggleHistory?: () => void;
  showHistory?: boolean;
}

// ─── Click Outside Hook ───────────────────────────────────────────────────────
function useClickOutside(ref: React.RefObject<HTMLElement | null>, handler: () => void) {
  useEffect(() => {
    const listener = (e: MouseEvent) => {
      if (!ref.current || ref.current.contains(e.target as Node)) return;
      handler();
    };
    document.addEventListener("mousedown", listener);
    return () => document.removeEventListener("mousedown", listener);
  }, [ref, handler]);
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function AICopilot({ onToggleHistory, showHistory }: AICopilotProps = {}) {
  // Dynamic models from API
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  
  // Settings
  const [selectedModel, setSelectedModel] = useState("claude-sonnet-4-5");
  const [selectedMode, setSelectedMode] = useState<"Ask" | "Edit" | "Agent">("Agent");
  const settings: Settings = { ...SETTINGS_DEFAULTS, model: selectedModel, mode: selectedMode };
  
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null); // null = checking
  const [showLogin, setShowLogin] = useState(false);
  const [userName, setUserName] = useState<string>("");
  
  // Check authentication on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        const data = await res.json();
        
        if (data.authenticated) {
          setIsAuthenticated(true);
          setShowLogin(false);
          setUserName(data.user?.name || data.user?.login || "User");
        } else {
          setIsAuthenticated(false);
          setShowLogin(true);
        }
      } catch {
        setIsAuthenticated(false);
        setShowLogin(true);
      }
    };
    checkAuth();
  }, []);
  
  // Conversations
  const {
    conversations,
    activeId,
    setActiveId,
    startNew,
    autoGenerateTitle,
  } = useConversations();
  
  // SSH credentials from store
  const sshCredentials = useStore(s => s.sshCredentials);
  const hasSshCredentials = !!(sshCredentials.host && sshCredentials.username);

  // Chat - pass activeId from useConversations
  const {
    messages,
    loading,
    sendMessage,
    stopGeneration,
    setMessages,
  } = useChat({
    settings,
    sshCredentials: hasSshCredentials ? sshCredentials : undefined,
    activeId,
    onAuthError: () => setShowLogin(true),
  });
  
  // UI State
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<Array<{ name: string; content: string }>>([]);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [showModeDropdown, setShowModeDropdown] = useState(false);
  const [showSlashCommands, setShowSlashCommands] = useState(false);
  const [expandedThinking, setExpandedThinking] = useState<Record<string, boolean>>({});
  const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>({});
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      return (localStorage.getItem('ai_theme') as 'dark' | 'light') || 'dark';
    } catch {
      return 'dark';
    }
  });
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const modeDropdownRef = useRef<HTMLDivElement>(null);
  
  // Current messages
  const currentMessages = activeId ? messages[activeId] ?? [] : [];
  
  // Click outside handlers
  useClickOutside(modelDropdownRef, () => setShowModelDropdown(false));
  useClickOutside(modeDropdownRef, () => setShowModeDropdown(false));
  
  // ─── Draft Auto-Save ──────────────────────────────────────────────────
  const draftKey = activeId ? `ai_draft_${activeId}` : "ai_draft_new";
  
  // Load draft on mount or conversation change
  useEffect(() => {
    try {
      const savedDraft = localStorage.getItem(draftKey);
      if (savedDraft && !input) {
        setInput(savedDraft);
      }
    } catch {
      // localStorage not available
    }
  }, [activeId]); // eslint-disable-line react-hooks/exhaustive-deps
  
  // Save draft on input change
  useEffect(() => {
    if (input) {
      try {
        localStorage.setItem(draftKey, input);
      } catch {
        // localStorage not available
      }
    }
  }, [input, draftKey]);
  
  // Clear draft when message is sent (handled in handleSend)
  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(draftKey);
    } catch {
      // localStorage not available
    }
  }, [draftKey]);
  
  // Fetch models from API with localStorage cache
  useEffect(() => {
    const fetchModels = async () => {
      // Check cache first (valid for 24 hours) with try-catch for private browsing
      const cacheKey = "ai_copilot_models";
      const cacheTimeKey = "ai_copilot_models_time";
      let cached: string | null = null;
      let cachedTime: string | null = null;
      
      try {
        cached = localStorage.getItem(cacheKey);
        cachedTime = localStorage.getItem(cacheTimeKey);
      } catch {
        // localStorage not available (private browsing, etc.)
      }
      
      const twentyFourHours = 24 * 60 * 60 * 1000;
      
      if (cached && cachedTime) {
        const parsedTime = parseInt(cachedTime);
        if (!isNaN(parsedTime) && (Date.now() - parsedTime) < twentyFourHours) {
          try {
            const parsed = JSON.parse(cached);
            if (parsed.length) {
              setModels(parsed);
              const defaultModel = parsed.find((m: ModelInfo) => m.isDefault) || parsed[0];
              if (defaultModel) setSelectedModel(defaultModel.id);
              setModelsLoading(false);
              return;
            }
          } catch { /* cache corrupted, fetch fresh */ }
        }
      }
      
      // Fetch from API
      try {
        const res = await fetch("/api/models");
        if (res.ok) {
          const data = await res.json();
          if (data.models?.length) {
            setModels(data.models);
            // Cache the models
            try {
              localStorage.setItem(cacheKey, JSON.stringify(data.models));
              localStorage.setItem(cacheTimeKey, Date.now().toString());
            } catch { /* quota exceeded */ }
            // Set default model
            const defaultModel = data.models.find((m: ModelInfo) => m.isDefault) || data.models[0];
            if (defaultModel) setSelectedModel(defaultModel.id);
            if (data.fallback) {
              console.warn("[AICopilot] Using fallback models — Copilot API unavailable");
            }
          }
        } else {
          // API returned error — clear cache so we retry next time
          const errData = await res.json().catch(() => ({}));
          console.error("[AICopilot] Models API error:", res.status, errData);
          try {
            localStorage.removeItem(cacheKey);
            localStorage.removeItem(cacheTimeKey);
          } catch { /* ignore */ }
        }
      } catch (err) {
        console.error("[AICopilot] Failed to fetch models:", err);
      } finally {
        setModelsLoading(false);
      }
    };
    fetchModels();
  }, []);
  
  // ─── SSH Connection Pre-warming ─────────────────────────────────────────
  // Pre-warm SSH connections when assistant mounts for faster first response
  useEffect(() => {
    if (hasSshCredentials) {
      console.log('[AICopilot] Pre-warming SSH connection...');
      fetch('/api/zos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: 'zvm_test_connection',
          args: {}
        }),
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            console.log('[AICopilot] SSH pre-warm successful');
          }
        })
        .catch(() => {
          // Pre-warm failed, but don't block - first request will establish connection
          console.log('[AICopilot] SSH pre-warm failed, will connect on first request');
        });
    }
  }, []); // Run once on mount
  
  // Filter models by mode capabilities
  const filteredModels = models.filter(m => {
    if (selectedMode === "Agent") return m.supportsTools;
    return true;
  });
  
  // Auto-scroll — track content length to scroll during streaming
  const lastContentLenRef = useRef(0);
  useEffect(() => {
    const lastMsg = currentMessages[currentMessages.length - 1];
    const contentLen = (lastMsg?.content?.length ?? 0) + (lastMsg?.thinking?.length ?? 0);
    if (contentLen !== lastContentLenRef.current) {
      lastContentLenRef.current = contentLen;
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [currentMessages, loading]);
  
  // Start new conversation if none active
  useEffect(() => {
    if (!activeId && conversations.length === 0) {
      startNew();
    } else if (!activeId && conversations.length > 0) {
      setActiveId(conversations[0].id);
    }
  }, [activeId, conversations, startNew, setActiveId]);
  
  // Send message
  const handleSend = useCallback(async () => {
    if ((!input.trim() && attachments.length === 0) || loading) return;
    
    const convId = activeId ?? startNew();
    let text = input;
    
    if (attachments.length > 0) {
      text += "\n\n--- Attached Files ---\n";
      attachments.forEach(att => {
        text += `\n📄 ${att.name}:\n\`\`\`\n${att.content}\n\`\`\`\n`;
      });
    }
    
    // Auto-generate title for first message
    const currentMsgs = messages[convId] ?? [];
    const isFirstMessage = currentMsgs.length === 0;
    
    setInput("");
    setAttachments([]);
    clearDraft();
    await sendMessage(text, convId, selectedModel);
    
    // Generate title from first message
    if (isFirstMessage) {
      autoGenerateTitle(convId, text);
    }
  }, [input, attachments, loading, activeId, startNew, sendMessage, selectedModel, messages, autoGenerateTitle, clearDraft]);
  
  // Handle key press
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === "/" && input === "") {
      setShowSlashCommands(true);
    }
  }, [handleSend, input]);
  
  // File attachment
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = () => setAttachments(prev => [...prev, { name: file.name, content: reader.result as string }]);
      reader.onerror = () => console.error("[AICopilot] Failed to read file:", file.name);
      reader.onabort = () => console.warn("[AICopilot] File read aborted:", file.name);
      reader.readAsText(file);
    });
    e.target.value = "";
  }, []);
  
  const removeAttachment = useCallback((index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = inputRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 150) + "px";
  }, [input]);

  const insertSlashCommand = useCallback((cmd: string) => {
    setInput(`/${cmd} `);
    setShowSlashCommands(false);
    inputRef.current?.focus();
  }, []);
  
  const toggleThinking = useCallback((msgId: string) => {
    setExpandedThinking(prev => ({ ...prev, [msgId]: !prev[msgId] }));
  }, []);
  
  // ─── Message Actions ────────────────────────────────────────────────────
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // Copy message content to clipboard
  const handleCopy = useCallback(async (content: string, msgId: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(msgId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      console.error("Failed to copy to clipboard");
    }
  }, []);
  
  // Regenerate last assistant response
  const handleRegenerate = useCallback(async (msgId: string) => {
    if (!activeId || loading) return;
    
    const msgs = messages[activeId] ?? [];
    const msgIndex = msgs.findIndex(m => m.id === msgId);
    if (msgIndex < 1) return;
    
    // Get the user message before this assistant message
    const userMsg = msgs[msgIndex - 1];
    if (!userMsg || userMsg.role !== "user") return;
    
    // Remove the assistant message and all messages after it
    setMessages(prev => ({
      ...prev,
      [activeId]: msgs.slice(0, msgIndex),
    }));
    
    // Resend the user message
    await sendMessage(userMsg.content, activeId, selectedModel);
  }, [activeId, loading, messages, sendMessage, selectedModel]);
  
  // Edit user message
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  
  const startEditMessage = useCallback((msgId: string, content: string) => {
    setEditingMsgId(msgId);
    setEditingContent(content);
  }, []);
  
  const confirmEditMessage = useCallback(async () => {
    if (!activeId || !editingMsgId || !editingContent.trim()) {
      setEditingMsgId(null);
      return;
    }
    
    const msgs = messages[activeId] ?? [];
    const msgIndex = msgs.findIndex(m => m.id === editingMsgId);
    if (msgIndex < 0) {
      setEditingMsgId(null);
      return;
    }
    
    // Remove all messages after the edited message
    const newMsgs = msgs.slice(0, msgIndex);
    
    // Update the message content
    const editedMsg = { ...msgs[msgIndex], content: editingContent.trim() };
    newMsgs.push(editedMsg);
    
    setMessages(prev => ({
      ...prev,
      [activeId]: newMsgs,
    }));
    
    setEditingMsgId(null);
    
    // Resend from the edited message
    await sendMessage(editingContent.trim(), activeId, selectedModel);
  }, [activeId, editingMsgId, editingContent, messages, sendMessage, selectedModel]);
  
  // Colors
  const getProviderColor = (provider: string) => {
    switch (provider) {
      case "Anthropic": return "text-orange-400";
      case "OpenAI": return "text-green-400";
      case "Google": return "text-blue-400";
      case "xAI": return "text-gray-300";
      case "DeepSeek": return "text-purple-400";
      default: return "text-gray-400";
    }
  };
  
  const getProviderDot = (provider: string) => {
    switch (provider) {
      case "Anthropic": return "bg-orange-400";
      case "OpenAI": return "bg-green-400";
      case "Google": return "bg-blue-400";
      case "xAI": return "bg-gray-300";
      case "DeepSeek": return "bg-purple-400";
      default: return "bg-gray-400";
    }
  };
  
  const getModeColor = (mode: string) => {
    switch (mode) {
      case "Agent": return "bg-purple-500/20 text-purple-300 border-purple-500/30";
      case "Edit": return "bg-blue-500/20 text-blue-300 border-blue-500/30";
      case "Ask": return "bg-green-500/20 text-green-300 border-green-500/30";
      default: return "bg-gray-500/20 text-gray-300 border-gray-500/30";
    }
  };
  
  const formatContext = (tokens?: number) => {
    if (!tokens) return "";
    if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(0)}M`;
    if (tokens >= 1000) return `${(tokens / 1000).toFixed(0)}k`;
    return `${tokens}`;
  };
  
  // Current selected model info
  const currentModel = models.find(m => m.id === selectedModel);
  
  // Device flow state
  const [deviceState, setDeviceState] = useState<"idle" | "loading" | "waiting" | "authorized">("idle");
  const [userCode, setUserCode] = useState("");
  const [verificationUri, setVerificationUri] = useState("https://github.com/login/device");
  const [copied, setCopied] = useState(false);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up poll timer
  useEffect(() => {
    return () => { if (pollTimerRef.current) clearTimeout(pollTimerRef.current); };
  }, []);

  // Start device flow
  async function startDeviceFlow() {
    setDeviceState("loading");
    try {
      const res = await fetch("/api/auth/device/start", { method: "POST" });
      const data = await res.json() as { device_code?: string; user_code?: string; verification_uri?: string; interval?: number; error?: string };
      if (!res.ok || data.error) {
        console.error("[Auth] Device flow start failed:", data.error);
        setDeviceState("idle");
        return;
      }
      setUserCode(data.user_code!);
      setVerificationUri(data.verification_uri ?? "https://github.com/login/device");
      setDeviceState("waiting");
      schedulePoll(data.device_code!, data.interval ?? 5);
    } catch (e) {
      console.error("[Auth] Device flow error:", e);
      setDeviceState("idle");
    }
  }

  function schedulePoll(dc: string, interval: number) {
    pollTimerRef.current = setTimeout(() => pollDeviceCode(dc, interval), interval * 1000);
  }

  async function pollDeviceCode(dc: string, interval: number) {
    try {
      const res = await fetch("/api/auth/device/poll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device_code: dc }),
      });
      const data = await res.json() as { status: string; error?: string; user?: { name?: string; login?: string } };

      if (data.status === "authorized") {
        setDeviceState("authorized");
        setUserName(data.user?.name || data.user?.login || "User");
        setTimeout(() => window.location.reload(), 1000);
        return;
      }
      if (data.status === "error") {
        console.error("[Auth] Device flow error:", data.error);
        setDeviceState("idle");
        return;
      }
      // Still pending — keep polling
      schedulePoll(dc, interval);
    } catch {
      const backoff = Math.min(interval * 2, 30);
      pollTimerRef.current = setTimeout(() => pollDeviceCode(dc, backoff), backoff * 1000);
    }
  }

  function copyCode() {
    navigator.clipboard?.writeText(userCode).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className={`flex flex-col h-full ${theme === 'dark' ? 'bg-[#0f0f0f] text-white' : 'bg-white text-gray-900'}`}>
      {/* ─── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800/50 bg-[#0a0a0a]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <Icons.Bot />
          </div>
          <span className="font-semibold text-sm text-white">AI Copilot</span>
        </div>
        
        <div className="flex items-center gap-1.5">
          {/* History Button */}
          <button
            onClick={onToggleHistory}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm transition-all ${
              showHistory
                ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                : "text-gray-400 hover:text-white hover:bg-gray-800/50 border border-transparent"
            }`}
            title="Chat History"
          >
            <Icons.History />
            <span className="hidden sm:inline">History</span>
          </button>
          
          {/* New Chat */}
          <button
            onClick={startNew}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800/50 transition-all"
            title="New Chat"
          >
            <Icons.Plus />
            <span className="hidden sm:inline">New</span>
          </button>
          
          {/* Theme Toggle */}
          <button
            onClick={() => {
              const newTheme = theme === 'dark' ? 'light' : 'dark';
              setTheme(newTheme);
              try { localStorage.setItem('ai_theme', newTheme); } catch {}
            }}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800/50 rounded-lg transition-all"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? <Icons.Sun /> : <Icons.Moon />}
          </button>
        </div>
      </div>
      
      {/* Mode & Model Bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800/30 bg-[#0d0d0d]">
        {/* Mode Selector */}
        <div className="relative" ref={modeDropdownRef}>
          <button
            onClick={() => setShowModeDropdown(!showModeDropdown)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium transition-all ${getModeColor(selectedMode)}`}
          >
            {selectedMode === "Agent" && <Icons.Sparkles />}
            {selectedMode}
            <Icons.ChevronDown />
          </button>
          
          {showModeDropdown && (
            <div className="absolute left-0 top-full mt-1 w-64 bg-[#1e1e1e] border border-gray-700 rounded-xl shadow-2xl overflow-hidden z-50">
              {MODES.map(mode => (
                <button
                  key={mode}
                  onClick={() => { setSelectedMode(mode); setShowModeDropdown(false); }}
                  className={`flex items-center gap-3 w-full px-3 py-2.5 text-left hover:bg-[#2a2a2a] transition-colors ${selectedMode === mode ? "bg-[#2a2a2a]" : ""}`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${
                    mode === "Agent" ? "bg-purple-500/20 text-purple-400" :
                    mode === "Edit" ? "bg-blue-500/20 text-blue-400" :
                    "bg-green-500/20 text-green-400"
                  }`}>
                    {mode === "Agent" && <Icons.Sparkles />}
                    {mode === "Edit" && <Icons.Wrench />}
                    {mode === "Ask" && <Icons.MessageSquare />}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-white text-sm">{mode}</div>
                    <div className="text-xs text-gray-400">{MODE_DESCRIPTIONS[mode]}</div>
                  </div>
                  {selectedMode === mode && <div className="text-green-400"><Icons.Check /></div>}
                </button>
              ))}
            </div>
          )}
        </div>
        
        {/* Model Selector */}
        <div className="relative" ref={modelDropdownRef}>
          <button
            onClick={() => setShowModelDropdown(!showModelDropdown)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[var(--ai-border,#374151)] bg-[var(--ai-card,#1a1a1a)] hover:bg-[#2a2a2a] text-xs transition-all max-w-[180px]"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 opacity-60">
              <rect x="4" y="4" width="16" height="16" rx="2" />
              <rect x="9" y="9" width="6" height="6" />
              <path d="M15 2v2M9 2v2M15 20v2M9 20v2M2 15h2M2 9h2M20 15h2M20 9h2" />
            </svg>
            <span className={`truncate font-medium ${getProviderColor(currentModel?.provider || "")}`}>
              {currentModel?.name || selectedModel}
            </span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 opacity-40">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          
          {showModelDropdown && (
            <div className="absolute right-0 top-full mt-1 w-64 bg-[#1e1e1e] border border-gray-700/80 rounded-xl shadow-2xl overflow-hidden z-50 max-h-80 overflow-y-auto">
              {modelsLoading ? (
                <div className="px-4 py-8 text-center text-gray-500 text-sm">
                  <div className="w-5 h-5 border-2 border-gray-600 border-t-blue-400 rounded-full animate-spin mx-auto mb-2" />
                  Loading models...
                </div>
              ) : filteredModels.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-500 text-sm">No models available</div>
              ) : (
                (() => {
                  // Group models by provider
                  const groups: Record<string, typeof filteredModels> = {};
                  filteredModels.forEach(m => {
                    const p = m.provider || "Other";
                    if (!groups[p]) groups[p] = [];
                    groups[p].push(m);
                  });
                  const providerOrder = ["Anthropic", "OpenAI", "Google", "Meta", "Mistral", "Microsoft", "xAI", "DeepSeek", "Cohere", "Other"];
                  const sortedProviders = Object.keys(groups).sort((a, b) => {
                    const ia = providerOrder.indexOf(a);
                    const ib = providerOrder.indexOf(b);
                    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
                  });

                  return sortedProviders.map((provider, pi) => (
                    <div key={provider}>
                      {pi > 0 && <div className="h-px bg-gray-700/50 mx-2" />}
                      <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                        <span className={getProviderColor(provider)}>{provider}</span>
                      </div>
                      {groups[provider].map(model => (
                        <button
                          key={model.id}
                          onClick={() => { setSelectedModel(model.id); setShowModelDropdown(false); }}
                          className={`flex items-center gap-2.5 w-full px-3 py-2 text-left hover:bg-white/5 transition-colors ${
                            selectedModel === model.id ? "bg-white/[0.07]" : ""
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-white text-[13px] truncate">{model.name}</span>
                              {model.isDefault && (
                                <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded-full border border-green-500/30 text-green-400 bg-green-500/10">Default</span>
                              )}
                              {model.isPremium && (
                                <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded-full border border-yellow-500/30 text-yellow-400 bg-yellow-500/10">Premium</span>
                              )}
                              {model.isPreview && (
                                <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded-full border border-blue-500/30 text-blue-400 bg-blue-500/10">Preview</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              {model.supportsTools && <span className="text-[10px] text-gray-500">Tools</span>}
                              {model.supportsVision && <span className="text-[10px] text-gray-500">Vision</span>}
                              {model.supportsThinking && <span className="text-[10px] text-gray-500">Think</span>}
                              {model.maxContextTokens && <span className="text-[10px] text-gray-500">{formatContext(model.maxContextTokens)}</span>}
                            </div>
                          </div>
                          {selectedModel === model.id && (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4ec9b0" strokeWidth="2.5" className="shrink-0">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </button>
                      ))}
                    </div>
                  ));
                })()
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* ─── Messages ─────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-4">
          {/* Welcome */}
          {currentMessages.length === 0 && (
            <div className="text-center py-8">
              <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <Icons.Bot />
              </div>
              <h2 className="text-lg font-bold text-white mb-2">How can I help?</h2>
              <p className="text-gray-400 text-sm max-w-xs mx-auto mb-4">
                Ask me about your mainframe, COBOL, datasets, or JCL.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {["List datasets", "Read COBOL", "Submit JCL", "Query DB2"].map(s => (
                  <button
                    key={s}
                    onClick={() => setInput(s)}
                    className="px-3 py-1.5 text-xs bg-[#1e1e1e] hover:bg-[#2a2a2a] rounded-lg text-gray-300 border border-gray-800 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {/* Messages */}
          {currentMessages.map(msg => (
            <div key={msg.id} className={`group flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
              {msg.role === "assistant" && (
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0 mt-1">
                  <Icons.Bot />
                </div>
              )}
              
              <div className={`max-w-[85%] ${msg.role === "user" ? "items-end" : "items-start"} flex flex-col`}>
                {/* User message - bubble or edit mode */}
                {msg.role === "user" ? (
                  editingMsgId === msg.id ? (
                    <div className="w-full bg-[#1a1a1a] rounded-xl border border-blue-500/50 p-2">
                      <textarea
                        value={editingContent}
                        onChange={e => setEditingContent(e.target.value)}
                        className="w-full bg-transparent text-white resize-none focus:outline-none text-sm"
                        rows={3}
                        autoFocus
                        onKeyDown={e => {
                          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) confirmEditMessage();
                          if (e.key === "Escape") setEditingMsgId(null);
                        }}
                      />
                      <div className="flex gap-2 mt-2 justify-end">
                        <button
                          onClick={() => setEditingMsgId(null)}
                          className="px-3 py-1 text-xs text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={confirmEditMessage}
                          className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
                        >
                          Resend <span className="text-blue-200/60 ml-1">Ctrl+Enter</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-[#2a2a2a] text-white rounded-2xl rounded-br-md px-4 py-2.5 text-sm leading-relaxed">
                      {msg.content}
                    </div>
                  )
                ) : (
                  /* Assistant message — Claude-style card */
                  <div className="text-gray-100 rounded-xl">
                    {/* Thinking — accordion with animation */}
                    {msg.thinking && msg.thinking.trim().length > 0 && (
                      <div className="mb-4">
                        {(() => {
                          const hasText = msg.content && msg.content.trim().length > 0;
                          const isExpanded = expandedThinking[msg.id] ?? !hasText;
                          return (
                            <div className="rounded-lg overflow-hidden border border-yellow-500/20 bg-[#1a1a1a]/50">
                              <button
                                onClick={() => toggleThinking(msg.id)}
                                className="flex items-center gap-2 w-full px-3 py-2 text-xs text-yellow-400/90 hover:text-yellow-400 hover:bg-yellow-500/5 transition-all"
                              >
                                <Icons.Brain />
                                <span className="font-medium">Thought process</span>
                                <svg
                                  width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                                  className={`ml-auto transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                                >
                                  <polyline points="6 9 12 15 18 9" />
                                </svg>
                              </button>
                              {isExpanded && (
                                <div className="px-3 pb-3 pt-1 border-t border-yellow-500/10 animate-[slideDown_0.15s_ease-out]">
                                  <pre className="text-xs text-gray-400 leading-relaxed max-h-60 overflow-y-auto whitespace-pre-wrap font-sans">
                                    {msg.thinking}
                                  </pre>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {/* Tool Calls — clean cards */}
                    {msg.toolCalls && msg.toolCalls.length > 0 && (
                      <div className="mb-4 space-y-2">
                        {msg.toolCalls.map((tc, i) => {
                          const toolKey = `${msg.id}-tc-${i}`;
                          const isExpanded = expandedTools[toolKey] ?? false;
                          const hasResult = tc.output && tc.output.length > 0;
                          return (
                            <div key={i} className="rounded-lg overflow-hidden border border-[#333] bg-[#1a1a1a]/60">
                              <div
                                className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-white/[0.03] transition-colors"
                                onClick={() => hasResult && setExpandedTools(p => ({ ...p, [toolKey]: !p[toolKey] }))}
                              >
                                <span className={`w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold ${
                                  tc.state === "done" ? "bg-green-500/20 text-green-400" :
                                  tc.state === "error" ? "bg-red-500/20 text-red-400" :
                                  "bg-yellow-500/20 text-yellow-400 animate-pulse"
                                }`}>
                                  {tc.state === "running" ? "…" : tc.state === "error" ? "✗" : "✓"}
                                </span>
                                <span className="text-sm text-blue-300 font-medium font-mono">{tc.name}</span>
                                {tc.state === "running" && (
                                  <span className="text-[10px] text-yellow-400/70">Running...</span>
                                )}
                                {hasResult && (
                                  <span className="ml-auto text-[10px] text-gray-500 flex items-center gap-1">
                                    Result
                                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
                                      className={`transition-transform duration-150 ${isExpanded ? 'rotate-180' : ''}`}>
                                      <polyline points="6 9 12 15 18 9" />
                                    </svg>
                                  </span>
                                )}
                              </div>
                              {isExpanded && hasResult && (
                                <div className="px-3 py-3 border-t border-[#2a2a2a] bg-[#111] animate-[slideDown_0.15s_ease-out]">
                                  <pre className="text-[11px] text-gray-300 whitespace-pre-wrap font-mono leading-relaxed max-h-48 overflow-y-auto">
                                    {tc.output}
                                  </pre>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Markdown content */}
                    <div className="message-content">
                      {msg.content ? (
                        <MarkdownText>{msg.content}</MarkdownText>
                      ) : loading ? (
                        <div className="flex items-center gap-2 py-3">
                          <div className="flex gap-1 px-3 py-1.5 rounded-full bg-[#1a1a1a] border border-[#333]">
                            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-[pulse_1.5s_ease-in-out_infinite]" />
                            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-[pulse_1.5s_ease-in-out_0.5s_infinite]" />
                            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-[pulse_1.5s_ease-in-out_1s_infinite]" />
                          </div>
                        </div>
                      ) : null}

                      {/* Streaming cursor */}
                      {loading && msg.content && msg.content.length > 0 && (
                        <span className="inline-block w-1.5 h-4 bg-blue-400/70 animate-[pulse_1s_ease-in-out_infinite] ml-0.5 align-text-bottom rounded-sm" />
                      )}
                    </div>
                  </div>
                )}
                
                {/* Timestamp & Model + Actions */}
                <div className={`flex items-center gap-2 text-[10px] mt-1 px-1 ${msg.role === "user" ? "justify-end" : ""}`}>
                  {/* Message Actions */}
                  <div className={`flex items-center gap-1 opacity-0 hover:opacity-100 group-hover:opacity-100 transition-opacity ${msg.role === "user" ? "order-first" : ""}`}>
                    {/* Copy Button */}
                    <button
                      onClick={() => handleCopy(msg.content, msg.id)}
                      className="p-1 text-gray-500 hover:text-white hover:bg-white/10 rounded transition-colors"
                      title="Copy"
                    >
                      {copiedId === msg.id ? <Icons.Check /> : <Icons.Copy />}
                    </button>
                    
                    {/* Regenerate Button (assistant only) */}
                    {msg.role === "assistant" && (
                      <button
                        onClick={() => handleRegenerate(msg.id)}
                        className="p-1 text-gray-500 hover:text-white hover:bg-white/10 rounded transition-colors"
                        title="Regenerate"
                      >
                        <Icons.RefreshCw />
                      </button>
                    )}
                    
                    {/* Edit Button (user only) */}
                    {msg.role === "user" && (
                      <button
                        onClick={() => startEditMessage(msg.id, msg.content)}
                        className="p-1 text-gray-500 hover:text-white hover:bg-white/10 rounded transition-colors"
                        title="Edit"
                      >
                        <Icons.Edit3 />
                      </button>
                    )}
                  </div>
                  
                  {/* Timestamp */}
                  <span className="text-gray-600">
                    {msg.model && msg.role === "assistant" && `${msg.model} · `}
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              </div>
              
              {msg.role === "user" && (
                <div className="w-7 h-7 rounded-full bg-[#2a2a2a] flex items-center justify-center flex-shrink-0 mt-1">
                  <Icons.User />
                </div>
              )}
            </div>
          ))}
          
          <div ref={messagesEndRef} />
        </div>
      </div>
      
      {/* ─── Input ────────────────────────────────────────────────────────── */}
      <div className="border-t border-gray-800/50 bg-[#0a0a0a] p-3">
        {/* Attachments */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {attachments.map((att, i) => (
              <div key={i} className="flex items-center gap-1.5 px-2 py-1 bg-[#1e1e1e] rounded text-xs border border-gray-700/50">
                <span className="text-blue-400">📄</span>
                <span className="text-gray-300 truncate max-w-[100px]">{att.name}</span>
                <button onClick={() => removeAttachment(i)} className="text-gray-500 hover:text-red-400"><Icons.X /></button>
              </div>
            ))}
          </div>
        )}
        
        {/* Slash Commands */}
        {showSlashCommands && (
          <div className="mb-2 p-2 bg-[#1e1e1e] rounded-lg border border-gray-700/50">
            {SLASH_COMMANDS.filter(c => c.modes.includes(selectedMode)).slice(0, 5).map(cmd => (
              <button
                key={cmd.name}
                onClick={() => insertSlashCommand(cmd.name)}
                className="flex items-center gap-2 w-full px-2 py-1.5 text-xs text-gray-300 hover:bg-[#2a2a2a] rounded transition-colors"
              >
                <span className="text-blue-400 font-mono">/{cmd.name}</span>
                <span className="text-gray-500 truncate">{cmd.desc}</span>
              </button>
            ))}
          </div>
        )}
        
        {/* Input Box */}
        <div className="flex items-end gap-2 bg-[#1a1a1a] rounded-xl border border-gray-700/50 p-2 focus-within:border-gray-600">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg transition-colors"
            title="Attach file"
          >
            <Icons.Paperclip />
          </button>
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileChange} />
          
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => { setInput(e.target.value); setShowSlashCommands(e.target.value === "/"); }}
            onKeyDown={handleKeyDown}
            placeholder={!isAuthenticated ? "Sign in to start chatting..." : `Message ${currentModel?.name?.split(" ")[0] || ""}...`}
            className="flex-1 bg-transparent text-white placeholder-gray-500 resize-none focus:outline-none py-1 text-sm"
            rows={1}
            disabled={loading || !isAuthenticated}
            style={{ minHeight: "36px" }}
          />
          
          {loading ? (
            <button
              onClick={stopGeneration}
              className="p-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all animate-pulse"
              title="Stop generation"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!isAuthenticated || (!input.trim() && attachments.length === 0)}
              className="p-1.5 bg-white text-black rounded-lg hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <Icons.Send />
            </button>
          )}
        </div>
        
        <div className="text-xs text-gray-600 mt-1.5 text-center">
          <kbd className="px-1 py-0.5 bg-[#1a1a1a] rounded">Enter</kbd> send · 
          <kbd className="px-1 py-0.5 bg-[#1a1a1a] rounded ml-1">Shift+Enter</kbd> newline · 
          <kbd className="px-1 py-0.5 bg-[#1a1a1a] rounded ml-1">/</kbd> commands
        </div>
      </div>

      {/* ─── Login Modal ─────────────────────────────────────────────────── */}
      {showLogin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1a1a1a] border border-gray-700 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Sign In</h3>
            </div>

            {/* IDLE / ERROR */}
            {deviceState === "idle" && (
              <>
                <p className="text-sm text-gray-400 mb-4">
                  Sign in with your GitHub account to use the AI assistant.
                </p>
                <button
                  onClick={startDeviceFlow}
                  className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-[#238636] hover:bg-[#2ea043] text-white font-medium rounded-xl transition-colors"
                >
                  <svg height="20" width="20" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
                  </svg>
                  Continue with GitHub
                </button>
                <p className="text-xs text-gray-500 text-center mt-2">
                  Requires an active GitHub Copilot subscription
                </p>
              </>
            )}

            {/* LOADING */}
            {deviceState === "loading" && (
              <div className="flex items-center justify-center gap-2 py-4">
                <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-gray-400">Connecting to GitHub...</span>
              </div>
            )}

            {/* WAITING — show device code */}
            {deviceState === "waiting" && (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-gray-300">1. Copy this code:</p>
                <div className="flex items-center gap-2">
                  <span className="flex-1 text-center text-xl font-mono tracking-widest text-green-400 bg-[#111] border border-gray-700 rounded px-4 py-2 select-all">
                    {userCode}
                  </span>
                  <button
                    onClick={copyCode}
                    className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                    title="Copy code"
                  >
                    {copied ? <Icons.Check /> : <Icons.Copy />}
                  </button>
                </div>
                <p className="text-sm text-gray-300">2. Open GitHub and enter the code:</p>
                <a
                  href={verificationUri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-[#24292e] hover:bg-[#333] text-white font-medium rounded-xl transition-colors"
                >
                  <svg height="20" width="20" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
                  </svg>
                  Open github.com/login/device
                </a>
                <div className="flex items-center gap-2 mt-1">
                  <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs text-gray-500">Waiting for authorization...</span>
                </div>
              </div>
            )}

            {/* AUTHORIZED */}
            {deviceState === "authorized" && (
              <div className="flex items-center justify-center gap-2 py-4">
                <span className="text-green-400 text-2xl">✓</span>
                <span className="text-sm text-green-400">Authorized! Redirecting...</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default AICopilot;
