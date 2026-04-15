import { buildTool, toolSuccess, toolError } from '../buildTool'
import type { ToolDefinition } from '../types'

export const lspTool: ToolDefinition = buildTool({
  name: 'lsp',
  description: 'Language server operations: find definition, references, diagnostics in code files.',
  parameters: [
    { name: 'action', type: 'string', required: true, description: 'Action: definition, references, diagnostics, hover', enum: ['definition', 'references', 'diagnostics', 'hover'] },
    { name: 'file', type: 'string', required: true, description: 'File to analyze' },
    { name: 'line', type: 'number', required: false, description: 'Line number (1-indexed)' },
    { name: 'column', type: 'number', required: false, description: 'Column number (1-indexed)' },
  ],
  isReadOnly: true,
  isConcurrencySafe: true,
  category: 'lsp',
  async handler({ action, file, line, column }) {
    try {
      // Read the file to analyze
      const res = await fetch(`/api/files?name=${encodeURIComponent(String(file))}&content=true`, { credentials: 'include' })
      if (!res.ok) return toolError(`Failed to read ${file}`)
      const { content } = await res.json() as { content: string }
      const lines = content.split('\n')

      const actionStr = String(action)

      if (actionStr === 'diagnostics') {
        // Basic syntax analysis
        const diagnostics: string[] = []
        lines.forEach((line, i) => {
          // Check for common issues
          if (line.includes('TODO') || line.includes('FIXME') || line.includes('HACK')) {
            diagnostics.push(`${file}:${i + 1}: ${line.trim()} (note)`)
          }
          if (line.length > 200) {
            diagnostics.push(`${file}:${i + 1}: Line too long (${line.length} chars) (warning)`)
          }
        })
        return toolSuccess(
          diagnostics.length > 0 ? diagnostics.join('\n') : 'No diagnostics found',
          { count: diagnostics.length }
        )
      }

      if (actionStr === 'definition') {
        // Simple word-based definition search
        const targetLine = Number(line) || 1
        const targetCol = Number(column) || 1
        const lineText = lines[targetLine - 1] || ''
        const word = lineText.substring(Math.max(0, targetCol - 20), targetCol + 20).match(/\w+/)?.[0] || ''

        if (!word) return toolError('Could not identify symbol at cursor position')

        // Search for the word in other lines
        const definitions: string[] = []
        lines.forEach((l, i) => {
          if (l.includes(word) && i !== targetLine - 1) {
            definitions.push(`${file}:${i + 1}: ${l.trim()}`)
          }
        })

        return toolSuccess(
          definitions.length > 0 ? definitions.slice(0, 10).join('\n') : `No definition found for "${word}"`,
          { symbol: word, results: definitions.length }
        )
      }

      if (actionStr === 'references') {
        const targetLine = Number(line) || 1
        const lineText = lines[targetLine - 1] || ''
        const word = lineText.match(/\w+/)?.[0] || ''

        if (!word) return toolError('Could not identify symbol')

        const refs: string[] = []
        lines.forEach((l, i) => {
          if (l.includes(word)) {
            refs.push(`${file}:${i + 1}: ${l.trim()}`)
          }
        })

        return toolSuccess(
          refs.length > 0 ? refs.join('\n') : `No references found for "${word}"`,
          { symbol: word, count: refs.length }
        )
      }

      if (actionStr === 'hover') {
        const targetLine = Number(line) || 1
        const lineText = lines[targetLine - 1] || ''
        return toolSuccess(
          `Line ${targetLine}: ${lineText.trim()}`,
          { line: targetLine, text: lineText.trim() }
        )
      }

      return toolError(`Unknown action: ${actionStr}`)
    } catch (err) {
      return toolError(err instanceof Error ? err.message : String(err))
    }
  }
})
