---
name: Job Management
description: JCL, job submission, monitoring, and batch processing
tools:
  - zvm_submit_job
  - run_command
  - read_file
  - search_files
keywords:
  - jcl
  - job
  - batch
  - sdsf
  - scheduling
version: 1.0.0
author: Toolkitr Agent
---

# Job Management Skill

Complete guide to JCL development, job submission, and monitoring.

## Overview

This skill covers:
- JCL fundamentals and syntax
- Job submission and tracking
- Output and return code analysis
- Error handling and recovery
- Performance tuning for batch jobs

## JCL Basics

### Job Card (JOB Statement)

```jcl
//MYJOB JOB CLASS=A,MSGCLASS=H,MSGLEVEL=(1,1),TIME=5
```

**Parameters:**
- **CLASS**: Job class (A-Z, default C) - determines queue/priority
- **MSGCLASS**: Message output class
- **MSGLEVEL**: Message levels (allocation=1, termination=1)
- **TIME**: Time limit in minutes (0=unlimited)
- **REGION**: Memory limit (example: 4096K)
- **NOTIFY**: Send completion message to user

### EXEC Statement (Execution)

```jcl
//STEP1 EXEC PGM=MYPROG,PARM='PARM1,PARM2'
```

**Parameters:**
- **PGM**: Load module name to execute
- **COND**: Conditional execution based on prior step RC
- **PARM**: Parameters passed to program
- **REGION**: Step-specific memory
- **VICIOUS**: Let system tune (IBM-specific)

### DD Statement (Data Definition)

```jcl
//INPUT DD DSN=ABC.SALES.DATA,DISP=SHR
//OUTPUT DD DSN=ABC.SALES.OUTPUT,
//        DISP=(NEW,CATLG),
//        SPACE=(TRK,(10,5)),
//        DCB=(RECFM=FB,LRECL=80,BLKSIZE=8000)
```

**Common DSN (Dataset Name):**
- Full name: `PREFIX.MIDDLE.MEMBER`
- DISP=SHR: Share dataset (read)
- DISP=NEW: Create new file
- DISP=OLD: Exclusive access
- DISP=MOD: Append to dataset

**SPACE parameter:**
- Format: `SPACE=(unit,(primary,secondary,directory))`
- Example: `SPACE=(TRK,(100,25))` = 100 tracks primary, 25 tracks secondary

## Job Examples

### Example 1: Simple Compile and Link

```jcl
//MYJOB JOB CLASS=A,MSGCLASS=H,TIME=10
//*
//* COBOL Compile and Link
//*
//COMPILE EXEC PGM=IGYCRCTL
//STEPLIB DD DSN=SYS1.COBOL.V6.R3.LOADLIB,DISP=SHR
//SYSUT1 DD UNIT=SYSDA,SPACE=(CYL,(100,50))
//SYSUT2 DD UNIT=SYSDA,SPACE=(CYL,(50,25))
//SYSUT3 DD UNIT=SYSDA,SPACE=(CYL,(50,25))
//SYSUT4 DD UNIT=SYSDA,SPACE=(CYL,(50,25))
//SYSUT5 DD UNIT=SYSDA,SPACE=(CYL,(50,25))
//SYSOUT DD SYSOUT=*
//SYSERR DD SYSOUT=*
//SYSLIN DD DSN=&&LOADSET,UNIT=SYSDA,SPACE=(CYL,(5,5)),
//        DISP=(MOD,KEEP)
//SYSIN DD DSN=ABC.COBOL.SOURCE(MYPROG),DISP=SHR
//
//LINK EXEC PGM=IEWL,COND=(4,LT,COMPILE)
//SYSLIB DD DSN=SYS1.LINKLIB,DISP=SHR
//SYSLIN DD DSN=&&LOADSET,DISP=(OLD,DELETE)
//SYSLMOD DD DSN=ABC.LOADLIB(MYPROG),DISP=SHR
//SYSOUT DD SYSOUT=*
//*
```

**Key points:**
- COMPILE step: PGM=IGYCRCTL is IBM COBOL compiler
- Generation dataset `&&LOADSET`: Temporary intermediate file
- COND=(4,LT,COMPILE): Link only if compile RC < 4
- SYSOUT=*: Send output to job message class

### Example 2: Data Processing Job

```jcl
//DATAJOB JOB CLASS=B,MSGCLASS=H,TIME=15,REGION=8192K
//*
//* Process Sales Data
//*
//PROCESS EXEC PGM=SALEPROG,PARM='MONTHLY'
//STEPLIB DD DSN=ABC.LOADLIB,DISP=SHR
//INPUT DD DSN=ABC.SALES.RAW,DISP=SHR
//OUTPUT DD DSN=ABC.SALES.MONTHLY,
//        DISP=(NEW,CATLG),
//        SPACE=(TRK,(50,10)),
//        DCB=(RECFM=FB,LRECL=100)
//ERRORS DD SYSOUT=*
//SYSOUT DD SYSOUT=*
//*
```

### Example 3: Job with Conditional Steps

```jcl
//CONDJOB JOB CLASS=A,MSGCLASS=H
//*
//* Step 1: Validate Data
//VALIDATE EXEC PGM=VALIDATE
//INPUT DD DSN=ABC.DATA.SOURCE,DISP=SHR
//OUTPUT DD SYSOUT=*
//
//* Step 2: Process (only if validation succeeded)
//PROCESS EXEC PGM=PROCESS,COND=(0,NE,VALIDATE)
//INPUT DD DSN=ABC.DATA.SOURCE,DISP=SHR
//OUTPUT DD DSN=ABC.DATA.VALIDATED,DISP=(NEW,CATLG)
//
//* Step 3: Report (always run)
//REPORT EXEC PGM=REPORT
//INPUT DD DSN=ABC.DATA.VALIDATED,DISP=SHR
//OUTPUT DD SYSOUT=*
//*
```

## Return Codes & Conditions

### Standard Return Codes

| RC | Meaning | Action |
|----|---------|--------|
| 0 | Success | Continue |
| 4 | Warning | Usually continue |
| 8 | Error | Review output |
| 12 | Severe error | Usually stop |
| 16 | Error - halt | Stop job |

### COND Parameter

```jcl
// EXEC PGM=STEP2,COND=((4,LT,STEP1),(8,LT,STEP0))
```

Reads as: "Execute STEP2 if (STEP1 RC < 4) AND (STEP0 RC < 8)"

**Common patterns:**
- `COND=(0,NE,STEP1)` - Execute if STEP1 failed
- `COND=(4,LT,STEP1)` - Execute if STEP1 succeeded or had warning
- `COND=(12,LT)` - Execute if all prior steps RC < 12

## Job Submission

### Submit Using zvm_submit_job

```bash
zvm_submit_job(
  jobname: "MYJOB",
  jcl_content: """
    //MYJOB JOB CLASS=A,MSGCLASS=H
    //STEP1 EXEC PGM=MYPROG
    //INPUT DD DSN=ABC.DATA,DISP=SHR
    //SYSOUT DD SYSOUT=*
  """
)
```

Returns:
- Job ID (JOB01234)
- Queue status
- Estimated execution time

### Monitor Job Status

```jcl
// After job submitted, check SDSF:
// Primary Command: ST (status)
// - Shows all jobs, their queue position, and status
```

## Output Analysis

### SDSF (Spool Display and Search Facility)

After job completes:

1. **View Job Status**
   ```
   SDSF> ST      // Show all jobs
   SDSF> ST MYJOB // Filter to specific job
   ```

2. **Review Output**
   ```
   SDSF> O       // Open output dataset
   ```

3. **View Job Log**
   ```
   SDSF> L       // Open job log
   ```

### Interpreting Output

**Compile output (IGYCRCTL):**
```
USER.COBOL(PROG)   - Data Division Line: 0025
A010 - Undefined variable [SALES-AMT]     ← Error (RC 8)
```

**Link-edit output (IEWL):**
```
SYMBOL   SECTION   LOADMOD

MYPROG   --------  ABC.LOADLIB(MYPROG)    ← Load module created
```

## Common Issues & Solutions

### Issue 1: JCL Syntax Error

**Symptom:** Job card error message
**Cause:** Invalid JCL statement
**Fix:**
```jcl
-- WRONG: Missing comma after CLASS
//JOB JOB CLASS=A MSGCLASS=H

-- CORRECT: Comma after CLASS
//JOB JOB CLASS=A,MSGCLASS=H
```

### Issue 2: Dataset Not Found

**Symptom:** `IEC130I` error
**Cause:** Dataset name incorrect or doesn't exist
**Fix:**
```jcl
-- Check dataset name spelling
-- Verify dataset is cataloged
-- Check user permissions
```

### Issue 3: Insufficient Space

**Symptom:** `IEC140I` error
**Cause:** Output space too small
**Fix:**
```jcl
-- Before:
//OUTPUT DD DSN=ABC.OUT,SPACE=(TRK,(5,1))

-- After (increased primary allocation):
//OUTPUT DD DSN=ABC.OUT,SPACE=(TRK,(50,10))
```

### Issue 4: Program Abend (Abnormal End)

**Symptom:** `ABEND Uxxxx` message
**Cause:** Program error or resource issue
**Fix:**
- Review program output and symptoms
- Add debugging output to program
- Increase REGION if out-of-memory
- Check input data format

## Performance Tuning

### 1. Optimize SPACE Allocation

```jcl
-- SLOW: Many secondary allocations
//DD1 DD DSN=ABC.OUTPUT,SPACE=(TRK,(10,1)) //lots of extends

-- FAST: Adequate primary allocation
//DD1 DD DSN=ABC.OUTPUT,SPACE=(TRK,(100,20)) //fewer extends
```

### 2. Parallel Steps

```jcl
//JOB JOB CLASS=A
//STEP1 EXEC PGM=PROG1
//DD1 DD ...
//
//STEP2A EXEC PGM=PROG2A
//DD2A DD ...
//
//STEP2B EXEC PGM=PROG2B,COND=(0,NE,STEP1)
//DD2B DD ...
```

Note: Only STEP1 is serialized. STEP2A and STEP2B run in parallel if both have same COND.

### 3. Use SORT for Efficiency

```jcl
// Instead of writing COBOL to sort:
//SORT EXEC PGM=SORT
//SYSOUT DD SYSOUT=*
//SORTIN DD DSN=ABC.UNSORTED,DISP=SHR
//SORTOUT DD DSN=ABC.SORTED,
//        DISP=(NEW,CATLG),
//        SPACE=(TRK,(100,20))
//SYSIN DD *
 SORT FIELDS=(1,10,CH,A)
/*
```

## Job Scheduling

### Using Optimized Workload Adjuster (OWA) / Workload Automation

```
Submit job during off-peak hours:
- Production jobs: Run 2 AM - 6 AM
- Batch reports: Run 6 AM - 8 AM
- User jobs: Run 8 AM - 6 PM (prioritize low)
```

## Debugging JCL

### Add Debug Output

```jcl
//DEBUG DD SYSOUT=*
...
//STEP1 EXEC PGM=MYPROG
// IF RC = 0 THEN
//   SET NEXTDD=CONTINUE
// ELSE
//   SET NEXTDD=SKIP
// ENDIF
//*SKIP XX DD DUMMY
//CONTINUE DD SYSOUT=*
```

### Verify Each Step

```jcl
//STEP1 EXEC PGM=PROG1
//DD1 DD ...
//
//VERIFY EXEC PGM=IEFBR14  // Dummy step to stop and check
//
//STEP2 EXEC PGM=PROG2,COND=(0,NE,VERIFY)
```

## Best Practices

- [ ] Keep job names to 8 characters
- [ ] Use meaningful step names
- [ ] Comment complex JCL sections
- [ ] Test jobs in TEST class first
- [ ] Use generation datasets `&&name` for temporary files
- [ ] Always specify SPACE and DCB for new datasets
- [ ] Include COND parameters for conditional execution
- [ ] Review job output for RC codes
- [ ] Archive successful JCL for reuse
- [ ] Document dataset naming standards

## Further Learning

See also:
- `Mainframe Automation` skill - z/OS operations
- `COBOL Development` skill - Program logic
- IBM JCL Reference Manual
- JOBLIB/STEPLIB usage guide
