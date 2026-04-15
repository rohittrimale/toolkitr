import { buildTool, toolSuccess, toolError } from '../buildTool'
import type { ToolDefinition } from '../types'
import { toolRegistry } from '../registry'

export const skillTool: ToolDefinition = buildTool({
  name: 'skill',
  description: 'Execute a skill (slash command). Skills are pre-built prompts for common tasks.',
  parameters: [
    { name: 'name', type: 'string', required: true, description: 'Skill name (e.g., "analyze", "submit", "browse")' },
    { name: 'args', type: 'string', required: false, description: 'Arguments to pass to the skill' },
  ],
  isReadOnly: true,
  isConcurrencySafe: false,
  category: 'skills',
  async handler({ name, args }) {
    const skill = toolRegistry.getSkill(String(name))
    if (!skill) {
      const available = toolRegistry.listSkills().map(s => s.name).join(', ')
      return toolError(`Skill "${name}" not found. Available: ${available}`)
    }
    try {
      const prompt = await skill.getPromptForCommand(String(args || ''))
      return toolSuccess(prompt, { skill: skill.name })
    } catch (err) {
      return toolError(err instanceof Error ? err.message : String(err))
    }
  }
})

// Register bundled skills

toolRegistry.registerSkill({
  name: 'analyze',
  description: 'Analyze COBOL code, JCL, or datasets',
  aliases: ['ana'],
  argumentHint: '[file or dataset name]',
  async getPromptForCommand(args) {
    return `Analyze the following mainframe artifact: ${args || 'the current screen'}

Steps:
1. Read the file or dataset content
2. Identify the language (COBOL, JCL, SQL, etc.)
3. Analyze the structure and purpose
4. Identify dependencies and relationships
5. Report any issues or improvements

Use read_file, glob, and grep tools to examine the code.`
  }
})

toolRegistry.registerSkill({
  name: 'submit',
  description: 'Submit a JCL job and monitor its execution',
  aliases: ['sub'],
  argumentHint: '[JCL file name]',
  async getPromptForCommand(args) {
    return `Submit the following JCL job: ${args || 'the current JCL'}

Steps:
1. Read the JCL content
2. Validate the JCL syntax
3. Submit the job via the mainframe connection
4. Monitor job status
5. Report the results (RC, output, spool)

Use the z/OS tools to submit and monitor the job.`
  }
})

toolRegistry.registerSkill({
  name: 'browse',
  description: 'Browse z/OS datasets',
  aliases: ['ls', 'list'],
  argumentHint: '[dataset pattern]',
  async getPromptForCommand(args) {
    return `Browse the following datasets: ${args || '*'}

Steps:
1. List datasets matching the pattern
2. Show dataset attributes (DSORG, RECFM, LRECL, BLKSIZE)
3. Show member list for PDS datasets
4. Show first few records of each dataset

Use the z/OS tools to list and read datasets.`
  }
})

toolRegistry.registerSkill({
  name: 'query',
  description: 'Run a DB2 SQL query',
  aliases: ['sql'],
  argumentHint: '[SQL query]',
  async getPromptForCommand(args) {
    return `Execute the following DB2 query: ${args || 'SELECT * FROM SYSIBM.SYSTABLES FETCH FIRST 10 ROWS ONLY'}

Steps:
1. Connect to DB2 subsystem
2. Execute the SQL query
3. Format results as a table
4. Report row count and execution time

Use the z/OS DB2 tools to execute the query.`
  }
})

toolRegistry.registerSkill({
  name: 'debug',
  description: 'Debug an issue by collecting diagnostic information',
  aliases: ['dbg', 'diag'],
  argumentHint: '[issue description]',
  async getPromptForCommand(args) {
    return `Debug the following issue: ${args || 'the current problem'}

Steps:
1. Read relevant log files and error messages
2. Search for error patterns in the codebase
3. Check system status and connectivity
4. Identify root cause
5. Suggest fixes

Use grep, read_file, and shell tools to collect diagnostics.`
  }
})
