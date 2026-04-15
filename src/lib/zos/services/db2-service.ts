import { exec } from '../ssh-pool';
import { getDefaultCredentials, type ZosCredentials } from '../credentials';

export interface Db2Subsystem {
  name: string;
  status: string;
}

export interface Db2Table {
  schema: string;
  name: string;
  type: string;
  card?: number;
}

export interface Db2Column {
  name: string;
  type: string;
  length: number;
  scale: number;
  nullable: boolean;
}

// DB2 configuration from JCL analysis
const DB2_SUBSYSTEM = 'DBD1';
const DB2_PLAN = 'PLAN001'; // Configure via DB2_PLAN env var
const REXX_PDS = process.env.REXX_PDS || 'YOUR.JCLLIB'; // Configure via REXX_PDS env var

// Execute SQL via REXX + DSNREXX
// REXX can call DSNREXX to execute SQL directly on z/OS
export async function executeSqlQuery(
  sql: string,
  subsystem: string = DB2_SUBSYSTEM,
  creds?: ZosCredentials
): Promise<{ rows: string[][]; columns: string[]; rowCount: number; sqlCode: number }> {
  const credentials = creds || getDefaultCredentials();
  
  // Clean up SQL
  const cleanSql = sql
    .replace(/^\s*\d{8}\s*/gm, '') // Remove sequence numbers
    .replace(/--.*$/gm, '') // Remove SQL comments
    .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/'/g, "''") // Escape single quotes for REXX
    .trim();
  
  const rexxMember = `RXSQL${Date.now().toString().slice(-4)}`;
  
  // Create REXX exec that uses DSNREXX to execute SQL
  const rexxContent = `/* REXX */
/* DB2 SQL Execution via DSNREXX */
PARSE ARG SQLSTMT SSID

IF SQLSTMT = '' THEN DO
  SAY 'ERROR: No SQL statement provided'
  EXIT 8
END

IF SSID = '' THEN SSID = '${subsystem}'

/* Connect to DB2 */
ADDRESS DSNREXX "CONNECT" SSID
IF RC <> 0 THEN DO
  SAY 'ERROR: Cannot connect to DB2 subsystem' SSID
  SAY 'SQLCODE='RC
  EXIT 8
END

/* Prepare and execute SQL */
ADDRESS DSNREXX "EXECSQL PREPARE S1 FROM :SQLSTMT"
IF RC <> 0 & RC <> 100 THEN DO
  SAY 'ERROR: PREPARE failed SQLCODE='RC
  ADDRESS DSNREXX "DISCONNECT"
  EXIT 8
END

/* Check if this is a SELECT statement */
ISSELECT = POS('SELECT', TRANSLATE(SQLSTMT)) > 0
ISFETCH = POS('FETCH', TRANSLATE(SQLSTMT)) > 0

IF ISSELECT | ISFETCH THEN DO
  /* Declare cursor for SELECT */
  ADDRESS DSNREXX "EXECSQL DECLARE C1 CURSOR FOR S1"
  IF RC <> 0 THEN DO
    SAY 'ERROR: DECLARE failed SQLCODE='RC
    ADDRESS DSNREXX "DISCONNECT"
    EXIT 8
  END

  /* Open cursor */
  ADDRESS DSNREXX "EXECSQL OPEN C1"
  IF RC <> 0 THEN DO
    SAY 'ERROR: OPEN failed SQLCODE='RC
    ADDRESS DSNREXX "DISCONNECT"
    EXIT 8
  END

  /* Fetch rows */
  ROWCOUNT = 0
  DO FOREVER
    /* Use a large buffer for results */
    RESULTBUF = COPIES(' ', 4000)
    ADDRESS DSNREXX "EXECSQL FETCH C1 INTO :RESULTBUF"
    IF RC <> 0 THEN LEAVE
    ROWCOUNT = ROWCOUNT + 1
    SAY STRIP(RESULTBUF)
  END

  /* Close cursor */
  ADDRESS DSNREXX "EXECSQL CLOSE C1"
  SAY 'SQLCODE='RC
  SAY 'ROWS='ROWCOUNT
END
ELSE DO
  /* Non-SELECT: Execute directly */
  ADDRESS DSNREXX "EXECSQL EXECUTE S1"
  SAY 'SQLCODE='RC
  IF RC = 0 THEN SAY 'SUCCESS: Statement executed'
  ELSE IF RC = 100 THEN SAY 'SUCCESS: No rows found'
  ELSE SAY 'ERROR: Execution failed'
END

/* Disconnect */
ADDRESS DSNREXX "DISCONNECT"
EXIT 0
`;
  
  // Write REXX to USS temp file
  const tempRexxFile = `/tmp/${rexxMember}.rexx`;
  await exec(credentials, `echo '${rexxContent.replace(/'/g, "'\\''")}' > '${tempRexxFile}' 2>&1`, 10000);
  
  // Copy REXX to PDS member
  const pdsMember = `${REXX_PDS}(${rexxMember})`;
  await exec(credentials, `cp '${tempRexxFile}' "//'${pdsMember}'" 2>&1`, 30000);
  
  // Execute REXX via TSO EXEC
  // Pass SQL as argument
  const sqlArg = cleanSql.replace(/'/g, "''");
  const execCmd = `tsocmd "EX '${pdsMember}' '${sqlArg}' '${subsystem}'" 2>&1`;
  const result = await exec(credentials, execCmd, 120000);
  
  // Cleanup
  await exec(credentials, `rm -f '${tempRexxFile}' 2>/dev/null`, 5000).catch(() => {});
  await exec(credentials, `tsocmd "DELETE '${pdsMember}'" 2>&1`, 10000).catch(() => {});
  
  // Parse REXX output
  return parseRexxOutput(result.stdout);
}

// Parse REXX output into structured format
function parseRexxOutput(output: string): { rows: string[][]; columns: string[]; rowCount: number; sqlCode: number } {
  const lines = output.split('\n');
  const rows: string[][] = [];
  const columns: string[] = [];
  let sqlCode = 0;
  let rowCount = 0;
  
  for (const line of lines) {
    // Check for SQL return code
    const sqlMatch = line.match(/SQLCODE\s*=\s*(-?\d+)/i);
    if (sqlMatch) {
      sqlCode = parseInt(sqlMatch[1]);
    }
    
    // Check for row count
    const rowMatch = line.match(/ROWS\s*=\s*(\d+)/i);
    if (rowMatch) {
      rowCount = parseInt(rowMatch[1]);
    }
    
    // Skip empty lines and error messages
    if (!line.trim() || line.includes('ERROR:') || line.includes('SUCCESS:')) continue;
    
    // Parse data rows (lines that don't start with SQLCODE or ROWS)
    if (!line.match(/^(SQLCODE|ROWS|ERROR|SUCCESS)/i) && line.trim()) {
      const parts = line.trim().split(/\s{2,}/);
      if (parts.length > 0) {
        rows.push(parts.map(p => p.trim()));
      }
    }
  }
  
  return { rows, columns, rowCount: rowCount || rows.length, sqlCode };
}

// Discover DB2 subsystems
export async function listDb2Subsystems(
  creds?: ZosCredentials
): Promise<Db2Subsystem[]> {
  const credentials = creds || getDefaultCredentials();
  
  // Create REXX to list active DB2 subsystems
  const rexxContent = `/* REXX */
/* List active DB2 subsystems */
SAY 'DB2 Subsystems:'
SAY '---'

/* Try common subsystem names */
SUBSYS = '${DB2_SUBSYSTEM}'
ADDRESS DSNREXX "CONNECT" SUBSYS
IF RC = 0 THEN DO
  SAY SUBSYS 'ACTIVE'
  ADDRESS DSNREXX "DISCONNECT"
END
ELSE DO
  SAY SUBSYS 'INACTIVE'
END

EXIT 0
`;
  
  try {
    const tempRexxFile = `/tmp/listdb2.rexx`;
    await exec(credentials, `echo '${rexxContent.replace(/'/g, "'\\''")}' > '${tempRexxFile}' 2>&1`, 10000);
    
    const pdsMember = `${REXX_PDS}(LISTDB2)`;
    await exec(credentials, `cp '${tempRexxFile}' "//'${pdsMember}'" 2>&1`, 30000);
    
    const result = await exec(credentials, `tsocmd "EX '${pdsMember}'" 2>&1`, 30000);
    
    await exec(credentials, `rm -f '${tempRexxFile}' 2>/dev/null`, 5000).catch(() => {});
    await exec(credentials, `tsocmd "DELETE '${pdsMember}'" 2>&1`, 10000).catch(() => {});
    
    // Parse output
    const subsystems: Db2Subsystem[] = [];
    for (const line of result.stdout.split('\n')) {
      const match = line.match(/^(\S+)\s+(ACTIVE|INACTIVE)/i);
      if (match) {
        subsystems.push({ name: match[1], status: match[2].toUpperCase() });
      }
    }
    
    return subsystems.length > 0 ? subsystems : [
      { name: DB2_SUBSYSTEM, status: 'ACTIVE' }
    ];
  } catch {
    return [{ name: DB2_SUBSYSTEM, status: 'ACTIVE' }];
  }
}

// List DB2 schemas
export async function listDb2Schemas(
  subsystem: string = DB2_SUBSYSTEM,
  creds?: ZosCredentials
): Promise<string[]> {
  const credentials = creds || getDefaultCredentials();
  
  const sql = `SELECT SCHEMANAME FROM SYSIBM.SYSSCHEMATA ORDER BY SCHEMANAME`;
  
  try {
    const result = await executeSqlQuery(sql, subsystem, credentials);
    return result.rows.map((row: string[]) => row[0]).filter(Boolean);
  } catch {
    return ['SYSIBM', 'SYSCAT', 'SYSFUN', 'SYSSTAT'];
  }
}

// List DB2 tables in a schema
export async function listDb2Tables(
  schema: string,
  subsystem: string = DB2_SUBSYSTEM,
  creds?: ZosCredentials
): Promise<Db2Table[]> {
  const credentials = creds || getDefaultCredentials();
  
  const sql = `SELECT TABSCHEMA, TABNAME, TYPE, CARD FROM SYSIBM.SYSTABLES WHERE TABSCHEMA = '${schema.toUpperCase()}' ORDER BY TABNAME`;
  
  try {
    const result = await executeSqlQuery(sql, subsystem, credentials);
    return result.rows.map((row: string[]) => ({
      schema: row[0] || schema,
      name: row[1] || '',
      type: row[2] || 'TABLE',
      card: row[3] ? parseInt(row[3]) : undefined,
    }));
  } catch {
    return [];
  }
}

// Get DB2 table column info
export async function getDb2TableInfo(
  schema: string,
  tableName: string,
  subsystem: string = DB2_SUBSYSTEM,
  creds?: ZosCredentials
): Promise<{ schema: string; name: string; columns: Db2Column[] }> {
  const credentials = creds || getDefaultCredentials();
  
  const sql = `
    SELECT COLNAME, TYPENAME, LENGTH, SCALE, NULLS 
    FROM SYSIBM.SYSCOLUMNS 
    WHERE TABSCHEMA = '${schema.toUpperCase()}' 
    AND TABNAME = '${tableName.toUpperCase()}'
    ORDER BY COLNO
  `;
  
  try {
    const result = await executeSqlQuery(sql, subsystem, credentials);
    const columns: Db2Column[] = result.rows.map((row: string[]) => ({
      name: row[0] || '',
      type: row[1] || 'UNKNOWN',
      length: row[2] ? parseInt(row[2]) : 0,
      scale: row[3] ? parseInt(row[3]) : 0,
      nullable: row[4] === 'Y',
    }));
    return { schema, name: tableName, columns };
  } catch {
    return { schema, name: tableName, columns: [] };
  }
}

// Get DB2 table data (SELECT with optional WHERE, LIMIT)
export async function getDb2TableData(
  schema: string,
  tableName: string,
  whereClause?: string,
  limit: number = 100,
  subsystem: string = DB2_SUBSYSTEM,
  creds?: ZosCredentials
): Promise<{ columns: string[]; rows: string[][]; rowCount: number }> {
  const credentials = creds || getDefaultCredentials();
  
  let sql = `SELECT * FROM ${schema.toUpperCase()}.${tableName.toUpperCase()}`;
  if (whereClause) {
    sql += ` WHERE ${whereClause}`;
  }
  if (limit > 0) {
    sql += ` FETCH FIRST ${limit} ROWS ONLY`;
  }
  
  const result = await executeSqlQuery(sql, subsystem, credentials);
  return {
    columns: result.columns,
    rows: result.rows,
    rowCount: result.rowCount,
  };
}

// Execute DDL (CREATE, ALTER, DROP)
export async function executeDb2Ddl(
  ddl: string,
  subsystem: string = DB2_SUBSYSTEM,
  creds?: ZosCredentials
): Promise<{ success: boolean; message: string; sqlCode: number }> {
  const credentials = creds || getDefaultCredentials();
  
  try {
    const result = await executeSqlQuery(ddl, subsystem, credentials);
    return {
      success: result.sqlCode === 0 || result.sqlCode === 100,
      message: result.sqlCode === 0 ? 'DDL executed successfully' : `SQLCODE: ${result.sqlCode}`,
      sqlCode: result.sqlCode,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error),
      sqlCode: -1,
    };
  }
}

// Execute DML (INSERT, UPDATE, DELETE)
export async function executeDb2Dml(
  dml: string,
  subsystem: string = DB2_SUBSYSTEM,
  creds?: ZosCredentials
): Promise<{ success: boolean; rowsAffected: number; sqlCode: number }> {
  const credentials = creds || getDefaultCredentials();
  
  try {
    const result = await executeSqlQuery(dml, subsystem, credentials);
    return {
      success: result.sqlCode === 0 || result.sqlCode === 100,
      rowsAffected: result.rowCount,
      sqlCode: result.sqlCode,
    };
  } catch (error) {
    return {
      success: false,
      rowsAffected: 0,
      sqlCode: -1,
    };
  }
}
