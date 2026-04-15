import { buildTool, toolSuccess, toolError } from '../buildTool'
import type { ToolDefinition } from '../types'

export const bashTool: ToolDefinition = buildTool({
  name: 'bash',
  description: 'Execute a bash/shell command on the server.',
  parameters: [
    { name: 'command', type: 'string', required: true, description: 'Shell command to execute' },
    { name: 'timeout', type: 'number', required: false, description: 'Timeout in seconds (default 30)' },
  ],
  isReadOnly: false,
  isConcurrencySafe: false,
  category: 'shell',
  async handler({ command, timeout }) {
    try {
      const res = await fetch('/api/shell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ command, shell: 'bash', timeout: timeout || 30 }),
      })
      if (!res.ok) return toolError('Shell execution failed')
      const data = await res.json() as { stdout: string; stderr: string; exitCode: number }
      if (data.exitCode !== 0) {
        return toolError(`Command failed (exit ${data.exitCode}): ${data.stderr || data.stdout}`)
      }
      return toolSuccess(data.stdout || '(no output)', { exitCode: data.exitCode })
    } catch (err) {
      return toolError(err instanceof Error ? err.message : String(err))
    }
  }
})

export const powershellTool: ToolDefinition = buildTool({
  name: 'powershell',
  description: 'Execute a PowerShell command on the server.',
  parameters: [
    { name: 'command', type: 'string', required: true, description: 'PowerShell command to execute' },
    { name: 'timeout', type: 'number', required: false, description: 'Timeout in seconds (default 30)' },
  ],
  isReadOnly: false,
  isConcurrencySafe: false,
  category: 'shell',
  async handler({ command, timeout }) {
    try {
      const res = await fetch('/api/shell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ command, shell: 'powershell', timeout: timeout || 30 }),
      })
      if (!res.ok) return toolError('PowerShell execution failed')
      const data = await res.json() as { stdout: string; stderr: string; exitCode: number }
      if (data.exitCode !== 0) {
        return toolError(`Command failed (exit ${data.exitCode}): ${data.stderr || data.stdout}`)
      }
      return toolSuccess(data.stdout || '(no output)', { exitCode: data.exitCode })
    } catch (err) {
      return toolError(err instanceof Error ? err.message : String(err))
    }
  }
})
