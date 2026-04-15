// Existing exports (backward compatibility)
export * from './definitions';
export * from './executor';

// New tool system (Claude Code style)
export { toolRegistry } from './registry';
export { buildTool, toolSuccess, toolError } from './buildTool';
export type { ToolDefinition, ToolParameter, ToolResult, ApiToolDefinition, SkillDefinition } from './types';

// Filesystem tools
export { readFileTool, writeFileTool, editFileTool, globTool, grepTool } from './filesystem';

// Web tools
export { webSearchTool, webFetchTool } from './web';

// Shell tools
export { bashTool, powershellTool } from './shell';

// Skills
export { skillTool } from './skills';

// MCP + LSP
export { mcpTool } from './mcp';
export { lspTool } from './lsp';
