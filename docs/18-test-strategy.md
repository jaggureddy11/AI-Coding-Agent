# 18 — Comprehensive Testing Strategy

## 1. Multi-Tier Testing Pyramid

To ensure production-grade reliability across all JAGGU components, testing is organized into four distinct tiers:

```
                  /\
                 /  \     Tier 4: Benchmark & Evaluation Suite (SWE-bench style)
                /----\
               /      \   Tier 3: End-to-End Headless VS Code Smoke Tests
              /--------\
             /          \ Tier 2: Subsystem Integration Tests (Mocked LLM)
            /------------\
           /              \ Tier 1: Unit Tests (FSM, Tools, Context, Diff)
          /----------------\
```

---

## 2. Tier 1: Unit Testing

Unit tests run in seconds using **Vitest / Jest** with 100% mocked external dependencies (no real LLM API calls, no real disk writes).

### 2.1 Agent State Machine Tests (`packages/jaggu-core/test/agent`)
- **Initial State**: Verifies FSM starts in `IDLE`.
- **Valid Transitions**: Verifies `IDLE` -> `UNDERSTAND` -> `PLAN` -> `REQUEST_APPROVAL` -> `EXECUTE_TOOL` -> `COMPLETE`.
- **Loop Guards**: Verifies that when a simulated tool call fails 3 consecutive times, state transitions to `DIAGNOSE` and then stops at `FAILED` when `maxRepairAttempts` is exceeded.
- **Cancellation**: Verifies that triggering `cancel()` at any step immediately transitions state to `CANCELLED` and cleans up.

### 2.2 Tool Schema & Argument Validation Tests (`packages/jaggu-core/test/tools`)
- Verifies `read_file` rejects directory traversal paths (`../../etc/passwd`).
- Verifies `delete_file` fails with validation error if `reason` parameter is omitted.
- Verifies `apply_patch` correctly replaces single-line and multi-line hunks and throws clean error on ambiguous matches.

### 2.3 Context Priority & Token Trimming Tests (`packages/jaggu-context/test`)
- Verifies that when total candidate files exceed 12,000 tokens, Tier 1 (selection) and Tier 2 (active file) are preserved while Tier 7/8 items are dropped.
- Verifies BM25 ranker places exact keyword matches higher than unrelated files.

### 2.4 Diff Engine Tests (`packages/jaggu-core/test/diff`)
- Verifies Myers diff generator accurately detects line additions, modifications, and deletions.
- Verifies per-hunk "Accept" and "Reject" logic correctly produces valid target file buffers.

---

## 3. Tier 2: Subsystem Integration Testing

Integration tests verify component interoperability using a deterministic mock LLM gateway.

### 3.1 Model Gateway ↔ Tool Runtime Integration
- Mock model returns a synthetic tool-call stream chunk for `write_file`.
- Verifies Tool Runtime intercepts request, validates schema, applies edit to shadow buffer, and dispatches `DIFF_STAGED` event.

### 3.2 Agent ↔ Terminal Subsystem Integration
- Agent requests `run_command` with `echo "JAGGU Test"`.
- Verifies Node PTY spawns child process, captures stdout, and emits exit code 0.
- Verifies timeout enforcement: a command running `sleep 10` with a 2-second timeout is killed via `SIGTERM` and returns `timedOut: true`.

### 3.3 Git Checkpoint Integration
- Verifies that modifying a file via the agent generates an automatic snapshot that can be cleanly restored via `rollback_checkpoint`.

---

## 4. Tier 3: End-to-End (E2E) Headless VS Code Tests

E2E tests run against a real headless VS Code instance using `@vscode/test-electron`:
1. Spawns fresh VS Code instance with a temporary mock workspace folder.
2. Activates the JAGGU extension (`packages/jaggu-vscode`).
3. Dispatches user prompt command: `"Add unit test for math.ts"`.
4. Mock LLM streams realistic plan and file changes.
5. Verifies sidebar webview renders cards, diff view displays changes, and files write cleanly to disk.

---

## 5. Tier 4: Evaluation Benchmark Suite (Offline AI Benchmarks)

JAGGU includes an automated evaluation harness (`packages/jaggu-eval`) inspired by SWE-bench:
- Runs against a fixed set of 25 standardized engineering problems across TypeScript, Python, and Go.
- Evaluates real LLM performance (Claude 3.5 Sonnet, GPT-4o, Gemini 2.0 Flash) without human interaction.
- Detailed metrics and benchmark criteria are specified in `docs/19-agent-evaluation.md`.
