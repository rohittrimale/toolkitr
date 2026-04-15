export const COBOL_TOOL_DEFINITIONS = [
  {
    type: "function",
    name: "download_cobol_with_dependencies",
    description: "Download a COBOL program with ALL dependencies - copybooks (COPY) and called programs (CALL/EXEC CICS LINK). Uses 3270-entry registry to auto-find datasets.",
    parameters: {
      type: "object",
      properties: {
        programs: {
          type: "array",
          items: { type: "string" },
          description: "Array of program names (1-8 char each)"
        },
        depth: {
          type: "number",
          description: "Search depth, default 3"
        },
        maxFiles: {
          type: "number",
          description: "Safety limit, default 50"
        }
      },
      required: ["programs"]
    }
  },
  {
    type: "function",
    name: "batch_download_cobol_with_dependencies",
    description: "Download 1..N COBOL programs with ALL dependencies in ONE parallel request. ALWAYS use instead of multiple single calls.",
    parameters: {
      type: "object",
      properties: {
        programs: {
          type: "array",
          items: { type: "string" },
          description: "Array of program names (1-8 chars each)"
        },
        depth: {
          type: "number",
          description: "Call depth. Default 3"
        },
        maxFiles: {
          type: "number",
          description: "Limit per program. Default 50"
        }
      },
      required: ["programs"]
    }
  },
  {
    type: "function",
    name: "download_jcl_with_dependencies",
    description: "Download JCL job with ALL dependencies - PROCs, JCL programs, and those programs' copybooks and CALL chains. Full end-to-end job flow.",
    parameters: {
      type: "object",
      properties: {
        jobname: {
          type: "string",
          description: "JCL member name (1-8 chars), Auto-find dataset."
        },
        depth: {
          type: "number",
          description: "CALL depth for programs. Default: 3"
        },
        maxFiles: {
          type: "number",
          description: "Safety limit. Default: 50"
        }
      },
      required: ["jobname"]
    }
  },
  {
    type: "function",
    name: "resolve_svc_service",
    description: "Resolve SOAP/REST service -> backing COBOL programs and download all code with dependencies. Supports URL keys, service names, or domains. 3270-entry registry.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "URL key, service name, or domain"
        },
        depth: {
          type: "number",
          description: "Call depth. Default 3"
        }
      },
      required: ["query"]
    }
  },
  {
    type: "function",
    name: "execute_ssh_command",
    description: "Execute any command on the mainframe via SSH. Use for TSO commands, ISPF, REXX, or any z/OS command. Returns command output.",
    parameters: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: "The command to execute on mainframe (TSO, ISPF, REXX, etc.)"
        }
      },
      required: ["command"]
    }
  },
  {
    type: "function",
    name: "submit_mainframe_job",
    description: "Submit a JCL job to the mainframe for execution. Returns the job ID for tracking.",
    parameters: {
      type: "object",
      properties: {
        jcl: {
          type: "string",
          description: "The complete JCL job to submit"
        }
      },
      required: ["jcl"]
    }
  },
  {
    type: "function",
    name: "check_job_status",
    description: "Check the output/status of a previously submitted mainframe job by job ID.",
    parameters: {
      type: "object",
      properties: {
        jobId: {
          type: "string",
          description: "The job ID to check (e.g., JOB12345)"
        }
      },
      required: ["jobId"]
    }
  },
  {
    type: "function",
    name: "list_dataset_members",
    description: "List all members in a PDS/PDSE dataset on the mainframe.",
    parameters: {
      type: "object",
      properties: {
        dataset: {
          type: "string",
          description: "The dataset name to list members from"
        }
      },
      required: ["dataset"]
    }
  },
  {
    type: "function",
    name: "search_in_codebase",
    description: "Search for text or patterns in downloaded mainframe code. Use to find specific variables, paragraphs, or code patterns.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Text or regex pattern to search for"
        },
        fileType: {
          type: "string",
          description: "Filter by file type: program, copybook, jcl, all (default: all)"
        }
      }
    }
  },
  {
    type: "function",
    name: "analyze_code_quality",
    description: "Analyze COBOL code for quality issues, potential bugs, performance problems, and best practices violations.",
    parameters: {
      type: "object",
      properties: {
        programName: {
          type: "string",
          description: "Name of the COBOL program to analyze"
        },
        checks: {
          type: "array",
          items: { type: "string" },
          description: "Specific checks to run: performance, security, best-practices, all (default: all)"
        }
      },
      required: ["programName"]
    }
  },
  {
    type: "function",
    name: "generate_jcl",
    description: "Generate JCL for common mainframe operations: compile, link, run, copy, sort, etc.",
    parameters: {
      type: "object",
      properties: {
        operation: {
          type: "string",
          description: "Operation type: compile, link, run, copy, sort, backup"
        },
        programName: {
          type: "string",
          description: "Name of program (for compile/link)"
        },
        inputDataset: {
          type: "string",
          description: "Input dataset for operations"
        },
        outputDataset: {
          type: "string",
          description: "Output dataset for operations"
        }
      },
      required: ["operation"]
    }
  },
  {
    type: "function",
    name: "get_mainframe_info",
    description: "Get information about the mainframe system: z/OS version, installed products, system symbols, etc.",
    parameters: {
      type: "object",
      properties: {
        infoType: {
          type: "string",
          description: "Type of info: system, version, products, symbols (default: system)"
        }
      }
    }
  }
];

export const COBOL_TOOL_NAMES = {
  DOWNLOAD_COBOL: 'download_cobol_with_dependencies',
  BATCH_DOWNLOAD_COBOL: 'batch_download_cobol_with_dependencies',
  DOWNLOAD_JCL: 'download_jcl_with_dependencies',
  RESOLVE_SVC: 'resolve_svc_service',
  EXECUTE_SSH: 'execute_ssh_command',
  SUBMIT_JOB: 'submit_mainframe_job',
  CHECK_JOB: 'check_job_status',
  LIST_DATASET: 'list_dataset_members',
  SEARCH_CODEBASE: 'search_in_codebase',
  ANALYZE_QUALITY: 'analyze_code_quality',
  GENERATE_JCL: 'generate_jcl',
  GET_INFO: 'get_mainframe_info'
} as const;

export type CobolToolName = typeof COBOL_TOOL_NAMES[keyof typeof COBOL_TOOL_NAMES];
