# 13 — Data Schema & State Management Specification

## 1. State Architecture: Persistent vs Ephemeral

JAGGU strictly bifurcates state into two categories:
1. **Persistent State**: Stored on disk in `.vscode/jaggu/` or VS Code's global storage directory. Survives editor restarts. Includes conversation logs, user configuration, task audit logs, and approval preferences.
2. **Ephemeral Runtime State**: Maintained exclusively in memory within active Node.js processes. Reset upon session restart. Includes active AST symbol caches, shadow buffer file edits, in-flight cancellation tokens, and live terminal process handles.

---

## 2. Complete Entity Schemas (TypeScript & JSON)

```typescript
// ==========================================
// 1. USER SETTINGS & WORKSPACE CONFIGURATION
// ==========================================
export interface UserSettings {
  defaultProvider: 'anthropic' | 'openai' | 'gemini' | 'ollama';
  modelOverrides: {
    chatModel?: string;
    planningModel?: string;
    fastModel?: string;
  };
  autoApproveSafeOperations: boolean;      // Default: true
  autoApproveModerateOperations: boolean;  // Default: false
  maxAgentIterations: number;              // Default: 20
  terminalExecutionTimeoutSeconds: number; // Default: 60
  enablePromptCaching: boolean;            // Default: true
  telemetryEnabled: boolean;               // Default: false
}

export interface WorkspaceConfig {
  workspaceId: string;
  rootPath: string;
  projectName: string;
  customIgnorePatterns: string[];
  testRunnerCommand?: string;
  buildCommand?: string;
  environmentVariables: Record<string, string>;
}

// ==========================================
// 2. CONVERSATION & MESSAGE ENTITIES
// ==========================================
export interface Conversation {
  id: string; // UUID v4
  workspaceId: string;
  createdAt: number; // Unix timestamp ms
  updatedAt: number;
  title: string;
  status: 'active' | 'archived' | 'completed';
  activeTaskId?: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  createdAt: number;
  metadata?: {
    modelUsed?: string;
    tokensConsumed?: number;
    toolCallIds?: string[];
    contextSnippetIds?: string[];
  };
}

// ==========================================
// 3. TASK & PLAN ENTITIES
// ==========================================
export interface Task {
  id: string;
  conversationId: string;
  intent: string;
  taskType: 'EXPLORE' | 'MUTATE' | 'DEBUG' | 'REFACTOR' | 'TEST';
  state: AgentState;
  createdAt: number;
  completedAt?: number;
  activePlanId?: string;
  error?: string;
}

export interface Plan {
  id: string;
  taskId: string;
  title: string;
  createdAt: number;
  approvedByDeveloper: boolean;
  approvedAt?: number;
  steps: PlanStep[];
}

export interface PlanStep {
  stepIndex: number;
  description: string;
  targetFiles: string[];
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
  toolCalls: string[]; // ToolCall IDs
}

// ==========================================
// 4. TOOL CALLS & TOOL RESULTS
// ==========================================
export interface ToolCall {
  id: string;
  taskId: string;
  stepIndex?: number;
  toolName: string;
  arguments: Record<string, unknown>;
  permissionTier: 'SAFE' | 'MODERATE' | 'HIGH_RISK';
  approvalStatus: 'NOT_REQUIRED' | 'PENDING' | 'APPROVED' | 'REJECTED';
  startedAt: number;
  completedAt?: number;
  status: 'PENDING' | 'EXECUTING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  result?: ToolResult;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  executionDurationMs: number;
  outputTruncated: boolean;
}

// ==========================================
// 5. FILE CHANGES & DIFF ENGINE STATE
// ==========================================
export interface FileChange {
  id: string;
  taskId: string;
  filePath: string;
  changeType: 'CREATE' | 'MODIFY' | 'DELETE';
  originalContent: string;
  stagedContent: string;
  stagedAt: number;
  committedToDisk: boolean;
  hunks: DiffHunk[];
}

export interface DiffHunk {
  hunkId: string;
  oldStartLine: number;
  oldLineCount: number;
  newStartLine: number;
  newLineCount: number;
  patchHeader: string;
  lines: string[];
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
}

// ==========================================
// 6. APPROVALS & RUNTIME EXECUTIONS
// ==========================================
export interface ApprovalRequest {
  id: string;
  taskId: string;
  operationType: 'PLAN' | 'FILE_WRITE' | 'FILE_DELETE' | 'COMMAND_EXECUTION';
  description: string;
  riskTier: 'MODERATE' | 'HIGH_RISK';
  payload: Record<string, unknown>;
  requestedAt: number;
  respondedAt?: number;
  decision?: 'APPROVED' | 'REJECTED' | 'MODIFIED';
  developerNote?: string;
}

export interface TerminalExecution {
  id: string;
  toolCallId: string;
  command: string;
  cwd: string;
  startedAt: number;
  completedAt?: number;
  exitCode?: number;
  stdoutSnippet: string;
  stderrSnippet: string;
  timedOut: boolean;
}

// ==========================================
// 7. MODEL USAGE & TELEMETRY
// ==========================================
export interface ModelUsage {
  id: string;
  taskId: string;
  model: string;
  provider: string;
  promptTokens: number;
  completionTokens: number;
  cachedTokens?: number;
  estimatedCostUsd: number;
  latencyMs: number;
  timestamp: number;
}
```

---

## 3. Storage Layout on Disk

Persistent files are organized cleanly in the workspace `.vscode/jaggu/` directory (automatically added to `.gitignore`):

```
.vscode/jaggu/
├── config.json               # WorkspaceConfig overrides
├── sessions/
│   ├── sess_9a8b7c6d.json    # Conversation, Messages & Tasks
│   └── sess_1f2e3d4c.json
├── snapshots/
│   ├── snap_checkpoint_01/   # Pre-task backup copies of modified files
│   └── snap_checkpoint_02/
└── audit.log                 # Append-only security audit log of commands executed
```
