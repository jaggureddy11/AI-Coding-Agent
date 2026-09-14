# 16 — Error Handling, Fault Recovery & Self-Healing

## 1. Error Classification: Recoverable vs Fatal

A key differentiator of an autonomous engineering agent is its ability to withstand runtime friction. Naive agents crash or abort on the first unhandled exception. JAGGU rigorously categorizes every potential failure into **Recoverable (Self-Healable)** versus **Fatal (Unrecoverable)**.

```
                              [Error Occurred]
                                     │
                    ┌────────────────┴────────────────┐
                    ▼                                 ▼
            [Recoverable Error]                 [Fatal Error]
                    │                                 │
         (Autonomous Self-Healing)              (Graceful Abort)
                    │                                 │
     ┌──────────────┼──────────────┐                  ├── 1. Terminate active child processes
     ▼              ▼              ▼                  ├── 2. Roll back uncommitted shadow diffs
[Malformed     [Test Failure] [Rate Limit         ├── 3. Clean temporary scratchpads
 Tool Call]          │         Exponential        └── 4. Report actionable error to developer
     │               ▼           Backoff]
[Schema Error  [Diagnose Trace      │
 Feedback to    & Apply Fix]        ▼
  LLM Loop]          │         [Retry HTTP]
                     ▼
             [Re-run Tests]
```

---

## 2. Master Error Taxonomy & Recovery Strategies

| Error Type | Severity | Category | Root Cause | Automated Recovery Strategy |
|---|---|---|---|---|
| `MODEL_TIMEOUT` | Medium | Recoverable | LLM provider took >30s without emitting tokens. | Abort HTTP stream; retry with backoff; offer provider failover if repeated. |
| `MODEL_RATE_LIMIT` (429) | Medium | Recoverable | Provider TPM/RPM ceiling hit. | Exponential backoff with jitter (1s, 2s, 4s, 8s, up to 30s). |
| `MALFORMED_TOOL_CALL` | Low | Recoverable | Model emitted invalid JSON or missing arguments. | Feed Zod validation error back to the model in the next turn as a tool error message. |
| `INVALID_FILE_PATH` | Low | Recoverable | Model hallucinated non-existent path. | Return `{ error: "File not found: X. Did you mean Y?" }` via fuzzy filename search. |
| `FILE_CONFLICT` | Medium | Recoverable | Developer manually edited a file while agent had uncommitted diffs. | Recompute Myers diff against fresh disk buffer; prompt developer if merge conflict. |
| `COMMAND_FAILURE` (Exit != 0) | Medium | Recoverable | Build or script exited with non-zero code. | Capture stdout/stderr; pass output to `DIAGNOSE` state; formulate fix. |
| `TEST_FAILURE` | Medium | Recoverable | Unit/integration test assertion failed. | Extract stack trace & line numbers; patch implementation file; re-run tests (max 3 loops). |
| `PERMISSION_DENIED` | High | Recoverable | Developer rejected an action in modal. | Return `{ error: "User denied permission" }`; model reformulates alternative non-destructive plan. |
| `CONTEXT_OVERFLOW` | High | Recoverable | Prompt length exceeded model window. | Context Engine aggressively drops Tier 7/8 items and summarizes older conversation turns. |
| `NETWORK_FAILURE` | High | Fatal/Retry | Loss of internet connection. | Retry 3 times; if network is down, pause agent and notify developer to check connectivity. |
| `AGENT_LOOP_EXHAUSTED` | High | Fatal | Max 20 iterations or 3 repeated test failures reached. | Pause state machine; preserve staged diffs; present full diagnostic summary to user. |
| `CORRUPTED_DISK_BUFFER` | Critical| Fatal | Operating system I/O error or permission failure. | Abort task immediately; revert to Git checkpoint snapshot; warn developer. |

---

## 3. The Self-Healing Diagnostic Pipeline

When a test failure or build error occurs during execution, JAGGU triggers its internal self-healing pipeline:

```typescript
export class DiagnosticSelfHealer {
  async handleFailure(failure: TestFailureEvent, attempt: number, maxAttempts: number): Promise<HealingAction> {
    if (attempt >= maxAttempts) {
      return {
        action: 'ABORT',
        reason: `Exceeded maximum self-healing budget (${attempt}/${maxAttempts}). Developer intervention required.`
      };
    }

    // 1. Extract file, line, and assertion from stack trace
    const parsedTrace = this.parseStackTrace(failure.stderr);
    
    // 2. Read relevant file context
    const sourceSnippet = await this.readTargetLines(parsedTrace.file, parsedTrace.line);
    
    // 3. Formulate targeted diagnostic prompt for Model
    const diagnosticMessage: ModelMessage = {
      role: 'user',
      content: `The test failed with the following error:\n${failure.stderr}\n\nTarget code:\n${sourceSnippet}\n\nDiagnose the failure, explain the root cause, and use write_file or apply_patch to fix it.`
    };

    return {
      action: 'RETRY_WITH_PROMPT',
      prompt: diagnosticMessage
    };
  }
}
```

---

## 4. Graceful Degradation Invariants

1. **State Isolation**: A failure in one tool call never leaves zombie background terminal processes running.
2. **Atomic Rollback**: If a multi-file refactor fails halfway through and the developer hits cancel, all staged shadow buffers are wiped clean without leaving partially-modified files on disk.
3. **No Uncaught Exceptions**: All async promises and child process events are wrapped in try-catch guards that emit standardized `TASK_ERROR` events.
