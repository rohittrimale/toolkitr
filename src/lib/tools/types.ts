/**
 * Tool types — inspired by Claude Code's Tool.ts
 */

// ── Tool Parameter ─────────────────────────────────────────────────────────

export interface ToolParameter {
  name: string
  type: 'string' | 'number' | 'boolean' | 'object' | 'array'
  description: string
  required: boolean
  enum?: string[]
}

// ── Tool Result ────────────────────────────────────────────────────────────

export interface ToolResult {
  success: boolean
  content: string
  error?: string
  metadata?: Record<string, unknown>
}

// ── Tool Definition ────────────────────────────────────────────────────────

export interface ToolDefinition {
  name: string
  description: string
  parameters: ToolParameter[]
  handler: (args: Record<string, unknown>) => Promise<ToolResult>
  isReadOnly: boolean
  isConcurrencySafe: boolean
  category: 'filesystem' | 'web' | 'shell' | 'skills' | 'mcp' | 'lsp' | 'mainframe' | 'memory'
  icon?: string
}

// ── API Tool Format (OpenAI function calling) ──────────────────────────────

export interface ApiToolDefinition {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: {
      type: 'object'
      properties: Record<string, { type: string; description: string; enum?: string[] }>
      required: string[]
    }
  }
}

// ── Skill Definition ───────────────────────────────────────────────────────

export interface SkillDefinition {
  name: string
  description: string
  aliases?: string[]
  argumentHint?: string
  whenToUse?: string
  allowedTools?: string[]
  getPromptForCommand: (args: string) => Promise<string>
  icon?: string
}

// ── MCP Server Config ──────────────────────────────────────────────────────

export interface McpServerConfig {
  name: string
  type: 'stdio' | 'http'
  command?: string
  args?: string[]
  url?: string
  enabled: boolean
}
