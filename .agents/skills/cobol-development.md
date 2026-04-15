---
name: COBOL Development
description: Advanced COBOL programming, error handling, and code patterns
tools:
  - zvm_read_member
  - zvm_write_dataset
  - zvm_compile
  - search_files
  - read_file
keywords:
  - cobol
  - programming
  - development
  - patterns
  - debugging
version: 1.0.0
author: Toolkitr Agent
---

# COBOL Development Skill

Advanced COBOL programming assistance, pattern recognition, and error handling.

## Overview

This skill provides deep COBOL development capabilities:
- Code analysis and review
- Common pattern recognition and suggestions
- Error diagnosis and correction
- Performance optimization hints
- COBOL standard compliance checking

## COBOL Division Structure

### IDENTIFICATION DIVISION
```cobol
IDENTIFICATION DIVISION.
PROGRAM-ID. MY-PROGRAM.
AUTHOR. Developer Name.
DATE-WRITTEN. MM/DD/YYYY.
REMARKS.
  This program processes monthly sales reports.
```

**Key points:**
- PROGRAM-ID must match load module name (8 chars max)
- AUTHOR and DATE-WRITTEN are optional
- REMARKS can span multiple lines

### ENVIRONMENT DIVISION
```cobol
ENVIRONMENT DIVISION.
CONFIGURATION SECTION.
INPUT-OUTPUT SECTION.
FILE-CONTROL.
  SELECT INPUT-FILE ASSIGN TO UT-S-INPUT.
  SELECT OUTPUT-FILE ASSIGN TO UT-S-OUTPUT.
```

**Common assignments:**
- `UT-S` = UNIX sequential file (typical)
- `UT-D` = DASD (disk) sequential
- `SYS-nnn` = DD statement reference

### DATA DIVISION
```cobol
DATA DIVISION.
FILE SECTION.
FD INPUT-FILE.
01 INPUT-REC.
   05 SALES-AMOUNT    PIC 9(7)V99.
   05 SALES-DATE      PIC 9(8).
```

**Variable rules:**
- Level 01 = record layout
- Level 05+ = subordinate fields
- PIC 9 = numeric
- PIC X = alphanumeric
- PIC V = implied decimal point

### PROCEDURE DIVISION
```cobol
PROCEDURE DIVISION.
MAIN-PROCESS.
  PERFORM UNTIL WS-EOF = 'Y'
    READ INPUT-FILE
      AT END MOVE 'Y' TO WS-EOF
      NOT AT END PERFORM PROCESS-RECORD
    END-READ
  END-PERFORM.
  STOP RUN.
```

## Common Patterns

### 1. File Processing Loop
```cobol
MAIN-PROCESS.
  OPEN INPUT INPUT-FILE OUTPUT OUTPUT-FILE.
  PERFORM UNTIL WS-EOF = 'Y'
    READ INPUT-FILE
      AT END MOVE 'Y' TO WS-EOF
      NOT AT END PERFORM PROCESS-RECORD
    END-READ
  END-PERFORM.
  CLOSE INPUT-FILE OUTPUT-FILE.
  STOP RUN.

PROCESS-RECORD.
  PERFORM VALIDATE-RECORD.
  IF WS-VALID = 'Y'
    PERFORM CREATE-OUTPUT-REC
    WRITE OUTPUT-REC
  END-IF.
```

### 2. Table/Array Iteration
```cobol
01 SALES-TABLE.
   05 SALES-ENTRY OCCURS 100 TIMES.
      10 SALES-ID        PIC 9(5).
      10 SALES-AMT       PIC 9(7)V99.

PERFORM VARYING WS-IDX FROM 1 BY 1
  UNTIL WS-IDX > 100
  IF SALES-AMT(WS-IDX) > 1000
    PERFORM HIGH-SALES-PROCESS
  END-IF
END-PERFORM.
```

### 3. Conditional Logic
```cobol
IF SALES-AMT > 5000
  EVALUATE TRUE
    WHEN CUST-TYPE = 'GOLD'
      COMPUTE DISCOUNT = SALES-AMT * 0.10
    WHEN CUST-TYPE = 'SILVER'
      COMPUTE DISCOUNT = SALES-AMT * 0.05
    WHEN OTHER
      MOVE 0 TO DISCOUNT
  END-EVALUATE
ELSE
  MOVE 0 TO DISCOUNT
END-IF.
```

### 4. String Operations
```cobol
01 WS-STRING PIC X(50).
01 WS-SEARCH PIC X(10).

STRING 'FIRST-' DELIMITED BY SIZE
       WS-NAME DELIMITED BY SPACE
       '-LAST' DELIMITED BY SIZE
  INTO WS-OUTPUT
END-STRING.

UNSTRING WS-INPUT DELIMITED BY ','
  INTO FIELD-1, FIELD-2, FIELD-3
END-UNSTRING.
```

### 5. Numeric Computation
```cobol
COMPUTE TOTAL = AMOUNT * RATE.
COMPUTE AVG = TOTAL / COUNT ROUNDED.
ADD AMOUNT TO GRAND-TOTAL
  GIVING WS-NEW-TOTAL.
```

## Error Handling

### Common Compilation Errors

| Error | Cause | Fix |
|-------|-------|-----|
| **Undefined variable** | Referenced before declaration | Add to DATA DIVISION |
| **Invalid PIC clause** | Typos or wrong format | Check PIC syntax (9, X, V format) |
| **Missing PERIOD** | Statements not terminated | Add period at end of statement |
| **Syntax error** | Wrong keyword or format | Check COBOL reference |
| **Level number wrong** | Sequential level numbers | Ensure 01, 05, 10 sequence |

### Runtime Errors

| Code | Meaning | Prevention |
|------|---------|-----------|
| **0** | Success | Normal execution |
| **1** | File not found | Verify DD statement |
| **2** | File already open | Check OPEN/CLOSE |
| **4** | Invalid file record | Validate input data |
| **8** | I/O error | Check DASD/network |

### Defensive Programming

```cobol
PERFORM READ-INPUT.
IF WS-RETURN-CODE NOT = 0
  DISPLAY 'Error reading file: ' WS-RETURN-CODE
  MOVE WS-RETURN-CODE TO WS-PROGRAM-RC
  STOP RUN
END-IF.

PERFORM VALIDATE-RECORD.
IF WS-VALID NOT = 'Y'
  PERFORM LOG-ERROR
  MOVE 0 TO WS-OUTPUT-COUNT
ELSE
  PERFORM CREATE-OUTPUT
  ADD 1 TO WS-OUTPUT-COUNT
END-IF.
```

## Performance Optimization

### 1. Reduce I/O Operations
```cobol
-- SLOW: Reads every record individually
PERFORM VARYING WS-IDX FROM 1 BY 1
  UNTIL WS-IDX > 10000
  READ INPUT-FILE INTO WS-REC
  PERFORM PROCESS-REC
END-PERFORM.

-- FAST: Read once, process in memory
OPEN INPUT INPUT-FILE.
READ INPUT-FILE INTO WS-BUFFER UNTIL WS-EOF.
CLOSE INPUT-FILE.
PERFORM PROCESS-BUFFER.
```

### 2. Optimize String Operations
```cobol
-- SLOW: String concatenation in loop
PERFORM VARYING I FROM 1 BY 1
  UNTIL I > 1000
  STRING RESULT DELIMITED BY SIZE
         DATA(I:10) DELIMITED BY SIZE
    INTO RESULT
  END-STRING
END-PERFORM.

-- FAST: Build once, copy once
MOVE FUNCTION CONCATENATION(...) TO RESULT.
```

### 3. Use COMP Variables for Speed
```cobol
-- SLOWER: X(4) string = 4 bytes, text operations
01 WS-COUNT PIC 9(4).

-- FASTER: COMP = binary, arithmetic operations
01 WS-COUNT PIC 9(4) COMP.

-- RECOMMENDED: COMP-3 = packed decimal
01 WS-COUNT PIC 9(4) COMP-3.
```

## Debugging Strategies

### Strategy 1: Add Debug Output
```cobol
-- Add display statements to track values
ADD 1 TO WS-REC-COUNT.
IF WS-DEBUG = 'Y'
  DISPLAY 'Processing record: ' WS-REC-COUNT
          ' Amount: ' SALES-AMT
END-IF.
```

### Strategy 2: Validate Assumptions
```cobol
PERFORM READ-INPUT.
-- Verify file opened successfully
IF WS-RETURN-CODE NOT = 0
  DISPLAY 'FILE ERROR: ' WS-RETURN-CODE
  STOP RUN
END-IF.

-- Verify data within expected range
IF SALES-AMT < 0 OR SALES-AMT > 9999999.99
  DISPLAY 'AMOUNT OUT OF RANGE: ' SALES-AMT
  MOVE 'N' TO WS-VALID
END-IF.
```

### Strategy 3: Check Loop Counters
```cobol
MOVE 0 TO WS-COUNT.
PERFORM UNTIL WS-COUNT > 100 OR WS-EOF = 'Y'
  ADD 1 TO WS-COUNT
  -- IF COUNTER IS STUCK HERE, LIKELY INFINITE LOOP
  PERFORM PROCESS-RECORD
END-PERFORM.
DISPLAY 'Processed records: ' WS-COUNT.
```

## Code Review Checklist

- [ ] All variables declared in DATA DIVISION
- [ ] All files properly OPEN and CLOSE
- [ ] All loops have proper termination conditions
- [ ] All conditional logic has ELSE or END-IF
- [ ] File status codes checked after I/O
- [ ] Numeric fields have appropriate precision
- [ ] String fields have adequate length
- [ ] Arrays/tables sized correctly
- [ ] OCCURS index variables initialized
- [ ] STOP RUN executed at program end

## Common Anti-Patterns to Avoid

### ❌ Bad: Unfenced Loop
```cobol
PERFORM UNTIL WS-EOF = 'Y'
  READ INPUT-FILE
  PERFORM PROCESS
-- Missing termination condition - may infinite loop!
```

### ✅ Good: Properly Fenced
```cobol
PERFORM UNTIL WS-EOF = 'Y'
  READ INPUT-FILE
    AT END MOVE 'Y' TO WS-EOF
    NOT AT END PERFORM PROCESS
  END-READ
END-PERFORM.
```

### ❌ Bad: Magic Numbers
```cobol
IF AMOUNT > 5000
  COMPUTE TAX = AMOUNT * 0.15.
```

### ✅ Good: Named Constants
```cobol
01 TAX-THRESHOLD PIC 9(7)V99 VALUE 5000.
01 HIGH-TAX-RATE PIC 9V99 VALUE .15.

IF AMOUNT > TAX-THRESHOLD
  COMPUTE TAX = AMOUNT * HIGH-TAX-RATE
END-IF.
```

## Migration & Modernization

### Moving to Modern COBOL

**Recommended for new code:**
```cobol
-- Use END-IF instead of periods
-- Use END-PERFORM instead of periods
-- Use END-READ instead of periods
-- Use structured data types
-- Minimize GOTO (if possible)
-- Use PERFORM VARYING instead of PERFORM UNTIL
```

**Consider Java/C alternatives for:**
- Complex UI interactions
- Database integration (instead of VSAM/DB2)
- Web services and APIs
- Real-time processing requirements

## Further Learning

See also:
- `Mainframe Automation` skill - z/OS operations
- `Job Management` skill - JCL and batch processing
- IBM COBOL Language Reference Manual
- COBOL Coding Standards (site-specific)
