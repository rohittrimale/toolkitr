import {
  DependencyResult,
  ResolvedDependency,
  SoapServiceResult,
} from './types';
import {
  extractCopybooks,
  extractCalledPrograms,
  parseJclForPrograms,
} from './parser';
import {
  downloadMainframeAsset,
  executeCommand,
  submitJcl,
  getJobOutput,
  SshCredentials,
  disconnect,
} from './ssh-client';
import {
  getComponents,
  getProgramDatasets,
  getCopybookDatasets,
  getJclDatasets,
  loadRegistry,
} from './registry';

loadRegistry();

export interface AgentContext {
  credentials: SshCredentials;
  sessionId: string;
  maxIterations: number;
  maxFiles: number;
}

export interface ToolExecutionResult {
  success: boolean;
  content: string;
  error?: string;
}

export async function executeCobolTool(
  toolName: string,
  args: Record<string, unknown>,
  context: AgentContext
): Promise<ToolExecutionResult> {
  const { credentials, maxFiles = 50 } = context;
  const depth = (args.depth as number) ?? 3;

  console.log(`[Agent] Executing tool: ${toolName}`, args);

  try {
    switch (toolName) {
      case 'download_cobol_with_dependencies': {
        const programs = args.programs as string[];
        if (!programs || programs.length === 0) {
          return { success: false, content: '', error: 'No programs specified' };
        }
        const result = await resolveCobolDependenciesInternal(
          programs,
          credentials,
          depth,
          maxFiles
        );
        return {
          success: result.files.length > 0,
          content: formatDependencyResult(result),
        };
      }

      case 'batch_download_cobol_with_dependencies': {
        const programs = args.programs as string[];
        if (!programs || programs.length === 0) {
          return { success: false, content: '', error: 'No programs specified' };
        }
        const results = await Promise.all(
          programs.map((prog) =>
            resolveCobolDependenciesInternal([prog], credentials, depth, maxFiles)
          )
        );
        const combined = combineResults(results);
        return {
          success: combined.files.length > 0,
          content: formatDependencyResult(combined),
        };
      }

      case 'download_jcl_with_dependencies': {
        const jobname = args.jobname as string;
        if (!jobname) {
          return { success: false, content: '', error: 'No jobname specified' };
        }
        const result = await resolveJclJobInternal(jobname, credentials, depth);
        return {
          success: !!result.jcl,
          content: formatJclResult(result),
        };
      }

      case 'resolve_svc_service': {
        const query = args.query as string;
        if (!query) {
          return { success: false, content: '', error: 'No query specified' };
        }
        const result = await resolveSoapServiceInternal(query, credentials, depth);
        return {
          success: result.matchedServices.length > 0,
          content: formatSoapResult(result),
        };
      }

      case 'execute_ssh_command': {
        const command = args.command as string;
        if (!command) {
          return { success: false, content: '', error: 'No command specified' };
        }
        const output = await executeCommand(command, credentials);
        return { success: true, content: output };
      }

      case 'submit_mainframe_job': {
        const jcl = args.jcl as string;
        if (!jcl) {
          return { success: false, content: '', error: 'No JCL specified' };
        }
        const result = await submitJcl(jcl, credentials);
        return {
          success: true,
          content: `Job submitted: ${result.jobId}\n${result.output || ''}`,
        };
      }

      case 'check_job_status': {
        const jobId = args.jobId as string;
        if (!jobId) {
          return { success: false, content: '', error: 'No jobId specified' };
        }
        const output = await getJobOutput(jobId, credentials);
        if (output === null) {
          return { success: false, content: '', error: 'Job not found' };
        }
        return { success: true, content: output };
      }

      case 'list_dataset_members': {
        const dataset = args.dataset as string;
        if (!dataset) {
          return { success: false, content: '', error: 'No dataset specified' };
        }
        const { listDatasetMembers } = await import('./ssh-client');
        const members = await listDatasetMembers(dataset, credentials);
        if (members === null) {
          return { success: false, content: '', error: 'Dataset not found' };
        }
        return {
          success: true,
          content: `Members in ${dataset}:\n${members.join('\n')}`,
        };
      }

      case 'search_in_codebase': {
        const query = args.query as string;
        if (!query) {
          return { success: false, content: '', error: 'No query specified' };
        }
        const fileType = (args.fileType as string) || 'all';
        const result = await searchInCodebase(query, fileType, context);
        return result;
      }

      case 'analyze_code_quality': {
        const programName = args.programName as string;
        if (!programName) {
          return { success: false, content: '', error: 'No program name specified' };
        }
        const checks = (args.checks as string[]) || ['all'];
        const result = await analyzeCodeQuality(programName, checks, context);
        return result;
      }

      case 'generate_jcl': {
        const operation = args.operation as string;
        if (!operation) {
          return { success: false, content: '', error: 'No operation specified' };
        }
        const jcl = await generateJcl(operation, args, context);
        return { success: true, content: jcl };
      }

      case 'get_mainframe_info': {
        const infoType = (args.infoType as string) || 'system';
        const info = await getMainframeInfo(infoType, context);
        return { success: true, content: info };
      }

      default:
        return { success: false, content: '', error: `Unknown tool: ${toolName}` };
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[Agent] Tool execution error:`, errorMsg);
    return { success: false, content: '', error: errorMsg };
  }
}

async function resolveCobolDependenciesInternal(
  programNames: string[],
  creds: SshCredentials,
  depth: number,
  maxFiles: number
): Promise<DependencyResult> {
  const result: DependencyResult = {
    files: [],
    errors: [],
  };

  const processed = new Set<string>();
  const queue: Array<{ name: string; type: 'program' | 'copybook'; depth: number }> = [];

  for (const prog of programNames) {
    if (result.files.length >= maxFiles) break;
    queue.push({ name: prog.toUpperCase(), type: 'program', depth });
  }

  while (queue.length > 0 && result.files.length < maxFiles) {
    const item = queue.shift();
    if (!item) continue;

    const { name, type, depth: currentDepth } = item;
    const key = `${type}:${name}`;

    if (processed.has(key)) continue;
    processed.add(key);

    const dataset = findDatasetForMember(name, type);

    if (!dataset) {
      result.errors.push({
        name,
        error: `Dataset not found for ${type} ${name}`,
      });
      continue;
    }

    const asset = await downloadMainframeAsset(dataset, name, creds);

    if (!asset) {
      result.errors.push({
        name,
        error: `Failed to download ${type} ${name} from ${dataset}`,
      });
      continue;
    }

    const resolvedFile: ResolvedDependency = {
      name,
      type: type,
      dataset,
      content: asset.content,
      length: asset.content.split('\n').length,
    };

    result.files.push(resolvedFile);

    if (type === 'program' && currentDepth > 0) {
      const copybooks = extractCopybooks(asset.content);

      for (const cb of copybooks) {
        if (result.files.length >= maxFiles) break;
        const cbKey = `copybook:${cb}`;
        if (!processed.has(cbKey)) {
          queue.push({ name: cb, type: 'copybook', depth: currentDepth - 1 });
        }
      }

      const calls = extractCalledPrograms(asset.content);

      for (const call of calls) {
        if (result.files.length >= maxFiles) break;
        const callKey = `program:${call}`;
        if (!processed.has(callKey)) {
          queue.push({ name: call, type: 'program', depth: currentDepth - 1 });
        }
      }
    }
  }

  result.summary = buildSummary(result.files);
  return result;
}

async function resolveJclJobInternal(
  jobname: string,
  creds: SshCredentials,
  depth: number
): Promise<DependencyResult & { jcl?: ResolvedDependency }> {
  const result: DependencyResult & { jcl?: ResolvedDependency } = {
    files: [],
    errors: [],
  };

  const upperJob = jobname.toUpperCase();
  const jclDatasetsList = getJclDatasets();

  let jclDataset: string | null = null;
  let jclContent: string | null = null;

  for (const ds of jclDatasetsList) {
    const asset = await downloadMainframeAsset(ds, upperJob, creds);
    if (asset) {
      jclDataset = ds;
      jclContent = asset.content;
      break;
    }
  }

  if (!jclContent) {
    result.errors.push({ name: jobname, error: 'JCL not found' });
    result.summary = buildSummary(result.files);
    return result;
  }

  result.jcl = {
    name: upperJob,
    type: 'jcl',
    dataset: jclDataset!,
    content: jclContent,
    length: jclContent.split('\n').length,
  };

  result.files.push(result.jcl);

  const programs = parseJclForPrograms(jclContent);

  for (const prog of programs) {
    if (result.files.length >= 50) break;

    try {
      const deps = await resolveCobolDependenciesInternal([prog], creds, depth, 50);
      result.files.push(...deps.files);
      result.errors.push(...deps.errors);
    } catch (err) {
      result.errors.push({
        name: prog,
        error: `Failed to resolve dependencies: ${err}`,
      });
    }
  }

  result.summary = buildSummary(result.files);
  return result;
}

async function resolveSoapServiceInternal(
  query: string,
  creds: SshCredentials,
  depth: number
): Promise<SoapServiceResult> {
  const result: SoapServiceResult = {
    matchedServices: [],
    files: [],
    errors: [],
  };

  const { searchServices } = await import('./registry');
  const matches = searchServices(query);

  if (matches.length === 0) {
    result.errors.push({ name: query, error: 'No matching services found' });
    result.summary = 'No services found';
    return result;
  }

  result.matchedServices = matches.map((m) => ({
    serviceKey: m.serviceKey,
    programName: m.programName,
    serviceName: m.serviceName,
    domain: m.domain,
  }));

  const uniquePrograms = [...new Set(matches.map((m) => m.programName))];

  for (const prog of uniquePrograms) {
    if (result.files.length >= 50) break;

    try {
      const deps = await resolveCobolDependenciesInternal([prog], creds, depth, 50);
      result.files.push(...deps.files);
      result.errors.push(...deps.errors);
    } catch (err) {
      result.errors.push({
        name: prog,
        error: `Failed to resolve dependencies: ${err}`,
      });
    }
  }

  const programCount = result.files.filter((f) => f.type === 'program').length;
  const copybookCount = result.files.filter((f) => f.type === 'copybook').length;
  result.summary = `${result.matchedServices.length} service(s), ${programCount} programs, ${copybookCount} copybooks`;

  return result;
}

function findDatasetForMember(
  member: string,
  type: 'program' | 'copybook' | 'jcl' | 'proc'
): string | null {
  const components = getComponents();

  const typeMap: Record<string, string> = {
    program: 'PGM',
    copybook: 'CPY',
    jcl: 'JCL',
    proc: 'PROC',
  };

  const compType = typeMap[type];

  const matches = components.filter(
    (c) =>
      c.name.toUpperCase() === member.toUpperCase() &&
      c.type.toUpperCase() === compType
  );

  if (matches.length > 0) {
    return matches[0].dept;
  }

  const fallbackDatasets =
    type === 'program'
      ? getProgramDatasets()
      : type === 'copybook'
        ? getCopybookDatasets()
        : [];

  if (fallbackDatasets.length > 0) {
    return fallbackDatasets[0];
  }

  return null;
}

function combineResults(results: DependencyResult[]): DependencyResult {
  const combined: DependencyResult = {
    files: [],
    errors: [],
  };

  const seen = new Set<string>();

  for (const result of results) {
    for (const file of result.files) {
      const key = `${file.type}:${file.name}`;
      if (!seen.has(key)) {
        seen.add(key);
        combined.files.push(file);
      }
    }
    combined.errors.push(...result.errors);
  }

  combined.summary = buildSummary(combined.files);
  return combined;
}

function buildSummary(files: ResolvedDependency[]): string {
  const programCount = files.filter((f) => f.type === 'program').length;
  const copybookCount = files.filter((f) => f.type === 'copybook').length;
  const jclCount = files.filter((f) => f.type === 'jcl').length;
  const procCount = files.filter((f) => f.type === 'proc').length;

  const parts: string[] = [];
  if (programCount > 0) parts.push(`${programCount} program(s)`);
  if (copybookCount > 0) parts.push(`${copybookCount} copybook(s)`);
  if (jclCount > 0) parts.push(`${jclCount} JCL(s)`);
  if (procCount > 0) parts.push(`${procCount} PROC(s)`);

  return parts.length > 0 ? `${parts.join(', ')}, Total: ${files.length}` : `Total: ${files.length}`;
}

export function formatDependencyResult(result: DependencyResult): string {
  const lines: string[] = [];

  lines.push('DEPENDENCY RESULTS');
  lines.push('='.repeat(50));

  if (result.summary) {
    lines.push(result.summary);
    lines.push('');
  }

  const programs = result.files.filter((f) => f.type === 'program');
  const copybooks = result.files.filter((f) => f.type === 'copybook');
  const other = result.files.filter(
    (f) => f.type !== 'program' && f.type !== 'copybook'
  );

  if (programs.length > 0) {
    lines.push('PROGRAMS:');
    for (const p of programs) {
      const dataset = p.dataset || 'unknown';
      const lineCount = p.length || 0;
      lines.push(`  - ${p.name} (${dataset}) lines: ${lineCount}`);
    }
    lines.push('');
  }

  if (copybooks.length > 0) {
    lines.push('COPYBOOKS:');
    for (const c of copybooks) {
      const dataset = c.dataset || 'unknown';
      const lineCount = c.length || 0;
      lines.push(`  - ${c.name} (${dataset}) lines: ${lineCount}`);
    }
    lines.push('');
  }

  if (other.length > 0) {
    lines.push('OTHER:');
    for (const o of other) {
      lines.push(`  - ${o.name} (${o.type})`);
    }
    lines.push('');
  }

  if (result.errors.length > 0) {
    lines.push('ERRORS:');
    for (const e of result.errors) {
      lines.push(`  - ${e.name}: ${e.error}`);
    }
  }

  return lines.join('\n');
}

export function formatJclResult(
  result: DependencyResult & { jcl?: ResolvedDependency }
): string {
  const lines: string[] = [];

  lines.push('JCL JOB ANALYSIS');
  lines.push('='.repeat(50));

  if (result.jcl) {
    lines.push(`Job: ${result.jcl.name}`);
    lines.push(`Dataset: ${result.jcl.dataset}`);
    lines.push(`Lines: ${result.jcl.length}`);
    lines.push('');
  }

  lines.push(formatDependencyResult(result));

  return lines.join('\n');
}

export function formatSoapResult(result: SoapServiceResult): string {
  const lines: string[] = [];

  lines.push('SOAP/REST SERVICE RESOLUTION');
  lines.push('='.repeat(50));

  lines.push(`Query: ${result.matchedServices.length} service(s) found`);

  if (result.matchedServices.length > 0) {
    lines.push('');
    lines.push('MATCHED SERVICES:');
    for (const svc of result.matchedServices) {
      lines.push(`  - ${svc.serviceKey}`);
      lines.push(`    Service: ${svc.serviceName}`);
      lines.push(`    Program: ${svc.programName}`);
      if (svc.domain) lines.push(`    Domain: ${svc.domain}`);
    }
    lines.push('');
  }

  lines.push(
    formatDependencyResult({
      files: result.files,
      errors: result.errors,
      summary: result.summary,
    })
  );
  
  return lines.join('\n');
}

async function searchInCodebase(
  query: string,
  fileType: string,
  context: AgentContext
): Promise<ToolExecutionResult> {
  const { credentials } = context;
  
  const deps = await resolveCobolDependenciesInternal(
    ['SEARCH_PLACEHOLDER'],
    credentials,
    1,
    100
  ).catch(() => ({ files: [], errors: [] }));

  const results: string[] = [];
  const queryLower = query.toLowerCase();

  for (const file of deps.files) {
    if (fileType !== 'all' && file.type !== fileType) continue;
    if (file.content && file.content.toLowerCase().includes(queryLower)) {
      const lines = file.content.split('\n');
      const matchingLines = lines
        .map((line, idx) => ({ line: idx + 1, text: line }))
        .filter(l => l.text.toLowerCase().includes(queryLower))
        .slice(0, 10);
      
      if (matchingLines.length > 0) {
        results.push(`\n=== ${file.name} (${file.type}) ====`);
        for (const m of matchingLines) {
          results.push(`  ${m.line}: ${m.text.substring(0, 80)}`);
        }
      }
    }
  }

  if (results.length === 0) {
    return { success: true, content: `No matches found for "${query}"` };
  }

  return {
    success: true,
    content: `Search results for "${query}":\n${results.join('\n')}`
  };
}

async function analyzeCodeQuality(
  programName: string,
  checks: string[],
  context: AgentContext
): Promise<ToolExecutionResult> {
  const { credentials } = context;
  
  const result = await resolveCobolDependenciesInternal(
    [programName],
    credentials,
    1,
    10
  );

  const program = result.files.find(f => f.name === programName.toUpperCase());
  if (!program || !program.content) {
    return { success: false, content: '', error: `Program ${programName} not found` };
  }

  const issues: string[] = [];
  const lines = program.content.split('\n');

  if (checks.includes('all') || checks.includes('performance')) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toUpperCase();
      if (line.includes('STRING') && line.includes('MOVE')) {
        issues.push(`Line ${i + 1}: Potential string performance issue with MOVE`);
      }
    }
  }

  if (checks.includes('all') || checks.includes('best-practices')) {
    if (!program.content.includes('INITIALIZE') && !program.content.includes('VALUE')) {
      issues.push('Variables may not be initialized - add INITIALIZE or VALUE clauses');
    }
    if (program.content.includes('GO TO') && program.content.match(/GO TO\s+\w+/g)?.length! > 3) {
      issues.push('Excessive GO TO statements - consider structured programming');
    }
    if (!program.content.includes('EVALUATE') && program.content.match(/IF\s+/g)?.length! > 5) {
      issues.push('Consider using EVALUATE for complex conditional logic');
    }
  }

  if (checks.includes('all') || checks.includes('security')) {
    if (program.content.includes('ACCEPT') && !program.content.includes('VALIDATE')) {
      issues.push('Line: ACCEPT without validation - potential security risk');
    }
  }

  const output = [
    `CODE ANALYSIS: ${programName}`,
    '='.repeat(50),
    `Lines: ${program.length}`,
    `Copybooks: ${result.files.filter(f => f.type === 'copybook').length}`,
    '',
    `Issues Found: ${issues.length}`,
    ''
  ];

  if (issues.length > 0) {
    issues.forEach(issue => output.push(`  - ${issue}`));
  } else {
    output.push('  No issues detected');
  }

  return { success: true, content: output.join('\n') };
}

async function generateJcl(
  operation: string,
  args: Record<string, unknown>,
  _context: AgentContext
): Promise<string> {
  const programName = args.programName as string;
  const inputDataset = args.inputDataset as string;
  const outputDataset = args.outputDataset as string;

  const jclTemplates: Record<string, string> = {
    compile: `//${(programName || 'COMPILE').toUpperCase()} JOB (ACCT),'COBOL COMPILATION',CLASS=A,
//             MSGCLASS=H,NOTIFY=&SYSUID
//*
//* Compile COBOL program
//*
//COMPILE  EXEC PGM=IGYCRCTL,REGION=0M,
//  PARM='Cobol,Spdance(Any)'
//SYSIN    DD DSN=${inputDataset || 'USER.COBOL.SOURCE(PROG)'},DISP=SHR
//SYSLIB   DD DSN=SYS1.COBLIB,DISP=SHR
//         DD DSN=USER.COPYBOOKS,DISP=SHR
//SYSPRINT DD SYSOUT=*
//SYSTERM  DD SYSOUT=*
//SYSUT1   DD UNIT=SYSDA,SPACE=(CYL,(10,5))
//SYSLIN   DD DSN=&&LOADSET,DISP=(MOD,PASS),UNIT=SYSDA,
//         DCB=(RECFM=FB,LRECL=80,BLKSIZE=27920)
//LKED    EXEC PGM=HEWL,REGION=0M,
//  PARM='LIST,XREF,LET'
//SYSLMOD  DD DSN=USER.LOAD(${(programName || 'PROG').toUpperCase()}),DISP=SHR
//SYSLIN   DD DSN=&&LOADSET,DISP=(OLD,DELETE)
//SYSUT1   DD UNIT=SYSDA,SPACE=(CYL,(5,5))
//SYSPRINT DD SYSOUT=*
`,

    run: `//${(programName || 'RUN').toUpperCase()}    JOB (ACCT),'RUN PROGRAM',CLASS=A,
//             MSGCLASS=H,NOTIFY=&SYSUID
//*
//* Run COBOL program
//*
//RUN     EXEC PGM=${programName || 'PROGRAM'}
//STEPLIB DD DSN=USER.LOAD,DISP=SHR
//SYSIN   DD DSN=USER.DATA.INPUT,DISP=SHR
//SYSPRINT DD SYSOUT=*
//SYSUDUMP DD DUMMY
`,

    copy: `//COPY${Date.now().toString().slice(-6)}  JOB (ACCT),'COPY DATASET',CLASS=A,
//             MSGCLASS=H,NOTIFY=&SYSUID
//*
//* Copy dataset using IEBCOPY
//*
//COPY    EXEC PGM=IEBCOPY,REGION=0M
//SYSPRINT DD SYSOUT=*
//INDD    DD DSN=${inputDataset || 'SOURCE.DATASET'},DISP=SHR
//OUTDD   DD DSN=${outputDataset || 'TARGET.DATASET'},DISP=(NEW,CATLG,DELETE),
//         DCB=(RECFM=FB,LRECL=80,BLKSIZE=27920),
//         SPACE=(CYL,(10,5),RLSE)
`,

    sort: `//SORT${Date.now().toString().slice(-6)}  JOB (ACCT),'SORT DATA',CLASS=A,
//             MSGCLASS=H,NOTIFY=&SYSUID
//*
//* Sort data using DFSORT
//*
//SORT    EXEC PGM=DFSORT,REGION=0M
//SORTIN  DD DSN=${inputDataset || 'INPUT.DATASET'},DISP=SHR
//SORTOUT DD DSN=${outputDataset || 'OUTPUT.DATASET'},DISP=(NEW,CATLG,DELETE),
//         DCB=(RECFM=FB,LRECL=80,BLKSIZE=27920),
//         SPACE=(CYL,(10,5),RLSE)
//SYSOUT  DD SYSOUT=*
//SYSIN   DD *
  SORT FIELDS=(1,10,CH,A)
  /*
`,

    backup: `//BACKUP  JOB (ACCT),'BACKUP DATASET',CLASS=A,
//             MSGCLASS=H,NOTIFY=&SYSUID
//*
//* Backup dataset using IEBCOPY
//*
//BACKUP  EXEC PGM=IEBCOPY,REGION=0M
//SYSPRINT DD SYSOUT=*
//INDD    DD DSN=${inputDataset || 'DATASET.TO.BACKUP'},DISP=SHR
//OUTDD   DD DSN=BACKUP.${Date.now().toString().slice(-6)}.D$(+1),DISP=(NEW,CATLG,DELETE),
//         DCB=(RECFM=FB,LRECL=80,BLKSIZE=27920),
//         SPACE=(CYL,(10,5),RLSE)
`
  };

  return jclTemplates[operation] || `//ERROR    JOB (ACCT),'ERROR',CLASS=A\n//* Unknown operation: ${operation}`;
}

async function getMainframeInfo(
  infoType: string,
  context: AgentContext
): Promise<string> {
  const { credentials } = context;

  const commands: Record<string, string> = {
    system: 'D IPLINFO',
    version: 'D OS,LEVEL',
    products: 'D PROD,LIST',
    symbols: 'D SYMBOLS'
  };

  const command = commands[infoType] || commands.system;

  try {
    const output = await executeCommand(command, credentials);
    return `Mainframe ${infoType.toUpperCase()}:\n${output}`;
  } catch (err) {
    return `Could not retrieve ${infoType} info: ${err}`;
  }
}
