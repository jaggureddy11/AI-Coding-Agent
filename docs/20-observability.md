# 20 — Observability, Structured Logging & Telemetry

## 1. Observability Architecture & Principles

Observability in JAGGU serves two essential purposes:
1. **Developer Insight**: Providing the engineer with an audit trail of every decision, tool call, command output, and latency metric in real time.
2. **System Health & Debugging**: Allowing developers to diagnose failures, measure model latency, and inspect token consumption.

### Strict Privacy Guarantee (The Anti-Surveillance Invariant)
- **Zero Secret Ingestion**: Passwords, API keys, bearer tokens, and private SSH keys are scrubbed before reaching any logger.
- **Zero Codebase Exfiltration**: Private source code is never transmitted to any third-party telemetry server. Telemetry is local-first (`.vscode/jaggu/audit.log`) and opt-in only.

---

## 2. Structured Log Schema (NDJSON)

Logs are written as newline-delimited JSON (NDJSON) to `.vscode/jaggu/audit.log`:

```typescript
export interface AuditLogEntry {
  timestamp: string; // ISO 8601
  sessionId: string;
  taskId: string;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  event: string;
  agentState: AgentState;
  details: {
    toolName?: string;
    toolArgumentsSanitized?: Record<string, unknown>;
    executionDurationMs?: number;
    exitCode?: number;
    provider?: string;
    model?: string;
    timeToFirstTokenMs?: number;
    durationMs?: number;
    promptTokens?: number;
    completionTokens?: number;
    retryCount?: number;
    cancelled?: boolean;
    costUsd?: number;
    errorType?: string;
    errorMessageSanitized?: string;
  };
}
```

### Example Structured Entry:
```json
{
  "timestamp": "2026-09-14T11:45:00.120Z",
  "sessionId": "sess_8a9b7c",
  "taskId": "task_102",
  "level": "INFO",
  "event": "TOOL_EXECUTION_COMPLETED",
  "agentState": "OBSERVE_RESULT",
  "details": {
    "toolName": "run_command",
    "toolArgumentsSanitized": { "command": "npm test tests/health.test.ts", "cwd": "/workspace" },
    "executionDurationMs": 1420,
    "exitCode": 0
  }
}
```

---

## 3. Real-Time Developer Output Channels

JAGGU provides three distinct visibility surfaces inside VS Code:

### 3.1 Surface 1: Dedicated Output Channel (`JAGGU Trace`)
- Accessible via VS Code's native `Output` panel dropdown (`Output -> JAGGU Trace`).
- Prints clean, formatted, human-readable execution breadcrumbs:
  ```
  [11:45:00 INFO] [Task: task_102] State -> UNDERSTAND
  [11:45:01 INFO] [ContextEngine] Ripgrep query "healthCheck" matched 2 files (24ms)
  [11:45:02 INFO] [ModelGateway] Prompt dispatched to Claude 3.5 Sonnet (3,410 tokens)
  [11:45:04 INFO] [ToolRuntime] Executing "write_file" on "src/routes/health.ts"
  [11:45:05 INFO] [Terminal] Spawned "npm test" (PID: 48192)
  [11:45:06 INFO] [Terminal] Process exited with code 0 (Duration: 1.1s)
  [11:45:07 INFO] [Task: task_102] State -> COMPLETED (Total: 7.2s)
  ```

### 3.2 Surface 2: Live Activity Card in Webview
- Renders animated tool chips, terminal streaming text, and step progress indicators directly in the chat sidebar.

### 3.3 Surface 3: VS Code Status Bar Item
- Displays background activity in the bottom status bar:
  - `$(sparkle) JAGGU: Idle`
  - `$(sync~spin) JAGGU: Running tests... (1.2s)`
  - `$(check) JAGGU: Task Complete (3 files)`

---

## 4. Secret Scrubbing Engine

Before any log entry is recorded or displayed, strings pass through the `SecretSanitizer`:
```typescript
export class SecretSanitizer {
  private static readonly PATTERNS: RegExp[] = [
    /sk-[a-zA-Z0-9]{20,}/g,                        // OpenAI keys
    /sk-ant-[a-zA-Z0-9_\-]{20,}/g,                 // Anthropic keys
    /AIza[0-9A-Za-z\-_]{35}/g,                     // Google API keys
    /ghp_[a-zA-Z0-9]{36}/g,                        // GitHub tokens
    /-----BEGIN [A-Z ]+ PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+ PRIVATE KEY-----/g,
    /(password|secret|token|api_key)=['"][^'"]+['"]/gi
  ];

  static sanitize(text: string): string {
    let sanitized = text;
    for (const pattern of this.PATTERNS) {
      sanitized = sanitized.replace(pattern, '[REDACTED_SECRET]');
    }
    return sanitized;
  }
}
```
