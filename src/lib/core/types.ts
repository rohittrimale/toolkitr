import type { Mode } from "./data";

export type Role = "user" | "assistant" | "tool";

export interface ContextAttachment {
  id: string;
  kind: "file" | "selection" | "codebase" | "editor" | "terminal" | "error" | "image";
  label: string;
  content?: string;  // text content or base64 data-URL (images)
  mimeType?: string; // e.g. "image/png" — only set for kind: "image"
}

export interface MemoryEntry {
  id: string;
  fact: string;
  addedAt: string; // ISO date string
}

export interface Project {
  id: string;
  name: string;
  color: string; // hex colour for folder icon
  createdAt: Date;
}

export interface ToolCallEntry {
  id: string;
  name: string;
  input: Record<string, unknown>;
  output?: string;
  state: "running" | "done" | "error";
  startedAt?: number;    // timestamp when tool was called
  completedAt?: number;  // timestamp when tool finished
  iterationNum?: number; // which iteration this was (for agentic loop visualization)
}

export interface TokenUsage {
  input: number;
  output: number;
  thinking?: number; // Anthropic thinking tokens (where available)
}

export interface MainframeAction {
  action_type: string;
  row?: number;
  col?: number;
  text?: string;
  field_label?: string;           // Field label for universal field detection
  ispf_command?: string;
  tso_command?: string;
  keystroke?: string;
  find_text?: string;
  replace_text?: string;
  confirmation_required?: boolean;
  next_step?: string;
  explanation?: string;
  // JCL support
  jcl_content?: string;           // Full JCL text to submit
  jcl_dataset?: string;           // Dataset to store JCL
  sort_input_dataset?: string;    // Input dataset for SORT
  sort_output_dataset?: string;   // Output dataset for SORT
  sort_fields?: Array<{           // Sort key definitions
    position: number;             // Starting position (1-based)
    length: number;               // Field length
    type?: 'CH' | 'ZD' | 'PD' | 'BI';  // Field type (CH=char, ZD=zoned, etc)
    order?: 'A' | 'D';            // A=ascending, D=descending
  }>;
  auto_submit?: boolean;          // Auto-submit job after creation
  // Multi-field writes
  fields?: Array<{                // For WRITE_FIELDS action
    field_label: string;          // Field label
    text: string;                 // Value to write
    row?: number;                 // Backup row
    col?: number;                 // Backup col
  }>;
  // Dataset name handling
  is_dataset_name?: boolean;      // Explicitly mark text as dataset name (for quoting)
}

export interface Message {
  id: string;
  role: Role;
  content: string;
  thinking?: string;   // Extended thinking text (Claude)
  tokens?: TokenUsage; // Token usage for this response
  model?: string;
  mode?: Mode;
  participant?: string;
  toolCalls?: ToolCallEntry[];
  attachments?: ContextAttachment[];
  followUps?: string[];  // Follow-up question suggestions
  hidden?: boolean;      // when true: system message (AGENT_CONTINUE etc.) — hidden from UI
  mainframeAction?: MainframeAction;  // Mainframe action associated with message
  createdAt: Date;
}

export interface Conversation {
  id: string;
  title: string;
  mode: Mode;
  createdAt: Date;
  previousResponseId?: string;  // last Responses API response ID for stateful chaining
  projectId?: string;           // optional project grouping
}

export type FeedbackState = "up" | "down" | null;

export interface Settings {
  model: string;
  mode: Mode;
  temperature: number;
  memory: boolean;
  tools: boolean;
  contextFiles: boolean;
  customInstructions: string;
  // API routing
  useMessagesApi: boolean;
  useResponsesApi: boolean;
  // Anthropic extended thinking
  thinkingBudgetTokens: number;
  thinkingEffort: "none" | "low" | "medium" | "high";
  // Responses API reasoning
  responsesReasoningEffort: "low" | "medium" | "high";
  responsesReasoningSummary: "none" | "auto" | "concise" | "detailed";
  // BYOK
  anthropicApiKey: string;
  openaiApiKey: string;
  byokEndpoint: string;
  // Agent
  agentTemperature: number;
  switchAgentEnabled: boolean;
  summarizeAgentHistory: boolean;
  // Features
  followUpSuggestions: boolean;  // Show follow-up question chips after responses
  braveSearchApiKey: string;     // Optional Brave Search API key for web search
  // Context window management
  maxContextWindow: number;      // Max tokens to keep in conversation (auto-trim older messages)
}
