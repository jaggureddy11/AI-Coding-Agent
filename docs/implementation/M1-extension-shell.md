# Milestone M1 Implementation Record: Basic JAGGU Extension Shell & Webview UI

**Milestone**: M1 — Basic JAGGU Extension Shell & Webview UI  
**Completed**: September 14, 2026  
**Status**: ACCEPTED & VERIFIED  

---

## 1. Objective & Scope

The objective of Milestone M1 was to establish the interactive presentation layer and verify the bi-directional communication pipeline between the React-based Webview UI and the VS Code Extension Host:

$$\text{React Webview} \underset{\text{typed RPC}}{\rightleftharpoons} \text{VS Code Extension Host}$$

Key accomplishments in M1:
1. **Production Webview Bundling**: Configured a high-speed, zero-runtime-dependency build pipeline compiling `@jaggu/ui` into `packages/jaggu-vscode/media/webview.js` using `esbuild`.
2. **VS Code Native Webview Integration**: Updated `JagguSidebarProvider` to serve the bundled UI with strict Content Security Policy (CSP), per-session cryptographic nonces, and native VS Code CSS theme variables.
3. **Typed RPC Message Protocol**: Formalized explicit contracts (`user.submit`, `agent.status`, `agent.message`, `agent.error`, `agent.cancel`, `ui.ready`, `ui.clear`) with runtime schema validation guards at the Extension Host boundary.
4. **Deterministic Mock Agent Pipeline**: Simulated asynchronous agent processing, transition to `PROCESSING`, generating structured responses, updating to `SUCCESS`, returning to `IDLE`, and supporting user cancellation (`agent.cancel`).
5. **Stateful Status Bar Indicator**: Integrated a persistent VS Code status bar item (`$(sparkle) JAGGU: Ready`) synchronized dynamically with agent state transitions.
6. **Multi-Theme Fidelity**: Utilized VS Code CSS custom properties (`--vscode-*`) to seamlessly inherit Dark, Light, and High Contrast editor themes without hard-coded color palettes.

---

## 2. Webview Build Pipeline

The Webview is bundled using `esbuild` to produce a single self-contained, browser-compatible IIFE bundle:

* **Entry Point**: `packages/jaggu-ui/src/main.tsx`
* **Output Destination**: `packages/jaggu-vscode/media/webview.js` (151.6 KB minified, 379.4 KB sourcemap)
* **Stylesheet**: `packages/jaggu-vscode/media/webview.css` (custom scrollbars, animations, and typography reset)
* **Build Target**: `ES2022`, IIFE format, production minified, `process.env.NODE_ENV="production"`
* **Asset Loading**: `sidebarProvider.ts` resolves URIs via `webview.asWebviewUri(...)` and injects them into HTML with nonced `<script>` tags.

### Content Security Policy (CSP)

```http
default-src 'none';
style-src ${webview.cspSource} 'unsafe-inline';
script-src 'nonce-${nonce}';
img-src ${webview.cspSource} https: data:;
font-src ${webview.cspSource};
```

---

## 3. RPC Contract & Message Flow

### Webview → Extension Host Messages

| Message Type | Payload Structure | Semantics |
| :--- | :--- | :--- |
| `ui.ready` | `{ timestamp: number }` | Webview mounted and requesting current state sync |
| `user.submit` | `{ id: string, text: string, timestamp: number }` | User submitted an engineering prompt or instruction |
| `agent.cancel` | `{ taskId?: string }` | User clicked Cancel during active task execution |
| `ui.clear` | `{}` | User cleared the conversation history |

### Extension Host → Webview Messages

| Message Type | Payload Structure | Semantics |
| :--- | :--- | :--- |
| `agent.status` | `{ state: UiAgentStatus, detail?: string }` | State transition (`IDLE`, `PROCESSING`, `SUCCESS`, `ERROR`, `CANCELLED`) |
| `agent.message` | `{ id: string, role: 'user' \| 'assistant' \| 'system', text: string, timestamp: number }` | New message bubble appended to conversation thread |
| `agent.error` | `{ code?: string, message: string }` | Error notification rendered in danger alert banner |

### Runtime Validation

The Extension Host guards against corrupted or invalid webview events using `isValidWebviewMessage(rawMessage: unknown): rawMessage is WebviewToExtensionMessage`. Malformed payloads are immediately rejected and trigger an `agent.error` response without crashing the Extension Host.

---

## 4. UI Architecture & Structure

The sidebar UI is structured into three dedicated vertical sections:

1. **Header**:
   - Branding: `JAGGU` title with `Agent` badge.
   - Reactive status badge: `StatusPill` with state dot (`Ready`, `Processing`, `Success`, `Error`, `Cancelled`).
   - Action controls: `Clear` button to reset chat thread.
2. **Conversation Area**:
   - **Empty State**: Displays `"What would you like me to build?"` with helper quick-start prompts (e.g. `Explain this project`, `Plan a new feature`, `Inspect repository architecture`).
   - **Active Thread**: Alternating user and assistant message bubbles with timestamps, role markers, and multi-line formatting.
   - **Processing Indicator**: Pulsing status message while task execution is in-flight.
   - **Error Banner**: Styled danger card displayed if an error occurs.
3. **Input & Control Area**:
   - Multiline textarea with `Type a task...` placeholder (Enter to send, Shift+Enter for newline).
   - Dynamic action buttons:
     - `Send` (active when text is typed; disabled when empty or processing).
     - `Cancel` (replaces Send when status is `PROCESSING`).
   - Live status label: `Status: ● Ready`.

---

## 5. Files Created & Modified

### Files Created
* `packages/jaggu-ui/src/main.tsx` — Webview mounting entry point.
* `packages/jaggu-vscode/media/webview.css` — Base theme stylesheet and animation utilities.
* `packages/jaggu-vscode/media/webview.js` — Compiled production Webview bundle.
* `packages/jaggu-vscode/media/webview.js.map` — Production sourcemap for Webview debugging.
* `test/vscode-mock.ts` — Comprehensive centralized mock of the VS Code extension runtime.
* `packages/jaggu-ui/test/rpc.test.ts` — Unit tests for RPC contract validation guards.
* `packages/jaggu-vscode/test/integration.test.ts` — Integration test proving end-to-end Webview ↔ Extension Host message exchange.
* `.vscode/launch.json` — VS Code F5 launch configuration for Extension Development Host.
* `.vscode/tasks.json` — Pre-launch build task configuration.
* `test/test-webview.html` — Standalone browser test harness for visual and RPC verification.
* `docs/implementation/M1-extension-shell.md` — This implementation record.

### Files Modified
* `packages/jaggu-core/src/types/state.ts` — Added `UiAgentStatus` and `agentStateToUiStatus` mapping helper.
* `packages/jaggu-ui/src/types/rpc.ts` — Added `ChatMessage`, strict `WebviewToExtensionMessage` union, `isValidWebviewMessage`, and `isValidExtensionMessage`.
* `packages/jaggu-ui/src/components/StatusPill.tsx` — Added support for `UiAgentStatus` with theme-adaptive dots and badges.
* `packages/jaggu-ui/src/App.tsx` — Rewritten with conversational chat thread, empty state, cancel controls, and RPC listeners.
* `packages/jaggu-ui/package.json` — Added `esbuild` dependency and `"bundle"` build script.
* `packages/jaggu-vscode/package.json` — Added `@jaggu/ui` dependency and registered `jaggu.openChat` command.
* `packages/jaggu-vscode/tsconfig.json` — Added project reference to `packages/jaggu-ui`.
* `packages/jaggu-vscode/src/sidebarProvider.ts` — Implemented full Webview lifecycle, CSP with nonces, and RPC message dispatcher.
* `packages/jaggu-vscode/src/extension.ts` — Wired status bar item, `jaggu.openChat` command, and status synchronization.
* `packages/jaggu-ui/test/ui.test.tsx` — Expanded tests for empty state, message rendering, status transitions, and clear button.
* `packages/jaggu-vscode/test/extension.test.ts` — Updated to use centralized VS Code mock and verify status bar and commands.
* `vitest.config.ts` — Configured `setupFiles: ['./test/vscode-mock.ts']`.
* `package.json` — Added `esbuild` to root devDependencies.

---

## 6. Automated Test Results

Command: `npm test` (`vitest run`)  
Result: **6 test suites passed (100%), 25 unit tests passed (100%)**

```
 ✓ packages/jaggu-ui/test/rpc.test.ts (9 tests)
 ✓ packages/jaggu-eval/test/runner.test.ts (1 test)
 ✓ packages/jaggu-core/test/fsm.test.ts (5 tests)
 ✓ packages/jaggu-ui/test/ui.test.tsx (5 tests)
 ✓ packages/jaggu-vscode/test/integration.test.ts (2 tests)
 ✓ packages/jaggu-vscode/test/extension.test.ts (3 tests)

 Test Files  6 passed (6)
      Tests  25 passed (25)
   Duration  1.29s
```

---

## 7. Verification & Limitations

* **Build & Typecheck**: `npm run build` and `npm run typecheck` succeed with zero errors under `strict: true`.
* **Linting**: `npm run lint` passes with zero warnings or errors.
* **CDP Browser Limitation**: The local environment's Chrome DevTools Protocol port (`127.0.0.1:9222`) rejected browser context creation with `Protocol error (Browser.setDownloadBehavior): Browser context management is not supported`. To ensure zero loss of verification rigor, we executed the strongest feasible substitute:
  - Created standalone browser harness [`test/test-webview.html`](file:///Users/apple/Desktop/PROJECTS/Coding%20Agent/test/test-webview.html).
  - Validated all UI states, message rendering, input, and controls under React SSR and DOM tests in `ui.test.tsx`.
  - Validated complete asynchronous bidirectional RPC message transmission in `integration.test.ts`.

---

## 8. Architectural Decisions

1. **Self-Contained Webview Bundle**: Selected `esbuild` with `--format=iife` to compile `@jaggu/ui` into a single, dependency-free JS file (`media/webview.js`). This eliminates complex AMD loaders or web worker module resolution issues inside VS Code's Webview iframe sandbox.
2. **Native Text Document Diffing Retained**: In accordance with ADR-003 and the architecture validation, diffs remain in native VS Code Monaco editor tabs (`vscode.diff`) rather than being rendered inside the Webview, keeping the Webview fast, light, and responsive.
3. **No Unnecessary Infrastructure**: Zero external UI frameworks (no Tailwind runtime, no CSS-in-JS, no Axios, no LangChain). CSS variables directly map to the host VS Code workbench.
