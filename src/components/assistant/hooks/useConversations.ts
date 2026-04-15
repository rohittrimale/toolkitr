import { useCallback, useEffect, useState } from "react";
import { generateId } from "@/lib/core/utils";

// Use this type instead of importing from types.ts to match API response
interface Conversation {
  id: string;
  title: string;
  mode: string;
  createdAt: Date;
}

interface UseConversationsReturn {
  conversations: Conversation[];
  activeId: string | null;
  loading: boolean;
  setActiveId: (id: string | null) => void;
  startNew: () => string;
  fetchConversations: () => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  renameConversation: (id: string, title: string) => Promise<void>;
  autoGenerateTitle: (id: string, messageContent: string) => void;
}

export function useConversations(): UseConversationsReturn {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch conversations from API
  const fetchConversations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/conversations");
      if (res.ok) {
        const data = await res.json();
        // API returns created_at (snake_case), convert to createdAt
        const convs = (data.conversations ?? []).map((c: {
          id: string;
          title: string;
          mode?: string;
          created_at?: string;
        }) => ({
          id: c.id,
          title: c.title,
          mode: c.mode || "Agent",
          createdAt: c.created_at ? new Date(c.created_at) : new Date(),
        }));
        setConversations(convs);
      }
    } catch (err) {
      console.error("[useConversations] fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Start new conversation - persist to DB
  const startNew = useCallback(() => {
    const newId = generateId();
    
    // Save to database
    fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: newId, title: "New Chat", mode: "Agent" }),
    }).catch(err => console.error("[useConversations] create error:", err));
    
    // Add to local state immediately (optimistic update)
    const newConv: Conversation = {
      id: newId,
      title: "New Chat",
      mode: "Agent",
      createdAt: new Date(),
    };
    setConversations(prev => [newConv, ...prev]);
    setActiveId(newId);
    
    return newId;
  }, []);

  // Auto-generate title from message content
  const autoGenerateTitle = useCallback((id: string, messageContent: string) => {
    // Extract first meaningful sentence as title
    let title = messageContent
      .split(/[.!?]/)[0] // Take first sentence
      .split('\n')[0] // Take first line
      .trim()
      .slice(0, 60); // Max 60 chars
    
    // Add ellipsis if truncated
    if (messageContent.length > 60) {
      title += "...";
    }
    
    // Clean up
    title = title.replace(/\s+/g, ' ').trim();
    
    if (!title || title.length < 3) {
      title = "New Chat";
    }
    
    // Update locally
    setConversations(prev => 
      prev.map(c => c.id === id ? { ...c, title } : c)
    );
    
    // Update in DB (fire and forget)
    fetch(`/api/conversations/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    }).catch(err => console.error("[useConversations] auto-title error:", err));
  }, []);

  // Delete conversation
  const deleteConversation = useCallback(async (id: string) => {
    // Optimistic update
    const prevConvs = conversations;
    setConversations(prev => prev.filter(c => c.id !== id));
    if (activeId === id) {
      const remaining = conversations.filter(c => c.id !== id);
      setActiveId(remaining[0]?.id ?? null);
    }
    
    try {
      await fetch(`/api/conversations/${id}`, { method: "DELETE" });
    } catch (err) {
      console.error("[useConversations] delete error:", err);
      // Rollback on error
      setConversations(prevConvs);
    }
  }, [activeId, conversations]);

  // Rename conversation
  const renameConversation = useCallback(async (id: string, title: string) => {
    // Optimistic update
    setConversations(prev =>
      prev.map(c => (c.id === id ? { ...c, title } : c))
    );
    
    try {
      await fetch(`/api/conversations/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
    } catch (err) {
      console.error("[useConversations] rename error:", err);
    }
  }, []);

  // Load conversations on mount
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  return {
    conversations,
    activeId,
    loading,
    setActiveId,
    startNew,
    fetchConversations,
    deleteConversation,
    renameConversation,
    autoGenerateTitle,
  };
}
