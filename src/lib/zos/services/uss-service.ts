import { exec } from '../ssh-pool';
import { getDefaultCredentials, type ZosCredentials } from '../credentials';

export interface UssFile {
  name: string;
  type: 'file' | 'directory' | 'symlink';
  size?: number;
  mode: string;
  owner: string;
  group: string;
  modified: string;
}

export async function listUssFiles(
  path: string,
  creds?: ZosCredentials
): Promise<UssFile[]> {
  const credentials = creds || getDefaultCredentials();
  const targetPath = path || '/';
  
  const command = `ls -la "${targetPath}" 2>&1`;
  const result = await exec(credentials, command, 30000);
  
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || `Failed to list ${path}`);
  }
  
  const lines = result.stdout.split('\n').filter(l => l.trim());
  const files: UssFile[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/^([dl-])([rwxs-]{9})\s+(\d+)\s+(\S+)\s+(\S+)\s+(\d+)\s+(\w+\s+\d+\s+[\d:]+)\s+(.+)$/);
    
    if (match) {
      const [, type, mode, , owner, group, , , name] = match;
      files.push({
        name: name.trim(),
        type: type === 'd' ? 'directory' : type === 'l' ? 'symlink' : 'file',
        size: parseInt(match[3]),
        mode: mode,
        owner: owner,
        group: group,
        modified: match[7],
      });
    }
  }
  
  return files;
}

export async function readUssFile(
  filePath: string,
  creds?: ZosCredentials
): Promise<string> {
  const credentials = creds || getDefaultCredentials();
  
  const command = `cat "${filePath}" 2>&1`;
  const result = await exec(credentials, command, 60000);
  
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || `Failed to read ${filePath}`);
  }
  
  return result.stdout;
}

export async function writeUssFile(
  filePath: string,
  content: string,
  creds?: ZosCredentials
): Promise<void> {
  const credentials = creds || getDefaultCredentials();
  
  const delim = `EOF_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  const command = `cat > "${filePath}" << '${delim}'\n${content}\n${delim}`;
  
  const result = await exec(credentials, command, 60000);
  
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || `Failed to write ${filePath}`);
  }
}

export async function deleteUssFile(
  filePath: string,
  creds?: ZosCredentials
): Promise<void> {
  const credentials = creds || getDefaultCredentials();
  
  const command = `rm -f "${filePath}" 2>&1`;
  const result = await exec(credentials, command, 30000);
  
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || `Failed to delete ${filePath}`);
  }
}

export async function createUssDirectory(
  dirPath: string,
  creds?: ZosCredentials
): Promise<void> {
  const credentials = creds || getDefaultCredentials();
  
  const command = `mkdir -p "${dirPath}" 2>&1`;
  const result = await exec(credentials, command, 30000);
  
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || `Failed to create directory ${dirPath}`);
  }
}

export async function copyUssFile(
  source: string,
  target: string,
  creds?: ZosCredentials
): Promise<void> {
  const credentials = creds || getDefaultCredentials();
  
  const command = `cp "${source}" "${target}" 2>&1`;
  const result = await exec(credentials, command, 60000);
  
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || `Failed to copy ${source} to ${target}`);
  }
}

export async function moveUssFile(
  source: string,
  target: string,
  creds?: ZosCredentials
): Promise<void> {
  const credentials = creds || getDefaultCredentials();
  
  const command = `mv "${source}" "${target}" 2>&1`;
  const result = await exec(credentials, command, 30000);
  
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || `Failed to move ${source} to ${target}`);
  }
}

export async function getUssFileInfo(
  filePath: string,
  creds?: ZosCredentials
): Promise<UssFile> {
  const credentials = creds || getDefaultCredentials();
  
  const command = `ls -la "${filePath}" 2>&1`;
  const result = await exec(credentials, command, 30000);
  
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || `Failed to get info for ${filePath}`);
  }
  
  const line = result.stdout.split('\n')[0];
  const match = line.match(/^([dl-])([rwxs-]{9})\s+(\d+)\s+(\S+)\s+(\S+)\s+(\d+)\s+(\w+\s+\d+\s+[\d:]+)\s+(.+)$/);
  
  if (!match) {
    throw new Error(`Could not parse file info for ${filePath}`);
  }
  
  const [, type, mode, , owner, group, , , name] = match;
  
  return {
    name: name.trim(),
    type: type === 'd' ? 'directory' : type === 'l' ? 'symlink' : 'file',
    size: parseInt(match[3]),
    mode: mode,
    owner: owner,
    group: group,
    modified: match[7],
  };
}
