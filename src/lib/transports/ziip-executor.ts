/**
 * zIIP Executor Transport
 * Executes mainframe tools via zIIP REST API for production
 *
 * zIIP (System z Integrated Information Processor):
 * - Specialized processor for workloads like XML, Java, etc.
 * - NOT charged against mainframe licensing (huge cost savings!)
 * - Much faster than SSH + TSO approach
 * - Can handle parallel queries
 */

import { IMainframeTransport, ToolResult } from './transport-interface';
import https from 'https';
import http from 'http';

export interface ZIIPExecutorConfig {
  timeout?: number;
  retries?: number;
  certificate?: string;
  rejectUnauthorized?: boolean;
}

export class ZIIPExecutor implements IMainframeTransport {
  private endpoint: string;
  private _available: boolean = false;
  private config: ZIIPExecutorConfig;
  private requestCount: number = 0;

  constructor(endpoint: string, config: ZIIPExecutorConfig = {}) {
    this.endpoint = endpoint;
    this.config = {
      timeout: config.timeout || 30000,
      retries: config.retries || 1,
      rejectUnauthorized: config.rejectUnauthorized !== false, // Default: true
      ...config
    };

    // Validate endpoint
    if (!this.endpoint.startsWith('http://') && !this.endpoint.startsWith('https://')) {
      throw new Error('zIIP endpoint must start with http:// or https://');
    }

    console.log(`[ZIIPExecutor] Initialized with endpoint: ${this.endpoint}`);
  }

  async execute(toolName: string, args: any): Promise<ToolResult> {
    const startTime = Date.now();
    this.requestCount++;

    try {
      console.log(
        `[ZIIPExecutor] Request #${this.requestCount}: Executing ${toolName} via zIIP`
      );

      const payload = {
        tool: toolName,
        args: args,
        timestamp: new Date().toISOString(),
        version: '1.0',
        requestId: `REQ-${this.requestCount}-${Date.now()}`
      };

      const response = await this.httpRequest('/api/tools/execute', 'POST', payload);

      return {
        success: response.success === true,
        data: response.result,
        error: response.error,
        metadata: {
          executionTime: Date.now() - startTime,
          transport: 'ziip',
          processor: 'zIIP'
        }
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(
        `[ZIIPExecutor] Request #${this.requestCount} failed (${Date.now() - startTime}ms):`,
        errorMsg
      );
      return {
        success: false,
        error: `zIIP execution failed: ${errorMsg}`,
        metadata: {
          executionTime: Date.now() - startTime,
          transport: 'ziip',
          processor: 'zIIP'
        }
      };
    }
  }

  async testConnection(): Promise<boolean> {
    const startTime = Date.now();

    try {
      console.log(`[ZIIPExecutor] Testing connection to ${this.endpoint}`);

      const response = await this.httpRequest('/health', 'GET', null, 5000);

      const isHealthy = response.status === 'healthy';
      this._available = isHealthy;

      console.log(
        `[ZIIPExecutor] Health check completed in ${Date.now() - startTime}ms: ${
          isHealthy ? 'HEALTHY ✓' : `${response.status} ✗`
        }`
      );

      return isHealthy;
    } catch (error) {
      console.error(
        `[ZIIPExecutor] Connection test failed (${Date.now() - startTime}ms):`,
        error
      );
      this._available = false;
      return false;
    }
  }

  isAvailable(): boolean {
    return this._available;
  }

  getName(): 'ziip' {
    return 'ziip';
  }

  async disconnect(): Promise<void> {
    console.log('[ZIIPExecutor] Disconnecting...');
    this._available = false;
  }

  /**
   * Get zIIP service endpoint info
   */
  getEndpointInfo(): { endpoint: string; available: boolean; requestsSent: number } {
    return {
      endpoint: this.endpoint,
      available: this._available,
      requestsSent: this.requestCount
    };
  }

  /**
   * Generic HTTP request handler
   */
  private httpRequest(
    path: string,
    method: string,
    body?: any,
    timeoutMs?: number
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const url = new URL(this.endpoint + path);
      const isHttps = url.protocol === 'https:';
      const client = isHttps ? https : http;

      const options = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Toolkitr-AI-Assistant/1.0',
          'X-Request-ID': `REQ-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          'X-Client-Version': '1.0'
        },
        timeout: timeoutMs || this.config.timeout,
        ...(isHttps && {
          rejectUnauthorized: this.config.rejectUnauthorized
        })
      };

      console.log(`[ZIIPExecutor] ${method} ${url.href}`);

      const req = client.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              const parsed = JSON.parse(data);
              console.log(`[ZIIPExecutor] Response status: ${res.statusCode}`);
              resolve(parsed);
            } else {
              reject(
                new Error(`HTTP ${res.statusCode}: ${data || 'No response body'}`)
              );
            }
          } catch (error) {
            reject(
              new Error(`Failed to parse zIIP response: ${data.substring(0, 200)}`)
            );
          }
        });
      });

      req.on('error', (error) => {
        console.error(`[ZIIPExecutor] Request error:`, error.message);
        reject(error);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(
          new Error(
            `zIIP request timeout after ${timeoutMs || this.config.timeout}ms`
          )
        );
      });

      if (body) {
        const bodyStr = JSON.stringify(body);
        req.write(bodyStr);
        console.log(`[ZIIPExecutor] Sent ${bodyStr.length} bytes`);
      }

      req.end();
    });
  }
}
