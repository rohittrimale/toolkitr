import { exec } from '../ssh-pool';
import { getDefaultCredentials, type ZosCredentials } from '../credentials';

export interface RacfUser {
  name: string;
  owner: string;
  created: string;
  defaultGroup: string;
  attributes: string[];
}

export interface RacfGroup {
  name: string;
  owner: string;
  superiorGroup: string;
  members: string[];
}

export interface RacfDataset {
  name: string;
  owner: string;
  level: number;
  auth: string;
}

export async function listRacfUsers(
  pattern: string = 'YOUR*',
  creds?: ZosCredentials
): Promise<RacfUser[]> {
  const credentials = creds || getDefaultCredentials();
  
  const command = `tsocmd "LISTUSER ${pattern}" 2>&1`;
  const result = await exec(credentials, command, 30000);
  
  if (result.exitCode !== 0) {
    return [];
  }
  
  const lines = result.stdout.split('\n');
  const users: RacfUser[] = [];
  let currentUser: Partial<RacfUser> = {};
  const attrs: string[] = [];
  
  for (const line of lines) {
    if (line.includes('USER=')) {
      if (currentUser.name) {
        currentUser.attributes = [...attrs];
        users.push(currentUser as RacfUser);
      }
      const match = line.match(/USER=(\S+)/);
      if (match) {
        currentUser = { name: match[1], attributes: [] };
      }
    }
    if (line.includes('OWNER=')) {
      const match = line.match(/OWNER=(\S+)/);
      if (match) currentUser.owner = match[1];
    }
    if (line.includes('CREATED=')) {
      const match = line.match(/CREATED=(\S+)/);
      if (match) currentUser.created = match[1];
    }
    if (line.includes('DEFAULT-GROUP=')) {
      const match = line.match(/DEFAULT-GROUP=(\S+)/);
      if (match) currentUser.defaultGroup = match[1];
    }
    if (line.includes('ATTRIBUTES=')) {
      const match = line.match(/ATTRIBUTES=(\S+)/);
      if (match) attrs.push(match[1]);
    }
  }
  
  if (currentUser.name) {
    currentUser.attributes = [...attrs];
    users.push(currentUser as RacfUser);
  }
  
  return users;
}

export async function listRacfGroups(
  pattern: string = 'YOUR*',
  creds?: ZosCredentials
): Promise<RacfGroup[]> {
  const credentials = creds || getDefaultCredentials();
  
  const command = `tsocmd "LISTGRP ${pattern}" 2>&1`;
  const result = await exec(credentials, command, 30000);
  
  if (result.exitCode !== 0) {
    return [];
  }
  
  const lines = result.stdout.split('\n');
  const groups: RacfGroup[] = [];
  let currentGroup: Partial<RacfGroup> = { members: [] };
  
  for (const line of lines) {
    if (line.includes('GROUP=')) {
      if (currentGroup.name) {
        groups.push(currentGroup as RacfGroup);
      }
      const match = line.match(/GROUP=(\S+)/);
      if (match) {
        currentGroup = { name: match[1], members: [] };
      }
    }
    if (line.includes('OWNER=')) {
      const match = line.match(/OWNER=(\S+)/);
      if (match) currentGroup.owner = match[1];
    }
    if (line.includes('SUPERIOR=')) {
      const match = line.match(/SUPERIOR=(\S+)/);
      if (match) currentGroup.superiorGroup = match[1];
    }
    if (line.includes('MEMBER=')) {
      const match = line.match(/MEMBER=(\S+)/);
      if (match && currentGroup.members) {
        currentGroup.members.push(match[1]);
      }
    }
  }
  
  if (currentGroup.name) {
    groups.push(currentGroup as RacfGroup);
  }
  
  return groups;
}

export async function listRacfDatasets(
  pattern: string = 'YOUR.DATASET.**',
  creds?: ZosCredentials
): Promise<RacfDataset[]> {
  const credentials = creds || getDefaultCredentials();
  
  const command = `tsocmd "LISTDSD DATASET('${pattern}') ALL" 2>&1`;
  const result = await exec(credentials, command, 30000);
  
  if (result.exitCode !== 0) {
    return [];
  }
  
  const lines = result.stdout.split('\n');
  const datasets: RacfDataset[] = [];
  let currentDs: Partial<RacfDataset> = {};
  
  for (const line of lines) {
    if (line.includes('DATASET=')) {
      if (currentDs.name) {
        datasets.push(currentDs as RacfDataset);
      }
      const match = line.match(/DATASET=(\S+)/);
      if (match) {
        currentDs = { name: match[1] };
      }
    }
    if (line.includes('OWNER=')) {
      const match = line.match(/OWNER=(\S+)/);
      if (match) currentDs.owner = match[1];
    }
    if (line.includes('LEVEL=')) {
      const match = line.match(/LEVEL=(\d+)/);
      if (match) currentDs.level = parseInt(match[1]);
    }
    if (line.includes('AUTHORITY=')) {
      const match = line.match(/AUTHORITY=(\S+)/);
      if (match) currentDs.auth = match[1];
    }
  }
  
  if (currentDs.name) {
    datasets.push(currentDs as RacfDataset);
  }
  
  return datasets;
}

export async function addRacfUser(
  userId: string,
  options: {
    name?: string;
    password?: string;
    group?: string;
  },
  creds?: ZosCredentials
): Promise<void> {
  const credentials = creds || getDefaultCredentials();
  
  const parts: string[] = [`USER(${userId})`];
  if (options.name) parts.push(`NAME(${options.name})`);
  if (options.password) parts.push(`PASSWORD(${options.password})`);
  if (options.group) parts.push(`DFLTGRP(${options.group})`);
  
  const command = `tsocmd "ADDUSER ${parts.join(' ')}" 2>&1`;
  const result = await exec(credentials, command, 30000);
  
  if (result.exitCode !== 0 && !result.stdout.includes('IKJ56701I')) {
    throw new Error(result.stdout || 'Failed to add RACF user');
  }
}

export async function addRacfDataset(
  datasetName: string,
  options: {
    owner?: string;
    level?: number;
    universalAccess?: string;
  },
  creds?: ZosCredentials
): Promise<void> {
  const credentials = creds || getDefaultCredentials();
  
  const parts: string[] = [`DATASET('${datasetName}')`];
  if (options.owner) parts.push(`OWNER(${options.owner})`);
  if (options.level) parts.push(`LEVEL(${options.level})`);
  if (options.universalAccess) parts.push(`UACC(${options.universalAccess})`);
  
  const command = `tsocmd "ADDSD ${parts.join(' ')}" 2>&1`;
  const result = await exec(credentials, command, 30000);
  
  if (result.exitCode !== 0) {
    throw new Error(result.stdout || 'Failed to add RACF dataset');
  }
}

export async function permitDataset(
  datasetName: string,
  userId: string,
  access: 'READ' | 'UPDATE' | 'CONTROL' | 'ALTER',
  creds?: ZosCredentials
): Promise<void> {
  const credentials = creds || getDefaultCredentials();
  
  const command = `tsocmd "PERMIT '${datasetName}' ID(${userId}) ACCESS(${access})" 2>&1`;
  const result = await exec(credentials, command, 30000);
  
  if (result.exitCode !== 0) {
    throw new Error(result.stdout || 'Failed to permit dataset');
  }
}
