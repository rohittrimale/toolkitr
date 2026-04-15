/**
 * Unified Mainframe Transport Interface
 * Allows swapping between SSH (dev) and zIIP (production) transparently
 */

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: {
    executionTime: number;
    transport: 'ssh' | 'ziip';
    iteration?: number;
    processor?: string; // 'CP' or 'zIIP'
  };
}

export interface IMainframeTransport {
  /**
   * Execute a mainframe tool with given arguments
   */
  execute(toolName: string, args: any): Promise<ToolResult>;

  /**
   * Test if transport is connected and ready
   */
  testConnection(): Promise<boolean>;

  /**
   * Check if transport is available for use
   */
  isAvailable(): boolean;

  /**
   * Get transport name for logging
   */
  getName(): 'ssh' | 'ziip';

  /**
   * Gracefully shutdown transport
   */
  disconnect?(): Promise<void>;
}

export interface SSHCredentials {
  host: string;
  port?: number;
  username: string;
  password?: string;
  keyPath?: string;
}

export interface ToolExecutorConfig {
  mode: 'ssh' | 'ziip';
  sshCredentials?: SSHCredentials;
  ziipEndpoint?: string;
  timeout?: number;
  retries?: number;
}
