import { exec } from '../ssh-pool';
import { zosCache, CacheService } from '../cache';
import { zosConfig } from '../config';
import { getDefaultCredentials, type ZosCredentials } from '../credentials';

export interface JobInfo {
  jobId: string;
  jobName: string;
  status: string;
  owner: string;
  rc?: string;
  submitted?: string;
  completed?: string;
}

export async function listJobs(
  owner?: string,
  creds?: ZosCredentials,
  maxResults: number = 100
): Promise<JobInfo[]> {
  const credentials = creds || getDefaultCredentials();
  const ownerFilter = owner || credentials.userId;
  
  // Check cache
  const cacheKey = CacheService.keyJobs(
    credentials.userId,
    credentials.sshHost,
    credentials.sshPort,
    ownerFilter
  );
  const cached = zosCache.get<JobInfo[]>(cacheKey);
  if (cached) return cached;

  // Execute SDSF command
  const command = `tsocmd "STATUS ${ownerFilter}" 2>&1`;
  const result = await exec(credentials, command, 30000);
  
  if (result.exitCode !== 0) {
    // Try alternative command
    const altCmd = `tsocmd "DS ${ownerFilter}" 2>&1`;
    const altResult = await exec(credentials, altCmd, 30000);
    if (altResult.exitCode !== 0) {
      throw new Error(altResult.stdout || 'Failed to list jobs');
    }
    return parseJobList(altResult.stdout, maxResults);
  }
  
  const jobs = parseJobList(result.stdout, maxResults);
  
  // Cache results
  zosCache.set(cacheKey, jobs, zosConfig.cache.ttlJobs);
  
  return jobs;
}

function parseJobList(output: string, maxResults: number): JobInfo[] {
  const lines = output.split('\n');
  const jobs: JobInfo[] = [];
  
  for (const line of lines) {
    // Parse SDSF output format
    const match = line.match(/^(\S+)\s+(\S+)\s+(\S+)\s+(\S+)/);
    if (match) {
      jobs.push({
        jobId: match[1],
        jobName: match[2],
        status: match[3],
        owner: match[4],
      });
    }
    if (jobs.length >= maxResults) break;
  }
  
  return jobs;
}

export async function getJob(
  jobId: string,
  creds?: ZosCredentials
): Promise<JobInfo> {
  const credentials = creds || getDefaultCredentials();
  
  // Check cache
  const cacheKey = CacheService.keyJob(
    credentials.userId,
    credentials.sshHost,
    credentials.sshPort,
    jobId
  );
  const cached = zosCache.get<JobInfo>(cacheKey);
  if (cached) return cached;

  // Execute SDSF STATUS command
  const command = `tsocmd "STATUS ${jobId}" 2>&1`;
  const result = await exec(credentials, command, 30000);
  
  if (result.exitCode !== 0) {
    throw new Error(result.stdout || `Failed to get job ${jobId}`);
  }
  
  const jobs = parseJobList(result.stdout, 1);
  if (jobs.length === 0) {
    throw new Error(`Job ${jobId} not found`);
  }
  
  const job = jobs[0];
  
  // Cache result
  zosCache.set(cacheKey, job, zosConfig.cache.ttlJobs);
  
  return job;
}

export async function submitJob(
  jcl: string,
  creds?: ZosCredentials
): Promise<{ jobId: string; jobName: string }> {
  const credentials = creds || getDefaultCredentials();
  
  // Write JCL to a USS temp file
  const tempFile = `/tmp/tempjcl_${Date.now()}.jcl`;
  const delim = `EOF_${Date.now()}`;
  
  // Write JCL to USS temp file
  const writeCmd = `cat > "${tempFile}" << '${delim}'\n${jcl}\n${delim}`;
  await exec(credentials, writeCmd, 30000);
  
  // Submit job from USS file
  const submitCmd = `submit "${tempFile}" 2>&1`;
  const result = await exec(credentials, submitCmd, 30000);
  
  // Clean up temp file
  await exec(credentials, `rm -f "${tempFile}"`, 5000).catch(() => {});
  
  if (result.exitCode !== 0 && !result.stdout.includes('IEE')) {
    throw new Error(result.stdout || 'Failed to submit job');
  }
  
  // Parse job ID from output
  const jobMatch = result.stdout.match(/IEE\d+/i) || result.stdout.match(/JOB\d+/i);
  const jobId = jobMatch ? jobMatch[0] : 'UNKNOWN';
  
  return {
    jobId,
    jobName: 'SUBMITTED',
  };
}

export async function submitJobFromDataset(
  datasetName: string,
  member?: string,
  creds?: ZosCredentials
): Promise<{ jobId: string; jobName: string }> {
  const credentials = creds || getDefaultCredentials();
  const dsn = datasetName.toUpperCase();
  const target = member ? `${dsn}(${member})` : dsn;
  
  const command = `tsocmd "SUBMIT '${target}'" 2>&1`;
  const result = await exec(credentials, command, 30000);
  
  if (result.exitCode !== 0) {
    throw new Error(result.stdout || 'Failed to submit job');
  }
  
  const jobMatch = result.stdout.match(/IEE\d+/i) || result.stdout.match(/JOB\d+/i);
  const jobId = jobMatch ? jobMatch[0] : 'UNKNOWN';
  
  return {
    jobId,
    jobName: member || datasetName,
  };
}

export async function getJobSpool(
  jobId: string,
  creds?: ZosCredentials
): Promise<string[]> {
  const credentials = creds || getDefaultCredentials();
  
  // Get spool files
  const command = `tsocmd "OUTPUT ${jobId}" 2>&1`;
  const result = await exec(credentials, command, 30000);
  
  if (result.exitCode !== 0) {
    throw new Error(result.stdout || 'Failed to get spool');
  }
  
  return result.stdout.split('\n');
}

export async function cancelJob(
  jobId: string,
  creds?: ZosCredentials
): Promise<void> {
  const credentials = creds || getDefaultCredentials();
  
  const command = `tsocmd "CANCEL ${jobId}" 2>&1`;
  const result = await exec(credentials, command, 30000);
  
  if (result.exitCode !== 0 && !result.stdout.includes('IEE301I')) {
    throw new Error(result.stdout || 'Failed to cancel job');
  }
}

export async function holdJob(
  jobId: string,
  creds?: ZosCredentials
): Promise<void> {
  const credentials = creds || getDefaultCredentials();
  
  const command = `tsocmd "HOLD ${jobId}" 2>&1`;
  const result = await exec(credentials, command, 30000);
  
  if (result.exitCode !== 0) {
    throw new Error(result.stdout || 'Failed to hold job');
  }
}

export async function releaseJob(
  jobId: string,
  creds?: ZosCredentials
): Promise<void> {
  const credentials = creds || getDefaultCredentials();
  
  const command = `tsocmd "RELEASE ${jobId}" 2>&1`;
  const result = await exec(credentials, command, 30000);
  
  if (result.exitCode !== 0) {
    throw new Error(result.stdout || 'Failed to release job');
  }
}
