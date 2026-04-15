/**
 * Build tool — creates a complete ToolDefinition with defaults (like Claude Code's buildTool)
 */

import type { ToolDefinition, ToolParameter, ToolResult } from './types'

type ToolInput = Omit<ToolDefinition, 'isReadOnly' | 'isConcurrencySafe' | 'category'> & {
  isReadOnly?: boolean
  isConcurrencySafe?: boolean
  category?: ToolDefinition['category']
}

export function buildTool(def: ToolInput): ToolDefinition {
  return {
    name: def.name,
    description: def.description,
    parameters: def.parameters,
    handler: def.handler,
    isReadOnly: def.isReadOnly ?? false,
    isConcurrencySafe: def.isConcurrencySafe ?? def.isReadOnly ?? false,
    category: def.category ?? 'filesystem',
    icon: def.icon,
  }
}

/**
 * Create a tool result
 */
export function toolSuccess(content: string, metadata?: Record<string, unknown>): ToolResult {
  return { success: true, content, metadata }
}

export function toolError(error: string): ToolResult {
  return { success: false, content: '', error }
}
