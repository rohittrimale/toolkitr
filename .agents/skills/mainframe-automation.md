---
name: Mainframe Automation
description: IBM z/OS mainframe operations, dataset management, and terminal navigation
tools:
  - zvm_read_member
  - zvm_write_dataset
  - zvm_submit_job
  - zvm_compile
  - run_command
keywords:
  - mainframe
  - z/os
  - ispf
  - dataset
  - terminal
  - tso
version: 1.0.0
author: Toolkitr Agent
---

# Mainframe Automation Skill

Complete guide to mainframe operations using the Toolkitr assistant in Agent Mode.

## Overview

This skill enables autonomous mainframe automation through:
- Live Toolkitr screen navigation and command entry
- COBOL source code reading and modification
- Job submission and monitoring
- Dataset and member management

## Key Capabilities

### 1. Dataset Navigation & Access

**What you can do:**
- Read COBOL source members from any dataset
- List dataset contents to see available members
- Create new source members with content
- Modify existing members in-place
- Copy dataset contents between libraries

**Example scenarios:**
- "Read my program from MYLIB.COBOL(TEST)"
- "Show me all members in the LOADLIB"
- "Create a new member MYLIB.COBOL(NEWPROG)"

**Tools used:**
- `zvm_read_member` - Read source code
- `zvm_write_dataset` - Create/modify members
- `run_command` - Execute TSO commands for dataset info

### 2. COBOL Compilation

**What you can do:**
- Compile COBOL programs with full error reporting
- Apply compiler options for optimization
- Link compiled modules into loadlibs
- Review compile-time and link-edit messages

**Example scenarios:**
- "Compile this source and check for errors"
- "Build the program with full optimization"
- "Link the object module and create load module"

**Tools used:**
- `zvm_compile` - Execute IBM COBOL compiler
- `run_command` - Execute BIND/LINK steps

### 3. Job Submission & Monitoring

**What you can do:**
- Submit JCL jobs to the batch queue
- Monitor job status and completion
- Read job output (SDSF integration)
- Handle job errors and return codes

**Example scenarios:**
- "Submit this JCL job and tell me when it's done"
- "Check the status of job named MYJOB"
- "Show me the job output"

**Tools used:**
- `zvm_submit_job` - Submit JCL to queue
- `run_command` - Query SDSF and job status

### 4. ISPF Navigation

**What you can do:**
- Navigate between ISPF panels
- Execute ISPF commands and macros
- Browse datasets and members
- Use ISPF edit for inline modifications

**Example scenarios:**
- "Go to the EDIT panel and open this member"
- "Search for all DATA DIVISION references"
- "Open the COBOL source"

**Tools used:**
- `run_command` - Send ISPF commands via 3270 terminal
- Live Toolkitr screen context for navigation confirmation

## How the Agent Operates

### Agent Mode Workflow

When you ask the agent to do something in Agent Mode:

1. **Understands Your Request**
   - Parses the task (compile, submit, read, etc.)
   - Identifies which mainframe resources needed
   - Plans execution steps

2. **Reads the Live Toolkitr Screen**
   - Sees ISPF panel, TSO prompt, SDSF output, etc.
   - Detects current location in ISPF
   - Identifies available options

3. **Executes Actions**
   - Sends 3270 terminal keystrokes to navigate
   - Calls z/OS tools (compile, submit, etc.)
   - Monitors responses and error codes

4. **Iterates Until Done**
   - Reads updated screen after each action
   - Decides next step based on response
   - Continues until task complete or error detected

5. **Reports Results**
   - Tells you what was accomplished
   - Reports any errors with recovery suggestions
   - Provides relevant output (logs, messages)

### Example: Compile and Link a COBOL Program

**You say:** "Compile and link MYLIB.COBOL(TEST) and show me any errors"

**Agent does:**
1. Reads the current Toolkitr screen → sees ISPF COMMAND SHELL
2. Navigates to the source dataset → opens TEST member in edit
3. Compiles the program → watches for completion
4. Reviews compile output → finds syntax errors
5. Shows you the errors and their locations
6. Optionally: Fixes syntax and recompiles
7. Links successful compilation into loadlib
8. Reports success and load module location

## Tool Reference

### zvm_read_member

Read COBOL source code from a dataset member.

```bash
# Read the entire member
zvm_read_member(dataset_name: "ABC.COBOL.SOURCE", member: "TEST")

# Read specific lines
zvm_read_member(
  dataset_name: "ABC.COBOL.SOURCE",
  member: "TEST",
  lines_start: 100,
  lines_end: 200
)

# List all members in dataset
zvm_read_member(dataset_name: "ABC.COBOL.SOURCE")
```

Returns:
- Full source code with line numbers
- Total line count
- Member attributes (date created, last modified)

### zvm_write_dataset

Create or update a member in a dataset.

```bash
# Create new member
zvm_write_dataset(
  dataset_name: "ABC.COBOL.SOURCE",
  member: "NEWPROG",
  content: "       IDENTIFICATION DIVISION.\n       PROGRAM-ID. NEWPROG.\n..."
)

# Append to existing member
zvm_write_dataset(
  dataset_name: "ABC.COBOL.SOURCE",
  member: "NEWPROG",
  content: "\n       END PROGRAM NEWPROG.",
  replace_mode: "append"
)
```

Returns:
- Write status (success/error)
- Number of records written
- Member creation/modification time

### zvm_compile

Compile a COBOL program.

```bash
# Basic compilation
zvm_compile(
  dataset_name: "ABC.COBOL.SOURCE",
  member: "TEST"
)

# With compiler options
zvm_compile(
  dataset_name: "ABC.COBOL.SOURCE",
  member: "TEST",
  compile_options: "OPTIMIZE(2) PROFILE(FULL)"
)

# To specific output library
zvm_compile(
  dataset_name: "ABC.COBOL.SOURCE",
  member: "TEST",
  target_lib: "ABC.LOAD"
)
```

Returns:
- Return code (0 = success)
- Compiler messages and warnings
- Load module path if successful
- Elapsed compilation time

### zvm_submit_job

Submit JCL job for batch processing.

```bash
# Simple job submission
zvm_submit_job(
  jobname: "MYJOB",
  jcl_content: "//MYJOB JOB ...\n//STEP1 EXEC ...\n..."
)

# Submit and wait for status
zvm_submit_job(
  jobname: "MYJOB",
  jcl_content: "//MYJOB JOB ...\n...",
  update_status: true
)
```

Returns:
- Job ID (JOBID-nnnnn)
- Initial queue status
- Estimated run time
- Current execution status

## Best Practices

### 1. Dataset Naming

Use consistent dataset naming conventions:
- Prefix with team identifier (ABC., PROJ.)
- Middle level for content type (COBOL, LOADLIB, OUTPUT)
- Member names describe functionality

```
ABC.COBOL.SOURCE(TEST)        // Source
ABC.COBOL.LOADLIB(TEST)       // Compiled module
ABC.COBOL.COMPILE.LOG         // Compiler output
```

### 2. Error Handling

If the agent encounters errors:
- Check screen content for actual message
- Look for return codes in job output
- Verify dataset/member names are correct
- Confirm user permissions allow the operation

### 3. Agent Iteration Limits

The agent has maximum 10 iterations per task:
- Each iteration = 1 action (keystroke or tool call)
- Complex tasks may hit limit
- For long tasks: break into multiple requests
- Monitor progress through iteration count

### 4. Timeouts

Tool execution has timeouts:
- Dataset operations: 30 seconds
- Compilation: 2 minutes (configurable)
- Job submission: immediate
- Job status queries: 10 seconds per poll

## Common Tasks

### Task: Find and Fix a Compilation Error

```
You: "Compile MYLIB.COBOL(REPORT) and fix any errors"

Agent:
1. Reads MYLIB.COBOL(REPORT)
2. Compiles with zvm_compile()
3. Finds error: "Undefined variable SALES-AMT"
4. Navigates to line with error
5. Shows context (10 lines around error)
6. Waits for your fix or suggests correction
```

### Task: Run a Batch Job

```
You: "Submit and run this JCL to process monthly reports"

Agent:
1. Reads your JCL
2. Submits with zvm_submit_job()
3. Gets job ID
4. Monitors status
5. Notifies when job complete
6. Parses output and reports results
```

### Task: Review and Update Source Code

```
You: "Read MYLIB.COBOL(CALC), show me the PROCEDURE division"

Agent:
1. Reads full member
2. Extracts PROCEDURE DIVISION
3. Shows with context
4. Ready to:
   - Explain the logic
   - Modify specific sections
   - Recompile if changed
```

## Limitations

- **Screen size:** Limited to 3270 terminal resolution (24x80 typical)
- **Iterations:** Max 10 per request (need second request for longer tasks)
- **File size:** Members typically ≤ 65,536 lines (VB)
- **Real-time:** Depends on mainframe load and network latency

## Next Steps

- Start with reading source: "Show me MYLIB.COBOL(TEST)"
- Progress to editing: "Update the variable names in the PROCEDURE DIVISION"
- Advance to compilation: "Compile and link this program"
- Expert: Automate multi-step workflows: "Compile, link, and run test suite"

## Further Learning

See also:
- `COBOL Development` skill - Advanced COBOL programming patterns
- `Job Management` skill - Enterprise JCL and job scheduling
- `Code Navigation` skill - Searching and understanding codebases
