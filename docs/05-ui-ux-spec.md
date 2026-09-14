# 05 — UI/UX Specification & Design System

## 1. Design Principles & Alignment with VS Code

ForgeAI is designed to feel like an organic, first-class subsystem of Visual Studio Code rather than a foreign, unstyled web frame. 
- **Native Aesthetic**: Inherits all VS Code CSS variables (`var(--vscode-editor-background)`, `var(--vscode-foreground)`, `var(--vscode-badge-background)`), guaranteeing perfect visual harmony across all dark, light, and high-contrast themes.
- **High Information Density**: Built for professional engineers who value speed, terminal precision, and concise status over empty whitespace.
- **Zero UI Blocking**: All streaming, animations, and transitions use CSS hardware-accelerated transforms and async non-blocking rendering.

---

## 2. Core UI Surfaces

```
+----------------------------------------------------------------------------------------------------+
| VS Code Title Bar                                                                   [ForgeAI: Idle]|
+----+----------------------+-------------------------------------------------+----------------------+
| A  |                      | Active Editor: src/routes/index.ts              | ForgeAI Sidebar      |
| c  |  Explorer /          |                                                 |                      |
| t  |  File Tree           | 14 import { Router } from 'express';             | [Agent: EXECUTING]   |
| i  |                      | 15                                              |                      |
| v  |  src/                | 16 export const router = Router();              | PLAN:                |
| i  |   controllers/       | 17 + router.get('/health', healthHandler);      | [x] Analyze routes   |
| t  |   routes/            | 18                                              | [x] Create handler   |
| y  |   tests/             |                                                 | [>] Apply route edit |
|    |                      |                                                 | [ ] Run test suite   |
| B  |                      |                                                 |                      |
| a  |                      +-------------------------------------------------+----------------------+
| r  |                      | Output / Integrated Terminal                    | Staged Diffs (2)     |
|    |                      |                                                 | - src/routes/index.ts|
| [*]|                      | $ npm test tests/health.test.ts                 | - src/health.ts      |
|    |                      | PASS tests/health.test.ts (1.2s)                | [Accept All] [Reject]|
+----+----------------------+-------------------------------------------------+----------------------+
```

### 2.1 Surface 1: ForgeAI Activity Bar & Sidebar
- **Activity Bar Icon**: Clean, modern stylized anvil/spark icon registered via `package.json` contributes `viewsContainers`.
- **Sidebar Header**: Displays active workspace name, current LLM model pill (`Claude 3.5 Sonnet`), and session reset button.
- **Agent Status Header Bar**: Real-time status indicator pill with distinct colors:
  - `IDLE`: Subtle gray circle.
  - `THINKING` / `PLANNING`: Pulsing indigo glow.
  - `READING` / `EDITING`: Amber working indicator.
  - `WAITING_FOR_APPROVAL`: Bright orange blinking alert.
  - `EXECUTING` / `TESTING`: Blue progress spinner.
  - `COMPLETED`: Emerald checkmark.
  - `FAILED` / `CANCELLED`: Ruby red error icon.

### 2.2 Surface 2: Interactive Plan Card
Rendered directly within the conversation stream when a complex task is formulated:
- **Title**: *"Task Plan: Implement Healthcheck Endpoint"*
- **Items**:
  - `[x] Completed`: Checked item in muted text.
  - `[>] Active`: Highlighted bold item with animated blue spinner.
  - `[ ] Pending`: Unchecked step with estimated action.
- **Controls**:
  - `[Approve & Run]` button (Primary, filled).
  - `[Edit Plan]` button (Secondary, outlined).
  - `[Cancel Task]` button (Ghost red).

### 2.3 Surface 3: Staged Diff Reviewer (Native Monaco Diff Editor)
- **Compact File Change Drawer in Sidebar**: Displays a list of files modified by the agent with change counters:
  - `src/controllers/health.ts` (+32, -0)
  - `src/routes/index.ts` (+4, -1)
- **Native VS Code Diff Tab**: Clicking any changed file opens the battle-tested, native VS Code side-by-side diff tab: `vscode.commands.executeCommand('vscode.diff', diskUri, shadowUri, 'ForgeAI Diff: index.ts')`.
- **Review Controls**: Floating action buttons in the sidebar allow the developer to `[Accept All Changes]`, `[Accept Active File]`, or `[Discard All]`. Approved changes are applied via `vscode.workspace.applyEdit()`, cleanly supporting `Cmd+Z` undo.

### 2.4 Surface 4: Terminal & Execution Activity
- **Sidebar Execution Card**: Renders high-level command status in the conversation stream (e.g., `npm test` -> Exit Code 0, Duration: 1.4s).
- **Native VS Code OutputChannel**: Real-time unabridged stdout and stderr stream directly into a dedicated VS Code Output panel (`Output -> ForgeAI Task Trace`), providing native text selection, search, and zero Webview rendering overhead.

### 2.5 Surface 5: Inline Code Actions & Floating Prompt (Cmd+K)
- Selecting code in any editor triggers a subtle ForgeAI lightbulb quick-fix:
  - *"Explain with ForgeAI"*
  - *"Refactor with ForgeAI"*
  - *"Generate Tests for Selection"*
- Hitting `Cmd+K` (macOS) or `Ctrl+K` (Windows/Linux) spawns a focused inline prompt bar floating directly over the selected editor lines, allowing quick modifications without switching to the sidebar.

---

## 3. Comprehensive Agent State Machine UI Mapping

| Agent State | UI Header Visual | Input Area State | Action Buttons Available |
|---|---|---|---|
| `IDLE` | Static gray circle: "Ready" | Editable, cursor focused | "Submit Task", "@mention" |
| `THINKING` | Pulsing violet shimmer: "Analyzing intent..." | Disabled | "Stop (Esc)" |
| `PLANNING` | Indigo spinner: "Formulating milestone plan..." | Disabled | "Stop (Esc)" |
| `READING` | Cyan scanline: "Reading src/auth/jwt.ts..." | Disabled | "Stop (Esc)" |
| `EDITING` | Amber pulse: "Staging patch for 2 files..." | Disabled | "Stop (Esc)" |
| `WAITING_FOR_APPROVAL` | Flashing orange badge: "Action Required" | Disabled | "Approve", "Modify", "Reject" |
| `EXECUTING` | Blue spinner: "Running npm test..." | Disabled | "Abort Command" |
| `TESTING` | Indigo radar: "Verifying test assertions..." | Disabled | "Abort Tests" |
| `DEBUGGING` | Yellow wrench: "Self-healing test failure (1/3)..." | Disabled | "Stop (Esc)" |
| `COMPLETED` | Solid green check: "Task Complete" | Editable, cursor focused | "Review Diffs", "New Task" |
| `FAILED` | Solid red exclamation: "Task Blocked" | Editable with error summary | "Retry", "Discard Changes" |
| `CANCELLED` | Muted slash: "Task Cancelled by User" | Editable | "Resume", "New Task" |

---

## 4. Keyboard Shortcuts & Accessibility

### 4.1 Keybindings
- `Cmd + Shift + A` / `Ctrl + Shift + A`: Toggle ForgeAI Sidebar focus.
- `Cmd + K` / `Ctrl + K`: Open Inline ForgeAI Prompt on selection.
- `Escape`: Instantly cancel active agent stream or command execution.
- `Cmd + Enter` / `Ctrl + Enter`: Submit prompt / Approve plan.
- `Alt + A`: Accept active diff hunk.
- `Alt + R`: Reject active diff hunk.

### 4.2 Accessibility & WCAG 2.1 AA Compliance
- Full keyboard navigability across all cards, diff hunks, and buttons using standard `Tab` / `Shift+Tab`.
- Screen-reader friendly ARIA live regions (`aria-live="polite"`) announcing agent state transitions.
- Contrast ratio exceeding 4.5:1 for all text elements across standard VS Code dark and light themes.
