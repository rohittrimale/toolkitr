// Batch Tool Executor
// Executes multiple tool calls in parallel with connection reuse
// Dramatically improves performance for multi-tool agentic workflows

import { Client } from 'ssh2';
import { getConnection, releaseConnection, exec } from '@/lib/zos/ssh-pool';
import { executeZosTool, type ToolExecutionResult } from '@/lib/zos/tool-executor';
import { ZosCredentials } from '@/lib/zos/credentials';

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  id: string;
  name: string;
  success: boolean;
  content: string;
  error?: string;
  executionTime: number;
}

// ─── Batch Execution ──────────────────────────────────────────────────────────

export async function executeBatch(
  toolCalls: ToolCall[],
  credentials: ZosCredentials
): Promise<ToolResult[]> {
  if (toolCalls.length === 0) return [];

  const creds: ZosCredentials = {
    sshHost: credentials.sshHost,
    sshPort: credentials.sshPort || 22,
    userId: credentials.userId,
    password: credentials.password,
  };

  // Group tools by type
  const sshTools = toolCalls.filter(tc => tc.name.startsWith('zvm_'));
  const fileTools = toolCalls.filter(tc => tc.name === 'create_document' || tc.name === 'get_file_formats');
  const otherTools = toolCalls.filter(tc => !tc.name.startsWith('zvm_') && tc.name !== 'create_document' && tc.name !== 'get_file_formats');

  const results: ToolResult[] = [];

  // Execute SSH tools in parallel with ONE connection
  if (sshTools.length > 0) {
    const sshResults = await executeSshBatch(sshTools, creds);
    results.push(...sshResults);
  }

  // Execute file tools in parallel (no SSH needed)
  if (fileTools.length > 0) {
    const fileResults = await executeFileBatch(fileTools);
    results.push(...fileResults);
  }

  // Execute other tools
  if (otherTools.length > 0) {
    const otherResults = otherTools.map(tc => ({
      id: tc.id,
      name: tc.name,
      success: false,
      content: '',
      error: `Unknown tool: ${tc.name}`,
      executionTime: 0,
    }));
    results.push(...otherResults);
  }

  return results;
}

// ─── SSH Batch Execution ──────────────────────────────────────────────────────

async function executeSshBatch(
  toolCalls: ToolCall[],
  creds: ZosCredentials
): Promise<ToolResult[]> {
  let client: Client | null = null;
  let broken = false;

  try {
    // Get ONE connection for all tools
    client = await getConnection(creds);

    // Execute all tools in parallel using the same connection
    const promises = toolCalls.map(async (tc) => {
      const startTime = Date.now();
      try {
        const result = await executeZosTool(tc.name, tc.arguments, creds);
        return {
          id: tc.id,
          name: tc.name,
          success: result.success,
          content: result.content || '',
          error: result.error,
          executionTime: Date.now() - startTime,
        };
      } catch (err) {
        return {
          id: tc.id,
          name: tc.name,
          success: false,
          content: '',
          error: err instanceof Error ? err.message : String(err),
          executionTime: Date.now() - startTime,
        };
      }
    });

    const results = await Promise.all(promises);
    return results;
  } catch (err) {
    broken = true;
    // Return error for all tools
    return toolCalls.map(tc => ({
      id: tc.id,
      name: tc.name,
      success: false,
      content: '',
      error: `SSH connection failed: ${err instanceof Error ? err.message : String(err)}`,
      executionTime: 0,
    }));
  } finally {
    if (client) {
      releaseConnection(creds, broken);
    }
  }
}

// ─── File Tool Batch Execution ────────────────────────────────────────────────

async function executeFileBatch(toolCalls: ToolCall[]): Promise<ToolResult[]> {
  const promises = toolCalls.map(async (tc) => {
    const startTime = Date.now();
    
    if (tc.name === 'get_file_formats') {
      return {
        id: tc.id,
        name: tc.name,
        success: true,
        content: 'Supported formats: docx, xlsx, pdf, md, csv, json, txt, cob, jcl, sql. Files saved to FILE_DOWNLOAD_PATH env var.',
        executionTime: Date.now() - startTime,
      };
    }
    
    if (tc.name === 'create_document') {
      try {
        const { format, title, content, filename, sections, table, sheets } = tc.arguments as {
          format: string;
          title: string;
          content: string;
          filename?: string;
          sections?: Array<{ heading: string; content: string }>;
          table?: { headers: string[]; rows: string[][] };
          sheets?: Array<{ name: string; headers: string[]; rows: string[][] }>;
        };

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3011';
        const res = await fetch(`${appUrl}/api/files/create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ format, title, content, filename, sections, table, sheets }),
        });

        const data = await res.json() as { success: boolean; filePath?: string; fileName?: string; fileSize?: number; error?: string };

        return {
          id: tc.id,
          name: tc.name,
          success: data.success,
          content: data.success
            ? `Document created: ${data.fileName} at ${data.filePath} (${data.fileSize} bytes)`
            : '',
          error: data.error,
          executionTime: Date.now() - startTime,
        };
      } catch (err) {
        return {
          id: tc.id,
          name: tc.name,
          success: false,
          content: '',
          error: err instanceof Error ? err.message : String(err),
          executionTime: Date.now() - startTime,
        };
      }
    }
    
    return {
      id: tc.id,
      name: tc.name,
      success: false,
      content: '',
      error: `Unknown file tool: ${tc.name}`,
      executionTime: 0,
    };
  });

  return Promise.all(promises);
}

// ─── Parallel SSH Command Execution ───────────────────────────────────────────

export async function executeCommandsBatch(
  commands: string[],
  creds: ZosCredentials
): Promise<Array<{ command: string; stdout: string; stderr: string; exitCode: number }>> {
  const client = await getConnection(creds);
  let broken = false;

  try {
    const promises = commands.map(async (cmd) => {
      try {
        const result = await exec(creds, cmd, 30000);
        return {
          command: cmd,
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode,
        };
      } catch (err) {
        return {
          command: cmd,
          stdout: '',
          stderr: err instanceof Error ? err.message : String(err),
          exitCode: 1,
        };
      }
    });

    return await Promise.all(promises);
  } catch (err) {
    broken = true;
    return commands.map(cmd => ({
      command: cmd,
      stdout: '',
      stderr: `SSH connection failed: ${err instanceof Error ? err.message : String(err)}`,
      exitCode: 1,
    }));
  } finally {
    releaseConnection(creds, broken);
  }
}
