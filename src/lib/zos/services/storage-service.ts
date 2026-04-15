import { exec } from '../ssh-pool';
import { getDefaultCredentials, type ZosCredentials } from '../credentials';

export interface VolumeInfo {
  volser: string;
  device: string;
  status: string;
  totalCylinders: number;
  usedCylinders: number;
  freeCylinders: number;
  totalTracks: number;
  usedTracks: number;
  freeTracks: number;
  vtocStart: string;
  vtocEnd: string;
}

export interface StorageGroupInfo {
  name: string;
  volser: string;
  totalCylinders: number;
  usedCylinders: number;
  freeCylinders: number;
}

export interface DatasetSpace {
  name: string;
  usedTracks: number;
  freeTracks: number;
  totalExtents: number;
  usedExtents: number;
}

export async function listVolumeInfo(
  volumeSerial?: string,
  creds?: ZosCredentials
): Promise<VolumeInfo[]> {
  const credentials = creds || getDefaultCredentials();
  
  const command = volumeSerial 
    ? `tsocmd "DASD ${volumeSerial}" 2>&1`
    : `tsocmd "D UDFS" 2>&1`;
    
  const result = await exec(credentials, command, 30000);
  
  if (result.exitCode !== 0) {
    return [];
  }
  
  const lines = result.stdout.split('\n');
  const volumes: VolumeInfo[] = [];
  
  for (const line of lines) {
    const match = line.match(/^(\S{6})\s+(\S+)\s+(\S+)/);
    if (match) {
      volumes.push({
        volser: match[1],
        device: match[2],
        status: match[3],
        totalCylinders: 0,
        usedCylinders: 0,
        freeCylinders: 0,
        totalTracks: 0,
        usedTracks: 0,
        freeTracks: 0,
        vtocStart: '0',
        vtocEnd: '0',
      });
    }
  }
  
  return volumes;
}

export async function getDetailedVolumeInfo(
  volumeSerial: string,
  creds?: ZosCredentials
): Promise<VolumeInfo | null> {
  const credentials = creds || getDefaultCredentials();
  
  const command = `tsocmd "DASD DETAIL(${volumeSerial})" 2>&1`;
  const result = await exec(credentials, command, 30000);
  
  if (result.exitCode !== 0) {
    return null;
  }
  
  const info: Partial<VolumeInfo> = { volser: volumeSerial };
  const lines = result.stdout.split('\n');
  
  for (const line of lines) {
    if (line.includes('DEVICE=')) {
      const match = line.match(/DEVICE=(\S+)/);
      if (match) info.device = match[1];
    }
    if (line.includes('STATUS=')) {
      const match = line.match(/STATUS=(\S+)/);
      if (match) info.status = match[1];
    }
    if (line.includes('TOTAL CYLS=')) {
      const match = line.match(/TOTAL CYLS=(\d+)/);
      if (match) info.totalCylinders = parseInt(match[1]);
    }
    if (line.includes('FREE CYLS=')) {
      const match = line.match(/FREE CYLS=(\d+)/);
      if (match) info.freeCylinders = parseInt(match[1]);
    }
    if (line.includes('TOTAL TRKS=')) {
      const match = line.match(/TOTAL TRKS=(\d+)/);
      if (match) info.totalTracks = parseInt(match[1]);
    }
    if (line.includes('FREE TRKS=')) {
      const match = line.match(/FREE TRKS=(\d+)/);
      if (match) info.freeTracks = parseInt(match[1]);
    }
  }
  
  if (info.totalCylinders && info.freeCylinders) {
    info.usedCylinders = info.totalCylinders - info.freeCylinders;
  }
  if (info.totalTracks && info.freeTracks) {
    info.usedTracks = info.totalTracks - info.freeTracks;
  }
  
  return info as VolumeInfo;
}

export async function listStorageGroups(
  creds?: ZosCredentials
): Promise<StorageGroupInfo[]> {
  const credentials = creds || getDefaultCredentials();
  
  const command = `tsocmd "D SMS,STORGRP" 2>&1`;
  const result = await exec(credentials, command, 30000);
  
  if (result.exitCode !== 0) {
    return [];
  }
  
  const lines = result.stdout.split('\n');
  const groups: StorageGroupInfo[] = [];
  
  for (const line of lines) {
    const match = line.match(/(\S+)\s+(\S+)\s+(\d+)\s+(\d+)/);
    if (match) {
      groups.push({
        name: match[1],
        volser: match[2],
        totalCylinders: parseInt(match[3]),
        usedCylinders: parseInt(match[4]),
        freeCylinders: parseInt(match[3]) - parseInt(match[4]),
      });
    }
  }
  
  return groups;
}

export async function getDatasetSpace(
  datasetName: string,
  creds?: ZosCredentials
): Promise<DatasetSpace | null> {
  const credentials = creds || getDefaultCredentials();
  
  const command = `tsocmd "LISTDS '${datasetName}' ALL" 2>&1`;
  const result = await exec(credentials, command, 30000);
  
  if (result.exitCode !== 0) {
    return null;
  }
  
  const info: Partial<DatasetSpace> = { name: datasetName };
  const lines = result.stdout.split('\n');
  
  for (const line of lines) {
    if (line.includes('NOT TOTAL')) continue;
    if (line.includes('TRACKS')) {
      const match = line.match(/(\d+)\s+(\d+)\s+(\d+)/);
      if (match) {
        info.usedTracks = parseInt(match[1]);
        info.freeTracks = parseInt(match[2]);
      }
    }
    if (line.includes('EXTENTS')) {
      const match = line.match(/EXTENTS\s*=\s*(\d+)/);
      if (match) {
        info.totalExtents = parseInt(match[1]);
      }
    }
  }
  
  return info as DatasetSpace;
}

export async function analyzeStorage(
  pattern: string = 'YOUR.DATASET.**',
  creds?: ZosCredentials
): Promise<{
  totalDatasets: number;
  totalTracks: number;
  totalCylinders: number;
  byVolume: Record<string, number>;
  byUnit: Record<string, number>;
}> {
  const credentials = creds || getDefaultCredentials();
  
  const command = `tsocmd "LISTCAT LEVEL(${pattern}) ALL" 2>&1`;
  const result = await exec(credentials, command, 60000);
  
  if (result.exitCode !== 0) {
    return {
      totalDatasets: 0,
      totalTracks: 0,
      totalCylinders: 0,
      byVolume: {},
      byUnit: {},
    };
  }
  
  let totalDatasets = 0;
  let totalTracks = 0;
  let totalCylinders = 0;
  const byVolume: Record<string, number> = {};
  const byUnit: Record<string, number> = {};
  
  const lines = result.stdout.split('\n');
  
  for (const line of lines) {
    if (line.includes('NONVSAM') || line.includes('CLUSTER')) {
      totalDatasets++;
    }
    if (line.includes('TRACKS')) {
      const match = line.match(/(\d+)\s+TRACKS/);
      if (match) {
        totalTracks += parseInt(match[1]);
      }
    }
    if (line.includes('CYLINDERS')) {
      const match = line.match(/(\d+)\s+CYLS/);
      if (match) {
        totalCylinders += parseInt(match[1]);
      }
    }
    if (line.includes('VOL=')) {
      const match = line.match(/VOL=(\S+)/);
      if (match) {
        byVolume[match[1]] = (byVolume[match[1]] || 0) + 1;
      }
    }
  }
  
  return {
    totalDatasets,
    totalTracks,
    totalCylinders,
    byVolume,
    byUnit,
  };
}
