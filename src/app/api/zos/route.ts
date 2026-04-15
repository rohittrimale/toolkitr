import { NextRequest, NextResponse } from 'next/server';
import { getCredentialsFromRequest } from '@/lib/zos/credentials';
import { executeZosTool, ToolExecutionResult } from '@/lib/zos/tool-executor';
import { ZOS_TOOL_NAMES } from '@/lib/zos/tools';
import { exec } from '@/lib/zos/ssh-pool';
import { zosCache, CacheService } from '@/lib/zos/cache';
import {
  readContent,
  getDatasetInfo,
  listMembers,
  createDataset,
  writeContent,
  renameDataset,
} from '@/lib/zos/services/dataset-service';
import {
  listUssFiles,
  readUssFile,
  writeUssFile,
  deleteUssFile,
  createUssDirectory,
  moveUssFile,
} from '@/lib/zos/services/uss-service';
import {
  getJobSpool,
  cancelJob,
} from '@/lib/zos/services/jes-service';
import {
  listDb2Subsystems,
  executeSqlQuery,
  listDb2Tables,
  listDb2Schemas,
  getDb2TableInfo,
  getDb2TableData,
  executeDb2Ddl,
  executeDb2Dml,
} from '@/lib/zos/services/db2-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tool, args, credentials } = body;

    if (!tool) {
      return NextResponse.json(
        { success: false, error: 'Missing tool name' },
        { status: 400 }
      );
    }

    const creds = getCredentialsFromRequest(credentials);

    // Handle extended operations not in tool-executor
    switch (tool) {
      // ─── Dataset Operations ───
      case 'read_dataset': {
        const dsn = args.datasetName as string;
        const member = args.member as string | undefined;
        const content = await readContent(dsn, member, creds);
        return NextResponse.json({ success: true, content });
      }
      case 'dataset_info': {
        const dsn = args.datasetName as string;
        const info = await getDatasetInfo(dsn, creds);
        return NextResponse.json({ success: true, info });
      }
      case 'list_members': {
        const dsn = args.datasetName as string;
        const members = await listMembers(dsn, creds);
        return NextResponse.json({ success: true, members });
      }
      case 'create_ps': {
        const dsn = args.datasetName as string;
        await createDataset(dsn, { dsorg: 'PS', recfm: args.recfm || 'FB', lrecl: args.lrecl || 80, blksize: args.blksize || 27920, space: args.space || '(10,5)', volser: args.volser }, creds);
        return NextResponse.json({ success: true, message: `Created PS: ${dsn}` });
      }
      case 'create_pds': {
        const dsn = args.datasetName as string;
        await createDataset(dsn, { dsorg: 'PO', recfm: args.recfm || 'FB', lrecl: args.lrecl || 80, blksize: args.blksize || 27920, space: args.space || '(10,5,10)', volser: args.volser }, creds);
        return NextResponse.json({ success: true, message: `Created PDS: ${dsn}` });
      }
      case 'create_member': {
        const dsn = args.datasetName as string;
        const member = args.member as string;
        const content = (args.content as string) || '';
        // Create member by writing content via USS temp file, then cp to PDS
        const memberSpec = `${dsn}(${member})`;
        const tempFile = `/tmp/create_member_${Date.now()}.txt`;
        
        // Step 1: Write content to USS temp file
        const escapedContent = content.replace(/\\/g, '\\\\').replace(/'/g, "'\\''");
        await exec(creds, `echo '${escapedContent}' > '${tempFile}' 2>&1`, 30000);
        
        // Step 2: Copy USS file to PDS member using cp with proper quoting
        const cpCmd = `cp '${tempFile}' "//'${memberSpec}'" 2>&1`;
        const result = await exec(creds, cpCmd, 30000);
        
        // Step 3: Cleanup temp file
        await exec(creds, `rm -f '${tempFile}' 2>/dev/null`, 5000).catch(() => {});
        
        if (result.exitCode !== 0) {
          throw new Error(result.stderr || result.stdout || 'Failed to create member');
        }
        
        // Invalidate cache for this PDS
        const membersCacheKey = CacheService.keyMembers(creds.userId, creds.sshHost, creds.sshPort, dsn);
        zosCache.delete(membersCacheKey);
        const contentCacheKey = CacheService.keyContent(creds.userId, creds.sshHost, creds.sshPort, dsn, member);
        zosCache.delete(contentCacheKey);
        
        return NextResponse.json({ success: true, message: `Created member: ${memberSpec}` });
      }
      case 'rename_member': {
        const dsn = args.datasetName as string;
        const oldMember = args.oldMember as string;
        const newMember = args.newMember as string;
        // TSO RENAME for members: RENAME 'dsn(old)' 'dsn(new)'
        const result = await exec(creds, `tsocmd "RENAME '${dsn}(${oldMember})' '${dsn}(${newMember})'" 2>&1`, 30000);
        if (result.exitCode !== 0) throw new Error(result.stdout || 'Failed to rename member');
        
        // Invalidate cache for this PDS
        const membersCacheKey = CacheService.keyMembers(creds.userId, creds.sshHost, creds.sshPort, dsn);
        zosCache.delete(membersCacheKey);
        const oldContentKey = CacheService.keyContent(creds.userId, creds.sshHost, creds.sshPort, dsn, oldMember);
        zosCache.delete(oldContentKey);
        const newContentKey = CacheService.keyContent(creds.userId, creds.sshHost, creds.sshPort, dsn, newMember);
        zosCache.delete(newContentKey);
        
        return NextResponse.json({ success: true, message: `Renamed ${oldMember} to ${newMember}` });
      }
      case 'write_dataset': {
        const dsn = args.datasetName as string;
        const member = args.member as string | undefined;
        const content = args.content as string;
        const target = member ? `${dsn}(${member})` : dsn;
        const tempFile = `/tmp/write_${Date.now()}.txt`;
        
        // Write content to USS temp file, then cp to MVS dataset
        const escapedContent = content.replace(/\\/g, '\\\\').replace(/'/g, "'\\''");
        await exec(creds, `echo '${escapedContent}' > '${tempFile}' 2>&1`, 30000);
        const result = await exec(creds, `cp '${tempFile}' "//'${target}'" 2>&1`, 30000);
        await exec(creds, `rm -f '${tempFile}' 2>/dev/null`, 5000).catch(() => {});
        
        if (result.exitCode !== 0) {
          throw new Error(result.stderr || result.stdout || 'Failed to write dataset');
        }
        
        // Invalidate cache for this dataset
        const cacheKey = CacheService.keyContent(creds.userId, creds.sshHost, creds.sshPort, dsn, member || undefined);
        zosCache.delete(cacheKey);
        
        return NextResponse.json({ success: true, message: `Written to ${target}` });
      }
      case 'rename_dataset': {
        const oldName = args.oldName as string;
        const newName = args.newName as string;
        await renameDataset(oldName, newName, creds);
        return NextResponse.json({ success: true, message: `Renamed ${oldName} to ${newName}` });
      }

      // ─── USS Operations ───
      case 'uss_create_file': {
        const path = args.path as string;
        const mode = (args.mode as string) || '644';
        await exec(creds, `touch "${path}" && chmod ${mode} "${path}"`, 30000);
        return NextResponse.json({ success: true, message: `Created file: ${path}` });
      }
      case 'uss_create_dir': {
        const path = args.path as string;
        await createUssDirectory(path, creds);
        return NextResponse.json({ success: true, message: `Created directory: ${path}` });
      }
      case 'uss_rename': {
        const oldPath = args.oldPath as string;
        const newPath = args.newPath as string;
        const result = await exec(creds, `mv "${oldPath}" "${newPath}" 2>&1`, 30000);
        if (result.exitCode !== 0) throw new Error(result.stderr || result.stdout);
        return NextResponse.json({ success: true, message: `Renamed ${oldPath} to ${newPath}` });
      }
      case 'uss_move': {
        const source = args.source as string;
        const target = args.target as string;
        await moveUssFile(source, target, creds);
        return NextResponse.json({ success: true, message: `Moved ${source} to ${target}` });
      }
      case 'uss_chmod': {
        const path = args.path as string;
        const mode = args.mode as string;
        const result = await exec(creds, `chmod ${mode} "${path}" 2>&1`, 30000);
        if (result.exitCode !== 0) throw new Error(result.stderr || result.stdout);
        return NextResponse.json({ success: true, message: `Changed permissions of ${path} to ${mode}` });
      }
      case 'uss_chown': {
        const path = args.path as string;
        const owner = args.owner as string;
        const result = await exec(creds, `chown ${owner} "${path}" 2>&1`, 30000);
        if (result.exitCode !== 0) throw new Error(result.stderr || result.stdout);
        return NextResponse.json({ success: true, message: `Changed owner of ${path} to ${owner}` });
      }
      case 'uss_search': {
        const path = args.path as string;
        const pattern = args.pattern as string;
        const searchText = args.searchText as string | undefined;
        const caseSensitive = args.caseSensitive !== false;
        const regex = args.regex === true;

        let cmd = '';
        if (searchText) {
          // Search file contents
          const grepFlags = caseSensitive ? '-rn' : '-rni';
          const regexFlag = regex ? '-E' : '-F';
          cmd = `find "${path}" -name "${pattern || '*'}" -type f -exec grep ${grepFlags} ${regexFlag} "${searchText.replace(/"/g, '\\"')}" {} + 2>/dev/null || echo "NO_MATCHES"`;
        } else {
          // Search file names
          const nameFlag = caseSensitive ? '-name' : '-iname';
          cmd = `find "${path}" ${nameFlag} "${pattern || '*'}" 2>/dev/null | head -100`;
        }
        const result = await exec(creds, cmd, 60000);
        const output = result.stdout.trim() === 'NO_MATCHES' ? '' : result.stdout.trim();
        return NextResponse.json({
          success: true,
          matches: output ? output.split('\n').filter(l => l.trim()) : [],
          count: output ? output.split('\n').filter(l => l.trim()).length : 0,
        });
      }
      case 'uss_write': {
        const path = args.path as string;
        const content = args.content as string;
        await writeUssFile(path, content, creds);
        return NextResponse.json({ success: true, message: `Written to ${path}` });
      }
      case 'uss_read': {
        const path = args.path as string;
        const content = await readUssFile(path, creds);
        return NextResponse.json({ success: true, content });
      }
      case 'uss_delete': {
        const path = args.path as string;
        await deleteUssFile(path, creds);
        return NextResponse.json({ success: true, message: `Deleted ${path}` });
      }

      // ─── Copy Operations (MVS <-> USS) ───
      case 'copy_mvs_to_uss': {
        const dsn = args.datasetName as string;
        const member = args.member as string | undefined;
        const ussPath = args.ussPath as string;
        const source = member ? `${dsn}(${member})` : dsn;
        // Use OGET to copy MVS to USS
        const result = await exec(creds, `tsocmd "OGET '${source}' '${ussPath}'" 2>&1`, 60000);
        if (result.exitCode !== 0 && !result.stdout.includes('ICH')) {
          // Fallback: use cat with MVS syntax
          const catResult = await exec(creds, `cat "//'${source}'" > "${ussPath}" 2>&1`, 60000);
          if (catResult.exitCode !== 0) throw new Error(catResult.stderr || catResult.stdout);
        }
        return NextResponse.json({ success: true, message: `Copied ${source} to ${ussPath}` });
      }
      case 'copy_uss_to_mvs': {
        const ussPath = args.ussPath as string;
        const dsn = args.datasetName as string;
        const member = args.member as string | undefined;
        const target = member ? `${dsn}(${member})` : dsn;
        // Use USS cp command instead of TSO OPUT (which doesn't support USS paths)
        const result = await exec(creds, `cp '${ussPath}' "//'${target}'" 2>&1`, 60000);
        if (result.exitCode !== 0) {
          throw new Error(result.stderr || result.stdout || 'Failed to copy USS to MVS');
        }
        
        // Invalidate cache for this dataset
        const cacheKey = CacheService.keyContent(creds.userId, creds.sshHost, creds.sshPort, dsn, member || undefined);
        zosCache.delete(cacheKey);
        
        return NextResponse.json({ success: true, message: `Copied ${ussPath} to ${target}` });
      }

      // ─── JES Operations ───
      case 'get_spool': {
        const jobId = args.jobId as string;
        const spoolId = args.spoolId as string | undefined;
        if (spoolId) {
          // Get specific spool file content
          const result = await exec(creds, `tsocmd "PRINT O(jobid(${jobId}),ddid(${spoolId}))" 2>&1`, 30000);
          return NextResponse.json({ success: true, content: result.stdout });
        }
        // Get all spool files
        const spool = await getJobSpool(jobId, creds);
        return NextResponse.json({ success: true, spool });
      }
      case 'download_job_output': {
        const jobId = args.jobId as string;
        const localPath = args.localPath as string | undefined;
        const spool = await getJobSpool(jobId, creds);
        const content = spool.join('\n');
        if (localPath) {
          // Write to USS temp file for download
          const tempPath = `/tmp/job_output_${jobId}_${Date.now()}.txt`;
          await writeUssFile(tempPath, content, creds);
          return NextResponse.json({ success: true, content, tempPath });
        }
        return NextResponse.json({ success: true, content });
      }
      case 'delete_job': {
        const jobId = args.jobId as string;
        await cancelJob(jobId, creds);
        return NextResponse.json({ success: true, message: `Job ${jobId} cancelled/purged` });
      }

      // ─── TSO Command ───
      case 'tso_command': {
        const command = args.command as string;
        const result = await exec(creds, `tsocmd "${command}" 2>&1`, 30000);
        return NextResponse.json({
          success: result.exitCode === 0,
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode,
        });
      }

      // ─── UNIX Shell ───
      case 'unix_command': {
        const command = args.command as string;
        const cwd = args.cwd as string | undefined;
        const timeout = (args.timeout as number) || 30000;
        const fullCmd = cwd ? `cd "${cwd}" && ${command}` : command;
        const result = await exec(creds, fullCmd, timeout);
        return NextResponse.json({
          success: result.exitCode === 0,
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode,
        });
      }

      // ─── System Operations ───
      case 'get_address_spaces': {
        // Use LISTA ST to show allocated DD names and active address spaces
        const result = await exec(creds, 'tsocmd "LISTA ST" 2>&1', 30000);
        return NextResponse.json({ success: true, output: result.stdout });
      }
      case 'get_job_address_space': {
        const jobId = args.jobId as string;
        const result = await exec(creds, `tsocmd "STATUS ${jobId}" 2>&1`, 30000);
        return NextResponse.json({ success: true, output: result.stdout });
      }
      case 'change_password': {
        const oldPassword = args.oldPassword as string;
        const newPassword = args.newPassword as string;
        // This requires interactive TSO, use tsocmd with password change
        const result = await exec(creds, `tsocmd "PASSWORD" << EOF\n${oldPassword}\n${newPassword}\n${newPassword}\nEOF`, 30000);
        return NextResponse.json({ success: result.exitCode === 0, output: result.stdout });
      }

      // ─── DB2 Operations ───
      case 'db2_query': {
        const sql = args.sql as string;
        const subsystem = (args.subsystem as string) || 'DB2P';
        if (!sql) {
          return NextResponse.json({ success: false, error: 'Missing sql parameter' }, { status: 400 });
        }
        const db2Result = await executeSqlQuery(sql, subsystem, creds);
        return NextResponse.json({
          success: db2Result.sqlCode === 0 || db2Result.sqlCode === 100,
          columns: db2Result.columns,
          rows: db2Result.rows,
          rowCount: db2Result.rowCount,
          sqlCode: db2Result.sqlCode,
        });
      }
      case 'db2_list_schemas': {
        const subsystem = (args.subsystem as string) || 'DB2P';
        const schemas = await listDb2Schemas(subsystem, creds);
        return NextResponse.json({ success: true, schemas });
      }
      case 'db2_list_tables': {
        const schema = args.schema as string;
        const subsystem = (args.subsystem as string) || 'DB2P';
        if (!schema) {
          return NextResponse.json({ success: false, error: 'Missing schema parameter' }, { status: 400 });
        }
        const tables = await listDb2Tables(schema, subsystem, creds);
        return NextResponse.json({ success: true, tables });
      }
      case 'db2_table_info': {
        const schema = args.schema as string;
        const table = args.table as string;
        const subsystem = (args.subsystem as string) || 'DB2P';
        if (!schema || !table) {
          return NextResponse.json({ success: false, error: 'Missing schema or table parameter' }, { status: 400 });
        }
        const info = await getDb2TableInfo(schema, table, subsystem, creds);
        return NextResponse.json({ success: true, info });
      }
      case 'db2_table_data': {
        const schema = args.schema as string;
        const table = args.table as string;
        const where = args.where as string | undefined;
        const limit = (args.limit as number) || 100;
        const subsystem = (args.subsystem as string) || 'DB2P';
        if (!schema || !table) {
          return NextResponse.json({ success: false, error: 'Missing schema or table parameter' }, { status: 400 });
        }
        const data = await getDb2TableData(schema, table, where, limit, subsystem, creds);
        return NextResponse.json({ success: true, ...data });
      }
      case 'db2_subsystems': {
        const subsystems = await listDb2Subsystems(creds);
        return NextResponse.json({ success: true, subsystems });
      }
      case 'db2_ddl': {
        const ddl = args.ddl as string;
        const subsystem = (args.subsystem as string) || 'DB2P';
        if (!ddl) {
          return NextResponse.json({ success: false, error: 'Missing ddl parameter' }, { status: 400 });
        }
        const ddlResult = await executeDb2Ddl(ddl, subsystem, creds);
        return NextResponse.json({ success: ddlResult.success, message: ddlResult.message, sqlCode: ddlResult.sqlCode });
      }
      case 'db2_dml': {
        const dml = args.dml as string;
        const subsystem = (args.subsystem as string) || 'DB2P';
        if (!dml) {
          return NextResponse.json({ success: false, error: 'Missing dml parameter' }, { status: 400 });
        }
        const dmlResult = await executeDb2Dml(dml, subsystem, creds);
        return NextResponse.json({ success: dmlResult.success, rowsAffected: dmlResult.rowsAffected, sqlCode: dmlResult.sqlCode });
      }

      default:
        // Fall through to tool-executor for standard tools
        break;
    }

    // Execute via tool-executor for standard zvm_* tools
    const result: ToolExecutionResult = await executeZosTool(tool, args || {}, creds);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[zos/api] Error:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  const creds = getCredentialsFromRequest();

  try {
    let result: ToolExecutionResult;

    switch (action) {
      case 'test':
        result = await executeZosTool(ZOS_TOOL_NAMES.TEST_CONNECTION, {}, creds);
        break;

      case 'system':
        result = await executeZosTool(ZOS_TOOL_NAMES.GET_SYSTEM_INFO, {}, creds);
        break;

      case 'datasets':
        const pattern = searchParams.get('pattern') || 'YOUR.DATASET.*';
        result = await executeZosTool(
          ZOS_TOOL_NAMES.LIST_DATASETS,
          { pattern, maxResults: 100 },
          creds
        );
        break;

      case 'jobs':
        const owner = searchParams.get('owner') || undefined;
        result = await executeZosTool(
          ZOS_TOOL_NAMES.LIST_JOBS,
          { owner, maxResults: 50 },
          creds
        );
        break;

      case 'volumes':
        result = await executeZosTool(ZOS_TOOL_NAMES.GET_VOLUME_INFO, {}, creds);
        break;

      case 'console':
        const lines = parseInt(searchParams.get('lines') || '50');
        result = await executeZosTool(
          ZOS_TOOL_NAMES.GET_CONSOLE_LOG,
          { lines },
          creds
        );
        break;

      case 'tools':
        return NextResponse.json({
          success: true,
          tools: [
            // Standard tools
            ...Object.values(ZOS_TOOL_NAMES),
            // Extended operations
            'read_dataset', 'dataset_info', 'list_members',
            'create_ps', 'create_pds', 'create_member', 'rename_member',
            'write_dataset', 'rename_dataset',
            'uss_create_file', 'uss_create_dir', 'uss_rename', 'uss_move',
            'uss_chmod', 'uss_chown', 'uss_search', 'uss_write', 'uss_read', 'uss_delete',
            'copy_mvs_to_uss', 'copy_uss_to_mvs',
            'get_spool', 'download_job_output', 'delete_job',
            'tso_command', 'unix_command',
            'get_address_spaces', 'get_job_address_space', 'change_password',
            'db2_query', 'db2_list_schemas', 'db2_list_tables', 'db2_table_info',
            'db2_table_data', 'db2_subsystems', 'db2_ddl', 'db2_dml',
          ],
        });

      case 'read': {
        // Read dataset via query param: ?action=read&dsn=YOUR.LIBRARY&member=MYPROG
        const dsn = searchParams.get('dsn');
        const member = searchParams.get('member') || undefined;
        if (!dsn) {
          return NextResponse.json({ success: false, error: 'Missing dsn parameter' }, { status: 400 });
        }
        const content = await readContent(dsn, member, creds);
        return NextResponse.json({ success: true, content });
      }

      case 'info': {
        // Dataset info via query param
        const dsn = searchParams.get('dsn');
        if (!dsn) {
          return NextResponse.json({ success: false, error: 'Missing dsn parameter' }, { status: 400 });
        }
        const info = await getDatasetInfo(dsn, creds);
        return NextResponse.json({ success: true, info });
      }

      case 'members': {
        // List members via query param
        const dsn = searchParams.get('dsn');
        if (!dsn) {
          return NextResponse.json({ success: false, error: 'Missing dsn parameter' }, { status: 400 });
        }
        const members = await listMembers(dsn, creds);
        return NextResponse.json({ success: true, members });
      }

      case 'uss_list': {
        // List USS files
        const path = searchParams.get('path') || '/';
        const files = await listUssFiles(path, creds);
        return NextResponse.json({ success: true, files });
      }

      case 'uss_read': {
        // Read USS file
        const path = searchParams.get('path');
        if (!path) {
          return NextResponse.json({ success: false, error: 'Missing path parameter' }, { status: 400 });
        }
        const content = await readUssFile(path, creds);
        return NextResponse.json({ success: true, content });
      }

      case 'spool': {
        // Get job spool
        const jobId = searchParams.get('jobId');
        if (!jobId) {
          return NextResponse.json({ success: false, error: 'Missing jobId parameter' }, { status: 400 });
        }
        const spool = await getJobSpool(jobId, creds);
        return NextResponse.json({ success: true, spool });
      }

      case 'address_spaces':
        const addrResult = await exec(creds, 'tsocmd "LISTA ST" 2>&1', 30000);
        return NextResponse.json({ success: true, output: addrResult.stdout });

      case 'db2_schemas': {
        const subsystem = searchParams.get('subsystem') || 'DB2P';
        const schemas = await listDb2Schemas(subsystem, creds);
        return NextResponse.json({ success: true, schemas });
      }

      case 'db2_tables': {
        const schema = searchParams.get('schema');
        const subsystem = searchParams.get('subsystem') || 'DB2P';
        if (!schema) {
          return NextResponse.json({ success: false, error: 'Missing schema parameter' }, { status: 400 });
        }
        const tables = await listDb2Tables(schema, subsystem, creds);
        return NextResponse.json({ success: true, tables });
      }

      case 'db2_subsystems': {
        const subsystems = await listDb2Subsystems(creds);
        return NextResponse.json({ success: true, subsystems });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}. Use ?action=tools to list available actions.` },
          { status: 400 }
        );
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error('[zos/api] Error:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
