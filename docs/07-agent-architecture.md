# 07 — Autonomous Agent Architecture & State Machine

## 1. Overview & Core Philosophy

The JAGGU Agent is implemented as a **Deterministic Finite State Machine (FSM)** with explicit transitions, strict loop limits, and human-in-the-loop verification gates. Unlike naive ReAct loops that invoke tools unconstrained until context limits explode or cost spirals out of control, JAGGU structures work into distinct cognitive phases:

```
                            JAGGU AGENT STATE MACHINE
                            
                                 [USER_REQUEST]
                                       │
                                       ▼
                                [1. UNDERSTAND] ◄───────────────+
                                       │                        │
                                       ▼                        │
                             [2. RETRIEVE_CONTEXT]              │
                                       │                        │
                                       ▼                        │
                                  [3. PLAN]                     │
                                       │                        │
                                       ▼                        │
                            [4. REQUEST_APPROVAL]               │
                                  │         │ (Reject/Edit)     │
                       (Approved) │         └───────────────────┘
                                  ▼
                            [5. EXECUTE_TOOL]
                                  │
                                  ▼
                           [6. OBSERVE_RESULT]
                                  │
                                  ▼
                             [7. EVALUATE]
                                  │
                  ┌───────────────┴───────────────┐
                  │                               │
            (Goal Satisfied)              (Defect / Error Detected)
                  ▼                               ▼
            [10. COMPLETE]                  [8. DIAGNOSE]
                                                  │
                                                  ▼
                                             [9. REPAIR]
                                                  │
                                                  ▼
                                            [RETEST (Loop)]
```

---

## 2. Formal State Definitions

```typescript
export enum AgentState {
  IDLE = 'IDLE',
  UNDERSTAND = 'UNDERSTAND',
  RETRIEVE_CONTEXT = 'RETRIEVE_CONTEXT',
  PLAN = 'PLAN',
  REQUEST_APPROVAL = 'REQUEST_APPROVAL',
  EXECUTE_TOOL = 'EXECUTE_TOOL',
  OBSERVE_RESULT = 'OBSERVE_RESULT',
  EVALUATE = 'EVALUATE',
  DIAGNOSE = 'DIAGNOSE',
  REPAIR = 'REPAIR',
  COMPLETE = 'COMPLETE',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}
```

### State 1: `IDLE`
- **Description**: Agent is dormant, awaiting user instruction.
- **Entry Action**: Resets active task context, cleans temporary scratchpads, preserves session memory.
- **Trigger to Next**: User submits prompt via UI input box.

### State 2: `UNDERSTAND`
- **Description**: Parses user intent into an internal goal representation. Classifies whether the task is Read-Only (Q&A) or Mutating (Code Change).
- **Activities**: Extracts referenced files, `@mentions`, and keywords.
- **Next Transition**: Automatically advances to `RETRIEVE_CONTEXT`.

### State 3: `RETRIEVE_CONTEXT`
- **Description**: Gathers repository ground truth relevant to the goal.
- **Activities**:
  - Invokes `search_files` and `search_code` (ripgrep).
  - Queries active VS Code language services for symbol references.
  - Formulates a ranked, token-budgeted prompt payload.
- **Next Transition**: If Read-Only, jumps directly to `COMPLETE` after streaming answer; if Mutating, advances to `PLAN`.

### State 4: `PLAN`
- **Description**: Breaks complex goals into an ordered sequence of discrete milestones.
- **Output**: Generates a structured JSON plan containing target files, tool actions, and verification criteria.
- **Next Transition**: Advances to `REQUEST_APPROVAL`.

### State 5: `REQUEST_APPROVAL`
- **Description**: Pauses execution and awaits developer confirmation of the plan.
- **User Actions**:
  - `Approve`: Transitions to `EXECUTE_TOOL` (Step 1).
  - `Modify`: Developer edits plan steps; transitions back to `PLAN`.
  - `Cancel`: Transitions to `CANCELLED`.

### State 6: `EXECUTE_TOOL`
- **Description**: Dispatches tool calls (e.g., `read_file`, `write_file`, `run_command`).
- **Safety Checks**: Intercepted by Permission Manager; confirms high-risk actions.
- **Next Transition**: Advances to `OBSERVE_RESULT` upon tool completion or error.

### State 7: `OBSERVE_RESULT`
- **Description**: Ingests raw outputs from tools (file contents, diff hunks, terminal stdout/stderr, exit codes).
- **Processing**: Normalizes outputs, trims excessively long logs (>500 lines truncated with head/tail preservation).
- **Next Transition**: Advances to `EVALUATE`.

### State 8: `EVALUATE`
- **Description**: Determines whether the active milestone or entire task succeeded or failed.
- **Criteria**:
  - Did the terminal command return exit code 0?
  - Do compiler diagnostics show zero errors?
  - Are all plan steps completed?
- **Transitions**:
  - If all steps pass: Advances to `COMPLETE`.
  - If more plan steps remain: Loops back to `EXECUTE_TOOL` for the next step.
  - If a test or build error is observed: Advances to `DIAGNOSE`.

### State 9: `DIAGNOSE`
- **Description**: Autonomous fault localization.
- **Activities**: Correlates the error trace with the recent patch, analyzes stack traces, and queries AST definitions to identify root cause.
- **Next Transition**: Advances to `REPAIR`.

### State 10: `REPAIR`
- **Description**: Formulates a targeted bugfix patch or configuration correction.
- **Activities**: Generates a corrective Myers diff for the failing file.
- **Next Transition**: Transitions to `EXECUTE_TOOL` to re-run verification tests.

### State 11: `COMPLETE`
- **Description**: Task successfully finished. Presents final summary, files touched, and test verification proof.

### State 12: `FAILED`
- **Description**: Task blocked after exceeding maximum retry budgets or encountering fatal runtime errors. Explains exact blocker to developer.

### State 13: `CANCELLED`
- **Description**: Aborted by developer. Reverts uncommitted changes, terminates child processes, returns to `IDLE`.

---

## 3. Loop Termination & Infinite Loop Prevention

To eliminate runaway agent costs and stuck execution loops, JAGGU enforces strict hard limits:

```typescript
export interface LoopGuardLimits {
  /** Maximum number of tool iterations per single user prompt */
  maxIterations: number; // Default: 20
  
  /** Maximum self-healing repair attempts for the same failing test */
  maxRepairAttempts: number; // Default: 3
  
  /** Maximum consecutive identical tool calls (detects circular loops) */
  maxRepeatedToolCalls: number; // Default: 2
  
  /** Absolute task timeout in seconds */
  taskTimeoutSeconds: number; // Default: 300 (5 minutes)
}
```

If any guard threshold is breached:
1. The agent immediately suspends execution.
2. The state transitions to `WAITING_FOR_APPROVAL` or `FAILED`.
3. The UI explains: *"Agent paused: maximum repair attempts (3/3) reached for test failure. Would you like to guide the agent or discard changes?"*

---

## 4. Context Window Trimming & State Persistence

At each step of the agent loop, the Conversation Manager computes total tokens consumed:
1. **System Prompt & Tool Definitions**: Fixed baseline (~2,000 tokens).
2. **Repository Context (Ground Truth)**: Budget capped (~8,000 tokens).
3. **Execution History**: Stores sliding window of recent tool calls. Older observation results (e.g., long terminal logs from 5 steps ago) are automatically summarized into 1-line checkpoints:
   - `[Step 2 Observation]: Ran 'npm test' -> Exit 1 (AssertionError in auth.ts:45) -> Resolved in Step 3`.
4. **Current Step**: Unabridged active prompt and scratchpad.
