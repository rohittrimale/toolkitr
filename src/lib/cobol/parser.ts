export function extractCopybooks(source: string): string[] {
  const copybooks = new Set<string>();
  const lines = source.split(/\r?\n/);
  
  for (const line of lines) {
    const upperLine = line.toUpperCase();
    
    if (isCommentLine(upperLine, line)) continue;
    
    const match = upperLine.match(/COPY\s+['"]?([A-Z0-9\-_]+)['"]?/);
    if (match && match[1]) {
      copybooks.add(match[1].toUpperCase());
    }
    
    const replacingMatch = upperLine.match(/COPY\s+['"]?([A-Z0-9\-_]+)['"]?\s+REPLACING/i);
    if (replacingMatch && replacingMatch[1]) {
      copybooks.add(replacingMatch[1].toUpperCase());
    }
  }
  
  return Array.from(copybooks);
}

export function extractCalledPrograms(source: string): string[] {
  const programs = new Set<string>();
  const lines = source.split(/\r?\n/);
  
  for (const line of lines) {
    const upperLine = line.toUpperCase();
    
    if (isCommentLine(upperLine, line)) continue;
    
    let match = upperLine.match(/CALL\s+['"]?([A-Z0-9\-_]+)['"]?/);
    if (match && match[1] && !isRuntimeVariable(upperLine, match.index || 0)) {
      programs.add(match[1].toUpperCase());
    }
    
    match = upperLine.match(/EXEC\s+CICS\s+LINK\s+['"]?([A-Z0-9\-_]+)['"]?/);
    if (match && match[1]) {
      programs.add(match[1].toUpperCase());
    }
    
    match = upperLine.match(/EXEC\s+CICS\s+LINK\s+PROGRAM\s*\(\s*['"]?([A-Z0-9\-_]+)['"]?\s*\)/i);
    if (match && match[1]) {
      programs.add(match[1].toUpperCase());
    }
    
    match = upperLine.match(/EXEC\s+CICS\s+XCTL\s+['"]?([A-Z0-9\-_]+)['"]?/i);
    if (match && match[1]) {
      programs.add(match[1].toUpperCase());
    }
    
    match = upperLine.match(/EXEC\s+CICS\s+XCTL\s+PROGRAM\s*\(\s*['"]?([A-Z0-9\-_]+)['"]?\s*\)/i);
    if (match && match[1]) {
      programs.add(match[1].toUpperCase());
    }
    
    match = upperLine.match(/CALL\s+([A-Z0-9\-_]+)/);
    if (match && match[1] && !isRuntimeVariable(upperLine, match.index || 0)) {
      const progName = match[1].toUpperCase();
      if (!isSystemUtility(progName)) {
        programs.add(progName);
      }
    }
  }
  
  return Array.from(programs);
}

export function extractExecCicsCommands(source: string): string[] {
  const commands = new Set<string>();
  const lines = source.split(/\r?\n/);
  
  for (const line of lines) {
    const upperLine = line.toUpperCase();
    
    if (isCommentLine(upperLine, line)) continue;
    
    const execMatch = upperLine.match(/EXEC\s+CICS\s+(\w+)/);
    if (execMatch && execMatch[1]) {
      commands.add(execMatch[1].toUpperCase());
    }
  }
  
  return Array.from(commands);
}

export function parseJclForPrograms(jclContent: string): string[] {
  const programs = new Set<string>();
  const lines = jclContent.split(/\r?\n/);
  
  for (const line of lines) {
    const upperLine = line.toUpperCase().trim();
    
    if (upperLine.startsWith('//') || upperLine.startsWith('/*')) continue;
    
    const execMatch = line.match(/EXEC\s+PGM\s*=\s*([A-Z0-9\-_]+)/i);
    if (execMatch && execMatch[1]) {
      programs.add(execMatch[1].toUpperCase());
    }
    
    const procMatch = line.match(/EXEC\s+([A-Z0-9\-_]+)/i);
    if (procMatch && procMatch[1] && !line.match(/EXEC\s+PGM\s*=/i)) {
      const procName = procMatch[1].toUpperCase();
      if (!isSystemUtility(procName)) {
        programs.add(procName);
      }
    }
  }
  
  return Array.from(programs);
}

export function parseJclForProcs(jclContent: string): string[] {
  const procs = new Set<string>();
  const lines = jclContent.split(/\r?\n/);
  
  for (const line of lines) {
    const upperLine = line.toUpperCase().trim();
    
    if (upperLine.startsWith('//') || upperLine.startsWith('/*')) continue;
    
    const procMatch = line.match(/EXEC\s+([A-Z0-9\-_]+)/i);
    if (procMatch && procMatch[1] && !line.match(/EXEC\s+PGM\s*=/i)) {
      procs.add(procMatch[1].toUpperCase());
    }
  }
  
  return Array.from(procs);
}

function isCommentLine(upperLine: string, originalLine: string): boolean {
  const col7 = originalLine.charAt(6);
  if (col7 === '*' || col7 === '/') return true;
  
  if (upperLine.startsWith('*>')) return true;
  if (upperLine.startsWith('* ')) return true;
  if (upperLine.startsWith('*')) return true;
  
  return false;
}

function isRuntimeVariable(line: string, index: number): boolean {
  const beforeCall = line.substring(0, index).trim();
  if (beforeCall.endsWith('(') || beforeCall.endsWith('USING')) return true;
  
  const afterCall = line.substring(index).split(/\s/)[1];
  if (afterCall && (afterCall.startsWith('(') || afterCall.startsWith(':'))) return true;
  
  return false;
}

function isSystemUtility(name: string): boolean {
  const systemUtilities = [
    'DFSORT', 'ICEGENER', 'IEBGENER', 'IEBCOPY', 'IEBRDPR', 'IEBWRIT',
    'SORT', 'MERGE', 'COPY', 'FIND', 'LISTCAT', 'REPRO',
    'IDCAMS', 'IKJEFT01', 'IKJEFT1B', 'ATTACH', 'LINK', 'LOADGO',
    'COB2GOF', 'IGYCRCTL', 'EDCBIND', 'DFHEIL1', 'DFHEIL2'
  ];
  
  return systemUtilities.includes(name);
}

export function normalizeFileType(type: string): 'program' | 'copybook' | 'jcl' | 'proc' | 'control-card' | 'job-doc' {
  const upperType = type.toUpperCase();
  
  if (upperType.includes('COB') || upperType.includes('CBL') || upperType.includes('PGM') || upperType.includes('PROGRAM')) {
    return 'program';
  }
  if (upperType.includes('CPY') || upperType.includes('COPY') || upperType.includes('COPYBOOK')) {
    return 'copybook';
  }
  if (upperType.includes('JCL') || upperType.includes('JOB')) {
    return 'jcl';
  }
  if (upperType.includes('PROC') || upperType.includes('PR')) {
    return 'proc';
  }
  
  return 'control-card';
}
