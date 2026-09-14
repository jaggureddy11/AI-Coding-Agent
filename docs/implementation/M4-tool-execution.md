# M4 — Tool Execution, File Editing & Safe Workspace Mutation Implementation

## 1. Executive Summary

Milestone M4 marks the foundational transition of JAGGU from a repository-aware AI assistant into an actual AI coding agent capable of proposing file changes, presenting native diffs for human review, safely mutating files upon explicit approval, and running controlled verification tests within strict workspace boundaries.

In strict adherence to the project's engineering principles:
- **No Uncontrolled Autonomous Execution**: No model-generated code or commands are executed without schema validation, permission checks, and containment verification.
- **Zero Surprise File Writes**: All proposed edits stage into an in-memory virtual document provider (`jaggu-shadow://`) and open in VS Code's native diff editor (`vscode.diff`). Real disk mutation only occurs after explicit human approval.
- **Concurrent Modification Safety**: Before applying any edit, the engine checks that the base file on disk matches the SHA-256 hash computed during proposal. If an external edit occurred, the mutation is aborted with a structured conflict error.
- **Strict Workspace Containment**: All filesystem paths are resolved against workspace roots, normalized, and checked for directory traversal (`../`), null-byte injection, and symlink escapes (including canonical realpath verification on macOS).
- **Controlled Command Policy**: `run_tests` enforces an allowlist of approved project test runners (`npm test`, `npx vitest`, `pytest`, `cargo test`, `go test`, etc.) and strictly forbids dangerous commands (`rm`, `curl`, `sudo`, shell metacharacters, background daemons).

---

## 2. Tool Architecture & Contract

Located in `packages/jaggu-core/src/types/tools.ts`:

```typescript
export type PermissionTier = 'SAFE' | 'MUTATING' | 'EXECUTION';

export interface IToolExecutionContext {
  readonly taskId: string;
  readonly workspaceRoot: string;
  readonly workspaceRoots?: string[];
  readonly abortSignal: AbortSignal;
}

export interface IToolResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  executionDurationMs: number;
}

export interface ITool<TInput = unknown, TOutput = unknown> {
  readonly name: string;
  readonly description: string;
  readonly permissionTier: PermissionTier;
  readonly schema: z.ZodType<TInput>;
  readonly timeoutMs: number;

  execute(args: TInput, context: IToolExecutionContext): Promise<IToolResult<TOutput>>;
  toModelToolDefinition(): ModelToolDefinition;
}
```

Every tool defines its input parameter structure using Zod schemas. These schemas are converted to JSON Schema format for the Model Gateway, while providing runtime validation before tool execution begins.

---

## 3. Initial Tool Set (M4 Inventory)

| Tool Name | Permission Tier | Purpose | Constraints / Protections |
| :--- | :--- | :--- | :--- |
| `read_file` | `SAFE` | Reads workspace file content | Relative workspace path, optional line range (`startLine`, `endLine`), 128 KB byte limit, binary file rejection, path containment validation. |
| `search_code` | `SAFE` | Searches repository content | Reuses M3 `RipgrepSearchService`, bounds max results, respects ignores. |
| `list_directory` | `SAFE` | Lists directory contents | Bounded traversal, result limit (max 200 entries), ignores build/vendor dirs. |
| `propose_edit` | `MUTATING` | Stages proposed modification | Computes base SHA-256 hash, generates diff summary, writes to `IVirtualDocStore` (`jaggu-shadow://`), emits `edit.proposed`. **Does NOT write to disk.** |
| `apply_edit` | `MUTATING` | Applies approved edit to disk | Requires `record.approved === true`. Validates current disk content matches `baseContentHash`. Performs atomic write, evicts shadow doc, emits `edit.applied`. |
| `run_tests` | `EXECUTION` | Runs controlled test command | Bounded to approved test runners (`npm test`, `pytest`, etc.). Rejects shell metacharacters (`;&\|><$`) and dangerous binaries (`rm`, `curl`, `sudo`). Clamps output to 64 KB, enforces timeout and cancellation. |

---

## 4. Tool Execution Engine (`ToolExecutor`)

Located in `packages/jaggu-core/src/tools/executor.ts`:

The `ToolExecutor` provides a centralized pipeline through which all tool invocations pass:

```
Model Tool Call
      ↓
Tool Name Validation (reject unknown tools)
      ↓
Schema Validation (Zod parse, reject malformed payloads)
      ↓
Cancellation Check (AbortSignal)
      ↓
Timeout Enforcement (AbortSignal.timeout)
      ↓
Tool Execution
      ↓
Lifecycle Events Emission (tool.requested, started, completed, failed, cancelled)
      ↓
Structured Result Packaging
```

---

## 5. Workspace Security & Containment

Located in `packages/jaggu-core/src/tools/security.ts`:

The function `resolveAndValidateWorkspacePath` enforces workspace boundaries:
1. **Null-byte Injection Rejection**: Rejects any path containing `\0`.
2. **Path Normalization**: Resolves paths against `workspaceRoot`.
3. **Traversal Checks**: Ensures normalized path does not start with `..`.
4. **Canonical Symlink Resolution**: Resolves target and workspace roots using `fs.realpathSync`.
   - On macOS, `/var` is a symlink to `/private/var`. The security engine canonicalizes workspace roots to ensure legitimate paths are correctly permitted while symlinks pointing outside the workspace are rejected.

---

## 6. Shadow Document & Diff Architecture

```
User Request: "Add validation to login endpoint"
                      ↓
          Agent Loop requests propose_edit
                      ↓
      propose_edit generates proposed content
                      ↓
  Staged into InMemoryVirtualDocStore (jaggu-shadow://)
                      ↓
  JagguShadowDocProvider serves proposed content
                      ↓
Native VS Code Diff Preview (vscode.diff)
  Original File (file://) ↔ Shadow File (jaggu-shadow://)
                      ↓
          User Review in Webview UI
          [Approve]       [Reject]
```

The Webview UI renders an `ApprovalCard` with:
- Target file path
- Diff summary (+lines added, -lines removed)
- **Review Changes** button (triggers `vscode.diff` between working tree and shadow document)
- **Approve** button (triggers `agent.approve` RPC to apply edit)
- **Reject** button (triggers `agent.reject` RPC, keeping real file untouched)

---

## 7. Apply Edit Safety & Atomicity

Before modifying any file on disk, `ApplyEditTool` executes safety checks:
1. Verifies the proposal was explicitly marked `approved === true`.
2. Re-reads the real file from disk.
3. Computes the current file's SHA-256 hash.
4. Compares the current hash to `proposal.baseContentHash`.
   - If the hashes match, the edit is applied.
   - If the hashes differ (e.g. user or Git modified the file in the background), the tool aborts with `CONCURRENT_MODIFICATION_CONFLICT` and emits `edit.conflict`.
5. Atomic Write: Writes the updated content and deletes the shadow document from `IVirtualDocStore`.

---

## 8. Agent Action Loop & Loop Guards

Located in `packages/jaggu-vscode/src/sidebarProvider.ts`:

The agent loop executes multi-turn tool calling:
1. Assembles grounded workspace context using M3 `ContextEngine`.
2. Provides available tools formatted via `toolExecutor.toModelToolDefinitions()`.
3. Streams model chunks.
4. When `tool_call_complete` is received:
   - For `SAFE` tools: executes immediately and appends result to conversation.
   - For `propose_edit`: stages shadow doc, displays Approval Card in UI, pauses loop awaiting user decision.
   - If user approves: executes `apply_edit` and resumes loop.
   - If user rejects: informs model of rejection and continues loop without mutating disk.
   - For `run_tests`: executes test runner and reports pass/fail in UI.
5. Final text response terminates loop and transitions status to `SUCCESS`.

### Hard Loop Guards:
- **Maximum Tool Calls**: Capped at 20 tool calls per task.
- **Maximum Iterations**: Capped at 10 iterations per user task.
- **Output Limits**: 128 KB for file reads, 64 KB for test runner outputs.
- **Cancellation**: AbortSignal propagates from Webview to all active tools and child processes.

---

## 9. Controlled Test Execution Policy (`run_tests`)

To prevent arbitrary command execution, `RunTestsTool` enforces:
- Permitted test prefixes: `npm test`, `npm run test`, `npx vitest`, `npx jest`, `pytest`, `python -m pytest`, `cargo test`, `go test`, `dotnet test`, `mvn test`, `gradle test`.
- Disallowed metacharacters: `;`, `&`, `|`, `>`, `<`, `$`, `` ` ``, `\`.
- Disallowed binaries: `rm`, `del`, `curl`, `wget`, `sudo`, `chmod`, `chown`, `format`, `bash`, `sh`, `zsh`, `powershell`, `cmd`.
- Execution mechanism: Uses `child_process.spawn` for non-interactive execution with timeouts and output stream capping.

---

## 10. Verification Results

### Automated Quality Gate:
- `npm run build`: All 4 packages compiled with 0 errors.
- `npm run typecheck`: TypeScript verification passed with 0 errors across monorepo.
- `npm run lint`: ESLint passed with 0 warnings/errors.
- `npm test`: **78 tests passing across 11 test suites.**

```
 ✓ packages/jaggu-core/test/tools.test.ts (13 tests)
 ✓ packages/jaggu-ui/test/ui.test.tsx (5 tests)
 ✓ packages/jaggu-vscode/test/extension.test.ts (3 tests)
 ✓ packages/jaggu-vscode/test/integration.test.ts (3 tests)
 ✓ packages/jaggu-core/test/context.test.ts (11 tests)
 ✓ packages/jaggu-core/test/security.test.ts (7 tests)
 ✓ packages/jaggu-core/test/fsm.test.ts (5 tests)
 ✓ packages/jaggu-ui/test/rpc.test.ts (9 tests)
 ✓ packages/jaggu-core/test/models.test.ts (16 tests)
 ✓ packages/jaggu-eval/test/runner.test.ts (1 test)
 ✓ packages/jaggu-vscode/test/agentLoop.test.ts (5 tests)
```
