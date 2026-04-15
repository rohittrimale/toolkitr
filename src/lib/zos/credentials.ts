export interface ZosCredentials {
  userId: string;
  password: string;
  sshHost: string;
  sshPort: number;
}

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export function getCredentialsFromRequest(creds?: {
  host?: string;
  port?: number;
  username?: string;
  password?: string;
}): ZosCredentials {
  return {
    userId: creds?.username || process.env.ZOS_SSH_USER || '',
    password: creds?.password || process.env.ZOS_SSH_PASSWORD || '',
    sshHost: creds?.host || process.env.ZOS_SSH_HOST || '',
    sshPort: creds?.port || parseInt(process.env.ZOS_SSH_PORT || '22'),
  };
}

export function getDefaultCredentials(): ZosCredentials {
  return {
    userId: process.env.ZOS_SSH_USER || '',
    password: process.env.ZOS_SSH_PASSWORD || '',
    sshHost: process.env.ZOS_SSH_HOST || '',
    sshPort: parseInt(process.env.ZOS_SSH_PORT || '22'),
  };
}
