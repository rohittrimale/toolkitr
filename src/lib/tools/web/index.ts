import { buildTool, toolSuccess, toolError } from '../buildTool'
import type { ToolDefinition } from '../types'

export const webSearchTool: ToolDefinition = buildTool({
  name: 'web_search',
  description: 'Search the web using DuckDuckGo or Brave.',
  parameters: [
    { name: 'query', type: 'string', required: true, description: 'Search query' },
  ],
  isReadOnly: true,
  isConcurrencySafe: true,
  category: 'web',
  async handler({ query }) {
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(String(query))}`, { credentials: 'include' })
      if (!res.ok) return toolError('Search failed')
      const data = await res.json() as { results: Array<{ title: string; url: string; snippet: string }> }
      const text = data.results.map(r => `${r.title}\n${r.url}\n${r.snippet}`).join('\n\n')
      return toolSuccess(text, { results: data.results })
    } catch (err) {
      return toolError(err instanceof Error ? err.message : String(err))
    }
  }
})

export const webFetchTool: ToolDefinition = buildTool({
  name: 'web_fetch',
  description: 'Fetch and read content from a URL.',
  parameters: [
    { name: 'url', type: 'string', required: true, description: 'URL to fetch' },
  ],
  isReadOnly: true,
  isConcurrencySafe: true,
  category: 'web',
  async handler({ url }) {
    try {
      const res = await fetch(`/api/fetch?url=${encodeURIComponent(String(url))}`, { credentials: 'include' })
      if (!res.ok) return toolError(`Failed to fetch ${url}`)
      const data = await res.json() as { content: string }
      return toolSuccess(data.content.substring(0, 10000), { url })
    } catch (err) {
      return toolError(err instanceof Error ? err.message : String(err))
    }
  }
})
