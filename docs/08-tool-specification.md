# 08 — Standardized Tool Specification

## 1. Overview & Schema Architecture

All ForgeAI tools follow an invariant interface contract. Tools are strictly defined using TypeScript types and validated at runtime using **Zod schemas**. The agent receives tool definitions formatted as standard JSON Schemas conforming to OpenAI and Anthropic function-calling conventions.

### 1.1 Base Tool Interface
```typescript
export type PermissionTier = 'SAFE' | 'MODERATE' | 'HIGH_RISK';

export interface ITool<TInput, TOutput> {
  readonly name: string;
  readonly description: string;
  readonly permissionTier: PermissionTier;
  readonly timeoutMs: number;
  
  validateArgs(args: unknown): TInput;
  execute(args: TInput, context: IToolExecutionContext): Promise<TOutput>;
  cancel?(): Promise<void>;
}

export interface IToolResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  executionTimeMs: number;
}
```

---

## 2. Comprehensive Tool Catalog

### 2.1 `read_file`
- **Purpose**: Reads content of a workspace file with line-range slicing.
- **Permission**: `SAFE` (Auto-execute).
- **Timeout**: 5,000ms.
- **Input Schema**:
  ```json
  {
    "type": "object",
    "properties": {
      "path": { "type": "string", "description": "Workspace-relative or absolute file path" },
      "startLine": { "type": "integer", "description": "1-based starting line number (optional)" },
      "endLine": { "type": "integer", "description": "1-based ending line number (optional)" }
    },
    "required": ["path"]
  }
  ```
- **Output Schema**: `{ "path": string, "content": string, "totalLines": number, "truncated": boolean }`
- **Failure Modes**: `FILE_NOT_FOUND`, `BINARY_FILE_REJECTED`, `ACCESS_DENIED`, `PATH_TRAVERSAL_DETECTED`.

### 2.2 `write_file`
- **Purpose**: Writes or completely overwrites content of an existing file via shadow staging.
- **Permission**: `MODERATE` (Configurable auto or confirm).
- **Timeout**: 10,000ms.
- **Input Schema**:
  ```json
  {
    "type": "object",
    "properties": {
      "path": { "type": "string", "description": "Workspace-relative file path" },
      "content": { "type": "string", "description": "New complete file content" }
    },
    "required": ["path", "content"]
  }
  ```
- **Output Schema**: `{ "path": string, "linesChanged": number, "diffSummary": string, "staged": boolean }`
- **Failure Modes**: `READ_ONLY_FILE`, `DIRECTORY_NOT_FOUND`, `DISK_FULL`.

### 2.3 `create_file`
- **Purpose**: Creates a new file at specified path, ensuring parent directories exist.
- **Permission**: `MODERATE`.
- **Timeout**: 5,000ms.
- **Input Schema**:
  ```json
  {
    "type": "object",
    "properties": {
      "path": { "type": "string", "description": "Workspace-relative path for new file" },
      "initialContent": { "type": "string", "description": "Initial text content (optional, default empty)" }
    },
    "required": ["path"]
  }
  ```
- **Output Schema**: `{ "path": string, "created": boolean }`
- **Failure Modes**: `FILE_ALREADY_EXISTS`, `INVALID_PATH_CHARACTERS`.

### 2.4 `delete_file`
- **Purpose**: Deletes a file from the workspace.
- **Permission**: `HIGH_RISK` (Mandatory human confirmation).
- **Timeout**: 5,000ms.
- **Input Schema**:
  ```json
  {
    "type": "object",
    "properties": {
      "path": { "type": "string", "description": "Workspace-relative path of file to delete" },
      "reason": { "type": "string", "description": "Explicit architectural justification for deletion" }
    },
    "required": ["path", "reason"]
  }
  ```
- **Output Schema**: `{ "path": string, "deleted": boolean, "backupSnapshotId": string }`
- **Failure Modes**: `FILE_NOT_FOUND`, `USER_REJECTED_DELETION`.

### 2.5 `apply_patch`
- **Purpose**: Applies a targeted hunk or line-level edit without overwriting the entire file.
- **Permission**: `MODERATE`.
- **Timeout**: 10,000ms.
- **Input Schema**:
  ```json
  {
    "type": "object",
    "properties": {
      "path": { "type": "string", "description": "Target file path" },
      "targetContent": { "type": "string", "description": "Exact text chunk to locate and replace" },
      "replacementContent": { "type": "string", "description": "New replacement text" }
    },
    "required": ["path", "targetContent", "replacementContent"]
  }
  ```
- **Output Schema**: `{ "path": string, "applied": boolean, "matchedLines": [number, number] }`
- **Failure Modes**: `TARGET_NOT_FOUND`, `AMBIGUOUS_MULTIPLE_MATCHES`.

### 2.6 `create_directory`
- **Purpose**: Creates a directory and any missing parent folders.
- **Permission**: `SAFE`.
- **Timeout**: 5,000ms.
- **Input Schema**:
  ```json
  {
    "type": "object",
    "properties": {
      "path": { "type": "string", "description": "Directory path to create" }
    },
    "required": ["path"]
  }
  ```
- **Output Schema**: `{ "path": string, "created": boolean }`

### 2.7 `list_directory`
- **Purpose**: Lists files and subdirectories within a directory path.
- **Permission**: `SAFE`.
- **Timeout**: 5,000ms.
- **Input Schema**:
  ```json
  {
    "type": "object",
    "properties": {
      "path": { "type": "string", "description": "Directory path (default root)" },
      "recursive": { "type": "boolean", "description": "Whether to recurse into subdirectories" },
      "maxDepth": { "type": "integer", "description": "Maximum depth if recursive (default 2)" }
    }
  }
  ```
- **Output Schema**: `{ "entries": Array<{ "name": string, "type": "file" | "directory", "size": number }> }`

### 2.8 `search_files`
- **Purpose**: Fuzzy searches workspace file names matching glob or pattern.
- **Permission**: `SAFE`.
- **Timeout**: 5,000ms.
- **Input Schema**:
  ```json
  {
    "type": "object",
    "properties": {
      "pattern": { "type": "string", "description": "Glob pattern (e.g., **/*.test.ts or *auth*)" },
      "limit": { "type": "integer", "description": "Max files to return (default 50)" }
    },
    "required": ["pattern"]
  }
  ```
- **Output Schema**: `{ "matches": string[], "total": number }`

### 2.9 `search_code`
- **Purpose**: Blazing-fast regex/text search across all workspace files via ripgrep.
- **Permission**: `SAFE`.
- **Timeout**: 10,000ms.
- **Input Schema**:
  ```json
  {
    "type": "object",
    "properties": {
      "query": { "type": "string", "description": "Text or regex search query" },
      "isRegex": { "type": "boolean", "description": "Whether query is a regular expression" },
      "caseSensitive": { "type": "boolean", "description": "Case-sensitive search (default false)" },
      "includeGlob": { "type": "string", "description": "Filter paths (e.g. src/**/*.ts)" },
      "maxResults": { "type": "integer", "description": "Maximum matches to return (default 30)" }
    },
    "required": ["query"]
  }
  ```
- **Output Schema**: `{ "matches": Array<{ "file": string, "line": number, "content": string }> }`

### 2.10 `find_symbol`
- **Purpose**: Locates symbol declarations (functions, classes, interfaces) via VS Code LSP.
- **Permission**: `SAFE`.
- **Timeout**: 5,000ms.
- **Input Schema**:
  ```json
  {
    "type": "object",
    "properties": {
      "symbolName": { "type": "string", "description": "Name of function, class, or type to locate" }
    },
    "required": ["symbolName"]
  }
  ```
- **Output Schema**: `{ "symbols": Array<{ "name": string, "kind": string, "file": string, "range": { "start": number, "end": number } }> }`

### 2.11 `run_command`
- **Purpose**: Runs an arbitrary shell command in a managed pseudo-terminal process.
- **Permission**: `MODERATE` for allowlisted prefixes (`npm test`, `npm run build`, `cargo test`); `HIGH_RISK` for arbitrary commands.
- **Timeout**: 120,000ms.
- **Input Schema**:
  ```json
  {
    "type": "object",
    "properties": {
      "command": { "type": "string", "description": "Shell command line string to execute" },
      "cwd": { "type": "string", "description": "Working directory (relative or absolute)" },
      "timeoutSeconds": { "type": "integer", "description": "Execution timeout (default 60)" }
    },
    "required": ["command"]
  }
  ```
- **Output Schema**: `{ "exitCode": number, "stdout": string, "stderr": string, "timedOut": boolean }`
- **Failure Modes**: `COMMAND_FAILED`, `TIMEOUT_EXCEEDED`, `BLOCKED_BY_POLICY`.

### 2.12 `run_tests`
- **Purpose**: Automatically discovers and invokes the project's primary test runner.
- **Permission**: `SAFE` or `MODERATE` (Allowlisted).
- **Timeout**: 180,000ms.
- **Input Schema**:
  ```json
  {
    "type": "object",
    "properties": {
      "testPath": { "type": "string", "description": "Specific test file or suite (optional)" },
      "filter": { "type": "string", "description": "Test name pattern filter (optional)" }
    }
  }
  ```
- **Output Schema**: `{ "passed": boolean, "totalTests": number, "passedCount": number, "failedCount": number, "failures": Array<{ "testName": string, "error": string, "file": string, "line": number }> }`

### 2.13 `get_git_status`
- **Purpose**: Returns current working tree status (untracked, modified, staged files).
- **Permission**: `SAFE`.
- **Timeout**: 5,000ms.
- **Input Schema**: `{ "type": "object", "properties": {} }`
- **Output Schema**: `{ "branch": string, "clean": boolean, "modified": string[], "untracked": string[], "staged": string[] }`

### 2.14 `get_git_diff`
- **Purpose**: Retrieves unified diff against HEAD or staged index.
- **Permission**: `SAFE`.
- **Timeout**: 5,000ms.
- **Input Schema**:
  ```json
  {
    "type": "object",
    "properties": {
      "file": { "type": "string", "description": "Specific file to diff (optional, default all)" }
    }
  }
  ```
- **Output Schema**: `{ "diff": string, "filesChanged": number, "insertions": number, "deletions": number }`
