/**
 * SSH Executor Transport
 * Executes mainframe tools via SSH for development/testing
 */

import { IMainframeTransport, ToolResult, SSHCredentials } from './transport-interface';

export interface SSHExecutorConfig {
  timeout?: number;
  retries?: number;
}

export class SSHExecutor implements IMainframeTransport {
  private credentials: SSHCredentials;
  private _available: boolean = false;
  private config: SSHExecutorConfig;

  constructor(credentials: SSHCredentials, config: SSHExecutorConfig = {}) {
    this.credentials = credentials;
    this.config = config;
    
    // Validate credentials
    if (!credentials.host || !credentials.username) {
      throw new Error('SSH host and username are required');
    }
  }

  async execute(toolName: string, args: any): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      console.log(`[SSHExecutor] Executing ${toolName} via SSH to ${this.credentials.host}`);

      // Import executeZosTool from zos tool executor
      const { executeZosTool } = await import('../zos/tool-executor');

      const result = await executeZosTool(
        toolName,
        args,
        {
          sshHost: this.credentials.host,
          sshPort: this.credentials.port || 22,
          userId: this.credentials.username,
          password: this.credentials.password || ''
        }
      );

      return {
        success: result.success,
        data: result.content,
        error: result.error,
        metadata: {
          executionTime: Date.now() - startTime,
          transport: 'ssh',
          processor: 'CP' // SSH always uses CP
        }
      };
    } catch (error) {
      console.error(`[SSHExecutor] Execution failed for ${toolName}:`, error);
      return {
        success: false,
        error: `SSH execution failed: ${(error as Error).message}`,
        metadata: {
          executionTime: Date.now() - startTime,
          transport: 'ssh',
          processor: 'CP'
        }
      };
    }
  }

  async testConnection(): Promise<boolean> {
    const startTime = Date.now();

    try {
      console.log(`[SSHExecutor] Testing connection to ${this.credentials.host}:${this.credentials.port || 22}`);

      const { executeZosTool } = await import('../zos/tool-executor');

      const result = await executeZosTool(
        'zvm_test_connection',
        {},
        {
          sshHost: this.credentials.host,
          sshPort: this.credentials.port || 22,
          userId: this.credentials.username,
          password: this.credentials.password || ''
        }
      );

      this._available = result.success;
      console.log(
        `[SSHExecutor] Connection test completed in ${Date.now() - startTime}ms: ${
          this._available ? 'OK' : 'FAILED'
        }`
      );
      return this._available;
    } catch (error) {
      console.error('[SSHExecutor] Connection test failed:', error);
      this._available = false;
      return false;
    }
  }

  isAvailable(): boolean {
    return this._available;
  }

  getName(): 'ssh' {
    return 'ssh';
  }

  async disconnect(): Promise<void> {
    // SSH connections are typically stateless in our case
    // But we could implement cleanup if needed
    console.log('[SSHExecutor] Disconnecting...');
    this._available = false;
  }

  /**
   * Get SSH connection info for debugging
   */
  getConnectionInfo(): {
    host: string;
    port: number;
    username: string;
    authenticated: boolean;
  } {
    return {
      host: this.credentials.host,
      port: this.credentials.port || 22,
      username: this.credentials.username,
      authenticated: this._available
    };
  }
}
