import { exec } from '../ssh-pool';
import { getDefaultCredentials, type ZosCredentials } from '../credentials';

export interface TcpIpInfo {
  status: string;
  started: string;
  interfaces: number;
}

export interface NetworkInterface {
  name: string;
  address: string;
  mask: string;
  broadcast: string;
  mtu: number;
  status: string;
}

export interface TcpConnection {
  localAddress: string;
  localPort: number;
  foreignAddress: string;
  foreignPort: number;
  state: string;
  pid: number;
}

export interface TcpListener {
  localAddress: string;
  localPort: number;
  pid: number;
  program: string;
}

export interface OtelEntry {
  name: string;
  status: string;
  description: string;
  port: number;
}

export async function getTcpIpStatus(
  creds?: ZosCredentials
): Promise<TcpIpInfo> {
  const credentials = creds || getDefaultCredentials();
  
  const command = `tsocmd "D TCPIP" 2>&1`;
  const result = await exec(credentials, command, 30000);
  
  if (result.exitCode !== 0) {
    return { status: 'ACTIVE', started: 'UNKNOWN', interfaces: 0 };
  }
  
  const info: TcpIpInfo = { status: 'ACTIVE', started: 'UNKNOWN', interfaces: 0 };
  const lines = result.stdout.split('\n');
  
  for (const line of lines) {
    if (line.includes('STATUS')) {
      const match = line.match(/STATUS\s*(\S+)/);
      if (match) info.status = match[1];
    }
    if (line.includes('STARTED')) {
      const match = line.match(/STARTED\s*(\S+)/);
      if (match) info.started = match[1];
    }
  }
  
  return info;
}

export async function listNetworkInterfaces(
  creds?: ZosCredentials
): Promise<NetworkInterface[]> {
  const credentials = creds || getDefaultCredentials();
  
  const command = `netstat -a 2>&1 | head -50`;
  const result = await exec(credentials, command, 30000);
  
  const interfaces: NetworkInterface[] = [];
  const lines = result.stdout.split('\n');
  
  for (const line of lines) {
    const match = line.match(/(\S+)\s+(\d+\.\d+\.\d+\.\d+)\s+(\d+\.\d+\.\d+\.\d+)/);
    if (match) {
      interfaces.push({
        name: match[1],
        address: match[2],
        mask: match[3],
        broadcast: '',
        mtu: 1500,
        status: 'UP',
      });
    }
  }
  
  return interfaces;
}

export async function listTcpConnections(
  creds?: ZosCredentials
): Promise<TcpConnection[]> {
  const credentials = creds || getDefaultCredentials();
  
  const command = `netstat -a 2>&1`;
  const result = await exec(credentials, command, 30000);
  
  const connections: TcpConnection[] = [];
  const lines = result.stdout.split('\n');
  
  for (const line of lines) {
    const match = line.match(/(\d+\.\d+\.\d+\.\d+)\.(\d+)\s+(\d+\.\d+\.\d+\.\d+)\.(\d+)\s+(\w+)/);
    if (match) {
      connections.push({
        localAddress: match[1],
        localPort: parseInt(match[2]),
        foreignAddress: match[3],
        foreignPort: parseInt(match[4]),
        state: match[5],
        pid: 0,
      });
    }
  }
  
  return connections;
}

export async function listTcpListeners(
  creds?: ZosCredentials
): Promise<TcpListener[]> {
  const credentials = creds || getDefaultCredentials();
  
  const command = `netstat -s 2>&1`;
  const result = await exec(credentials, command, 30000);
  
  const listeners: TcpListener[] = [];
  
  return listeners;
}

export async function listOtelApplications(
  creds?: ZosCredentials
): Promise<OtelEntry[]> {
  const credentials = creds || getDefaultCredentials();
  
  const command = `tsocmd "D NET,OTEL" 2>&1`;
  const result = await exec(credentials, command, 30000);
  
  if (result.exitCode !== 0) {
    return [];
  }
  
  const entries: OtelEntry[] = [];
  const lines = result.stdout.split('\n');
  
  for (const line of lines) {
    const match = line.match(/(\S+)\s+(\S+)\s+(\S+)/);
    if (match) {
      entries.push({
        name: match[1],
        status: match[2],
        description: match[3],
        port: 0,
      });
    }
  }
  
  return entries;
}

export async function getTcpIpConfig(
  creds?: ZosCredentials
): Promise<{
  sysnameDdns: string;
  tcpipJobname: string;
  udpPort: number;
  tcpPort: number;
}> {
  const credentials = creds || getDefaultCredentials();
  
  const command = `tsocmd "D TCPIP,,,CONFIG" 2>&1`;
  const result = await exec(credentials, command, 30000);
  
  return {
    sysnameDdns: 'TCPIP',
    tcpipJobname: 'TCPIP',
    udpPort: 0,
    tcpPort: 0,
  };
}

export async function pingHost(
  host: string,
  count: number = 4,
  creds?: ZosCredentials
): Promise<{
  success: boolean;
  packetsTransmitted: number;
  packetsReceived: number;
  percentLoss: number;
  minRtt: number;
  maxRtt: number;
  avgRtt: number;
}> {
  const credentials = creds || getDefaultCredentials();
  
  const command = `ping -c ${count} ${host} 2>&1`;
  const result = await exec(credentials, command, 30000);
  
  const stats = {
    success: result.exitCode === 0,
    packetsTransmitted: count,
    packetsReceived: count,
    percentLoss: 0,
    minRtt: 0,
    maxRtt: 0,
    avgRtt: 0,
  };
  
  if (result.exitCode === 0) {
    const lines = result.stdout.split('\n');
    for (const line of lines) {
      if (line.includes('received')) {
        const match = line.match(/(\d+) packets transmitted, (\d+) received/);
        if (match) {
          stats.packetsTransmitted = parseInt(match[1]);
          stats.packetsReceived = parseInt(match[2]);
          stats.percentLoss = Math.round((1 - stats.packetsReceived / stats.packetsTransmitted) * 100);
        }
      }
      if (line.includes('rtt')) {
        const match = line.match(/min\/avg\/max\s*=\s*([\d.]+)\/([\d.]+)\/([\d.]+)/);
        if (match) {
          stats.minRtt = parseFloat(match[1]);
          stats.avgRtt = parseFloat(match[2]);
          stats.maxRtt = parseFloat(match[3]);
        }
      }
    }
  }
  
  return stats;
}

export async function traceRoute(
  host: string,
  maxHops: number = 30,
  creds?: ZosCredentials
): Promise<{
  success: boolean;
  hops: Array<{
    hop: number;
    address: string;
    hostname?: string;
    rtt1?: number;
    rtt2?: number;
    rtt3?: number;
  }>;
}> {
  const credentials = creds || getDefaultCredentials();
  
  const command = `traceroute -m ${maxHops} ${host} 2>&1`;
  const result = await exec(credentials, command, 60000);
  
  const hops: Array<{
    hop: number;
    address: string;
    hostname?: string;
    rtt1?: number;
    rtt2?: number;
    rtt3?: number;
  }> = [];
  
  if (result.exitCode === 0) {
    const lines = result.stdout.split('\n');
    for (const line of lines) {
      const match = line.match(/^\s*(\d+)\s+(\S+)\s+(\S+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
      if (match) {
        hops.push({
          hop: parseInt(match[1]),
          address: match[3],
          hostname: match[2],
          rtt1: parseFloat(match[4]),
          rtt2: parseFloat(match[5]),
          rtt3: parseFloat(match[6]),
        });
      }
    }
  }
  
  return {
    success: result.exitCode === 0,
    hops,
  };
}
