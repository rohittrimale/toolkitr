import { DependencyResult, ResolvedDependency, DependencyError } from './types';
import { extractCopybooks, extractCalledPrograms } from './parser';
import { downloadMainframeAsset, SshCredentials } from './ssh-client';
import { getComponents, getProgramDatasets, getCopybookDatasets, loadRegistry } from './registry';

loadRegistry();

export async function resolveCobolDependencies(
  programNames: string[],
  creds: SshCredentials,
  depth: number = 3,
  maxFiles: number = 50
): Promise<DependencyResult> {
  const result: DependencyResult = {
    files: [],
    errors: []
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
        error: `Dataset not found for ${type} ${name}`
      });
      continue;
    }
    
    const asset = await downloadMainframeAsset(dataset, name, creds);
    
    if (!asset) {
      result.errors.push({
        name,
        error: `Failed to download ${type} ${name} from ${dataset}`
      });
      continue;
    }
    
    const resolvedFile: ResolvedDependency = {
      name,
      type: type,
      dataset,
      content: asset.content,
      length: asset.content.split('\n').length
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
  
  result.summary = buildSummaryInternal(result.files);
  
  return result;
}

export async function resolveJclJob(
  jobname: string,
  creds: SshCredentials,
  depth: number = 3
): Promise<DependencyResult & { jcl?: ResolvedDependency }> {
  const result: DependencyResult & { jcl?: ResolvedDependency } = {
    files: [],
    errors: []
  };
  
  const upperJob = jobname.toUpperCase();
  const jclDatasets = getJclDatasets();
  
  let jclDataset: string | null = null;
  let jclContent: string | null = null;
  
  for (const ds of jclDatasets) {
    const asset = await downloadMainframeAsset(ds, upperJob, creds);
    if (asset) {
      jclDataset = ds;
      jclContent = asset.content;
      break;
    }
  }
  
  if (!jclContent) {
    result.errors.push({ name: jobname, error: 'JCL not found' });
    result.summary = buildSummaryInternal(result.files);
    return result;
  }
  
  result.jcl = {
    name: upperJob,
    type: 'jcl',
    dataset: jclDataset!,
    content: jclContent,
    length: jclContent.split('\n').length
  };
  
  result.files.push(result.jcl);
  
  const { parseJclForPrograms } = await import('./parser');
  const programs = parseJclForPrograms(jclContent);
  
  for (const prog of programs) {
    if (result.files.length >= 50) break;
    
    try {
      const deps = await resolveCobolDependencies([prog], creds, depth, 50);
      result.files.push(...deps.files);
      result.errors.push(...deps.errors);
    } catch (err) {
      result.errors.push({
        name: prog,
        error: `Failed to resolve dependencies: ${err}`
      });
    }
  }
  
  result.summary = buildSummaryInternal(result.files);
  
  return result;
}

export async function resolveSoapService(
  query: string,
  creds: SshCredentials,
  depth: number = 3
): Promise<import('./types').SoapServiceResult> {
  const result: import('./types').SoapServiceResult = {
    matchedServices: [],
    files: [],
    errors: []
  };
  
  const { searchServices } = await import('./registry');
  const matches = searchServices(query);
  
  if (matches.length === 0) {
    result.errors.push({ name: query, error: 'No matching services found' });
    result.summary = 'No services found';
    return result;
  }
  
  result.matchedServices = matches.map(m => ({
    serviceKey: m.serviceKey,
    programName: m.programName,
    serviceName: m.serviceName,
    domain: m.domain
  }));
  
  const uniquePrograms = [...new Set(matches.map(m => m.programName))];
  
  for (const prog of uniquePrograms) {
    if (result.files.length >= 50) break;
    
    try {
      const deps = await resolveCobolDependencies([prog], creds, depth, 50);
      result.files.push(...deps.files);
      result.errors.push(...deps.errors);
    } catch (err) {
      result.errors.push({
        name: prog,
        error: `Failed to resolve dependencies: ${err}`
      });
    }
  }
  
  const programCount = result.files.filter(f => f.type === 'program').length;
  const copybookCount = result.files.filter(f => f.type === 'copybook').length;
  result.summary = `${result.matchedServices.length} service(s), ${programCount} programs, ${copybookCount} copybooks`;
  
  return result;
}

function findDatasetForMember(member: string, type: 'program' | 'copybook' | 'jcl' | 'proc'): string | null {
  const components = getComponents();
  
  const typeMap: Record<string, string> = {
    'program': 'PGM',
    'copybook': 'CPY',
    'jcl': 'JCL',
    'proc': 'PROC'
  };
  
  const compType = typeMap[type];
  
  const matches = components.filter(c => 
    c.name.toUpperCase() === member.toUpperCase() &&
    c.type.toUpperCase() === compType
  );
  
  if (matches.length > 0) {
    return matches[0].dept;
  }
  
  const fallbackDatasets = type === 'program' 
    ? getProgramDatasets()
    : type === 'copybook'
      ? getCopybookDatasets()
      : [];
  
  if (fallbackDatasets.length > 0) {
    return fallbackDatasets[0];
  }
  
  return null;
}

function getJclDatasets(): string[] {
  const { getJclDatasets: getJcl } = require('./registry');
  return getJcl();
}

function buildSummaryInternal(files: ResolvedDependency[]): string {
  const programCount = files.filter(f => f.type === 'program').length;
  const copybookCount = files.filter(f => f.type === 'copybook').length;
  const jclCount = files.filter(f => f.type === 'jcl').length;
  const procCount = files.filter(f => f.type === 'proc').length;
  
  const parts: string[] = [];
  if (programCount > 0) parts.push(`${programCount} program(s)`);
  if (copybookCount > 0) parts.push(`${copybookCount} copybook(s)`);
  if (jclCount > 0) parts.push(`${jclCount} JCL(s)`);
  if (procCount > 0) parts.push(`${procCount} PROC(s)`);
  
  return parts.length > 0 
    ? `${parts.join(', ')}, Total: ${files.length}`
    : `Total: ${files.length}`;
}

function formatDependencyResultOld(result: DependencyResult): string {
  const lines: string[] = [];
  
  lines.push('DEPENDENCY RESULTS');
  lines.push('='.repeat(50));
  
  if (result.summary) {
    lines.push(result.summary);
    lines.push('');
  }
  
  const programs = result.files.filter(f => f.type === 'program');
  const copybooks = result.files.filter(f => f.type === 'copybook');
  const other = result.files.filter(f => f.type !== 'program' && f.type !== 'copybook');
  
  if (programs.length > 0) {
    lines.push('PROGRAMS:');
    for (const p of programs) {
      const dataset = p.dataset || 'unknown';
      const lines2 = p.length || 0;
      lines.push(`  - ${p.name} (${dataset}) lines:${lines2}`);
    }
    lines.push('');
  }
  
  if (copybooks.length > 0) {
    lines.push('COPYBOOKS:');
    for (const c of copybooks) {
      const dataset = c.dataset || 'unknown';
      const lines2 = c.length || 0;
      lines.push(`  - ${c.name} (${dataset}) lines:${lines2}`);
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

function formatJclResultOld(result: DependencyResult & { jcl?: ResolvedDependency }): string {
  const lines: string[] = [];
  
  lines.push('JCL JOB ANALYSIS');
  lines.push('='.repeat(50));
  
  if (result.jcl) {
    lines.push(`Job: ${result.jcl.name}`);
    lines.push(`Dataset: ${result.jcl.dataset}`);
    lines.push(`Lines: ${result.jcl.length}`);
    lines.push('');
  }
  
  lines.push(formatDependencyResultOld(result));
  
  return lines.join('\n');
}

function formatSoapResultOld(result: import('./types').SoapServiceResult): string {
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
  
  lines.push(formatDependencyResultOld({
    files: result.files,
    errors: result.errors,
    summary: result.summary
  }));
  
  return lines.join('\n');
}
