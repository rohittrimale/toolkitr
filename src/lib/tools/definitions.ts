/**
 * Tool definitions — exact schemas from vscode-copilot-chat source
 * Mirrors: package.json contributes.languageModelTools
 *          src/extension/tools/common/toolNames.ts
 *
 * ToolName enum maps to the actual API string IDs used in tool_calls.
 * ContributedToolName enum maps to the VS Code contributed tool names.
 */

// ─── Tool name enums (from toolNames.ts) ─────────────────────────────────────

export enum ToolName {
  ApplyPatch = "apply_patch",
  Codebase = "semantic_search",
  VSCodeAPI = "get_vscode_api",
  TestFailure = "test_failure",
  FindFiles = "file_search",
  FindTextInFiles = "grep_search",
  ReadFile = "read_file",
  ListDirectory = "list_dir",
  GetErrors = "get_errors",
  GetScmChanges = "get_changed_files",
  ReadProjectStructure = "read_project_structure",
  CreateNewWorkspace = "create_new_workspace",
  CreateNewJupyterNotebook = "create_new_jupyter_notebook",
  SearchWorkspaceSymbols = "search_workspace_symbols",
  EditFile = "insert_edit_into_file",
  CreateFile = "create_file",
  ReplaceString = "replace_string_in_file",
  MultiReplaceString = "multi_replace_string_in_file",
  EditNotebook = "edit_notebook_file",
  RunNotebookCell = "run_notebook_cell",
  GetNotebookSummary = "copilot_getNotebookSummary",
  ReadCellOutput = "read_notebook_cell_output",
  InstallExtension = "install_extension",
  FetchWebPage = "fetch_webpage",
  Memory = "memory",
  FindTestFiles = "test_search",
  GetProjectSetupInfo = "get_project_setup_info",
  SearchViewResults = "get_search_view_results",
  GithubRepo = "github_repo",
  IntegratedBrowser = "open_integrated_browser",
  CreateDirectory = "create_directory",
  RunVscodeCmd = "run_vscode_command",
  CoreManageTodoList = "manage_todo_list",
  CoreRunInTerminal = "run_in_terminal",
  CoreGetTerminalOutput = "get_terminal_output",
  CoreTerminalSelection = "terminal_selection",
  CoreTerminalLastCommand = "terminal_last_command",
  CoreCreateAndRunTask = "create_and_run_task",
  CoreRunTask = "run_task",
  CoreGetTaskOutput = "get_task_output",
  CoreRunTest = "runTests",
  CoreRunSubagent = "runSubagent",
  CoreAskQuestions = "vscode_askQuestions",
  SwitchAgent = "switch_agent",
}

export enum ContributedToolName {
  ApplyPatch = "copilot_applyPatch",
  Codebase = "copilot_searchCodebase",
  SearchWorkspaceSymbols = "copilot_searchWorkspaceSymbols",
  VSCodeAPI = "copilot_getVSCodeAPI",
  TestFailure = "copilot_testFailure",
  FindFiles = "copilot_findFiles",
  FindTextInFiles = "copilot_findTextInFiles",
  ReadFile = "copilot_readFile",
  ListDirectory = "copilot_listDirectory",
  GetErrors = "copilot_getErrors",
  GetScmChanges = "copilot_getChangedFiles",
  ReadProjectStructure = "copilot_readProjectStructure",
  CreateNewWorkspace = "copilot_createNewWorkspace",
  CreateNewJupyterNotebook = "copilot_createNewJupyterNotebook",
  EditFile = "copilot_insertEdit",
  CreateFile = "copilot_createFile",
  ReplaceString = "copilot_replaceString",
  MultiReplaceString = "copilot_multiReplaceString",
  EditNotebook = "copilot_editNotebook",
  RunNotebookCell = "copilot_runNotebookCell",
  GetNotebookSummary = "copilot_getNotebookSummary",
  ReadCellOutput = "copilot_readNotebookCellOutput",
  InstallExtension = "copilot_installExtension",
  FetchWebPage = "copilot_fetchWebPage",
  Memory = "copilot_memory",
  FindTestFiles = "copilot_findTestFiles",
  GetProjectSetupInfo = "copilot_getProjectSetupInfo",
  SearchViewResults = "copilot_getSearchResults",
  GithubRepo = "copilot_githubRepo",
  CreateAndRunTask = "copilot_createAndRunTask",
  IntegratedBrowser = "copilot_openIntegratedBrowser",
  CreateDirectory = "copilot_createDirectory",
  RunVscodeCmd = "copilot_runVscodeCommand",
  SwitchAgent = "copilot_switchAgent",
}

// ─── Tool categories ──────────────────────────────────────────────────────────

export enum ToolCategory {
  JupyterNotebook = "Jupyter Notebook Tools",
  WebInteraction = "Web Interaction",
  VSCodeInteraction = "VS Code Interaction",
  Testing = "Testing",
  RedundantButSpecific = "Redundant but Specific",
  Core = "Core",
}

// ─── JSON Schema type ─────────────────────────────────────────────────────────

interface JSONSchemaProperty {
  type: string;
  description?: string;
  items?: { type: string; enum?: string[] };
  enum?: string[];
}

interface JSONSchema {
  type?: string;
  properties?: Record<string, JSONSchemaProperty>;
  required?: string[];
}

// ─── Tool definition ──────────────────────────────────────────────────────────

export interface ToolDefinition {
  name: string;
  contributedName: string;
  toolReferenceName?: string;
  displayName: string;
  userDescription: string;
  modelDescription: string;
  inputSchema: JSONSchema;
  category: ToolCategory;
  tags?: string[];
}

// ─── All tool definitions (from contributes.languageModelTools in package.json) ──

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: ToolName.Codebase,
    contributedName: ContributedToolName.Codebase,
    toolReferenceName: "codebase",
    displayName: "Codebase",
    userDescription: "Find relevant file chunks, symbols, and other information via semantic search",
    modelDescription:
      "Run a natural language search for relevant code or documentation comments from the user's current workspace. Returns relevant code snippets from the user's current workspace if it is large, or the full contents of the workspace if it is small.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "The query to search the codebase for. Should contain all relevant context. Should ideally be text that might appear in the codebase, such as function names, variable names, or comments.",
        },
      },
      required: ["query"],
    },
    category: ToolCategory.Core,
    tags: ["codesearch", "vscode_codesearch"],
  },
  {
    name: ToolName.SearchWorkspaceSymbols,
    contributedName: ContributedToolName.SearchWorkspaceSymbols,
    toolReferenceName: "symbols",
    displayName: "Workspace Symbols",
    userDescription: "Search for workspace symbols using language services.",
    modelDescription:
      "Search the user's workspace for code symbols using language services. Useful for finding class definitions, function signatures, and other named code elements with precise identifiers.",
    inputSchema: {
      type: "object",
      properties: {
        symbolName: { type: "string", description: "The name of the symbol to search for." },
      },
      required: ["symbolName"],
    },
    category: ToolCategory.VSCodeInteraction,
    tags: ["vscode_codesearch"],
  },
  {
    name: ToolName.VSCodeAPI,
    contributedName: ContributedToolName.VSCodeAPI,
    toolReferenceName: "vscodeAPI",
    displayName: "Get VS Code API References",
    userDescription: "Use VS Code API references to answer questions about VS Code extension development.",
    modelDescription:
      "Get comprehensive VS Code API documentation and references for extension development. This tool provides authoritative documentation for VS Code's extensive API surface, including proposed APIs, contribution points, and best practices.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The query to search vscode documentation for. Should contain all relevant context.",
        },
      },
      required: ["query"],
    },
    category: ToolCategory.VSCodeInteraction,
    tags: [],
  },
  {
    name: ToolName.FindFiles,
    contributedName: ContributedToolName.FindFiles,
    toolReferenceName: "fileSearch",
    displayName: "Find Files",
    userDescription: "Find files by name using a glob pattern",
    modelDescription:
      "Search for files in the workspace by glob pattern. This only returns the paths of matching files. Use this tool when you know the exact filename pattern of the files you're searching for.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search for files with names or paths matching this glob pattern." },
        maxResults: { type: "number", description: "The maximum number of results to return." },
      },
      required: ["query"],
    },
    category: ToolCategory.Core,
    tags: ["vscode_codesearch"],
  },
  {
    name: ToolName.FindTextInFiles,
    contributedName: ContributedToolName.FindTextInFiles,
    toolReferenceName: "textSearch",
    displayName: "Find Text In Files",
    userDescription: "Search for text in files by regular expression",
    modelDescription:
      "Do a fast text search in the workspace. Use this tool when you want to search with an exact string or regex. Use includePattern to search within files matching a specific pattern. Use isRegexp to enable regular expression matching.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "The pattern to search for in files in the workspace." },
        isRegexp: { type: "boolean", description: "Whether the pattern is a regex." },
        includePattern: {
          type: "string",
          description:
            "Search files matching this glob pattern. Will be applied to the relative path of files within the workspace.",
        },
        maxResults: { type: "number", description: "The maximum number of results to return." },
        includeIgnoredFiles: {
          type: "boolean",
          description: "Whether to include files that would normally be ignored.",
        },
      },
      required: ["query", "isRegexp"],
    },
    category: ToolCategory.Core,
    tags: ["vscode_codesearch"],
  },
  {
    name: ToolName.ApplyPatch,
    contributedName: ContributedToolName.ApplyPatch,
    toolReferenceName: "applyPatch",
    displayName: "Apply Patch",
    userDescription: "Edit text files in the workspace",
    modelDescription:
      "Edit text files. Do not use this tool to edit Jupyter notebooks. `apply_patch` allows you to execute a diff/patch against a text file to make targeted edits.",
    inputSchema: {
      type: "object",
      properties: {
        input: { type: "string", description: "The patch in unified diff format to apply to the file." },
        explanation: { type: "string", description: "A brief explanation of what the patch does." },
      },
      required: ["input", "explanation"],
    },
    category: ToolCategory.Core,
    tags: [],
  },
  {
    name: ToolName.ReadFile,
    contributedName: ContributedToolName.ReadFile,
    toolReferenceName: "readFile",
    displayName: "Read File",
    userDescription: "Read the contents of a file",
    modelDescription:
      "Read the contents of a file.\n\nYou must specify the line range you're interested in. Line numbers are 1-indexed. If the file contents returned are insufficient for your task, you may call this tool again to retrieve more content. Prefer reading larger ranges over doing many small reads.",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "The absolute path of the file to read." },
        startLine: { type: "number", description: "The line number to start reading from, 1-based." },
        endLine: { type: "number", description: "The inclusive line number to end reading at, 1-based." },
      },
      required: ["filePath", "startLine", "endLine"],
    },
    category: ToolCategory.Core,
    tags: ["vscode_codesearch"],
  },
  {
    name: ToolName.ListDirectory,
    contributedName: ContributedToolName.ListDirectory,
    toolReferenceName: "listDirectory",
    displayName: "List Dir",
    userDescription: "List the contents of a directory",
    modelDescription:
      "List the contents of a directory. Result will have the name of the child. If the name ends in /, it's a folder, otherwise a file",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "The absolute path to the directory to list." },
      },
      required: ["path"],
    },
    category: ToolCategory.Core,
    tags: ["vscode_codesearch"],
  },
  {
    name: ToolName.GetErrors,
    contributedName: ContributedToolName.GetErrors,
    toolReferenceName: "problems",
    displayName: "Get Problems",
    userDescription: "Check errors for a particular file",
    modelDescription:
      "Get any compile or lint errors in a specific file or across all files. If the user mentions errors or problems in a file, they may be referring to these. Use the tool to see the same errors that the user is seeing.",
    inputSchema: {
      type: "object",
      properties: {
        filePaths: {
          type: "array",
          description: "The absolute paths to the files or folders to check for errors.",
          items: { type: "string" },
        },
      },
    },
    category: ToolCategory.VSCodeInteraction,
    tags: [],
  },
  {
    name: ToolName.ReadProjectStructure,
    contributedName: ContributedToolName.ReadProjectStructure,
    displayName: "Project Structure",
    userDescription: "Get a file tree representation of the workspace",
    modelDescription: "Get a file tree representation of the workspace.",
    inputSchema: {},
    category: ToolCategory.Core,
    tags: [],
  },
  {
    name: ToolName.GetScmChanges,
    contributedName: ContributedToolName.GetScmChanges,
    toolReferenceName: "changes",
    displayName: "Git Changes",
    userDescription: "Get diffs of changed files",
    modelDescription:
      "Get git diffs of current file changes in a git repository. Don't forget that you can use run_in_terminal to run git commands in a terminal as well.",
    inputSchema: {
      type: "object",
      properties: {
        repositoryPath: {
          type: "string",
          description: "The absolute path to the git repository. If not provided, the active git repository will be used.",
        },
        sourceControlState: {
          type: "array",
          description: "The kinds of git state to filter by.",
          items: {
            type: "string",
            enum: ["staged", "unstaged", "merge-conflicts"],
          },
        },
      },
    },
    category: ToolCategory.VSCodeInteraction,
    tags: ["vscode_codesearch"],
  },
  {
    name: ToolName.TestFailure,
    contributedName: ContributedToolName.TestFailure,
    toolReferenceName: "testFailure",
    displayName: "Test Failure",
    userDescription: "Include information about the last unit test failure",
    modelDescription: "Includes test failure information in the prompt.",
    inputSchema: {},
    category: ToolCategory.Testing,
    tags: ["vscode_editing_with_tests"],
  },
  {
    name: ToolName.CreateNewWorkspace,
    contributedName: ContributedToolName.CreateNewWorkspace,
    toolReferenceName: "newWorkspace",
    displayName: "Create New Workspace",
    userDescription: "Scaffold a new workspace in VS Code",
    modelDescription:
      "Get comprehensive setup steps to help the user create complete project structures in a VS Code workspace. This tool is designed for full project initialization and scaffolding, not for creating individual files.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "A clear and concise description of the workspace the user wants to create.",
        },
      },
      required: ["query"],
    },
    category: ToolCategory.VSCodeInteraction,
    tags: [],
  },
  {
    name: ToolName.CreateNewJupyterNotebook,
    contributedName: ContributedToolName.CreateNewJupyterNotebook,
    displayName: "Create New Jupyter Notebook",
    userDescription: "Create a new Jupyter Notebook",
    modelDescription:
      "Generates a new Jupyter Notebook (.ipynb) in VS Code. Prefer creating plain Python files unless a user explicitly requests a new Jupyter Notebook.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "A clear and concise description of the notebook to create." },
      },
      required: ["query"],
    },
    category: ToolCategory.JupyterNotebook,
    tags: [],
  },
  {
    name: ToolName.EditFile,
    contributedName: ContributedToolName.EditFile,
    toolReferenceName: "applyPatch",
    displayName: "Edit File",
    userDescription: "Edit a file in the workspace",
    modelDescription:
      "This is a tool for making edits in an existing file in the workspace. For larger edits, split them into smaller edits and call the edit tool multiple times. Before editing, always ensure you have the context to understand the file's contents.",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "An absolute path to the file to edit." },
        oldString: {
          type: "string",
          description:
            "The exact literal text to replace. Include at least 3 lines of context before and after the target text.",
        },
        newString: { type: "string", description: "The exact literal text to replace oldString with." },
      },
      required: ["filePath", "oldString", "newString"],
    },
    category: ToolCategory.Core,
    tags: [],
  },
  {
    name: ToolName.CreateFile,
    contributedName: ContributedToolName.CreateFile,
    displayName: "Create File",
    userDescription: "Create new files",
    modelDescription:
      "This is a tool for creating a new file in the workspace. The file will be created with the specified content. The directory will be created if it does not already exist. Never use this tool to edit a file that already exists.",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "The absolute path to the file to create." },
        content: { type: "string", description: "The content to write to the file." },
      },
      required: ["filePath", "content"],
    },
    category: ToolCategory.Core,
    tags: [],
  },
  {
    name: ToolName.ReplaceString,
    contributedName: ContributedToolName.ReplaceString,
    displayName: "Replace String in File",
    userDescription: "Replace a string in a file",
    modelDescription:
      "This is a tool for editing an existing file in the workspace. Provide oldString (the exact literal text to replace including all whitespace) and newString (the exact literal text to replace it with). Each use of this tool replaces exactly ONE occurrence of oldString.",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "An absolute path to the file to edit." },
        oldString: {
          type: "string",
          description: "The exact literal text to replace. Include at least 3 lines of context before and after.",
        },
        newString: { type: "string", description: "The exact literal text to replace oldString with." },
      },
      required: ["filePath", "oldString", "newString"],
    },
    category: ToolCategory.Core,
    tags: [],
  },
  {
    name: ToolName.MultiReplaceString,
    contributedName: ContributedToolName.MultiReplaceString,
    displayName: "Multi-Replace String in Files",
    userDescription: "Apply multiple replacements in one call",
    modelDescription:
      "This is a tool for applying multiple replace_string_in_file operations in a single call, which is more efficient than calling replace_string_in_file multiple times. It takes an array of replacement operations and applies them sequentially.",
    inputSchema: {
      type: "object",
      properties: {
        explanation: { type: "string", description: "A brief explanation of what the multi-replace will accomplish." },
        replacements: {
          type: "array",
          description: "Array of replacement operations to apply sequentially.",
          items: { type: "string" },
        },
      },
      required: ["explanation", "replacements"],
    },
    category: ToolCategory.Core,
    tags: [],
  },
  {
    name: ToolName.EditNotebook,
    contributedName: ContributedToolName.EditNotebook,
    displayName: "Edit Notebook",
    userDescription: "Edit a notebook file in the workspace",
    modelDescription:
      "This is a tool for editing an existing Notebook file in the workspace. The system is very smart and can understand how to apply your edits to the notebooks.",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "An absolute path to the notebook file to edit." },
        cellId: { type: "string", description: "Id of the cell that needs to be deleted or edited." },
        editType: {
          type: "string",
          description: "The operation performed on the cell.",
          enum: ["insert", "delete", "edit"],
        },
        language: { type: "string", description: "The language of the cell." },
        newCode: { type: "string", description: "The code for the new or existing cell to be edited." },
      },
      required: ["filePath", "editType", "cellId"],
    },
    category: ToolCategory.JupyterNotebook,
    tags: [],
  },
  {
    name: ToolName.RunNotebookCell,
    contributedName: ContributedToolName.RunNotebookCell,
    displayName: "Run Notebook Cell",
    userDescription: "Trigger the execution of a cell in a notebook file",
    modelDescription:
      "This is a tool for running a code cell in a notebook file directly in the notebook editor. The output from the execution will be returned.",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "An absolute path to the notebook file with the cell to run." },
        cellId: { type: "string", description: "The ID for the code cell to execute." },
        continueOnError: {
          type: "boolean",
          description: "Whether or not execution should continue for remaining cells if an error is encountered.",
        },
        reason: { type: "string", description: "An optional explanation of why the cell is being run." },
      },
      required: ["filePath", "cellId"],
    },
    category: ToolCategory.JupyterNotebook,
    tags: [],
  },
  {
    name: ToolName.GetNotebookSummary,
    contributedName: ContributedToolName.GetNotebookSummary,
    displayName: "Get Notebook Cell Output",
    userDescription: "Read the output of a previously executed cell",
    modelDescription:
      "This tool returns the list of Notebook cells along with the id, cell types, line ranges, language, execution information and output mime types for each cell.",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "An absolute path to the notebook file." },
      },
      required: ["filePath"],
    },
    category: ToolCategory.JupyterNotebook,
    tags: [],
  },
  {
    name: ToolName.InstallExtension,
    contributedName: ContributedToolName.InstallExtension,
    toolReferenceName: "installExtension",
    displayName: "Install Extension in VS Code",
    userDescription: "Install an extension in VS Code",
    modelDescription:
      "Install an extension in VS Code. Use this tool to install an extension in Visual Studio Code as part of a new workspace creation process only.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "The ID of the extension to install (publisher.extension format)." },
        name: { type: "string", description: "The name of the extension to install." },
      },
      required: ["id", "name"],
    },
    category: ToolCategory.VSCodeInteraction,
    tags: [],
  },
  {
    name: ToolName.FetchWebPage,
    contributedName: ContributedToolName.FetchWebPage,
    displayName: "Fetch Web Page",
    userDescription: "Fetch the main content from a web page",
    modelDescription:
      "Fetches the main content from a web page. This tool is useful for summarizing or analyzing the content of a webpage. You should use this tool when you think the user is looking for information from a specific webpage.",
    inputSchema: {
      type: "object",
      properties: {
        urls: {
          type: "array",
          description: "An array of URLs to fetch content from.",
          items: { type: "string" },
        },
        query: {
          type: "string",
          description: "The query to search for in the web page's content.",
        },
      },
      required: ["urls", "query"],
    },
    category: ToolCategory.WebInteraction,
    tags: [],
  },
  {
    name: ToolName.Memory,
    contributedName: ContributedToolName.Memory,
    displayName: "Memory",
    userDescription: "Store facts about the codebase so they can be recalled in future conversations",
    modelDescription:
      "Store facts about the codebase so they can be recalled in future conversations. Use this tool to persist important information like architectural decisions, coding conventions, frequently used patterns, etc.",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", description: "The action to perform: 'store', 'recall', or 'list'.", enum: ["store", "recall", "list"] },
        content: { type: "string", description: "The content to store or the query to recall." },
        title: { type: "string", description: "A short title for the memory entry." },
      },
      required: ["action"],
    },
    category: ToolCategory.Core,
    tags: [],
  },
  {
    name: ToolName.FindTestFiles,
    contributedName: ContributedToolName.FindTestFiles,
    displayName: "Find Test Files",
    userDescription:
      "For a source code file, find the file that contains the tests. For a test file, find the file that contains the code under test",
    modelDescription:
      "For a source code file, find the file that contains the tests. For a test file, find the file that contains the code under test.",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "The absolute path to the source or test file." },
      },
      required: ["filePath"],
    },
    category: ToolCategory.Testing,
    tags: [],
  },
  {
    name: ToolName.GetProjectSetupInfo,
    contributedName: ContributedToolName.GetProjectSetupInfo,
    toolReferenceName: "getProjectSetupInfo",
    displayName: "Get Project Setup Info",
    userDescription: "Get project setup information for a specific project type",
    modelDescription:
      "Do not call this tool without first calling the tool to create a workspace. This tool provides a project setup information for a Visual Studio Code workspace based on a project type and programming language.",
    inputSchema: {
      type: "object",
      properties: {
        projectType: {
          type: "string",
          description:
            "The type of project to create. Supported values are: 'python-script', 'python-project', 'mcp-server', 'model-context-protocol-server', 'vscode-extension', 'next-js', 'vite' and 'other'",
        },
      },
      required: ["projectType"],
    },
    category: ToolCategory.VSCodeInteraction,
    tags: [],
  },
  {
    name: ToolName.SearchViewResults,
    contributedName: ContributedToolName.SearchViewResults,
    displayName: "Search View Results",
    userDescription: "Get the results of the search view",
    modelDescription: "The results from the search view",
    inputSchema: {},
    category: ToolCategory.VSCodeInteraction,
    tags: [],
  },
  {
    name: ToolName.GithubRepo,
    contributedName: ContributedToolName.GithubRepo,
    displayName: "Search GitHub Repository",
    userDescription: "Search a GitHub repository for relevant source code snippets. You can specify a repository using `owner/repo`",
    modelDescription:
      "Searches a GitHub repository for relevant source code snippets. Only use this tool if the user is very clearly asking for code snippets from a specific GitHub repository.",
    inputSchema: {
      type: "object",
      properties: {
        repo: {
          type: "string",
          description: "The name of the Github repository to search for code in, formatted as '<owner>/<repo>'.",
        },
        query: { type: "string", description: "The query to search for in the repo." },
      },
      required: ["repo", "query"],
    },
    category: ToolCategory.WebInteraction,
    tags: [],
  },
  {
    name: ToolName.IntegratedBrowser,
    contributedName: ContributedToolName.IntegratedBrowser,
    displayName: "Open Integrated Browser",
    userDescription: "Preview a locally hosted website in the Integrated Browser",
    modelDescription:
      "Preview a website or open a URL in the editor's Simple Browser. Useful for quickly viewing locally hosted websites, demos, or resources without leaving the coding environment.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "The website URL to preview. Must be either an http or https URL." },
      },
      required: ["url"],
    },
    category: ToolCategory.WebInteraction,
    tags: [],
  },
  {
    name: ToolName.CreateDirectory,
    contributedName: ContributedToolName.CreateDirectory,
    displayName: "Create Directory",
    userDescription: "Create new directories in your workspace",
    modelDescription:
      "Create a new directory structure in the workspace. Will recursively create all directories in the path, like mkdir -p.",
    inputSchema: {
      type: "object",
      properties: {
        dirPath: { type: "string", description: "The absolute path to the directory to create." },
      },
      required: ["dirPath"],
    },
    category: ToolCategory.Core,
    tags: [],
  },
  {
    name: ToolName.RunVscodeCmd,
    contributedName: ContributedToolName.RunVscodeCmd,
    toolReferenceName: "runCommand",
    displayName: "Run VS Code Command",
    userDescription: "Run a command in VS Code",
    modelDescription:
      "Run a command in VS Code. Use this tool to run a command in Visual Studio Code as part of a new workspace creation process only.",
    inputSchema: {
      type: "object",
      properties: {
        commandId: { type: "string", description: "The ID of the command to execute." },
        name: { type: "string", description: "The name of the command." },
        args: { type: "array", description: "The arguments to pass to the command.", items: { type: "string" } },
      },
      required: ["commandId", "name"],
    },
    category: ToolCategory.VSCodeInteraction,
    tags: [],
  },
  {
    name: ToolName.CoreManageTodoList,
    contributedName: "manage_todo_list" as ContributedToolName,
    displayName: "Manage Todo List",
    userDescription: "Manage a structured todo list to track progress",
    modelDescription:
      "Manage a structured todo list to track progress and plan tasks throughout your coding session. Use this tool VERY frequently to ensure task visibility and proper planning.",
    inputSchema: {
      type: "object",
      properties: {
        todoList: {
          type: "array",
          description: "Complete array of all todo items.",
          items: { type: "string" },
        },
      },
      required: ["todoList"],
    },
    category: ToolCategory.Core,
    tags: [],
  },
  {
    name: ToolName.CoreRunInTerminal,
    contributedName: "run_in_terminal" as ContributedToolName,
    displayName: "Run in Terminal",
    userDescription: "Run a command in the terminal",
    modelDescription:
      "Executes a shell command in a persistent terminal session. Use isBackground=true for long-running processes like servers.",
    inputSchema: {
      type: "object",
      properties: {
        command: { type: "string", description: "The command to run in the terminal." },
        explanation: { type: "string", description: "A one-sentence description of what the command does." },
        goal: { type: "string", description: "A short description of the goal or purpose of the command." },
        isBackground: { type: "boolean", description: "Whether the command starts a background process." },
        timeout: { type: "number", description: "An optional timeout in milliseconds." },
      },
      required: ["command", "explanation", "goal", "isBackground"],
    },
    category: ToolCategory.Core,
    tags: [],
  },
  {
    name: ToolName.CoreGetTerminalOutput,
    contributedName: "get_terminal_output" as ContributedToolName,
    displayName: "Get Task Output",
    userDescription: "Get the output of a background terminal command",
    modelDescription: "Get the output of a terminal command previously started with run_in_terminal.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "The ID of the terminal to check." },
      },
      required: ["id"],
    },
    category: ToolCategory.VSCodeInteraction,
    tags: [],
  },
  {
    name: ToolName.CoreCreateAndRunTask,
    contributedName: ContributedToolName.CreateAndRunTask,
    displayName: "Create and Run Task",
    userDescription: "Create and run a task in the workspace",
    modelDescription:
      "Creates and runs a build, run, or custom task for the workspace by generating or adding to a tasks.json file based on the project structure.",
    inputSchema: {
      type: "object",
      properties: {
        task: { type: "string", description: "The task configuration object." },
        workspaceFolder: { type: "string", description: "The absolute path of the workspace folder." },
      },
      required: ["task", "workspaceFolder"],
    },
    category: ToolCategory.VSCodeInteraction,
    tags: [],
  },
  {
    name: ToolName.SwitchAgent,
    contributedName: ContributedToolName.SwitchAgent,
    displayName: "Switch Agent",
    userDescription: "Switch to a different agent mode",
    modelDescription:
      "Switch to a different agent mode. Currently only the Plan agent is supported.",
    inputSchema: {
      type: "object",
      properties: {
        agent: { type: "string", description: "The agent to switch to.", enum: ["plan"] },
        reason: { type: "string", description: "The reason for switching agents." },
      },
      required: ["agent"],
    },
    category: ToolCategory.VSCodeInteraction,
    tags: [],
  },
  {
    name: ToolName.CoreRunSubagent,
    contributedName: "runSubagent" as ContributedToolName,
    displayName: "Run Subagent",
    userDescription: "Runs a task within an isolated subagent context",
    modelDescription:
      "Runs a task within an isolated subagent context. Enables efficient organization of tasks and context window management.",
    inputSchema: {
      type: "object",
      properties: {
        description: { type: "string", description: "A short (3-5 word) description of the task." },
        prompt: { type: "string", description: "A detailed description of the task for the agent to perform." },
      },
      required: ["prompt", "description"],
    },
    category: ToolCategory.Core,
    tags: [],
  },
];

// ─── Lookup helpers ────────────────────────────────────────────────────────────

/** Get a tool definition by its ToolName */
export function getToolByName(name: ToolName | string): ToolDefinition | undefined {
  return TOOL_DEFINITIONS.find((t) => t.name === name);
}

/** Get a tool definition by its ContributedToolName */
export function getToolByContributedName(name: string): ToolDefinition | undefined {
  return TOOL_DEFINITIONS.find((t) => t.contributedName === name);
}

/** Get all tools in a category */
export function getToolsByCategory(category: ToolCategory): ToolDefinition[] {
  return TOOL_DEFINITIONS.filter((t) => t.category === category);
}

/** Get core tools (always active in agent mode) */
export function getCoreTools(): ToolDefinition[] {
  return getToolsByCategory(ToolCategory.Core);
}

/** Display name lookup map (used in the UI) */
export const TOOL_DISPLAY_NAMES: Record<string, string> = Object.fromEntries(
  TOOL_DEFINITIONS.map((t) => [t.name, t.displayName])
);

/** Convert tool definitions to OpenAI-compatible function schemas.
 * GitHub Copilot's completions/responses API uses a flat structure:
 * { type, name, description, parameters } — NOT nested under "function".
 */
export function toOpenAITools(tools: ToolDefinition[]) {
  return tools
    .filter((tool) => typeof tool.name === 'string' && tool.name.trim().length > 0)
    .map((tool) => ({
      type: "function" as const,
      name: tool.name,
      description: tool.modelDescription,
      parameters: {
        type: "object" as const,
        properties: {},
        ...tool.inputSchema,
      },
    }));
}

/** Convert tool definitions to Anthropic-compatible tool schemas */
export function toAnthropicTools(tools: ToolDefinition[]) {
  return tools
    .filter((tool) => typeof tool.name === 'string' && tool.name.trim().length > 0)
    .map((tool) => ({
      name: tool.name,
      description: tool.modelDescription,
      // Anthropic requires input_schema to always have type: "object"
      input_schema: {
        type: "object" as const,
        properties: {},
        ...tool.inputSchema,
      },
    }));
}

/** Tool sets for different modes */
export const TOOL_SETS = {
  /** Read-only tools for Ask/Explain mode */
  read: [
    ToolName.Codebase,
    ToolName.ReadFile,
    ToolName.ListDirectory,
    ToolName.FindFiles,
    ToolName.FindTextInFiles,
    ToolName.SearchWorkspaceSymbols,
    ToolName.GetErrors,
    ToolName.GetScmChanges,
    ToolName.ReadProjectStructure,
    ToolName.FetchWebPage,
    ToolName.GithubRepo,
  ],
  /** Edit tools for Edit mode */
  edit: [
    ToolName.CreateFile,
    ToolName.ReplaceString,
    ToolName.MultiReplaceString,
    ToolName.CreateDirectory,
    ToolName.EditFile,
    ToolName.ApplyPatch,
  ],
  /** Full agent tools */
  agent: [
    ToolName.Codebase,
    ToolName.ReadFile,
    ToolName.ListDirectory,
    ToolName.FindFiles,
    ToolName.FindTextInFiles,
    ToolName.SearchWorkspaceSymbols,
    ToolName.GetErrors,
    ToolName.GetScmChanges,
    ToolName.ReadProjectStructure,
    ToolName.CreateFile,
    ToolName.ReplaceString,
    ToolName.MultiReplaceString,
    ToolName.CreateDirectory,
    ToolName.EditFile,
    ToolName.CoreRunInTerminal,
    ToolName.CoreGetTerminalOutput,
    ToolName.CoreManageTodoList,
    ToolName.FetchWebPage,
    ToolName.GithubRepo,
    ToolName.Memory,
    ToolName.CoreRunSubagent,
  ],
  /** Jupyter notebook tools */
  jupyter: [
    ToolName.CreateNewJupyterNotebook,
    ToolName.EditNotebook,
    ToolName.RunNotebookCell,
    ToolName.GetNotebookSummary,
  ],
  /** Web tools */
  web: [ToolName.FetchWebPage, ToolName.IntegratedBrowser, ToolName.GithubRepo],
  /** VS Code interaction tools */
  vscode: [
    ToolName.VSCodeAPI,
    ToolName.GetErrors,
    ToolName.GetScmChanges,
    ToolName.SearchWorkspaceSymbols,
    ToolName.InstallExtension,
    ToolName.RunVscodeCmd,
    ToolName.CoreCreateAndRunTask,
    ToolName.SearchViewResults,
  ],
};
