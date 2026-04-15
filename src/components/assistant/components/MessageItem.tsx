'use client';

import type { Message, ToolCallEntry } from '@/lib/core/types';
import { MarkdownText } from './MarkdownText';
import MessageActions from './MessageActions';

// ── Tool Call Card ─────────────────────────────────────────────────────────

interface ToolCallCardProps {
  toolCall: ToolCallEntry;
  isExpanded: boolean;
  onToggle: () => void;
}

function ToolCallCard({ toolCall, isExpanded, onToggle }: ToolCallCardProps) {
  const hasResult = !!toolCall.output;
  const statusColor = toolCall.state === 'done' ? 'green' : toolCall.state === 'error' ? 'red' : 'yellow';

  return (
    <div className="rounded-lg border border-[#333] bg-[#1a1a1a]/60 overflow-hidden">
      <div
        className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-white/[0.03] transition-colors"
        onClick={hasResult ? onToggle : undefined}
      >
        <span className={`w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold ${
          statusColor === 'green' ? 'bg-green-500/20 text-green-400' :
          statusColor === 'red' ? 'bg-red-500/20 text-red-400' :
          'bg-yellow-500/20 text-yellow-400 animate-pulse'
        }`}>
          {toolCall.state === 'running' ? '…' : toolCall.state === 'error' ? '✗' : '✓'}
        </span>
        <span className="text-sm text-blue-300 font-medium font-mono">{toolCall.name}</span>
        {toolCall.state === 'running' && (
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
            {toolCall.output}
          </pre>
        </div>
      )}
    </div>
  );
}

// ── Thinking Accordion ─────────────────────────────────────────────────────

interface ThinkingAccordionProps {
  thinking: string;
  isExpanded: boolean;
  onToggle: () => void;
  isStreaming: boolean;
}

function ThinkingAccordion({ thinking, isExpanded, onToggle, isStreaming }: ThinkingAccordionProps) {
  return (
    <div className="rounded-lg overflow-hidden border border-yellow-500/20 bg-[#1a1a1a]/50 mb-4">
      <button
        onClick={onToggle}
        className="flex items-center gap-2 w-full px-3 py-2 text-xs text-yellow-400/90 hover:text-yellow-400 hover:bg-yellow-500/5 transition-all"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z" />
          <path d="M12 16v-4" />
          <path d="M12 8h.01" />
        </svg>
        <span className="font-medium">
          {isStreaming ? 'Thinking...' : 'Thought process'}
        </span>
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
            {thinking}
          </pre>
        </div>
      )}
    </div>
  );
}

// ── Message Item ───────────────────────────────────────────────────────────

interface MessageItemProps {
  message: Message;
  isStreaming: boolean;
  expandedThinking: Record<string, boolean>;
  expandedTools: Record<string, boolean>;
  onToggleThinking: (id: string) => void;
  onToggleTool: (key: string) => void;
  onCopy: (content: string) => void;
  onRetry?: (id: string) => void;
  onEdit?: (id: string, content: string) => void;
  onDelete?: (id: string) => void;
}

export default function MessageItem({
  message,
  isStreaming,
  expandedThinking,
  expandedTools,
  onToggleThinking,
  onToggleTool,
  onCopy,
  onRetry,
  onEdit,
  onDelete,
}: MessageItemProps) {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';

  return (
    <div className={`group flex gap-3 ${isUser ? 'justify-end' : ''}`}>
      {/* Assistant avatar */}
      {isAssistant && (
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0 mt-1">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <path d="M12 8V4H8" />
            <rect width="16" height="12" x="4" y="8" rx="2" />
            <path d="M2 14h2" />
            <path d="M20 14h2" />
            <path d="M15 13v2" />
            <path d="M9 13v2" />
          </svg>
        </div>
      )}

      {/* Message content */}
      <div className={`max-w-[85%] flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
        {/* User message bubble */}
        {isUser && (
          <div className="bg-[#2a2a2a] text-white rounded-2xl rounded-br-md px-4 py-2.5 text-sm leading-relaxed">
            {message.content}
          </div>
        )}

        {/* Assistant message */}
        {isAssistant && (
          <div className="text-gray-100 rounded-xl">
            {/* Thinking */}
            {message.thinking && message.thinking.trim().length > 0 && (
              <ThinkingAccordion
                thinking={message.thinking}
                isExpanded={expandedThinking[message.id] ?? !message.content?.trim()}
                onToggle={() => onToggleThinking(message.id)}
                isStreaming={isStreaming}
              />
            )}

            {/* Tool calls */}
            {message.toolCalls && message.toolCalls.length > 0 && (
              <div className="mb-4 space-y-2">
                {message.toolCalls.map((tc, i) => (
                  <ToolCallCard
                    key={`${message.id}-tc-${i}`}
                    toolCall={tc}
                    isExpanded={expandedTools[`${message.id}-tc-${i}`] ?? false}
                    onToggle={() => onToggleTool(`${message.id}-tc-${i}`)}
                  />
                ))}
              </div>
            )}

            {/* Markdown content */}
            <div className="message-content">
              {message.content ? (
                <MarkdownText>{message.content}</MarkdownText>
              ) : isStreaming ? (
                <div className="flex items-center gap-2 py-3">
                  <div className="flex gap-1 px-3 py-1.5 rounded-full bg-[#1a1a1a] border border-[#333]">
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-[pulse_1.5s_ease-in-out_infinite]" />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-[pulse_1.5s_ease-in-out_0.5s_infinite]" />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-[pulse_1.5s_ease-in-out_1s_infinite]" />
                  </div>
                </div>
              ) : null}

              {/* Streaming cursor */}
              {isStreaming && message.content && message.content.length > 0 && (
                <span className="inline-block w-1.5 h-4 bg-blue-400/70 animate-[pulse_1s_ease-in-out_infinite] ml-0.5 align-text-bottom rounded-sm" />
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 mt-1">
          <MessageActions
            content={message.content}
            isAssistant={isAssistant}
            isStreaming={isStreaming}
            onCopy={() => onCopy(message.content)}
            onRetry={isAssistant && onRetry ? () => onRetry(message.id) : undefined}
            onEdit={!isAssistant && onEdit ? () => onEdit(message.id, message.content) : undefined}
            onDelete={onDelete ? () => onDelete(message.id) : undefined}
          />
          <span className="text-[10px] text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity">
            {message.model || ''}
          </span>
        </div>
      </div>

      {/* User avatar */}
      {isUser && (
        <div className="w-7 h-7 rounded-full bg-[#2a2a2a] flex items-center justify-center flex-shrink-0 mt-1">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>
      )}
    </div>
  );
}
