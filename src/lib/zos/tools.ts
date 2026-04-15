export const ZOS_TOOL_DEFINITIONS = [
  // =======================
  // DATASET OPERATIONS
  // =======================
  {
    type: "function",
    name: "zvm_list_datasets",
    description: "List z/OS datasets matching a pattern (with wildcards). Returns all datasets (PS, PO, VSAM, GDG). Example: {pattern: 'USER.*'} lists all USER.* datasets.",
    parameters: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "Dataset pattern with wildcards (REQUIRED - e.g., 'YOUR.DATASET.*', 'USER.*.COBOL')" },
        maxResults: { type: "number", description: "Maximum number of results (default: 1000)" }
      },
      required: ["pattern"]
    }
  },
  {
    type: "function",
    name: "zvm_list_dataset_members",
    description: "List all members in a PDS (Partitioned Dataset). Returns member names only. Example: to check members in YOUR.LIBRARY, call with {datasetName: 'YOUR.LIBRARY'} NOT with empty object.",
    parameters: {
      type: "object",
      properties: {
        datasetName: { type: "string", description: "Full dataset name (e.g., 'YOUR.COBOL.SRCLIB' or 'YOUR.LIBRARY'). REQUIRED - must extract from user input." }
      },
      required: ["datasetName"]
    }
  },
  {
    type: "function",
    name: "zvm_read_dataset_content",
    description: "Read the content of a sequential dataset or PDS member. Returns raw content as text. Example: {datasetName: 'YOUR.LIBRARY', member: 'MYPROG'} or just {datasetName: 'YOUR.CONFIG'}",
    parameters: {
      type: "object",
      properties: {
        datasetName: { type: "string", description: "Full dataset name (REQUIRED - e.g., 'YOUR.LIBRARY' or 'USER.COBOL.SOURCE')" },
        member: { type: "string", description: "Member name for PDS (e.g., 'MYPROG' - optional for sequential datasets)" }
      },
      required: ["datasetName"]
    }
  },
  {
    type: "function",
    name: "zvm_write_dataset_content",
    description: "Write or update content in a sequential dataset or PDS member. Creates the dataset if it doesn't exist.",
    parameters: {
      type: "object",
      properties: {
        datasetName: { type: "string", description: "Full dataset name" },
        member: { type: "string", description: "Member name (for PDS)" },
        content: { type: "string", description: "Content to write" }
      },
      required: ["datasetName", "content"]
    }
  },
  {
    type: "function",
    name: "zvm_delete_dataset",
    description: "Delete a z/OS dataset (sequential, PDS, or VSAM).",
    parameters: {
      type: "object",
      properties: {
        datasetName: { type: "string", description: "Full dataset name to delete" }
      },
      required: ["datasetName"]
    }
  },
  {
    type: "function",
    name: "zvm_rename_dataset",
    description: "Rename a z/OS dataset.",
    parameters: {
      type: "object",
      properties: {
        oldName: { type: "string", description: "Current dataset name" },
        newName: { type: "string", description: "New dataset name" }
      },
      required: ["oldName", "newName"]
    }
  },
  {
    type: "function",
    name: "zvm_copy_dataset",
    description: "Copy a dataset to a new name or location.",
    parameters: {
      type: "object",
      properties: {
        sourceName: { type: "string", description: "Source dataset name" },
        targetName: { type: "string", description: "Target dataset name" }
      },
      required: ["sourceName", "targetName"]
    }
  },
  {
    type: "function",
    name: "zvm_create_dataset",
    description: "Create a new z/OS dataset with specified attributes.",
    parameters: {
      type: "object",
      properties: {
        datasetName: { type: "string", description: "Dataset name to create" },
        dsorg: { type: "string", description: "Dataset organization: PO (PDS), PS, POE" },
        recfm: { type: "string", description: "Record format: FB, F, V, VB" },
        lrecl: { type: "number", description: "Logical record length" },
        blksize: { type: "number", description: "Block size" },
        space: { type: "string", description: "Space allocation (e.g., '(10,5)')" },
        volser: { type: "string", description: "Volume serial" }
      },
      required: ["datasetName"]
    }
  },
  {
    type: "function",
    name: "zvm_get_dataset_info",
    description: "Get detailed information about a dataset (RECFM, LRECL, BLKSIZE, DSORG, VOLUME). Example: {datasetName: 'YOUR.LIBRARY'} to verify it exists and see its attributes.",
    parameters: {
      type: "object",
      properties: {
        datasetName: { type: "string", description: "Full dataset name (REQUIRED - e.g., 'YOUR.COBOL.SRCLIB')" }
      },
      required: ["datasetName"]
    }
  },

  // =======================
  // JES/JOB OPERATIONS
  // =======================
  {
    type: "function",
    name: "zvm_list_jobs",
    description: "List jobs in the JES spool. Shows job ID, name, status, owner, return code.",
    parameters: {
      type: "object",
      properties: {
        owner: { type: "string", description: "Filter by job owner (default: current user)" },
        maxResults: { type: "number", description: "Maximum number of results (default: 100)" }
      }
    }
  },
  {
    type: "function",
    name: "zvm_get_job_status",
    description: "Get detailed status of a specific job including return code.",
    parameters: {
      type: "object",
      properties: {
        jobId: { type: "string", description: "Job ID (e.g., 'JOB12345')" }
      },
      required: ["jobId"]
    }
  },
  {
    type: "function",
    name: "zvm_submit_job",
    description: "Submit a JCL job for execution. Pass the full JCL content.",
    parameters: {
      type: "object",
      properties: {
        jcl: { type: "string", description: "Full JCL content to submit" }
      },
      required: ["jcl"]
    }
  },
  {
    type: "function",
    name: "zvm_submit_job_dataset",
    description: "Submit a JCL job from an existing dataset.",
    parameters: {
      type: "object",
      properties: {
        datasetName: { type: "string", description: "Dataset containing JCL" },
        member: { type: "string", description: "Member name (if PDS)" }
      },
      required: ["datasetName"]
    }
  },
  {
    type: "function",
    name: "zvm_get_job_spool",
    description: "Get the spool output (JESMSGLG, JESJCL, etc.) for a completed job.",
    parameters: {
      type: "object",
      properties: {
        jobId: { type: "string", description: "Job ID to get spool for" }
      },
      required: ["jobId"]
    }
  },
  {
    type: "function",
    name: "zvm_cancel_job",
    description: "Cancel a running or queued job.",
    parameters: {
      type: "object",
      properties: {
        jobId: { type: "string", description: "Job ID to cancel" }
      },
      required: ["jobId"]
    }
  },
  {
    type: "function",
    name: "zvm_hold_job",
    description: "Hold a job in the queue.",
    parameters: {
      type: "object",
      properties: {
        jobId: { type: "string", description: "Job ID to hold" }
      },
      required: ["jobId"]
    }
  },
  {
    type: "function",
    name: "zvm_release_job",
    description: "Release a held job.",
    parameters: {
      type: "object",
      properties: {
        jobId: { type: "string", description: "Job ID to release" }
      },
      required: ["jobId"]
    }
  },

  // =======================
  // USS OPERATIONS
  // =======================
  {
    type: "function",
    name: "zvm_list_uss_files",
    description: "List files in a USS (Unix) directory.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "USS path (e.g., '/u/username')" }
      },
      required: ["path"]
    }
  },
  {
    type: "function",
    name: "zvm_read_uss_file",
    description: "Read the content of a USS file.",
    parameters: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Full USS file path" }
      },
      required: ["filePath"]
    }
  },
  {
    type: "function",
    name: "zvm_write_uss_file",
    description: "Write content to a USS file. Creates parent directories if needed.",
    parameters: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Full USS file path" },
        content: { type: "string", description: "Content to write" }
      },
      required: ["filePath", "content"]
    }
  },
  {
    type: "function",
    name: "zvm_delete_uss_file",
    description: "Delete a USS file or directory.",
    parameters: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "USS file or directory path" }
      },
      required: ["filePath"]
    }
  },

  // =======================
  // CICS OPERATIONS
  // =======================
  {
    type: "function",
    name: "zvm_list_cics_regions",
    description: "List all active CICS regions.",
    parameters: {
      type: "object",
      properties: {}
    }
  },
  {
    type: "function",
    name: "zvm_list_cics_programs",
    description: "List programs in a CICS region.",
    parameters: {
      type: "object",
      properties: {
        region: { type: "string", description: "CICS region name" }
      },
      required: ["region"]
    }
  },
  {
    type: "function",
    name: "zvm_list_cics_transactions",
    description: "List transactions in a CICS region.",
    parameters: {
      type: "object",
      properties: {
        region: { type: "string", description: "CICS region name" }
      },
      required: ["region"]
    }
  },
  {
    type: "function",
    name: "zvm_execute_cics_command",
    description: "Execute a CICS CEMT command (e.g., PERFORM, SET, DISCARD).",
    parameters: {
      type: "object",
      properties: {
        region: { type: "string", description: "CICS region name" },
        command: { type: "string", description: "CEMT command (e.g., 'PERFORM PROGRAM(PGM1) PHASEIN')" }
      },
      required: ["region", "command"]
    }
  },

  // =======================
  // DB2 OPERATIONS
  // =======================
  {
    type: "function",
    name: "zvm_list_db2_subsystems",
    description: "List active DB2 subsystems.",
    parameters: {
      type: "object",
      properties: {}
    }
  },
  {
    type: "function",
    name: "zvm_execute_sql",
    description: "Execute a SQL query against DB2. Returns results as JSON array.",
    parameters: {
      type: "object",
      properties: {
        sql: { type: "string", description: "SQL query to execute" },
        subsystem: { type: "string", description: "DB2 subsystem (default: DB2P)" }
      },
      required: ["sql"]
    }
  },
  {
    type: "function",
    name: "zvm_list_db2_tables",
    description: "List tables in a DB2 schema.",
    parameters: {
      type: "object",
      properties: {
        schema: { type: "string", description: "Schema name (e.g., 'YOUR_SCHEMA')" },
        subsystem: { type: "string", description: "DB2 subsystem" }
      },
      required: ["schema"]
    }
  },

  // =======================
  // SYSTEM OPERATIONS
  // =======================
  {
    type: "function",
    name: "zvm_get_system_info",
    description: "Get z/OS system information (CPU, memory, version, IPL).",
    parameters: {
      type: "object",
      properties: {}
    }
  },
  {
    type: "function",
    name: "zvm_get_console_log",
    description: "Get recent console messages.",
    parameters: {
      type: "object",
      properties: {
        lines: { type: "number", description: "Number of lines (default: 50)" }
      }
    }
  },
  {
    type: "function",
    name: "zvm_execute_operator_command",
    description: "Execute a z/OS console command (MVS, SDSF, etc.).",
    parameters: {
      type: "object",
      properties: {
        command: { type: "string", description: "Console command (e.g., 'D A,L')" }
      },
      required: ["command"]
    }
  },
  {
    type: "function",
    name: "zvm_get_volume_info",
    description: "Get information about mounted volumes.",
    parameters: {
      type: "object",
      properties: {}
    }
  },

  // =======================
  // SSH OPERATIONS
  // =======================
  {
    type: "function",
    name: "zvm_test_connection",
    description: "Test the SSH connection to z/OS. Returns latency and user ID.",
    parameters: {
      type: "object",
      properties: {}
    }
  },
  {
    type: "function",
    name: "zvm_execute_command",
    description: "Execute any command on z/OS via SSH. Use for TSO, ISPF, REXX, or z/OS commands.",
    parameters: {
      type: "object",
      properties: {
        command: { type: "string", description: "Command to execute" },
        timeout: { type: "number", description: "Timeout in ms (default: 30000)" }
      },
      required: ["command"]
    }
  },

  // =======================
  // VSAM OPERATIONS
  // =======================
  {
    type: "function",
    name: "zvm_list_vsam_datasets",
    description: "List VSAM datasets matching a pattern.",
    parameters: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "VSAM dataset pattern" }
      }
    }
  },
  {
    type: "function",
    name: "zvm_get_vsam_info",
    description: "Get detailed information about a VSAM dataset.",
    parameters: {
      type: "object",
      properties: {
        datasetName: { type: "string", description: "VSAM dataset name" }
      },
      required: ["datasetName"]
    }
  },

  // =======================
  // RACF OPERATIONS
  // =======================
  {
    type: "function",
    name: "zvm_list_racf_users",
    description: "List RACF users matching a pattern.",
    parameters: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "User ID pattern" }
      }
    }
  },
  {
    type: "function",
    name: "zvm_list_racf_groups",
    description: "List RACF groups matching a pattern.",
    parameters: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "Group name pattern" }
      }
    }
  },
  {
    type: "function",
    name: "zvm_list_racf_datasets",
    description: "List RACF protected datasets.",
    parameters: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "Dataset pattern" }
      }
    }
  },

  // =======================
  // STORAGE OPERATIONS
  // =======================
  {
    type: "function",
    name: "zvm_list_storage_groups",
    description: "List SMS storage groups.",
    parameters: {
      type: "object",
      properties: {}
    }
  },
  {
    type: "function",
    name: "zvm_analyze_storage",
    description: "Analyze storage usage for datasets matching a pattern.",
    parameters: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "Dataset pattern" }
      }
    }
  },

  // =======================
  // NETWORK OPERATIONS
  // =======================
  {
    type: "function",
    name: "zvm_get_tcpip_status",
    description: "Get TCP/IP stack status.",
    parameters: {
      type: "object",
      properties: {}
    }
  },
  {
    type: "function",
    name: "zvm_list_tcp_connections",
    description: "List active TCP connections.",
    parameters: {
      type: "object",
      properties: {}
    }
  },
  {
    type: "function",
    name: "zvm_ping_host",
    description: "Ping a host from z/OS.",
    parameters: {
      type: "object",
      properties: {
        host: { type: "string", description: "Host or IP to ping" },
        count: { type: "number", description: "Number of packets" }
      },
      required: ["host"]
    }
  }
];

export const ZOS_TOOL_NAMES = {
  // Datasets
  LIST_DATASETS: 'zvm_list_datasets',
  LIST_DATASET_MEMBERS: 'zvm_list_dataset_members',
  READ_DATASET_CONTENT: 'zvm_read_dataset_content',
  WRITE_DATASET_CONTENT: 'zvm_write_dataset_content',
  DELETE_DATASET: 'zvm_delete_dataset',
  RENAME_DATASET: 'zvm_rename_dataset',
  COPY_DATASET: 'zvm_copy_dataset',
  CREATE_DATASET: 'zvm_create_dataset',
  GET_DATASET_INFO: 'zvm_get_dataset_info',
  
  // Jobs
  LIST_JOBS: 'zvm_list_jobs',
  GET_JOB_STATUS: 'zvm_get_job_status',
  SUBMIT_JOB: 'zvm_submit_job',
  SUBMIT_JOB_DATASET: 'zvm_submit_job_dataset',
  GET_JOB_SPOOL: 'zvm_get_job_spool',
  CANCEL_JOB: 'zvm_cancel_job',
  HOLD_JOB: 'zvm_hold_job',
  RELEASE_JOB: 'zvm_release_job',
  
  // USS
  LIST_USS_FILES: 'zvm_list_uss_files',
  READ_USS_FILE: 'zvm_read_uss_file',
  WRITE_USS_FILE: 'zvm_write_uss_file',
  DELETE_USS_FILE: 'zvm_delete_uss_file',
  
  // CICS
  LIST_CICS_REGIONS: 'zvm_list_cics_regions',
  LIST_CICS_PROGRAMS: 'zvm_list_cics_programs',
  LIST_CICS_TRANSACTIONS: 'zvm_list_cics_transactions',
  EXECUTE_CICS_COMMAND: 'zvm_execute_cics_command',
  
  // DB2
  LIST_DB2_SUBSYSTEMS: 'zvm_list_db2_subsystems',
  EXECUTE_SQL: 'zvm_execute_sql',
  LIST_DB2_TABLES: 'zvm_list_db2_tables',
  
  // System
  GET_SYSTEM_INFO: 'zvm_get_system_info',
  GET_CONSOLE_LOG: 'zvm_get_console_log',
  EXECUTE_OPERATOR_COMMAND: 'zvm_execute_operator_command',
  GET_VOLUME_INFO: 'zvm_get_volume_info',
  
  // SSH
  TEST_CONNECTION: 'zvm_test_connection',
  EXECUTE_COMMAND: 'zvm_execute_command',
  
  // VSAM
  LIST_VSAM_DATASETS: 'zvm_list_vsam_datasets',
  GET_VSAM_INFO: 'zvm_get_vsam_info',
  
  // RACF
  LIST_RACF_USERS: 'zvm_list_racf_users',
  LIST_RACF_GROUPS: 'zvm_list_racf_groups',
  LIST_RACF_DATASETS: 'zvm_list_racf_datasets',
  
  // Storage
  LIST_STORAGE_GROUPS: 'zvm_list_storage_groups',
  ANALYZE_STORAGE: 'zvm_analyze_storage',
  
  // Network
  GET_TCPIP_STATUS: 'zvm_get_tcpip_status',
  LIST_TCP_CONNECTIONS: 'zvm_list_tcp_connections',
  PING_HOST: 'zvm_ping_host',
} as const;

export type ZosToolName = typeof ZOS_TOOL_NAMES[keyof typeof ZOS_TOOL_NAMES];
