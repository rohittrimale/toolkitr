import { exec } from '../ssh-pool';
import { getDefaultCredentials, type ZosCredentials } from '../credentials';

export interface SystemInfo {
  systemName: string;
  sysplexName: string;
  osVersion: string;
  mvsVersion: string;
  ipAddress: string;
  cpuCount: number;
  memoryTotal: number;
}

export interface ConsoleMessage {
  time: string;
  message: string;
}

export async function getSystemInfo(
  creds?: ZosCredentials
): Promise<SystemInfo> {
  const credentials = creds || getDefaultCredentials();
  
  // Get system information
  const commands = [
    'tsocmd "D M=CPU" 2>&1',
    'tsocmd "D A,L" 2>&1',
    'tsocmd "D IPLINFO" 2>&1',
  ];
  
  let cpuCount = 0;
  let memoryTotal = 0;
  let osVersion = 'z/OS';
  let mvsVersion = 'unknown';
  let systemName = 'SYSTEM';
  let sysplexName = '';
  
  for (const cmd of commands) {
    try {
      const result = await exec(credentials, cmd, 10000);
      const output = result.stdout;
      
      const cpuMatch = output.match(/CPU=(\d+)/i) || output.match(/(\d+)\s+CORE/i);
      if (cpuMatch) cpuCount = parseInt(cpuMatch[1]) || 1;
      
      const memMatch = output.match(/STORAGE\s*=\s*(\d+)/i) || output.match(/(\d+)M\s+REAL/i);
      if (memMatch) memoryTotal = parseInt(memMatch[1]) || 0;
      
      const iplMatch = output.match(/IPL\s+VERSION\s*=\s*(\S+)/i);
      if (iplMatch) mvsVersion = iplMatch[1];
      
      const sysMatch = output.match(/SYSTEM\s*NAME\s*=\s*(\S+)/i);
      if (sysMatch) systemName = sysMatch[1];
    } catch {}
  }
  
  return {
    systemName,
    sysplexName,
    osVersion,
    mvsVersion,
    ipAddress: credentials.sshHost,
    cpuCount: cpuCount || 1,
    memoryTotal: memoryTotal || 4096,
  };
}

export async function getConsoleLog(
  lines: number = 50,
  creds?: ZosCredentials
): Promise<ConsoleMessage[]> {
  const credentials = creds || getDefaultCredentials();
  
  const command = `tsocmd "D R,L" 2>&1`;
  const result = await exec(credentials, command, 30000);
  
  if (result.exitCode !== 0) {
    return [
      { time: new Date().toISOString(), message: 'Console log not available' }
    ];
  }
  
  const outputLines = result.stdout.split('\n').slice(0, lines);
  const messages: ConsoleMessage[] = [];
  
  for (const line of outputLines) {
    if (line.trim()) {
      const timeMatch = line.match(/^(\d{2}:\d{2}:\d{2})/);
      messages.push({
        time: timeMatch ? timeMatch[1] : '',
        message: line.replace(/^\d{2}:\d{2}:\d{2}\s*/, ''),
      });
    }
  }
  
  return messages;
}

export async function getOperLog(
  startTime?: Date,
  endTime?: Date,
  creds?: ZosCredentials
): Promise<string[]> {
  const credentials = creds || getDefaultCredentials();
  
  const command = `tsocmd "D OPR" 2>&1`;
  const result = await exec(credentials, command, 30000);
  
  if (result.exitCode !== 0) {
    return ['Operlog not available'];
  }
  
  return result.stdout.split('\n');
}

export async function executeOperatorCommand(
  command: string,
  creds?: ZosCredentials
): Promise<string> {
  const credentials = creds || getDefaultCredentials();
  
  const fullCommand = `tsocmd "${command}" 2>&1`;
  const result = await exec(credentials, fullCommand, 30000);
  
  if (result.exitCode !== 0) {
    throw new Error(result.stdout || 'Command failed');
  }
  
  return result.stdout;
}

export async function getSysplexInfo(
  creds?: ZosCredentials
): Promise<any> {
  const credentials = creds || getDefaultCredentials();
  
  const command = `tsocmd "D XCF,ALL" 2>&1`;
  const result = await exec(credentials, command, 30000);
  
  return {
    sysplexName: 'PLEX1',
    output: result.stdout,
  };
}

export async function getVolumeInfo(
  creds?: ZosCredentials
): Promise<any[]> {
  const credentials = creds || getDefaultCredentials();
  
  const command = `tsocmd "D UDFS" 2>&1`;
  const result = await exec(credentials, command, 30000);
  
  const volumes: any[] = [];
  const lines = result.stdout.split('\n');
  
  for (const line of lines) {
    const match = line.match(/(\S+)\s+(\S+)\s+(\S+)/);
    if (match) {
      volumes.push({
        volser: match[1],
        device: match[2],
        status: match[3],
      });
    }
  }
  
  return volumes;
}

export async function getIplDevice(
  creds?: ZosCredentials
): Promise<any> {
  const credentials = creds || getDefaultCredentials();
  
  const command = `tsocmd "D IPLINFO" 2>&1`;
  const result = await exec(credentials, command, 30000);
  
  return {
    output: result.stdout,
  };
}
