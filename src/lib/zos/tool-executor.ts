import {
  // Dataset services
  listDatasets,
  listMembers,
  readContent,
  writeContent,
  deleteDataset,
  renameDataset,
  copyDataset,
  createDataset,
  getDatasetInfo,
  // JES services
  listJobs,
  getJob,
  submitJob,
  submitJobFromDataset,
  getJobSpool,
  cancelJob,
  holdJob,
  releaseJob,
  // USS services
  listUssFiles,
  readUssFile,
  writeUssFile,
  deleteUssFile,
  // CICS services
  listCicsRegions,
  listCicsPrograms,
  listCicsTransactions,
  executeCicsCommand,
  // DB2 services
  listDb2Subsystems,
  executeSqlQuery,
  listDb2Tables,
  // Admin services
  getSystemInfo,
  getConsoleLog,
  executeOperatorCommand,
  getVolumeInfo,
  // VSAM services
  listVsamDatasets,
  getVsamInfo,
  // RACF services
  listRacfUsers,
  listRacfGroups,
  listRacfDatasets,
  // Storage services
  listStorageGroups,
  analyzeStorage,
  // Network services
  getTcpIpStatus,
  listTcpConnections,
  pingHost,
} from './services';
import { exec, testConnection } from './ssh-pool';
import { getDefaultCredentials, type ZosCredentials } from './credentials';
import { ZOS_TOOL_NAMES } from './tools';

export interface ToolExecutionResult {
  success: boolean;
  content: string;
  error?: string;
}

export async function executeZosTool(
  toolName: string,
  args: Record<string, unknown>,
  credentials?: ZosCredentials
): Promise<ToolExecutionResult> {
  const creds = credentials || getDefaultCredentials();

  // Validate credentials have required fields
  if (!creds.sshHost || !creds.userId) {
    return {
      success: false,
      content: 'Missing mainframe credentials. To use z/OS tools, configure these in .env.local:\n- NEXT_PUBLIC_SSH_HOST (mainframe hostname/IP)\n- NEXT_PUBLIC_SSH_USERNAME (your TSO user ID)\n- NEXT_PUBLIC_SSH_PASSWORD (your password)',
      error: 'INVALID_CREDENTIALS'
    };
  }

  console.log(`[zOS Tool] Executing: ${toolName}`, { ...args, password: '*****' });

  try {
    switch (toolName) {
      // =======================
      // DATASET OPERATIONS
      // =======================
      case ZOS_TOOL_NAMES.LIST_DATASETS: {
        const pattern = args.pattern as string;
        const maxResults = (args.maxResults as number) || 1000;
        const datasets = await listDatasets(pattern, creds, maxResults);
        return {
          success: true,
          content: formatDatasetList(datasets),
        };
      }

      case ZOS_TOOL_NAMES.LIST_DATASET_MEMBERS: {
        const datasetName = args.datasetName as string;
        const members = await listMembers(datasetName, creds);
        return {
          success: true,
          content: `Members in ${datasetName}:\n${members.join('\n')}`,
        };
      }

      case ZOS_TOOL_NAMES.READ_DATASET_CONTENT: {
        const datasetName = args.datasetName as string;
        const member = args.member as string | undefined;
        try {
          const content = await readContent(datasetName, member, creds);
          if (!content) {
            return {
              success: false,
              content: '',
              error: `Failed to read ${member ? `member ${member} from ` : ''}dataset ${datasetName}: Empty response`,
            };
          }
          return {
            success: true,
            content: formatContent(content),
          };
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          return {
            success: false,
            content: '',
            error: `Failed to read ${member ? `member ${member} from ` : ''}dataset ${datasetName}: ${errorMsg}`,
          };
        }
      }

      case ZOS_TOOL_NAMES.WRITE_DATASET_CONTENT: {
        const datasetName = args.datasetName as string;
        const member = args.member as string | undefined;
        const content = args.content as string;
        await writeContent(datasetName, content, member, creds);
        return {
          success: true,
          content: `Successfully wrote to ${datasetName}${member ? `(${member})` : ''}`,
        };
      }

      case ZOS_TOOL_NAMES.DELETE_DATASET: {
        const datasetName = args.datasetName as string;
        await deleteDataset(datasetName, creds);
        return {
          success: true,
          content: `Successfully deleted ${datasetName}`,
        };
      }

      case ZOS_TOOL_NAMES.RENAME_DATASET: {
        const oldName = args.oldName as string;
        const newName = args.newName as string;
        await renameDataset(oldName, newName, creds);
        return {
          success: true,
          content: `Successfully renamed ${oldName} to ${newName}`,
        };
      }

      case ZOS_TOOL_NAMES.COPY_DATASET: {
        const sourceName = args.sourceName as string;
        const targetName = args.targetName as string;
        await copyDataset(sourceName, targetName, creds);
        return {
          success: true,
          content: `Successfully copied ${sourceName} to ${targetName}`,
        };
      }

      case ZOS_TOOL_NAMES.CREATE_DATASET: {
        const datasetName = args.datasetName as string;
        const options = {
          dsorg: args.dsorg as 'PO' | 'PS' | 'POE',
          recfm: args.recfm as 'F' | 'FB' | 'V' | 'VB',
          lrecl: args.lrecl as number,
          blksize: args.blksize as number,
          space: args.space as string,
          volser: args.volser as string,
        };
        await createDataset(datasetName, options, creds);
        return {
          success: true,
          content: `Successfully created dataset ${datasetName}`,
        };
      }

      case ZOS_TOOL_NAMES.GET_DATASET_INFO: {
        const datasetName = args.datasetName as string;
        const info = await getDatasetInfo(datasetName, creds);
        return {
          success: true,
          content: formatDatasetInfo(info),
        };
      }

      // =======================
      // JOB OPERATIONS
      // =======================
      case ZOS_TOOL_NAMES.LIST_JOBS: {
        const owner = args.owner as string | undefined;
        const maxResults = (args.maxResults as number) || 100;
        const jobs = await listJobs(owner, creds, maxResults);
        return {
          success: true,
          content: formatJobList(jobs),
        };
      }

      case ZOS_TOOL_NAMES.GET_JOB_STATUS: {
        const jobId = args.jobId as string;
        const job = await getJob(jobId, creds);
        return {
          success: true,
          content: formatJobInfo(job),
        };
      }

      case ZOS_TOOL_NAMES.SUBMIT_JOB: {
        const jcl = args.jcl as string;
        const result = await submitJob(jcl, creds);
        return {
          success: true,
          content: `Job submitted: ${result.jobId} (${result.jobName})`,
        };
      }

      case ZOS_TOOL_NAMES.SUBMIT_JOB_DATASET: {
        const datasetName = args.datasetName as string;
        const member = args.member as string | undefined;
        const result = await submitJobFromDataset(datasetName, member, creds);
        return {
          success: true,
          content: `Job submitted: ${result.jobId} (${result.jobName})`,
        };
      }

      case ZOS_TOOL_NAMES.GET_JOB_SPOOL: {
        const jobId = args.jobId as string;
        const spool = await getJobSpool(jobId, creds);
        return {
          success: true,
          content: formatContent(spool.join('\n')),
        };
      }

      case ZOS_TOOL_NAMES.CANCEL_JOB: {
        const jobId = args.jobId as string;
        await cancelJob(jobId, creds);
        return {
          success: true,
          content: `Job ${jobId} cancelled`,
        };
      }

      case ZOS_TOOL_NAMES.HOLD_JOB: {
        const jobId = args.jobId as string;
        await holdJob(jobId, creds);
        return {
          success: true,
          content: `Job ${jobId} held`,
        };
      }

      case ZOS_TOOL_NAMES.RELEASE_JOB: {
        const jobId = args.jobId as string;
        await releaseJob(jobId, creds);
        return {
          success: true,
          content: `Job ${jobId} released`,
        };
      }

      // =======================
      // USS OPERATIONS
      // =======================
      case ZOS_TOOL_NAMES.LIST_USS_FILES: {
        const path = args.path as string;
        const files = await listUssFiles(path, creds);
        return {
          success: true,
          content: formatUssList(files),
        };
      }

      case ZOS_TOOL_NAMES.READ_USS_FILE: {
        const filePath = args.filePath as string;
        const content = await readUssFile(filePath, creds);
        return {
          success: true,
          content: formatContent(content),
        };
      }

      case ZOS_TOOL_NAMES.WRITE_USS_FILE: {
        const filePath = args.filePath as string;
        const content = args.content as string;
        await writeUssFile(filePath, content, creds);
        return {
          success: true,
          content: `Successfully wrote to ${filePath}`,
        };
      }

      case ZOS_TOOL_NAMES.DELETE_USS_FILE: {
        const filePath = args.filePath as string;
        await deleteUssFile(filePath, creds);
        return {
          success: true,
          content: `Successfully deleted ${filePath}`,
        };
      }

      // =======================
      // CICS OPERATIONS
      // =======================
      case ZOS_TOOL_NAMES.LIST_CICS_REGIONS: {
        const regions = await listCicsRegions(creds);
        return {
          success: true,
          content: formatCicsRegions(regions),
        };
      }

      case ZOS_TOOL_NAMES.LIST_CICS_PROGRAMS: {
        const region = args.region as string;
        const programs = await listCicsPrograms(region, creds);
        return {
          success: true,
          content: formatCicsPrograms(programs),
        };
      }

      case ZOS_TOOL_NAMES.LIST_CICS_TRANSACTIONS: {
        const region = args.region as string;
        const transactions = await listCicsTransactions(region, creds);
        return {
          success: true,
          content: formatCicsTransactions(transactions),
        };
      }

      case ZOS_TOOL_NAMES.EXECUTE_CICS_COMMAND: {
        const region = args.region as string;
        const command = args.command as string;
        const result = await executeCicsCommand(region, command, creds);
        return {
          success: true,
          content: result,
        };
      }

      // =======================
      // DB2 OPERATIONS
      // =======================
      case ZOS_TOOL_NAMES.LIST_DB2_SUBSYSTEMS: {
        const subsystems = await listDb2Subsystems(creds);
        return {
          success: true,
          content: formatDb2Subsystems(subsystems),
        };
      }

      case ZOS_TOOL_NAMES.EXECUTE_SQL: {
        const sql = args.sql as string;
        const subsystem = (args.subsystem as string) || 'DB2P';
        const results = await executeSqlQuery(sql, subsystem, creds);
        return {
          success: true,
          content: JSON.stringify(results),
        };
      }

      case ZOS_TOOL_NAMES.LIST_DB2_TABLES: {
        const schema = args.schema as string;
        const subsystem = (args.subsystem as string) || 'DB2P';
        const tables = await listDb2Tables(schema, subsystem, creds);
        return {
          success: true,
          content: formatDb2Tables(tables),
        };
      }

      // =======================
      // SYSTEM OPERATIONS
      // =======================
      case ZOS_TOOL_NAMES.GET_SYSTEM_INFO: {
        const info = await getSystemInfo(creds);
        return {
          success: true,
          content: formatSystemInfo(info),
        };
      }

      case ZOS_TOOL_NAMES.GET_CONSOLE_LOG: {
        const lines = (args.lines as number) || 50;
        const logs = await getConsoleLog(lines, creds);
        return {
          success: true,
          content: formatConsoleLog(logs),
        };
      }

      case ZOS_TOOL_NAMES.EXECUTE_OPERATOR_COMMAND: {
        const command = args.command as string;
        const result = await executeOperatorCommand(command, creds);
        return {
          success: true,
          content: result,
        };
      }

      case ZOS_TOOL_NAMES.GET_VOLUME_INFO: {
        const volumes = await getVolumeInfo(creds);
        return {
          success: true,
          content: formatVolumeInfo(volumes),
        };
      }

      // =======================
      // SSH OPERATIONS
      // =======================
      case ZOS_TOOL_NAMES.TEST_CONNECTION: {
        const result = await testConnection(creds);
        return {
          success: result.success,
          content: result.success
            ? `Connection successful! Latency: ${result.latency}ms, User: ${result.output}`
            : `Connection failed: ${result.output}`,
        };
      }

      case ZOS_TOOL_NAMES.EXECUTE_COMMAND: {
        const command = args.command as string;
        const timeout = (args.timeout as number) || 30000;
        const result = await exec(creds, command, timeout);
        return {
          success: result.exitCode === 0,
          content: result.exitCode === 0 ? result.stdout : `Error: ${result.stderr || result.stdout}`,
        };
      }

      // =======================
      // VSAM OPERATIONS
      // =======================
      case ZOS_TOOL_NAMES.LIST_VSAM_DATASETS: {
        const pattern = (args.pattern as string) || 'YOUR.DATASET.**';
        const datasets = await listVsamDatasets(pattern, creds);
        return {
          success: true,
          content: formatVsamList(datasets),
        };
      }

      case ZOS_TOOL_NAMES.GET_VSAM_INFO: {
        const datasetName = args.datasetName as string;
        const info = await getVsamInfo(datasetName, creds);
        return {
          success: true,
          content: formatVsamInfo(info),
        };
      }

      // =======================
      // RACF OPERATIONS
      // =======================
      case ZOS_TOOL_NAMES.LIST_RACF_USERS: {
        const pattern = (args.pattern as string) || 'YOUR.DATASET*';
        const users = await listRacfUsers(pattern, creds);
        return {
          success: true,
          content: formatRacfUsers(users),
        };
      }

      case ZOS_TOOL_NAMES.LIST_RACF_GROUPS: {
        const pattern = (args.pattern as string) || 'YOUR.DATASET*';
        const groups = await listRacfGroups(pattern, creds);
        return {
          success: true,
          content: formatRacfGroups(groups),
        };
      }

      case ZOS_TOOL_NAMES.LIST_RACF_DATASETS: {
        const pattern = (args.pattern as string) || 'YOUR.DATASET.**';
        const datasets = await listRacfDatasets(pattern, creds);
        return {
          success: true,
          content: formatRacfDatasets(datasets),
        };
      }

      // =======================
      // STORAGE OPERATIONS
      // =======================
      case ZOS_TOOL_NAMES.LIST_STORAGE_GROUPS: {
        const groups = await listStorageGroups(creds);
        return {
          success: true,
          content: formatStorageGroups(groups),
        };
      }

      case ZOS_TOOL_NAMES.ANALYZE_STORAGE: {
        const pattern = (args.pattern as string) || 'YOUR.DATASET.**';
        const analysis = await analyzeStorage(pattern, creds);
        return {
          success: true,
          content: formatStorageAnalysis(analysis),
        };
      }

      // =======================
      // NETWORK OPERATIONS
      // =======================
      case ZOS_TOOL_NAMES.GET_TCPIP_STATUS: {
        const info = await getTcpIpStatus(creds);
        return {
          success: true,
          content: formatTcpIpInfo(info),
        };
      }

      case ZOS_TOOL_NAMES.LIST_TCP_CONNECTIONS: {
        const connections = await listTcpConnections(creds);
        return {
          success: true,
          content: formatTcpConnections(connections),
        };
      }

      case ZOS_TOOL_NAMES.PING_HOST: {
        const host = args.host as string;
        const count = (args.count as number) || 4;
        const result = await pingHost(host, count, creds);
        return {
          success: result.success,
          content: formatPingResult(result),
        };
      }

      default:
        return {
          success: false,
          content: '',
          error: `Unknown tool: ${toolName}`,
        };
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[zOS Tool] Error in ${toolName}:`, errorMsg);
    return {
      success: false,
      content: '',
      error: errorMsg,
    };
  }
}

// =======================
// FORMATTING HELPERS
// =======================

function formatDatasetList(datasets: any[]): string {
  if (datasets.length === 0) return 'No datasets found';
  const lines = ['Datasets:', '---'];
  for (const ds of datasets.slice(0, 50)) {
    lines.push(`${ds.name} (${ds.dsorg})`);
  }
  if (datasets.length > 50) lines.push(`... and ${datasets.length - 50} more`);
  return lines.join('\n');
}

function formatContent(content: string): string {
  return content.substring(0, 50000) + (content.length > 50000 ? '\n... (truncated)' : '');
}

function formatDatasetInfo(info: any): string {
  return `Dataset: ${info.name}
RECFM: ${info.recfm || 'N/A'}
LRECL: ${info.lrecl || 'N/A'}
BLKSIZE: ${info.blksize || 'N/A'}
DSORG: ${info.dsorg || 'N/A'}
VOLUME: ${info.volser || 'N/A'}`;
}

function formatJobList(jobs: any[]): string {
  if (jobs.length === 0) return 'No jobs found';
  const lines = ['Jobs:', '---'];
  for (const job of jobs.slice(0, 30)) {
    lines.push(`${job.jobId} ${job.jobName} ${job.status} ${job.owner} RC:${job.rc || 'N/A'}`);
  }
  return lines.join('\n');
}

function formatJobInfo(job: any): string {
  return `Job: ${job.jobId}
Name: ${job.jobName}
Status: ${job.status}
Owner: ${job.owner}
RC: ${job.rc || 'N/A'}`;
}

function formatUssList(files: any[]): string {
  if (files.length === 0) return 'No files found';
  const lines = ['Files:', '---'];
  for (const f of files) {
    const perms = f.type === 'd' ? 'drwxr-xr-x' : '-rw-r--r--';
    lines.push(`${perms} ${f.owner} ${f.size || 0} ${f.modified} ${f.name}`);
  }
  return lines.join('\n');
}

function formatCicsRegions(regions: any[]): string {
  if (regions.length === 0) return 'No CICS regions found';
  const lines = ['CICS Regions:', '---'];
  for (const r of regions) {
    lines.push(`${r.name} - ${r.status} (${r.jobName})`);
  }
  return lines.join('\n');
}

function formatCicsPrograms(programs: any[]): string {
  if (programs.length === 0) return 'No programs found';
  const lines = ['Programs:', '---'];
  for (const p of programs.slice(0, 50)) {
    lines.push(`${p.name} - ${p.status}`);
  }
  return lines.join('\n');
}

function formatCicsTransactions(transactions: any[]): string {
  if (transactions.length === 0) return 'No transactions found';
  const lines = ['Transactions:', '---'];
  for (const t of transactions.slice(0, 50)) {
    lines.push(`${t.name} - ${t.program} (${t.status})`);
  }
  return lines.join('\n');
}

function formatDb2Subsystems(subsystems: any[]): string {
  if (subsystems.length === 0) return 'No DB2 subsystems found';
  const lines = ['DB2 Subsystems:', '---'];
  for (const s of subsystems) {
    lines.push(`${s.name} - ${s.status}`);
  }
  return lines.join('\n');
}

function formatSqlResults(results: any[]): string {
  if (results.length === 0) return 'No results';
  const lines = ['SQL Results:', '---'];
  for (const row of results.slice(0, 100)) {
    lines.push(Array.isArray(row) ? row.join(' | ') : JSON.stringify(row));
  }
  if (results.length > 100) lines.push(`... and ${results.length - 100} more rows`);
  return lines.join('\n');
}

function formatDb2Tables(tables: any[]): string {
  if (tables.length === 0) return 'No tables found';
  const lines = ['Tables:', '---'];
  for (const t of tables.slice(0, 50)) {
    lines.push(`${t.schema}.${t.name} (${t.type})`);
  }
  return lines.join('\n');
}

function formatSystemInfo(info: any): string {
  return `System Information:
---
System Name: ${info.systemName}
Sysplex: ${info.sysplexName || 'N/A'}
z/OS Version: ${info.mvsVersion}
IP Address: ${info.ipAddress}
CPUs: ${info.cpuCount}
Memory: ${info.memoryTotal}MB`;
}

function formatConsoleLog(logs: any[]): string {
  if (logs.length === 0) return 'No console messages';
  const lines = ['Console Log:', '---'];
  for (const log of logs.slice(0, 50)) {
    lines.push(`${log.time} ${log.message}`);
  }
  return lines.join('\n');
}

function formatVolumeInfo(volumes: any[]): string {
  if (volumes.length === 0) return 'No volumes found';
  const lines = ['Volumes:', '---'];
  for (const v of volumes) {
    lines.push(`${v.volser} ${v.device} ${v.status}`);
  }
  return lines.join('\n');
}

function formatVsamList(datasets: any[]): string {
  if (datasets.length === 0) return 'No VSAM datasets found';
  const lines = ['VSAM Datasets:', '---'];
  for (const ds of datasets.slice(0, 30)) {
    lines.push(`${ds.name} (${ds.type})`);
  }
  return lines.join('\n');
}

function formatVsamInfo(info: any): string {
  if (!info) return 'VSAM dataset not found';
  return `VSAM Dataset: ${info.name}
Type: ${info.type || 'N/A'}
RECFM: ${info.recfm || 'N/A'}
LRECL: ${info.lrecl || 'N/A'}
BLKSIZE: ${info.blksize || 'N/A'}
CISIZE: ${info.cisize || 'N/A'}
MAXLRECL: ${info.maxlrecl || 'N/A'}`;
}

function formatRacfUsers(users: any[]): string {
  if (users.length === 0) return 'No RACF users found';
  const lines = ['RACF Users:', '---'];
  for (const u of users.slice(0, 30)) {
    lines.push(`${u.name} (${u.defaultGroup || 'N/A'})`);
  }
  return lines.join('\n');
}

function formatRacfGroups(groups: any[]): string {
  if (groups.length === 0) return 'No RACF groups found';
  const lines = ['RACF Groups:', '---'];
  for (const g of groups.slice(0, 30)) {
    lines.push(`${g.name} (${g.superiorGroup || 'N/A'})`);
  }
  return lines.join('\n');
}

function formatRacfDatasets(datasets: any[]): string {
  if (datasets.length === 0) return 'No RACF datasets found';
  const lines = ['RACF Protected Datasets:', '---'];
  for (const ds of datasets.slice(0, 30)) {
    lines.push(`${ds.name} (${ds.auth})`);
  }
  return lines.join('\n');
}

function formatStorageGroups(groups: any[]): string {
  if (groups.length === 0) return 'No storage groups found';
  const lines = ['Storage Groups:', '---'];
  for (const g of groups) {
    lines.push(`${g.name} ${g.volser} Cyls: ${g.usedCylinders}/${g.totalCylinders}`);
  }
  return lines.join('\n');
}

function formatStorageAnalysis(analysis: any): string {
  return `Storage Analysis:
---
Total Datasets: ${analysis.totalDatasets}
Total Tracks: ${analysis.totalTracks}
Total Cylinders: ${analysis.totalCylinders}
By Volume: ${JSON.stringify(analysis.byVolume)}`;
}

function formatTcpIpInfo(info: any): string {
  return `TCP/IP Status:
---
Status: ${info.status}
Started: ${info.started}
Interfaces: ${info.interfaces}`;
}

function formatTcpConnections(connections: any[]): string {
  if (connections.length === 0) return 'No TCP connections found';
  const lines = ['TCP Connections:', '---'];
  for (const c of connections.slice(0, 30)) {
    lines.push(`${c.localAddress}:${c.localPort} -> ${c.foreignAddress}:${c.foreignPort} (${c.state})`);
  }
  return lines.join('\n');
}

function formatPingResult(result: any): string {
  if (!result.success) return 'Ping failed';
  return `Ping Results:
---
Packets: ${result.packetsReceived}/${result.packetsTransmitted} received (${result.percentLoss}% loss)
RTT: min=${result.minRtt}ms avg=${result.avgRtt}ms max=${result.maxRtt}ms`;
}
