# 15 — Event System & Lifecycle Event Bus

## 1. Event Bus Architecture

JAGGU utilizes a centralized, asynchronous **Event Bus** (`packages/jaggu-core/events`) inspired by the VS Code `Emitter<T>` and `Event<T>` pattern. Decoupling the orchestrator from UI renderers, logging engines, and telemetry sinks guarantees that new listeners can be registered without modifying core agent execution logic.

```
                              [Agent Orchestrator]
                                       │
                                       ▼ (Emits)
                             [JAGGU Event Bus]
                                       │
         ┌─────────────────┬───────────┴───────────┬─────────────────┐
         ▼                 ▼                       ▼                 ▼
   [UI / Webview]  [Telemetry / Audit]    [Status Bar Pill]   [History Store]
   (Live Cards)    (Security Log)         (Spinners/Icons)    (Session Disk)
```

---

## 2. Master Event Catalog & Payloads

```typescript
export interface JagguEvents {
  'agent.started': {
    taskId: string;
    conversationId: string;
    prompt: string;
    timestamp: number;
  };

  'agent.planning': {
    taskId: string;
    intent: string;
    timestamp: number;
  };

  'agent.waiting_for_approval': {
    taskId: string;
    approvalId: string;
    type: 'PLAN' | 'FILE_WRITE' | 'COMMAND';
    description: string;
    timestamp: number;
  };

  'agent.tool_started': {
    taskId: string;
    toolCallId: string;
    toolName: string;
    arguments: Record<string, unknown>;
    timestamp: number;
  };

  'agent.tool_completed': {
    taskId: string;
    toolCallId: string;
    toolName: string;
    success: boolean;
    durationMs: number;
    timestamp: number;
  };

  'agent.file_changed': {
    taskId: string;
    filePath: string;
    changeType: 'CREATE' | 'MODIFY' | 'DELETE';
    insertions: number;
    deletions: number;
    staged: boolean;
    timestamp: number;
  };

  'agent.command_started': {
    taskId: string;
    commandId: string;
    command: string;
    cwd: string;
    timestamp: number;
  };

  'agent.command_completed': {
    taskId: string;
    commandId: string;
    command: string;
    exitCode: number;
    durationMs: number;
    timestamp: number;
  };

  'agent.test_started': {
    taskId: string;
    testSuitePath?: string;
    timestamp: number;
  };

  'agent.test_failed': {
    taskId: string;
    failedTests: Array<{ name: string; error: string; file: string; line: number }>;
    exitCode: number;
    timestamp: number;
  };

  'agent.test_passed': {
    taskId: string;
    passedTestCount: number;
    durationMs: number;
    timestamp: number;
  };

  'agent.completed': {
    taskId: string;
    summary: string;
    totalFilesChanged: number;
    durationMs: number;
    tokensUsed: number;
    timestamp: number;
  };

  'agent.failed': {
    taskId: string;
    error: string;
    fatal: boolean;
    timestamp: number;
  };

  'agent.cancelled': {
    taskId: string;
    reason: string;
    timestamp: number;
  };
}
```

---

## 3. Subsystem Consumers & Handlers

| Event | Primary UI Action | Telemetry Action | Session Persistence Action |
|---|---|---|---|
| `agent.started` | Resets active card, enables cancel button. | Logs task start with anonymized ID. | Initializes Task record in database. |
| `agent.planning` | Displays pulsating indigo planning card. | Records planning latency. | Updates task status to `PLANNING`. |
| `agent.waiting_for_approval` | Pops modal or flashes plan approval button. | Tracks human intervention count. | Persists pending approval entity. |
| `agent.tool_started` | Shows tool activity icon in sidebar. | Audits tool name & args (sanitized). | Creates ToolCall record. |
| `agent.tool_completed` | Updates step status icon to check/cross. | Records tool execution duration. | Updates ToolCall record with result. |
| `agent.file_changed` | Adds file to staged diff review list. | Counts lines modified. | Updates FileChange record. |
| `agent.command_started` | Spawns interactive terminal card. | Records command invocation. | Creates TerminalExecution record. |
| `agent.command_completed` | Badges terminal card with exit code. | Logs exit code and run time. | Finalizes execution output snippet. |
| `agent.test_failed` | Displays failure banner with stack trace. | Tracks test regression / failure. | Triggers diagnostic loop handler. |
| `agent.test_passed` | Displays green verification badge. | Records successful verification. | Marks test step complete in plan. |
| `agent.completed` | Plays completion chime (optional) + summary. | Calculates task success metrics. | Marks task `COMPLETED` and flushes session. |
| `agent.failed` | Displays red failure card with retry action. | Records failure taxonomy. | Marks task `FAILED`. |
| `agent.cancelled` | Disables progress indicators, restores input. | Tracks cancellation point. | Marks task `CANCELLED`. |
