# 14 — Internal API Contracts & IPC Protocols

## 1. Boundary Architecture

Communication between the JAGGU UI (Webview), Extension Host Controller, Agent Orchestrator, Context Engine, Model Gateway, and Tool Runtime is enforced via typed asynchronous message interfaces:

```
[UI Layer (Webview)]
        ↕ postMessage (WebviewRPCProtocol)
[Extension Host Controller (`packages/jaggu-vscode`)]
        ↕ Direct Asynchronous In-Memory Invocations (Node.js)
[Agent Orchestrator (`packages/jaggu-core/agent`)]
   ├── ↕ IContextEngine
   ├── ↕ IModelGateway
   └── ↕ IToolRuntime
```

---

## 2. Webview RPC Protocol (UI ↔ Extension Host)

Messages between the React Webview and VS Code Extension Host are strongly typed:

```typescript
export type WebviewToExtensionMessage =
  | { type: 'SUBMIT_PROMPT'; payload: { prompt: string; attachedFiles?: string[] } }
  | { type: 'CANCEL_ACTIVE_TASK'; payload: { taskId: string } }
  | { type: 'APPROVE_PLAN'; payload: { planId: string } }
  | { type: 'MODIFY_PLAN'; payload: { planId: string; modifiedSteps: string[] } }
  | { type: 'ACCEPT_DIFF_HUNK'; payload: { filePath: string; hunkId: string } }
  | { type: 'REJECT_DIFF_HUNK'; payload: { filePath: string; hunkId: string } }
  | { type: 'ACCEPT_ALL_DIFFS'; payload: { taskId: string } }
  | { type: 'REJECT_ALL_DIFFS'; payload: { taskId: string } }
  | { type: 'RESOLVE_APPROVAL'; payload: { approvalId: string; decision: 'APPROVED' | 'REJECTED' } }
  | { type: 'UPDATE_SETTINGS'; payload: Partial<UserSettings> }
  | { type: 'CLEAR_SESSION'; payload: {} };

export type ExtensionToWebviewMessage =
  | { type: 'AGENT_STATE_CHANGED'; payload: { state: AgentState; detail?: string } }
  | { type: 'TOKEN_STREAM_CHUNK'; payload: { text: string } }
  | { type: 'PLAN_GENERATED'; payload: Plan }
  | { type: 'PLAN_STEP_UPDATED'; payload: { stepIndex: number; status: PlanStep['status'] } }
  | { type: 'DIFF_STAGED'; payload: { fileChanges: FileChange[] } }
  | { type: 'TERMINAL_OUTPUT_CHUNK'; payload: { commandId: string; line: string } }
  | { type: 'APPROVAL_REQUESTED'; payload: ApprovalRequest }
  | { type: 'TASK_COMPLETED'; payload: { summary: string; executionTimeMs: number; tokensUsed: number } }
  | { type: 'TASK_ERROR'; payload: { error: string; recoverable: boolean } };
```

---

## 3. Agent Orchestrator ↔ Subsystem Contracts

### 3.1 `IContextEngine` Contract
```typescript
export interface ContextQuery {
  prompt: string;
  activeFilePath?: string;
  activeSelection?: string;
  maxTokens?: number;
}

export interface AssembledContext {
  files: Array<{ path: string; content: string; tier: number }>;
  symbols: Array<{ name: string; definition: string }>;
  diagnostics: Array<{ file: string; message: string; line: number }>;
  totalTokens: number;
}

export interface IContextEngine {
  gatherContext(query: ContextQuery, cancelToken?: CancellationToken): Promise<AssembledContext>;
  searchCode(query: string, options?: RipgrepOptions): Promise<CodeSearchResult[]>;
  resolveSymbols(symbolName: string): Promise<SymbolResult[]>;
}
```

### 3.2 `IModelGateway` Contract
```typescript
export interface IModelGateway {
  stream(
    messages: ModelMessage[],
    tools: ModelToolDefinition[],
    options?: ModelOptions
  ): AsyncIterable<ModelStreamChunk>;
  
  abortActiveStream(sessionId: string): void;
}
```

### 3.3 `IToolRuntime` Contract
```typescript
export interface IToolRuntime {
  registerTool(tool: ITool<unknown, unknown>): void;
  getToolDefinitions(): ModelToolDefinition[];
  executeTool(name: string, args: unknown, context: IToolExecutionContext): Promise<IToolResult>;
  cancelActiveTool(toolCallId: string): Promise<void>;
}
```

---

## 4. Cancellation & Error Contracts

1. **Propagation**: When `CANCEL_ACTIVE_TASK` arrives from the UI, the Orchestrator dispatches a cancellation signal across all subsystems via `AbortController.abort()` and VS Code `CancellationTokenSource.cancel()`.
2. **Deterministic Cleanup**: The Tool Runtime immediately sends `SIGTERM` to running child processes, rolls back staged shadow buffer changes, and guarantees no half-written files remain on disk.
