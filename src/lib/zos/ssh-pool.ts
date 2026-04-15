/* eslint-disable @typescript-eslint/no-explicit-any */
import { Client, ConnectConfig } from 'ssh2';
import { zosConfig } from './config';
import { getDefaultCredentials, type ZosCredentials } from './credentials';

interface PooledConnection {
  client: Client;
  credentials: ZosCredentials;
  inUse: boolean;
  lastUsed: number;
  broken: boolean;
}

// Configuration - Performance optimized
const POOL_TTL = 10 * 60 * 1000; // 10 minutes (longer reuse)
const MAX_CONNECTIONS_PER_HOST = 15; // Allow up to 15 connections per host
const RECENT_THRESHOLD = 120000; // Skip connection test if used within 120s

// Connection pool - allows multiple connections per host
const connectionPool: Map<string, PooledConnection[]> = new Map();
const pendingConnections: Map<string, Promise<Client>> = new Map();
const connectionCount: Map<string, number> = new Map();

function getPoolKey(creds: ZosCredentials): string {
  return `${creds.sshHost}:${creds.sshPort}:${creds.userId}`;
}

function createConnection(creds: ZosCredentials): Promise<Client> {
  return new Promise((resolve, reject) => {
    const client = new Client();
    
    const config: ConnectConfig = {
      host: creds.sshHost,
      port: creds.sshPort,
      username: creds.userId,
      password: creds.password,
      readyTimeout: zosConfig.ssh.timeout,
      keepaliveInterval: 15000,
      tryKeyboard: true,
    };

    let resolved = false;

    client.on('ready', () => {
      if (!resolved) {
        resolved = true;
        resolve(client);
      }
    });

    client.on('error', (err) => {
      if (!resolved) {
        resolved = true;
        reject(err);
      }
    });

    client.on('close', () => {
      // Mark connection as broken in all pools
      for (const [key, connections] of connectionPool) {
        for (const pooled of connections) {
          if (pooled.client === client) {
            pooled.broken = true;
            break;
          }
        }
      }
    });

    client.connect(config);
  });
}

export async function getConnection(creds?: ZosCredentials): Promise<Client> {
  const credentials = creds || getDefaultCredentials();
  const key = getPoolKey(credentials);
  
  // Check if there's already a connection being created for this key
  const pending = pendingConnections.get(key);
  if (pending) {
    try {
      return await pending;
    } catch {
      // Pending connection failed, try creating a new one
    }
  }
  
  // Check existing pool for available connections
  const connections = connectionPool.get(key) || [];
  
  // Find an available connection
  for (const pooled of connections) {
    if (!pooled.broken && !pooled.inUse) {
      const age = Date.now() - pooled.lastUsed;
      if (age < POOL_TTL) {
        // Skip connection test if recently used
        if (age < RECENT_THRESHOLD) {
          pooled.inUse = true;
          pooled.lastUsed = Date.now();
          return pooled.client;
        }
        
        // Connection is old - test if still alive
        try {
          await execInternal(pooled.client, credentials, 'echo test', 5000);
          pooled.inUse = true;
          pooled.lastUsed = Date.now();
          return pooled.client;
        } catch {
          // Connection dead, mark as broken
          pooled.broken = true;
        }
      } else {
        // TTL expired
        pooled.broken = true;
      }
    }
  }
  
  // Clean up broken connections
  const activeConnections = connections.filter(c => !c.broken);
  connectionPool.set(key, activeConnections);
  
  // Check if we can create a new connection
  const currentCount = activeConnections.filter(c => c.inUse).length;
  if (currentCount >= MAX_CONNECTIONS_PER_HOST) {
    // Wait for a connection to become available
    throw new Error(`Connection pool full: ${currentCount}/${MAX_CONNECTIONS_PER_HOST} connections in use for ${key}`);
  }
  
  // Create new connection with deduplication
  const connectionPromise = createConnection(credentials)
    .then((client) => {
      const newPooled: PooledConnection = {
        client,
        credentials,
        inUse: true,
        lastUsed: Date.now(),
        broken: false,
      };
      
      const existing = connectionPool.get(key) || [];
      existing.push(newPooled);
      connectionPool.set(key, existing);
      
      pendingConnections.delete(key);
      return client;
    })
    .catch((err) => {
      pendingConnections.delete(key);
      throw err;
    });
  
  pendingConnections.set(key, connectionPromise);
  return connectionPromise;
}

export function releaseConnection(creds: ZosCredentials, markBroken = false): void {
  const key = getPoolKey(creds);
  const connections = connectionPool.get(key);
  
  if (connections) {
    for (const pooled of connections) {
      if (pooled.inUse) {
        if (markBroken) {
          pooled.broken = true;
          pooled.client.end();
        } else {
          pooled.inUse = false;
          pooled.lastUsed = Date.now();
        }
        break;
      }
    }
  }
}

export async function execInternal(
  client: Client,
  creds: ZosCredentials,
  command: string,
  timeout: number = 30000
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let streamRef: any = null;

    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      if (timeoutId) clearTimeout(timeoutId);
      fn();
    };

    client.exec(command, (err, stream) => {
      if (err) {
        settle(() => reject(err));
        return;
      }

      streamRef = stream;
      let stdout = '';
      let stderr = '';

      stream.on('close', (code: number) => {
        settle(() => resolve({
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: code || 0,
        }));
      });

      stream.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      stream.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      stream.on('error', (err: Error) => {
        settle(() => reject(err));
      });

      // Timeout handling
      timeoutId = setTimeout(() => {
        settle(() => {
          if (streamRef) {
            streamRef.close();
            setTimeout(() => {
              try { streamRef.end(); } catch { /* ignore */ }
            }, 1000);
          }
          reject(new Error(`Command timeout after ${timeout}ms: ${command}`));
        });
      }, timeout);
    });
  });
}

export async function exec(
  creds: ZosCredentials,
  command: string,
  timeout: number = 30000
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  let client: Client | null = null;
  let broken = false;

  try {
    client = await getConnection(creds);
    const result = await execInternal(client, creds, command, timeout);
    return result;
  } catch (err) {
    broken = true;
    throw err;
  } finally {
    if (client) {
      releaseConnection(creds, broken);
    }
  }
}

export async function testConnection(creds?: ZosCredentials): Promise<{ success: boolean; latency: number; output: string }> {
  const credentials = creds || getDefaultCredentials();
  const start = Date.now();

  try {
    const result = await exec(credentials, 'whoami', 10000);
    const latency = Date.now() - start;

    return {
      success: result.exitCode === 0,
      latency,
      output: result.stdout || result.stderr,
    };
  } catch (err) {
    return {
      success: false,
      latency: Date.now() - start,
      output: err instanceof Error ? err.message : String(err),
    };
  }
}

export function closeAllConnections(): void {
  for (const [, connections] of connectionPool) {
    for (const pooled of connections) {
      try {
        pooled.client.end();
      } catch { /* ignore */ }
    }
  }
  connectionPool.clear();
  pendingConnections.clear();
}

// Cleanup old connections periodically
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, connections] of connectionPool) {
    const active = connections.filter(c => {
      if (c.broken) {
        try { c.client.end(); } catch { /* ignore */ }
        return false;
      }
      if (!c.inUse && (now - c.lastUsed) > POOL_TTL) {
        try { c.client.end(); } catch { /* ignore */ }
        return false;
      }
      return true;
    });
    connectionPool.set(key, active);
  }
}, 60000);

if (typeof cleanupInterval === 'object' && 'unref' in cleanupInterval) {
  cleanupInterval.unref();
}

// Get pool statistics
export function getPoolStats(): { totalConnections: number; activeConnections: number; pools: number } {
  let total = 0;
  let active = 0;
  
  for (const [, connections] of connectionPool) {
    total += connections.length;
    active += connections.filter(c => c.inUse && !c.broken).length;
  }
  
  return {
    totalConnections: total,
    activeConnections: active,
    pools: connectionPool.size,
  };
}
