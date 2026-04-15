import { exec } from '../ssh-pool';
import { getDefaultCredentials, type ZosCredentials } from '../credentials';

export interface VsamDataset {
  name: string;
  type: 'KSDS' | 'ESDS' | 'RRDS' | 'LDS';
  recfm: string;
  lrecl: number;
  blksize: number;
  cisize: number;
  maxlrecl: number;
}

export async function listVsamDatasets(
  pattern: string = 'YOUR.DATASET.**',
  creds?: ZosCredentials
): Promise<VsamDataset[]> {
  const credentials = creds || getDefaultCredentials();
  
  const command = `tsocmd "LISTCAT ENTRIES('${pattern}') ALL" 2>&1`;
  const result = await exec(credentials, command, 30000);
  
  if (result.exitCode !== 0) {
    return [];
  }
  
  const lines = result.stdout.split('\n');
  const datasets: VsamDataset[] = [];
  let currentDs: Partial<VsamDataset> = {};
  
  for (const line of lines) {
    if (line.includes('CLUSTER')) {
      if (currentDs.name) {
        datasets.push(currentDs as VsamDataset);
      }
      const match = line.match(/^\s*(\S+)\s+-{2,}\s+CLUSTER/);
      if (match) {
        currentDs = { name: match[1].trim(), type: 'KSDS' };
      }
    }
    if (line.includes('RECFM')) {
      const match = line.match(/RECFM-\s*(\S+)/);
      if (match) currentDs.recfm = match[1];
    }
    if (line.includes('LRECL')) {
      const match = line.match(/LRECL-\s*(\d+)/);
      if (match) currentDs.lrecl = parseInt(match[1]);
    }
    if (line.includes('BLKSIZE')) {
      const match = line.match(/BLKSIZE-\s*(\d+)/);
      if (match) currentDs.blksize = parseInt(match[1]);
    }
    if (line.includes('MAXLRECL')) {
      const match = line.match(/MAXLRECL-\s*(\d+)/);
      if (match) currentDs.maxlrecl = parseInt(match[1]);
    }
    if (line.includes('CISIZE')) {
      const match = line.match(/CISIZE-\s*(\d+)/);
      if (match) currentDs.cisize = parseInt(match[1]);
    }
  }
  
  if (currentDs.name) {
    datasets.push(currentDs as VsamDataset);
  }
  
  return datasets;
}

export async function getVsamInfo(
  datasetName: string,
  creds?: ZosCredentials
): Promise<VsamDataset | null> {
  const credentials = creds || getDefaultCredentials();
  
  const command = `tsocmd "LISTCAT ENTRIES('${datasetName}') ALL" 2>&1`;
  const result = await exec(credentials, command, 30000);
  
  if (result.exitCode !== 0) {
    return null;
  }
  
  const info: Partial<VsamDataset> = { name: datasetName };
  const lines = result.stdout.split('\n');
  
  for (const line of lines) {
    if (line.includes('CLUSTER')) {
      const match = line.match(/^\s*(\S+)\s+-{2,}\s+(\S+)/);
      if (match) {
        const type = match[2];
        if (type === 'CLUSTER') info.type = 'KSDS';
        else if (type === 'DATA') info.type = 'ESDS';
        else info.type = 'RRDS';
      }
    }
    if (line.includes('RECFM')) {
      const match = line.match(/RECFM-\s*(\S+)/);
      if (match) info.recfm = match[1];
    }
    if (line.includes('LRECL') && !line.includes('MAX')) {
      const match = line.match(/LRECL-\s*(\d+)/);
      if (match) info.lrecl = parseInt(match[1]);
    }
    if (line.includes('BLKSIZE')) {
      const match = line.match(/BLKSIZE-\s*(\d+)/);
      if (match) info.blksize = parseInt(match[1]);
    }
    if (line.includes('MAXLRECL')) {
      const match = line.match(/MAXLRECL-\s*(\d+)/);
      if (match) info.maxlrecl = parseInt(match[1]);
    }
    if (line.includes('CISIZE')) {
      const match = line.match(/CISIZE-\s*(\d+)/);
      if (match) info.cisize = parseInt(match[1]);
    }
  }
  
  return info as VsamDataset;
}

export async function defineVsam(
  datasetName: string,
  options: {
    type: 'KSDS' | 'ESDS' | 'RRDS' | 'LDS';
    recfm?: string;
    lrecl?: number;
    cisize?: number;
    tracks?: number;
    volume?: string;
  },
  creds?: ZosCredentials
): Promise<void> {
  const credentials = creds || getDefaultCredentials();
  
  const typeParam = options.type === 'KSDS' ? 'INDEXED' 
    : options.type === 'ESDS' ? 'NONINDEXED'
    : options.type === 'RRDS' ? 'RECORD'
    : 'LDS';
  
  const recfm = options.recfm || 'FB';
  const lrecl = options.lrecl || 80;
  const cisize = options.cisize || 4096;
  const tracks = options.tracks || 10;
  const volume = options.volume || 'USRVS1';
  
  const command = `tsocmd "DEFINE CLUSTER (NAME('${datasetName}') ${typeParam} RECFM(${recfm}) LRECL(${lrecl}) CISIZE(${cisize}) TRACKS(${tracks}) VOLUME(${volume}))" 2>&1`;
  const result = await exec(credentials, command, 60000);
  
  if (result.exitCode !== 0) {
    throw new Error(result.stdout || 'Failed to define VSAM dataset');
  }
}

export async function deleteVsam(
  datasetName: string,
  creds?: ZosCredentials
): Promise<void> {
  const credentials = creds || getDefaultCredentials();
  
  const command = `tsocmd "DELETE '${datasetName}' CLUSTER" 2>&1`;
  const result = await exec(credentials, command, 30000);
  
  if (result.exitCode !== 0) {
    throw new Error(result.stdout || 'Failed to delete VSAM dataset');
  }
}

export async function reproVsam(
  sourceDataset: string,
  targetDataset: string,
  creds?: ZosCredentials
): Promise<void> {
  const credentials = creds || getDefaultCredentials();
  
  const command = `tsocmd "REPRO INFILE('${sourceDataset}') OUTFILE('${targetDataset}')" 2>&1`;
  const result = await exec(credentials, command, 120000);
  
  if (result.exitCode !== 0) {
    throw new Error(result.stdout || 'Failed to REPRO VSAM dataset');
  }
}
