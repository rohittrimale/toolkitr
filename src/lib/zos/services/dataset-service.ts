import { exec } from '../ssh-pool';
import { zosCache, CacheService } from '../cache';
import { zosConfig } from '../config';
import { getDefaultCredentials, type ZosCredentials } from '../credentials';

function sanitizeDatasetName(dsn: string): string {
  return dsn.toUpperCase().replace(/['"]/g, '').trim();
}

function sanitizeMemberName(member: string): string {
  return member.toUpperCase().replace(/[^A-Z0-9@#$]/g, '').substring(0, 8);
}

export async function listDatasets(
  pattern: string,
  creds?: ZosCredentials,
  maxResults: number = 1000
): Promise<any[]> {
  const credentials = creds || getDefaultCredentials();
  const cleanPattern = sanitizeDatasetName(pattern || zosConfig.defaults.hlq);
  
  // Handle wildcard patterns - use LISTDS for PDS pattern matching
  // TSO LISTDS supports % (single char) and * (multiple chars) wildcards
  const hasWildcard = cleanPattern.includes('*') || cleanPattern.includes('%');
  
  // Execute LISTCAT or LISTDS command
  let command: string;
  if (hasWildcard) {
    // For wildcard patterns, use LISTDS with quotes
    command = `tsocmd "LISTDS '${cleanPattern}'" 2>&1`;
  } else {
    // For non-wildcard, use LISTCAT
    command = `tsocmd "LISTCAT LEVEL(${cleanPattern})" 2>&1`;
  }
  const result = await exec(credentials, command, 30000);
  
  if (result.exitCode !== 0 && !result.stdout.includes('NOT FOUND')) {
    throw new Error(result.stdout || 'Failed to list datasets');
  }

  const lines = result.stdout.split('\n');
  const datasets: any[] = [];

  // Parse output based on which command was used
  if (hasWildcard) {
    // LISTDS output format - dataset name starts at column 1
    for (const line of lines) {
      // Match dataset names (start with letter, contain dots)
      const match = line.match(/^([A-Z@#$][A-Z0-9@#$.*]*\.[A-Z@#$][A-Z0-9@#$.*]*)/);
      if (!match) continue;
      
      const name = match[1].trim();
      // Skip header lines
      if (name.includes('RECFM') || name.includes('VOLUME') || name.includes('--')) continue;
      
      // Determine DSORG from the line below if available
      let dsorg = 'PS';
      const idx = lines.indexOf(line);
      if (idx >= 0 && idx < lines.length - 1) {
        const nextLine = lines[idx + 1];
        if (nextLine.includes('PO ')) dsorg = 'PO';
        else if (nextLine.includes('PS ')) dsorg = 'PS';
      }
      
      datasets.push({ name, dsorg });
      if (datasets.length >= maxResults) break;
    }
  } else {
    // LISTCAT output format
    for (const line of lines) {
      const match = line.match(/^\s*(\S+)\s+-{2,}\s+(\S+)/);
      if (!match) continue;
      
      const name = match[1].trim();
      const type = match[2].trim();
      
      if (type === 'DATA' || type === 'INDEX') continue;
      if (line.includes('IN-CAT')) continue;
      
      const dsorg = type === 'NONVSAM' ? 'PS' 
        : type === 'CLUSTER' ? 'VSAM' 
        : type === 'GDG' ? 'GDG' 
        : type;
      
      datasets.push({ name, dsorg });
      if (datasets.length >= maxResults) break;
    }
  }
  
  // Cache results
  const cacheKey = CacheService.keyDatasetList(
    credentials.userId,
    credentials.sshHost,
    credentials.sshPort,
    cleanPattern
  );
  zosCache.set(cacheKey, datasets, zosConfig.cache.ttlDatasetList);
  
  return datasets;
}

export async function listMembers(
  datasetName: string,
  creds?: ZosCredentials,
  maxResults: number = 5000
): Promise<string[]> {
  const credentials = creds || getDefaultCredentials();
  const dsn = sanitizeDatasetName(datasetName);
  
  // Check cache
  const cacheKey = CacheService.keyMembers(
    credentials.userId,
    credentials.sshHost,
    credentials.sshPort,
    dsn
  );
  const cached = zosCache.get<string[]>(cacheKey);
  if (cached) return cached;

  // Execute LISTDS command
  const command = `tsocmd "LISTDS '${dsn}' MEMBERS" 2>&1`;
  const result = await exec(credentials, command, 30000);
  
  if (result.exitCode !== 0) {
    throw new Error(result.stdout || 'Failed to list members');
  }

  const lines = result.stdout.split('\n');
  const members: string[] = [];
  let inMembers = false;

  for (const line of lines) {
    if (/--MEMBERS--|MEMBERS:/.test(line)) {
      inMembers = true;
      continue;
    }
    if (inMembers) {
      const parts = line.trim().split(/\s+/);
      for (const name of parts) {
        if (name && /^[A-Z@#$][A-Z0-9@#$]{0,7}$/.test(name)) {
          members.push(name);
        }
      }
    }
    if (members.length >= maxResults) break;
  }

  // Cache results
  zosCache.set(cacheKey, members, zosConfig.cache.ttlDatasetList);
  
  return members;
}

export async function readContent(
  datasetName: string,
  member?: string,
  creds?: ZosCredentials
): Promise<string> {
  const credentials = creds || getDefaultCredentials();
  const dsn = sanitizeDatasetName(datasetName);
  const mem = member ? sanitizeMemberName(member) : null;
  
  // Check cache
  const cacheKey = CacheService.keyContent(
    credentials.userId,
    credentials.sshHost,
    credentials.sshPort,
    dsn,
    mem || undefined
  );
  const cached = zosCache.get<string>(cacheKey);
  if (cached) return cached;

  // Use direct cat command to read MVS dataset/member
  // Format: cat "//'DATASET(MEMBER)'" or cat "//'DATASET'"
  // Note: The // must be OUTSIDE the quotes for proper shell interpretation
  const memberSpec = mem ? `${dsn}(${mem})` : dsn;
  const command = `cat //"'${memberSpec}'"`;
  
  const result = await exec(credentials, command, 60000);
  
  // Check if command succeeded
  if (result.exitCode !== 0 || result.stdout.includes('NOT FOUND') || result.stdout.includes('ERROR')) {
    throw new Error(result.stderr || result.stdout || 'Failed to read content');
  }

  const finalContent = result.stdout.trim();

  // Cache results
  zosCache.set(cacheKey, finalContent, zosConfig.cache.ttlContent);
  
  return finalContent;
}

export async function writeContent(
  datasetName: string,
  content: string,
  member?: string,
  creds?: ZosCredentials
): Promise<void> {
  const credentials = creds || getDefaultCredentials();
  const dsn = sanitizeDatasetName(datasetName);
  const mem = member ? sanitizeMemberName(member) : null;
  
  // Create temp USS file to hold content
  const tempFile = `/tmp/write_${Date.now()}_${Math.random().toString(36).substring(2, 9)}.txt`;
  const memberSpec = mem ? `${dsn}(${mem})` : dsn;
  
  try {
    // Step 1: Write content to USS temp file using shell redirection
    const delim = `EOF_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    const writeCommand = `cat > '${tempFile}' << '${delim}'\n${content}\n${delim}`;
    const writeResult = await exec(credentials, writeCommand, 30000);
    
    if (writeResult.exitCode !== 0) {
      throw new Error(`Failed to create temp file: ${writeResult.stderr || writeResult.stdout}`);
    }
    
    // Step 2: Use OPUT to copy USS file to MVS dataset
    const oputCommand = `tsocmd "OPUT '${tempFile}' '${memberSpec}'" 2>&1`;
    const oputResult = await exec(credentials, oputCommand, 30000);
    
    if (oputResult.exitCode !== 0 || oputResult.stdout.includes('ERROR')) {
      throw new Error(`OPUT failed: ${oputResult.stdout || oputResult.stderr}`);
    }
  } finally {
    // Always clean up temp file
    await exec(credentials, `rm -f '${tempFile}' 2>/dev/null`, 5000).catch(() => {
      // Ignore cleanup errors
    });
  }

  // Invalidate cache
  const cachePrefix = CacheService.keyContent(
    credentials.userId,
    credentials.sshHost,
    credentials.sshPort,
    dsn,
    mem || undefined
  ).replace(/:[^:]+$/, '');
  zosCache.deletePrefix(cachePrefix);
}

export async function deleteDataset(
  datasetName: string,
  creds?: ZosCredentials
): Promise<void> {
  const credentials = creds || getDefaultCredentials();
  const dsn = sanitizeDatasetName(datasetName);
  
  const command = `tsocmd "DELETE '${dsn}'" 2>&1`;
  const result = await exec(credentials, command, 30000);
  
  if (result.exitCode !== 0) {
    throw new Error(result.stdout || 'Failed to delete dataset');
  }
}

export async function renameDataset(
  oldName: string,
  newName: string,
  creds?: ZosCredentials
): Promise<void> {
  const credentials = creds || getDefaultCredentials();
  const oldDsn = sanitizeDatasetName(oldName);
  const newDsn = sanitizeDatasetName(newName);
  
  const command = `tsocmd "RENAME '${oldDsn}' '${newDsn}'" 2>&1`;
  const result = await exec(credentials, command, 30000);
  
  if (result.exitCode !== 0) {
    throw new Error(result.stdout || 'Failed to rename dataset');
  }
}

export async function copyDataset(
  sourceName: string,
  targetName: string,
  creds?: ZosCredentials
): Promise<void> {
  const credentials = creds || getDefaultCredentials();
  const source = sanitizeDatasetName(sourceName);
  const target = sanitizeDatasetName(targetName);
  
  const command = `tsocmd "COPY '${source}' '${target}'" 2>&1`;
  const result = await exec(credentials, command, 60000);
  
  if (result.exitCode !== 0) {
    throw new Error(result.stdout || 'Failed to copy dataset');
  }
}

export async function createDataset(
  datasetName: string,
  options: {
    dsorg?: 'PO' | 'PS' | 'POE';
    recfm?: 'F' | 'FB' | 'V' | 'VB' | 'FBA' | 'VBA';
    lrecl?: number;
    blksize?: number;
    space?: string;
    volser?: string;
  } = {},
  creds?: ZosCredentials
): Promise<void> {
  const credentials = creds || getDefaultCredentials();
  const dsn = sanitizeDatasetName(datasetName);
  
  const dsorg = options.dsorg || 'PO';
  const recfm = (options.recfm || 'FB').replace(/([A-Z])([A-Z])/i, '$1,$2');
  const lrecl = options.lrecl || 80;
  const blksize = options.blksize || 27920;
  const volser = options.volser || zosConfig.defaults.volser;
  
  // Use IDCAMS DEFINE CLUSTER for proper cataloged dataset creation
  // This works for both PS and PO datasets
  const isPO = dsorg === 'PO' || dsorg === 'POE';
  const dirBlocks = isPO ? 'DIR(10)' : '';
  const dsorgParam = isPO ? 'PO' : 'PS';
  
  // IDCAMS JCL via TSO ALLOCATE - simpler and more reliable
  // First delete if exists (ignore error), then allocate
  const allocCmd = [
    `tsocmd "DELETE '${dsn}'" 2>&1 || true`,
    `tsocmd "ALLOC DS('${dsn}') NEW CATALOG TRACKS SPACE(10,5) DSORG(${dsorgParam}) RECFM(${recfm}) LRECL(${lrecl}) BLKSIZE(${blksize}) ${dirBlocks}" 2>&1`,
  ].join(' && ');
  
  const result = await exec(credentials, allocCmd, 30000);
  
  if (result.exitCode !== 0) {
    throw new Error(result.stdout || 'Failed to create dataset');
  }
}

export async function getDatasetInfo(
  datasetName: string,
  creds?: ZosCredentials
): Promise<any> {
  const credentials = creds || getDefaultCredentials();
  const dsn = sanitizeDatasetName(datasetName);
  
  const command = `tsocmd "LISTDS '${dsn}'"`;
  const result = await exec(credentials, command, 30000);
  
  if (result.exitCode !== 0) {
    throw new Error(result.stdout || 'Failed to get dataset info');
  }

  const lines = result.stdout.split('\n');
  const info: any = { name: dsn };
  
  for (const line of lines) {
    // Handle format: RECFM=F or RECFM-F
    let match = line.match(/RECFM[=\-]\s*(\S+)/i);
    if (match) info.recfm = match[1].split(/[\s,)]/)[0]; // Take first part if followed by space or paren
    
    // Handle format: LRECL=80 or LRECL-80
    match = line.match(/LRECL[=\-]\s*(\d+)/i);
    if (match) info.lrecl = parseInt(match[1]);
    
    // Handle format: BLKSIZE=6160 or BLKSIZE-6160
    match = line.match(/(?:BLOCK|BLKSIZE)[=\-]\s*(\d+)/i);
    if (match) info.blksize = parseInt(match[1]);
    
    // Handle format: DSORG=PO or DSORG-PO
    match = line.match(/DSORG[=\-]\s*(\S+)/i);
    if (match) info.dsorg = match[1].split(/[\s,)]/)[0];
    
    // Handle format: VOLSER=disk or VOL-disk or VOLUMES--disk
    match = line.match(/(?:VOLSER|VOLUME)[S]?[=\-]+\s*(\S+)/i);
    if (match) info.volser = match[1].split(/[\s,)]/)[0];
  }
  
  return info;
}
