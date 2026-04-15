/* eslint-disable @typescript-eslint/no-explicit-any */
import { Client, SFTPWrapper, ConnectConfig, FileEntryWithStats, Stats } from 'ssh2';

export interface SshCredentials {
  host: string;
  port?: number;
  username: string;
  password?: string;
  privateKey?: string;
  passphrase?: string;
}

export interface MainframeAsset {
  dataset: string;
  member: string;
  content: string;
}

let _sshClient: Client | null = null;
let _sftpClient: SFTPWrapper | null = null;

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getSftpClient(creds: SshCredentials): Promise<SFTPWrapper> {
  if (_sftpClient && _sshClient && (_sshClient as any).conn?.authenticated) {
    return _sftpClient;
  }

  return new Promise((resolve, reject) => {
    const client = new Client();
    
    const config: ConnectConfig = {
      host: creds.host,
      port: creds.port || 22,
      username: creds.username,
    };

    if (creds.password) {
      config.password = creds.password;
    }

    if (creds.privateKey) {
      config.privateKey = creds.privateKey;
      if (creds.passphrase) {
        config.passphrase = creds.passphrase;
      }
    }

    client.on('ready', () => {
      client.sftp((err: Error | undefined, sftp: SFTPWrapper | undefined) => {
        if (err) {
          client.end();
          reject(err);
          return;
        }
        if (!sftp) {
          client.end();
          reject(new Error('SFTP not available'));
          return;
        }
        _sshClient = client;
        _sftpClient = sftp;
        resolve(sftp);
      });
    });

    client.on('error', (err: Error) => {
      console.error('[SSH] Connection error:', err.message);
      reject(err);
    });

    client.connect(config);
  });
}

export async function downloadMainframeAsset(
  dataset: string,
  member: string,
  creds: SshCredentials
): Promise<MainframeAsset | null> {
  const remotePath = `'${dataset}(${member})'`;
  
  for (let attempts = 0; attempts < 3; attempts++) {
    try {
      const sftp = await getSftpClient(creds);
      
      const content = await new Promise<string>((resolve, reject) => {
        let content = '';
        const readStream = sftp.createReadStream(remotePath, {
          encoding: 'utf8',
          flags: 'r'
        });
        
        readStream.on('data', (chunk: string) => {
          content += chunk;
        });
        
        readStream.on('end', () => {
          resolve(content);
        });
        
        readStream.on('error', (err: Error) => {
          reject(err);
        });
      });
      
      if (content) {
        return { dataset, member, content };
      }
      
      return null;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.warn(`[SSH] Attempt ${attempts + 1} failed for ${remotePath}:`, errorMsg);
      
      _sftpClient = null;
      _sshClient = null;
      
      if (attempts < 2) {
        const delay = 1000 * Math.pow(2, attempts);
        await sleep(delay);
      }
    }
  }
  
  console.warn(`[SSH] Failed to download ${dataset}(${member}) after 3 attempts`);
  return null;
}

export async function downloadDatasetMember(
  dataset: string,
  member: string,
  creds: SshCredentials
): Promise<MainframeAsset | null> {
  return downloadMainframeAsset(dataset, member, creds);
}

export async function listDatasetMembers(
  dataset: string,
  creds: SshCredentials
): Promise<string[] | null> {
  try {
    const sftp = await getSftpClient(creds);
    
    const list = await new Promise<FileEntryWithStats[]>((resolve, reject) => {
      sftp.readdir(`'${dataset}'`, (err: Error | undefined, list: FileEntryWithStats[]) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(list);
      });
    });
    
    return list
      .filter(item => !item.filename.startsWith('.'))
      .map(item => item.filename.replace(/\(.*\)$/, '').trim());
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.warn('[SSH] Failed to list members:', errorMsg);
    return null;
  }
}

export async function datasetExists(
  dataset: string,
  creds: SshCredentials
): Promise<boolean> {
  try {
    const sftp = await getSftpClient(creds);
    
    await new Promise<void>((resolve, reject) => {
      sftp.stat(`'${dataset}'`, (err: Error | undefined) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
    
    return true;
  } catch {
    return false;
  }
}

export async function memberExists(
  dataset: string,
  member: string,
  creds: SshCredentials
): Promise<boolean> {
  try {
    const sftp = await getSftpClient(creds);
    
    await new Promise<void>((resolve, reject) => {
      sftp.stat(`'${dataset}(${member})'`, (err: Error | undefined) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
    
    return true;
  } catch {
    return false;
  }
}

export async function executeCommand(
  command: string,
  creds: SshCredentials
): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = new Client();
    
    const config: ConnectConfig = {
      host: creds.host,
      port: creds.port || 22,
      username: creds.username,
    };

    if (creds.password) {
      config.password = creds.password;
    }

    if (creds.privateKey) {
      config.privateKey = creds.privateKey;
      if (creds.passphrase) {
        config.passphrase = creds.passphrase;
      }
    }

    client.on('ready', () => {
      client.exec(command, (err: Error | undefined, stream: any) => {
        if (err) {
          client.end();
          reject(err);
          return;
        }
        
        let output = '';
        let errorOutput = '';
        
        stream.on('close', (code: number) => {
          client.end();
          if (code !== 0 && errorOutput) {
            reject(new Error(errorOutput));
          } else {
            resolve(output);
          }
        });
        
        stream.on('data', (data: Buffer) => {
          output += data.toString();
        });
        
        stream.stderr.on('data', (data: Buffer) => {
          errorOutput += data.toString();
        });
      });
    });

    client.on('error', (err: Error) => {
      reject(err);
    });

    client.connect(config);
  });
}

export async function submitJcl(
  jclContent: string,
  creds: SshCredentials
): Promise<{ jobId: string; output?: string }> {
  const tempJcl = `/tmp/temp_jcl_${Date.now()}.jcl`;
  
  try {
    const sftp = await getSftpClient(creds);
    
    await new Promise<void>((resolve, reject) => {
      sftp.writeFile(tempJcl, jclContent, (err: Error | null | undefined) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    const submitCmd = `submit '${tempJcl}'`;
    const result = await executeCommand(submitCmd, creds);
    
    const jobMatch = result.match(/JOB(\d+)/i) || result.match(/IEE\d+/i);
    const jobId = jobMatch ? jobMatch[0] : 'UNKNOWN';
    
    return { jobId, output: result };
  } finally {
    try {
      const sftp = await getSftpClient(creds);
      await new Promise<void>((resolve) => {
        sftp.unlink(tempJcl, (err: Error | null | undefined) => {
          if (err) console.warn('[SSH] Failed to delete temp JCL:', err.message);
          resolve();
        });
      });
    } catch {
    }
  }
}

export async function getJobOutput(
  jobId: string,
  creds: SshCredentials
): Promise<string | null> {
  try {
    const command = `output ${jobId}`;
    const output = await executeCommand(command, creds);
    return output;
  } catch {
    return null;
  }
}

export function disconnect(): void {
  if (_sshClient) {
    _sshClient.end();
    _sshClient = null;
    _sftpClient = null;
  }
}

export function isConnected(): boolean {
  return _sftpClient !== null && _sshClient !== null;
}
