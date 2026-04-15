/**
 * Tool Executor - Smart Router
 * Routes tool execution to SSH (dev) or zIIP (production) transparently
 */

import { IMainframeTransport, ToolResult, ToolExecutorConfig, SSHCredentials } from '@/lib/transports/transport-interface';
import { SSHExecutor } from '@/lib/transports/ssh-executor';
import { ZIIPExecutor } from '@/lib/transports/ziip-executor';

export class ToolExecutor {
  private transport: IMainframeTransport;
  private config: ToolExecutorConfig;
  private readonly DEFAULT_TIMEOUT = 30000;
  private readonly DEFAULT_RETRIES = 1;

  constructor(config: ToolExecutorConfig) {
    this.config = {
      timeout: config.timeout || this.DEFAULT_TIMEOUT,
      retries: config.retries || this.DEFAULT_RETRIES,
      ...config
    };

    // Initialize appropriate transport
    if (this.config.mode === 'ziip' && this.config.ziipEndpoint) {
      this.transport = new ZIIPExecutor(this.config.ziipEndpoint, {
        timeout: this.config.timeout,
        retries: this.config.retries
      });
    } else if (this.config.sshCredentials) {
      this.transport = new SSHExecutor(this.config.sshCredentials, {
        timeout: this.config.timeout,
        retries: this.config.retries
      });
    } else {
      throw new Error('Either ziipEndpoint or sshCredentials must be provided');
    }
  }

  /**
   * Execute a tool with the configured transport
   */
  async execute<T = any>(toolName: string, args: any): Promise<T> {
    const startTime = Date.now();

    try {
      console.log(
        `[ToolExecutor] Routing ${toolName} to ${this.transport.getName()} transport`
      );

      const result = await this.executeWithRetry(toolName, args);

      console.log(
        `[ToolExecutor] ${toolName} completed in ${Date.now() - startTime}ms`
      );

      return result.data as T;
    } catch (error) {
      console.error(`[ToolExecutor] Tool ${toolName} failed:`, error);
      throw error;
    }
  }

  /**
   * Execute with retry logic
   */
  private async executeWithRetry(
    toolName: string,
    args: any
  ): Promise<ToolResult> {
    let lastError: Error | null = null;
    const maxAttempts = (this.config.retries || 1) + 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await this.transport.execute(toolName, args);

        if (!result.success && attempt < maxAttempts) {
          lastError = new Error(result.error || 'Unknown error');
          const backoffMs = Math.pow(2, attempt - 1) * 100;
          console.warn(
            `[ToolExecutor] Attempt ${attempt} failed, retrying in ${backoffMs}ms...`
          );
          await new Promise(resolve => setTimeout(resolve, backoffMs));
          continue;
        }

        return result;
      } catch (error) {
        lastError = error as Error;
        if (attempt < maxAttempts) {
          const backoffMs = Math.pow(2, attempt - 1) * 100;
          console.warn(
            `[ToolExecutor] Attempt ${attempt} failed with exception, retrying in ${backoffMs}ms...`
          );
          await new Promise(resolve => setTimeout(resolve, backoffMs));
        }
      }
    }

    throw lastError || new Error('Tool execution failed after all retries');
  }

  /**
   * Batch execute multiple tools
   */
  async executeBatch<T = any>(
    tools: Array<{ name: string; args: any }>
  ): Promise<T[]> {
    return Promise.all(
      tools.map(({ name, args }) => this.execute<T>(name, args))
    );
  }

  /**
   * Test connection availability
   */
  async testConnection(): Promise<boolean> {
    try {
      const connected = await this.transport.testConnection();
      console.log(
        `[ToolExecutor] Connection test (${this.transport.getName()}): ${
          connected ? 'OK' : 'FAILED'
        }`
      );
      return connected;
    } catch (error) {
      console.error('[ToolExecutor] Connection test error:', error);
      return false;
    }
  }

  /**
   * Get transport availability status
   */
  isConnected(): boolean {
    return this.transport.isAvailable();
  }

  /**
   * Get current transport name
   */
  getTransportName(): 'ssh' | 'ziip' {
    return this.transport.getName();
  }

  /**
   * Get transport details for debugging
   */
  getTransportInfo(): {
    type: 'ssh' | 'ziip';
    available: boolean;
    endpoint?: string;
    timeout: number;
    retries: number;
  } {
    return {
      type: this.transport.getName(),
      available: this.transport.isAvailable(),
      endpoint: this.config.ziipEndpoint,
      timeout: this.config.timeout || this.DEFAULT_TIMEOUT,
      retries: this.config.retries || this.DEFAULT_RETRIES
    };
  }

  /**
   * Disconnect gracefully
   */
  async disconnect(): Promise<void> {
    if (this.transport.disconnect) {
      await this.transport.disconnect();
      console.log(`[ToolExecutor] Disconnected from ${this.transport.getName()}`);
    }
  }
}

/**
 * Convenience function to create executor from environment
 */
export function createToolExecutorFromEnv(): ToolExecutor {
  const mode = (process.env.TOOL_EXECUTOR_MODE || 'ssh') as 'ssh' | 'ziip';

  if (mode === 'ziip') {
    const endpoint = process.env.ZIIP_ENDPOINT;
    if (!endpoint) {
      throw new Error('ZIIP_ENDPOINT environment variable is required when using ziip mode');
    }
    return new ToolExecutor({
      mode: 'ziip',
      ziipEndpoint: endpoint,
      timeout: parseInt(process.env.TOOL_TIMEOUT || '30000'),
      retries: parseInt(process.env.TOOL_RETRIES || '1')
    });
  } else {
    const sshCredentials = {
      host: process.env.SSH_HOST,
      port: parseInt(process.env.SSH_PORT || '22'),
      username: process.env.SSH_USER,
      password: process.env.SSH_PASSWORD,
      keyPath: process.env.SSH_KEY_PATH
    };

    if (!sshCredentials.host || !sshCredentials.username) {
      throw new Error(
        'SSH_HOST and SSH_USER environment variables are required when using ssh mode'
      );
    }

    return new ToolExecutor({
      mode: 'ssh',
      sshCredentials: sshCredentials as SSHCredentials,
      timeout: parseInt(process.env.TOOL_TIMEOUT || '30000'),
      retries: parseInt(process.env.TOOL_RETRIES || '1')
    });
  }
}
