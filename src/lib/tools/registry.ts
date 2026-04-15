/**
 * Tool registry — unified registry for all tools (built-in + MCP)
 */

import type { ToolDefinition, ApiToolDefinition, SkillDefinition } from './types'

class ToolRegistry {
  private tools = new Map<string, ToolDefinition>()
  private skills = new Map<string, SkillDefinition>()
  private mcpTools = new Map<string, ToolDefinition[]>()

  /** Register a built-in tool */
  register(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool)
  }

  /** Register multiple tools */
  registerAll(tools: ToolDefinition[]): void {
    for (const tool of tools) {
      this.tools.set(tool.name, tool)
    }
  }

  /** Get a tool by name */
  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name) ?? this.getMcpTool(name)
  }

  /** List all tools */
  list(): ToolDefinition[] {
    const builtIn = [...this.tools.values()]
    const mcp = [...this.mcpTools.values()].flat()
    return [...builtIn, ...mcp]
  }

  /** List tools by category */
  listByCategory(category: string): ToolDefinition[] {
    return this.list().filter(t => t.category === category)
  }

  /** Format tools for AI API (OpenAI function calling format) */
  toApiTools(): ApiToolDefinition[] {
    return this.list().map(t => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: {
          type: 'object' as const,
          properties: Object.fromEntries(
            t.parameters.map(p => [p.name, {
              type: p.type,
              description: p.description,
              ...(p.enum ? { enum: p.enum } : {}),
            }])
          ),
          required: t.parameters.filter(p => p.required).map(p => p.name),
        }
      }
    }))
  }

  /** Execute a tool by name */
  async execute(name: string, args: Record<string, unknown>): Promise<import('./types').ToolResult> {
    const tool = this.get(name)
    if (!tool) {
      return { success: false, content: '', error: `Tool not found: ${name}` }
    }
    try {
      return await tool.handler(args)
    } catch (err) {
      return {
        success: false,
        content: '',
        error: err instanceof Error ? err.message : String(err),
      }
    }
  }

  // ── Skills ───────────────────────────────────────────────────────────────

  registerSkill(skill: SkillDefinition): void {
    this.skills.set(skill.name, skill)
    if (skill.aliases) {
      for (const alias of skill.aliases) {
        this.skills.set(alias, skill)
      }
    }
  }

  getSkill(name: string): SkillDefinition | undefined {
    return this.skills.get(name)
  }

  listSkills(): SkillDefinition[] {
    const seen = new Set<string>()
    return [...this.skills.values()].filter(s => {
      if (seen.has(s.name)) return false
      seen.add(s.name)
      return true
    })
  }

  // ── MCP Tools ────────────────────────────────────────────────────────────

  addMcpTools(serverName: string, tools: ToolDefinition[]): void {
    this.mcpTools.set(serverName, tools)
  }

  removeMcpTools(serverName: string): void {
    this.mcpTools.delete(serverName)
  }

  private getMcpTool(name: string): ToolDefinition | undefined {
    for (const tools of this.mcpTools.values()) {
      const found = tools.find(t => t.name === name)
      if (found) return found
    }
    return undefined
  }
}

const toolRegistry = new ToolRegistry()
export { toolRegistry }
