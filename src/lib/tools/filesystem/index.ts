'use client';

import { buildTool, toolSuccess, toolError } from '../buildTool'
import type { ToolDefinition } from '../types'

// ── Read File ──────────────────────────────────────────────────────────────

export const readFileTool: ToolDefinition = buildTool({
  name: 'read_file',
  description: 'Read a file from configured download directory. Supports text, code, DOCX, XLSX, CSV, PDF.',
  parameters: [
    { name: 'file', type: 'string', required: true, description: 'File name to read' },
    { name: 'offset', type: 'number', required: false, description: 'Start line number (optional)' },
    { name: 'limit', type: 'number', required: false, description: 'Max lines to read (optional)' },
  ],
  isReadOnly: true,
  isConcurrencySafe: true,
  category: 'filesystem',
  async handler({ file, offset, limit }) {
    try {
      const res = await fetch(`/api/files?name=${encodeURIComponent(String(file))}&content=true`, { credentials: 'include' })
      if (!res.ok) return toolError(`Failed to read ${file}`)
      const data = await res.json() as { content: string; format: string; size: number }
      let content = data.content
      if (offset || limit) {
        const lines = content.split('\n')
        const start = Number(offset) || 0
        const end = limit ? start + Number(limit) : undefined
        content = lines.slice(start, end).join('\n')
      }
      return toolSuccess(content, { format: data.format, size: data.size, lines: content.split('\n').length })
    } catch (err) {
      return toolError(err instanceof Error ? err.message : String(err))
    }
  }
})

// ── Write File ─────────────────────────────────────────────────────────────

export const writeFileTool: ToolDefinition = buildTool({
  name: 'write_file',
  description: 'Write content to a file in configured directory. Creates new or overwrites existing.',
  parameters: [
    { name: 'file', type: 'string', required: true, description: 'File name' },
    { name: 'content', type: 'string', required: true, description: 'File content' },
  ],
  isReadOnly: false,
  isConcurrencySafe: false,
  category: 'filesystem',
  async handler({ file, content }) {
    try {
      const ext = String(file).includes('.') ? String(file).split('.').pop() || 'txt' : 'txt'
      const res = await fetch('/api/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'create', name: file, format: ext, content }),
      })
      if (!res.ok) return toolError(`Failed to write ${file}`)
      const data = await res.json() as { file: { name: string; size: number } }
      return toolSuccess(`Written ${data.file.name} (${data.file.size} bytes)`, { file: data.file })
    } catch (err) {
      return toolError(err instanceof Error ? err.message : String(err))
    }
  }
})

// ── Edit File ──────────────────────────────────────────────────────────────

export const editFileTool: ToolDefinition = buildTool({
  name: 'edit_file',
  description: 'Edit a file by replacing specific text. Like find-and-replace.',
  parameters: [
    { name: 'file', type: 'string', required: true, description: 'File name' },
    { name: 'old_string', type: 'string', required: true, description: 'Text to find' },
    { name: 'new_string', type: 'string', required: true, description: 'Replacement text' },
    { name: 'replace_all', type: 'boolean', required: false, description: 'Replace all occurrences' },
  ],
  isReadOnly: false,
  isConcurrencySafe: false,
  category: 'filesystem',
  async handler({ file, old_string, new_string, replace_all }) {
    try {
      // Read current content
      const readRes = await fetch(`/api/files?name=${encodeURIComponent(String(file))}&content=true`, { credentials: 'include' })
      if (!readRes.ok) return toolError(`Failed to read ${file}`)
      const { content: original } = await readRes.json() as { content: string }

      if (!original.includes(String(old_string))) {
        return toolError(`Text not found in ${file}: "${old_string}"`)
      }

      const newContent = replace_all
        ? original.replaceAll(String(old_string), String(new_string))
        : original.replace(String(old_string), String(new_string))

      // Write back
      const writeRes = await fetch('/api/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'create', name: file, format: String(file).split('.').pop() || 'txt', content: newContent }),
      })
      if (!writeRes.ok) return toolError(`Failed to write ${file}`)

      const originalLines = original.split('\n').length
      const newLines = newContent.split('\n').length
      return toolSuccess(
        `Edited ${file}: ${originalLines} lines → ${newLines} lines`,
        { originalLines, newLines }
      )
    } catch (err) {
      return toolError(err instanceof Error ? err.message : String(err))
    }
  }
})

// ── Glob ───────────────────────────────────────────────────────────────────

export const globTool: ToolDefinition = buildTool({
  name: 'glob',
  description: 'Find files matching a pattern. Example: "*.cob", "*.jcl", "report_*"',
  parameters: [
    { name: 'pattern', type: 'string', required: true, description: 'Pattern to match (e.g., "*.cob", "report_*")' },
  ],
  isReadOnly: true,
  isConcurrencySafe: true,
  category: 'filesystem',
  async handler({ pattern }) {
    try {
      const res = await fetch('/api/files', { credentials: 'include' })
      if (!res.ok) return toolError('Failed to list files')
      const data = await res.json() as { files: Array<{ name: string; size: number; format: string }> }

      const pat = String(pattern).toLowerCase()
      const filtered = data.files.filter(f => {
        const name = f.name.toLowerCase()
        if (pat.startsWith('*.')) {
          return name.endsWith(pat.slice(1))
        }
        return name.includes(pat.replace(/\*/g, ''))
      })

      if (filtered.length === 0) {
        return toolSuccess(`No files matching "${pattern}"`)
      }

      const result = filtered.map(f => `${f.name} (${f.format}, ${f.size} bytes)`).join('\n')
      return toolSuccess(result, { count: filtered.length, files: filtered })
    } catch (err) {
      return toolError(err instanceof Error ? err.message : String(err))
    }
  }
})

// ── Grep ───────────────────────────────────────────────────────────────────

export const grepTool: ToolDefinition = buildTool({
  name: 'grep',
  description: 'Search file contents for a pattern (regex). Returns matching lines with context.',
  parameters: [
    { name: 'pattern', type: 'string', required: true, description: 'Regex pattern to search' },
    { name: 'file_filter', type: 'string', required: false, description: 'Filter by extension (e.g., ".cob")' },
  ],
  isReadOnly: true,
  isConcurrencySafe: true,
  category: 'filesystem',
  async handler({ pattern, file_filter }) {
    try {
      const res = await fetch('/api/files', { credentials: 'include' })
      if (!res.ok) return toolError('Failed to list files')
      const data = await res.json() as { files: Array<{ name: string; format: string }> }

      const textFiles = file_filter
        ? data.files.filter(f => f.name.endsWith(String(file_filter)))
        : data.files.filter(f => ['txt', 'md', 'json', 'csv', 'cob', 'cbl', 'jcl', 'sql', 'js', 'ts', 'html', 'css', 'py', 'java', 'xml', 'yaml', 'log'].includes(f.format))

      const regex = new RegExp(String(pattern), 'gi')
      const matches: string[] = []

      for (const file of textFiles.slice(0, 50)) {
        try {
          const contentRes = await fetch(`/api/files?name=${encodeURIComponent(file.name)}&content=true`, { credentials: 'include' })
          if (!contentRes.ok) continue
          const { content } = await contentRes.json() as { content: string }
          const lines = content.split('\n')
          lines.forEach((line, i) => {
            if (regex.test(line)) {
              matches.push(`${file.name}:${i + 1}: ${line.trim()}`)
            }
            regex.lastIndex = 0
          })
        } catch { /* skip */ }
      }

      if (matches.length === 0) {
        return toolSuccess(`No matches found for "${pattern}"`)
      }

      return toolSuccess(matches.slice(0, 100).join('\n'), { matchCount: matches.length })
    } catch (err) {
      return toolError(err instanceof Error ? err.message : String(err))
    }
  }
})
