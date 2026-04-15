"use client";
import { useCallback, useMemo, useState } from "react";
import { useConversations } from "./hooks/useConversations";

// ─── Icons ────────────────────────────────────────────────────────────────────
const Icons = {
  Search: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>,
  MessageSquare: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  Plus: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>,
  Trash: () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>,
  Edit: () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>,
  ArrowLeft: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>,
  X: () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>,
  Sparkles: () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>,
  Clock: () => <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  Bot: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>,
  Calendar: () => <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>,
};

// ─── Props ────────────────────────────────────────────────────────────────────
interface HistoryPanelProps {
  onClose: () => void;
}

// ─── Mode Badge Component ─────────────────────────────────────────────────────
function ModeBadge({ mode }: { mode: string }) {
  const colors = {
    Agent: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    Edit: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    Ask: "bg-green-500/20 text-green-400 border-green-500/30",
  }[mode] || "bg-gray-500/20 text-gray-400 border-gray-500/30";
  
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${colors}`}>
      {mode}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function HistoryPanel({ onClose }: HistoryPanelProps) {
  const {
    conversations,
    activeId,
    setActiveId,
    startNew,
    deleteConversation,
    renameConversation,
  } = useConversations();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  
  // Filter conversations
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter(c => (c.title || "").toLowerCase().includes(q));
  }, [conversations, searchQuery]);
  
  // Group by date
  const grouped = useMemo(() => {
    const groups: { label: string; icon: React.ReactNode; items: typeof conversations }[] = [];
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 86400000);
    const weekAgo = new Date(today.getTime() - 7 * 86400000);
    
    const t: typeof conversations = [];
    const y: typeof conversations = [];
    const w: typeof conversations = [];
    const o: typeof conversations = [];
    
    filtered.forEach(conv => {
      const d = new Date(conv.createdAt);
      if (d >= today) t.push(conv);
      else if (d >= yesterday) y.push(conv);
      else if (d >= weekAgo) w.push(conv);
      else o.push(conv);
    });
    
    if (t.length) groups.push({ label: "Today", icon: <Icons.Clock />, items: t });
    if (y.length) groups.push({ label: "Yesterday", icon: <Icons.Clock />, items: y });
    if (w.length) groups.push({ label: "Last 7 Days", icon: <Icons.Calendar />, items: w });
    if (o.length) groups.push({ label: "Older", icon: <Icons.Calendar />, items: o });
    
    return groups;
  }, [filtered]);
  
  // Total count
  const totalCount = conversations.length;
  
  // Select conversation and close
  const selectConversation = useCallback((id: string) => {
    setActiveId(id);
    onClose();
  }, [setActiveId, onClose]);
  
  // New chat and close
  const handleNewChat = useCallback(() => {
    startNew();
    onClose();
  }, [startNew, onClose]);
  
  // Rename
  const startRename = useCallback((id: string, title: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(id);
    setEditingTitle(title || "New Chat");
  }, []);
  
  const confirmRename = useCallback(() => {
    if (editingId && editingTitle.trim()) {
      renameConversation(editingId, editingTitle.trim());
    }
    setEditingId(null);
    setEditingTitle("");
  }, [editingId, editingTitle, renameConversation]);
  
  // Delete with confirmation
  const handleDelete = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (deleteConfirmId === id) {
      deleteConversation(id);
      setDeleteConfirmId(null);
    } else {
      setDeleteConfirmId(id);
      // Auto-cancel after 3 seconds
      setTimeout(() => setDeleteConfirmId(null), 3000);
    }
  }, [deleteConfirmId, deleteConversation]);
  
  return (
    <div className="flex flex-col h-full" style={{ 
      background: 'linear-gradient(180deg, #0c1929 0%, #0a0f1a 100%)',
    }}>
      {/* Header */}
      <div className="px-4 py-4 border-b border-white/5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-all duration-200"
              title="Back"
            >
              <Icons.ArrowLeft />
            </button>
            <div>
              <h2 className="font-semibold text-white text-sm">Chat History</h2>
              <p className="text-xs text-gray-500">{totalCount} conversation{totalCount !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <button
            onClick={handleNewChat}
            className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white text-xs font-medium rounded-lg transition-all duration-200 shadow-lg shadow-blue-500/20"
          >
            <Icons.Plus />
            New
          </button>
        </div>
        
        {/* Search */}
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
            <Icons.Search />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search conversations..."
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-8 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:bg-white/10 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
            >
              <Icons.X />
            </button>
          )}
        </div>
      </div>
      
      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {/* Empty State */}
        {grouped.length === 0 && !searchQuery && (
          <div className="flex flex-col items-center justify-center h-full px-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center mb-4">
              <Icons.Bot />
            </div>
            <h3 className="text-white font-medium mb-1">No conversations yet</h3>
            <p className="text-gray-500 text-sm text-center mb-4">
              Start a new chat to begin your conversation with the AI assistant
            </p>
            <button
              onClick={handleNewChat}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white text-sm font-medium rounded-xl transition-all duration-200 shadow-lg shadow-blue-500/20"
            >
              <Icons.Sparkles />
              Start New Chat
            </button>
          </div>
        )}
        
        {/* No Results */}
        {searchQuery && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 px-4">
            <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-3">
              <Icons.Search />
            </div>
            <p className="text-gray-400 text-sm">No chats found for "{searchQuery}"</p>
          </div>
        )}
        
        {/* Groups */}
        {grouped.map((group, groupIdx) => (
          <div key={group.label} className="mb-4">
            <div className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
              <span className="text-gray-600">{group.icon}</span>
              {group.label}
              <span className="ml-auto text-gray-600 text-[10px] font-normal lowercase">{group.items.length}</span>
            </div>
            <div className="space-y-0.5">
              {group.items.map(conv => {
                const isActive = activeId === conv.id;
                const isEditing = editingId === conv.id;
                const isConfirmingDelete = deleteConfirmId === conv.id;
                
                return (
                  <div
                    key={conv.id}
                    className={`group relative flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 ${
                      isActive 
                        ? "bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/20" 
                        : isConfirmingDelete
                        ? "bg-red-500/10 border border-red-500/20"
                        : "hover:bg-white/5 border border-transparent"
                    }`}
                    onClick={() => !isEditing && selectConversation(conv.id)}
                  >
                    {/* Active indicator */}
                    {isActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-gradient-to-b from-blue-400 to-purple-400 rounded-r" />
                    )}
                    
                    {/* Icon */}
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      isActive 
                        ? "bg-gradient-to-br from-blue-500 to-purple-600 text-white" 
                        : "bg-white/5 text-gray-400"
                    }`}>
                      <Icons.MessageSquare />
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editingTitle}
                          onChange={e => setEditingTitle(e.target.value)}
                          onBlur={confirmRename}
                          onKeyDown={e => { 
                            if (e.key === "Enter") confirmRename(); 
                            if (e.key === "Escape") { setEditingId(null); setEditingTitle(""); }
                          }}
                          className="w-full bg-transparent border-b border-blue-500 text-sm text-white outline-none py-0.5"
                          autoFocus
                          onClick={e => e.stopPropagation()}
                        />
                      ) : (
                        <>
                          <div className={`text-sm truncate ${isActive ? "text-white font-medium" : "text-gray-200"}`}>
                            {conv.title || "New Chat"}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <ModeBadge mode={conv.mode || "Agent"} />
                            <span className="text-[10px] text-gray-500">
                              {new Date(conv.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                    
                    {/* Actions */}
                    {!isEditing && (
                      <div className={`flex items-center gap-0.5 transition-opacity ${
                        isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                      }`}>
                        <button
                          onClick={e => startRename(conv.id, conv.title, e)}
                          className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                          title="Rename"
                        >
                          <Icons.Edit />
                        </button>
                        <button
                          onClick={e => handleDelete(conv.id, e)}
                          className={`p-1.5 rounded-lg transition-all ${
                            isConfirmingDelete 
                              ? "text-red-400 bg-red-500/20 hover:bg-red-500/30" 
                              : "text-gray-400 hover:text-red-400 hover:bg-red-500/10"
                          }`}
                          title={isConfirmingDelete ? "Click again to confirm" : "Delete"}
                        >
                          <Icons.Trash />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      
      {/* Footer */}
      <div className="px-4 py-3 border-t border-white/5">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-1.5">
            <Icons.Bot />
            <span>AI Copilot</span>
          </div>
          <span>{totalCount} chats</span>
        </div>
      </div>
    </div>
  );
}

export default HistoryPanel;
