import { buildTool, toolSuccess, toolError } from '../buildTool'
import type { ToolDefinition } from '../types'
import { toolRegistry } from '../registry'

export const mcpTool: ToolDefinition = buildTool({
  name: 'mcp_call',
  description: 'Call a tool from an external MCP-compatible server via HTTP. Configured servers are listed in settings.',
  parameters: [
    { name: 'server', type: 'string', required: true, description: 'MCP server name (e.g., "zowe", "postgres")' },
    { name: 'tool', type: 'string', required: true, description: 'Tool name to call on the server' },
    { name: 'arguments', type: 'object', required: false, description: 'Tool arguments as JSON object' },
  ],
  isReadOnly: false,
  isConcurrencySafe: false,
  category: 'mcp',
  async handler({ server, tool, arguments: args }) {
    try {
      // Check if server is configured
      const res = await fetch('/api/mcp/config', { credentials: 'include' })
      if (!res.ok) return toolError('MCP config not available')

      const config = await res.json() as { servers: Array<{ name: string; url: string; enabled: boolean }> }
      const serverConfig = config.servers.find(s => s.name === server)

      if (!serverConfig) {
        const available = config.servers.map(s => s.name).join(', ')
        return toolError(`MCP server "${server}" not found. Available: ${available}`)
      }

      if (!serverConfig.enabled) {
        return toolError(`MCP server "${server}" is disabled`)
      }

      // Call the tool on the MCP server
      const toolRes = await fetch(`${serverConfig.url}/api/tools/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: tool, arguments: args || {} }),
      })

      if (!toolRes.ok) {
        const errText = await toolRes.text()
        return toolError(`MCP tool call failed: ${errText}`)
      }

      const data = await toolRes.json() as { result: string; isError?: boolean }
      if (data.isError) {
        return toolError(data.result)
      }

      return toolSuccess(data.result, { server, tool })
    } catch (err) {
      return toolError(err instanceof Error ? err.message : String(err))
    }
  }
})
