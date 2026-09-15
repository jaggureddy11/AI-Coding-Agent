# JAGGU — VS Code Marketplace Release Readiness Plan

**Document Version:** 1.0.0  
**Target Milestone:** Release Candidate 1 (v0.1.0)  
**Date:** September 15, 2026  
**Status:** Under Review (Phase 1 Checkpoint — Awaiting User Approval)

---

## Executive Summary & Purpose

This document constitutes the formal, exhaustive engineering plan to transition **JAGGU** from a functional multi-package TypeScript development project into a **production-grade, securely packaged, standalone `.vsix` extension ready for VS Code Marketplace submission**.

Following the **Phase 0 Release Audit**, this plan systematically addresses packaging architecture, bundle isolation, security gates, clean-room verification, and documentation prerequisites.

---

## 1. Extension Architecture Audit

### Current Topology
JAGGU is currently configured as an npm monorepo with 4 packages:
- `packages/jaggu-core`: Pure TypeScript autonomous agent orchestrator, 7-state FSM, context engine, Myers diff engine, tool executor, git safety, verification loop, and polymorphic model gateway.
- `packages/jaggu-ui`: React 18 Webview interface (`PlanCard`, `ApprovalCard`, `ModelSelector`, `ContextPill`, `StatusPill`).
- `packages/jaggu-vscode`: Extension Host entry point, sidebar view provider, Webview RPC bridge, SecretStorage credential manager, and virtual document provider.
- `packages/jaggu-eval`: 12-task SWE evaluation benchmark harness and sandbox fixtures.

### Audit Findings
- In development, `packages/jaggu-vscode/src/extension.ts` directly imports `@jaggu/core` and `@jaggu/ui`.
- `jaggu-vscode` is compiled with `tsc -b`, producing unbundled JavaScript in `packages/jaggu-vscode/dist/` that preserves external import statements (`from '@jaggu/core'`).
- In a standalone `.vsix` installed on an end-user machine, `@jaggu/core` will **not** exist in `node_modules`, causing fatal activation failure (`Cannot find module '@jaggu/core'`).
- The Webview UI (`packages/jaggu-ui`) is already bundled into a single file via `esbuild` to `packages/jaggu-vscode/media/webview.js` (170.1 KB), which works cleanly.

---

## 2. Package & Bundling Strategy

### Architectural Decision
We must bundle `packages/jaggu-vscode/src/extension.ts` using `esbuild` to produce a completely self-contained extension file at `packages/jaggu-vscode/dist/extension.js`.

### Technical Configuration
- **Bundler:** `esbuild`
- **Entry point:** `packages/jaggu-vscode/src/extension.ts`
- **Output:** `packages/jaggu-vscode/dist/extension.js`
- **Target:** `node20` (matching VS Code 1.90+ Node runtime)
- **Format:** CommonJS (`cjs`) as required by VS Code Extension Host
- **External Dependencies:**
  - `vscode` (strictly marked `--external:vscode`)
- **Inlined Internal Packages:**
  - `@jaggu/core` (fully inlined)
  - `@vscode/ripgrep` (binary locator handled safely)
  - `zod` (inlined)
- **Source Maps:** `--sourcemap` enabled for actionable error traces in VS Code Developer Tools without shipping uncompiled TypeScript source files.

---

## 3. VSIX Contents Specification

The final generated `.vsix` package must be strictly minimal, secure, and contain only runtime essentials:

### Included in VSIX:
- `package.json` (sanitized production manifest)
- `dist/extension.js` (bundled standalone extension code)
- `dist/extension.js.map` (source map)
- `media/icon.svg` & `media/icon.png` (extension icon)
- `media/webview.js` & `media/webview.js.map` (bundled Webview bundle)
- `media/webview.css` (Webview stylesheet)
- `README.md` (Marketplace documentation)
- `LICENSE` (MIT license text)
- `CHANGELOG.md` (Release changelog)

### Excluded from VSIX:
- `src/` (TypeScript source files across all packages)
- `test/` & `tests/` (all test suites, mocks, and fixtures)
- `tsconfig*.json` & `tsconfig.tsbuildinfo`
- `node_modules/` & monorepo symlinks
- `docs/` (internal engineering specs and milestone reports)
- `.vscode/` & temporary development workspaces
- `scripts/` (development runtimes)
- Any temporary `.log`, `.env`, or credential files

---

## 4. Extension Manifest Audit (`packages/jaggu-vscode/package.json`)

The manifest requires the following fixes to pass Marketplace validation:

| Field | Current State | Required Release State | Rationale |
| :--- | :--- | :--- | :--- |
| `name` | `"jaggu-vscode"` | `"jaggu"` or `"jaggu-vscode"` | Marketplace URL slug (`jaggu` recommended) |
| `displayName` | `"JAGGU"` | `"JAGGU — Autonomous AI Coding Agent"` | Descriptive title on Marketplace |
| `description` | Simple string | Accurate, non-hyperbolic capability summary | Accurate positioning |
| `version` | `"0.1.0"` | `"0.1.0"` | Valid initial semver |
| `publisher` | `"jaggu"` | `"jaggu"` (Requires verification) | Document `PUBLISHER VERIFICATION REQUIRED` |
| `repository` | Missing | `https://github.com/jaggureddy11/AI-Coding-Agent` | Mandatory for verified extensions |
| `license` | Missing | `"MIT"` | Mandatory for OSS extensions |
| `icon` | In activitybar only | Root `"icon": "media/icon.png"` | Mandatory for Marketplace listing |
| `categories` | `["AI", ...]` | `["AI", "Programming Languages", "Machine Learning"]` | Validated |
| `keywords` | Missing | `["ai", "coding-agent", "autonomous", "developer-tool", "llm"]` | Discovery on Marketplace |
| `homepage` | Missing | Repository homepage | Developer link |
| `bugs` | Missing | GitHub issues URL | Issue reporting link |

---

## 5. Dependency Audit

### Runtime vs Dev Dependencies
- In `packages/jaggu-vscode/package.json`, `@jaggu/core` and `@jaggu/ui` are listed as `"dependencies"`. When bundled with `esbuild`, these are compiled directly into `dist/extension.js`, eliminating runtime `node_modules` lookups.
- Root dependencies are all development-only (`vitest`, `esbuild`, `eslint`, `prettier`, `typescript`).
- No native C++ node addons exist in the dependency tree. `@vscode/ripgrep` binary packaging will be verified to resolve reliably in packaged environments.

---

## 6. `.vscodeignore` Architecture

Create `packages/jaggu-vscode/.vscodeignore` containing exact exclusions:
```gitignore
.vscode/**
.vscode-test/**
src/**
test/**
tests/**
**/*.test.ts
**/*.spec.ts
tsconfig*.json
*.tsbuildinfo
node_modules/**
.gitignore
.prettierrc
eslint.config.mjs
vitest.config.ts
**/*.map
```
*(Note: Source maps will be evaluated for size budget before final exclusion/inclusion).*

---

## 7. License Compliance

- An official **MIT License** file will be created at the repository root (`LICENSE`) and copied/referenced into `packages/jaggu-vscode/LICENSE`.
- Copyright holder will be established: `Copyright (c) 2026 JAGGU Authors`.
- Manifests across all packages will explicitly declare `"license": "MIT"`.

---

## 8. Repository Metadata & Cleanliness

- Eliminate relative `file:///Users/apple/...` links in public markdown files (`README.md`, `packages/jaggu-vscode/README.md`) in favor of relative links (`docs/...`).
- Add `.github/` templates:
  - Issue templates (Bug report, Feature request)
  - Pull request template
- Ensure `.gitignore` ignores `tsconfig.tsbuildinfo` and untracked temporary evaluation logs.

---

## 9. Marketplace Metadata & Presentation

- Construct complete extension listing tags:
  - **Banner Color:** Dark theme matching `#1e1e1e` / `#252526`.
  - **Badge Support:** GitHub release, MIT license, build status.
  - **Q&A:** GitHub Discussions / Issues.

---

## 10. Marketplace-Grade README (`packages/jaggu-vscode/README.md`)

The extension package README will be tailored specifically for Marketplace consumers:
1. **Overview**: Honest, clear value proposition (*"Developer-controlled AI coding agent that understands repositories, formulates plans, executes diffs, and verifies results"*).
2. **Features**: Context retrieval, structured planning, shadow buffer staging, test execution, self-healing, Git safety.
3. **Architecture Diagram**: Clean ASCII pipeline (`VS Code ➔ Extension ➔ Orchestrator ➔ Context/Tools/Verification ➔ Model Gateway ➔ Cloud/Local LLMs`).
4. **Installation**: Marketplace install vs `.vsix` developer install.
5. **Model Configuration**: Clear setup for Ollama (local), OpenAI-compatible (vLLM/LM Studio), Anthropic, OpenAI, Gemini, Hugging Face.
6. **Security & Privacy**: Explanation of SecretStorage, zero middleman telemetry, and local air-gapped capabilities.
7. **Known Limitations**: Clear disclosure of current file-level approval, local hardware prerequisites, and LLM non-determinism.

---

## 11. Screenshots & Visual Assets

- **Icon**:
  - Convert `media/icon.svg` to a crisp 128x128 PNG (`media/icon.png`) for Marketplace compliance.
- **Screenshots**:
  - Marketplace guidelines recommend 1280x800 or 1920x1080 high-contrast screenshots.
  - Required views:
    1. JAGGU Sidebar & Model Selector.
    2. Interactive PlanCard & Scope Approval.
    3. Multi-file Diff Preview in VS Code.
    4. Diagnostics & Self-Healing Terminal Verification.
  - If dynamic capture inside headless CLI is constrained, report as `SCREENSHOTS: MANUAL CAPTURE REQUIRED` with exact reproduction instructions.

---

## 12. Configuration & Settings Audit

Audit all contributed settings in `packages/jaggu-vscode/package.json`:
- `jaggu.provider`: Add `'huggingface'` to the enum and description. Ensure default is `'mock'` or `'ollama'`.
- `jaggu.model`: Ensure default is clear and documented.
- `jaggu.ollama.endpoint`: Default `http://localhost:11434`.
- `jaggu.openaiCompatible.endpoint`: Default `http://localhost:1234/v1`.
- `jaggu.model.contextLimit`: Default `0` (auto).
- `jaggu.temperature`: Default `0.2` (bounded [0.0, 1.0]).
- Audit code in `extension.ts` and `sidebarProvider.ts` to ensure all settings update dynamically without requiring extension restart.

---

## 13. Command Registration & Palettes

Synchronize `contributes.commands` in `package.json` with registered handlers in `extension.ts`:
- `jaggu.openChat`: Open sidebar view.
- `jaggu.startSession`: Focus and initialize session.
- `jaggu.cancelSession`: Cancel active agent task immediately.
- `jaggu.setApiKey`: Securely store API key in `SecretStorage`.
- `jaggu.selectProvider`: QuickPick provider selector.
- `jaggu.selectModel`: QuickPick model selector.
- Internal commands (`jaggu.reviewDiff`, `jaggu.approvePlan`, `jaggu.rejectPlan`, `jaggu.approveEditSet`, `jaggu.rejectEditSet`) will be documented or hidden from command palette using `"when": "false"`.

---

## 14. Activation Behavior & Lazy Loading

- **Activation Event:** Change from broad `onStartupFinished` to lazy on-demand activation:
  - `onView:jaggu.sidebarView`
  - `onCommand:jaggu.openChat`
  - `onCommand:jaggu.startSession`
- Ensures extension does not consume memory or CPU until the developer explicitly opens JAGGU or invokes a command.

---

## 15. Webview Security & Content Security Policy (CSP)

- Verify `nonce`-based CSP in `sidebarProvider.ts`:
  - `default-src 'none';`
  - `style-src ${webview.cspSource} 'unsafe-inline';`
  - `script-src 'nonce-${nonce}';`
  - `img-src ${webview.cspSource} https: data:;`
  - `font-src ${webview.cspSource};`
- Verify Webview RPC strictly uses `isValidWebviewMessage` schema validation before handling messages.
- Ensure no arbitrary HTML or script injection is possible through model responses.

---

## 16. Credential Security & SecretStorage

- Audit `CredentialManager`:
  - API keys are stored exclusively in `context.secrets` (`vscode.SecretStorage`).
  - No credentials are ever saved to `settings.json`, workspace files, or Git.
  - Secret keys are stripped before logging or sending messages to Webview.
  - Automated `SecretSanitizer` scrubs OpenAI, Anthropic, Gemini, and Hugging Face tokens from debug channels and telemetry.

---

## 17. Model Provider Security & Containment

- All cloud requests use direct TLS connections (`fetch` with HTTPS) directly to model vendor endpoints.
- No third-party relay or proxy servers.
- Model inputs are sanitized for prompt injection using `PromptInjectionSanitizer`.
- Model outputs are treated as **untrusted input**: all proposed edits require human approval and must pass through `VirtualDocStore` staging.

---

## 18. Error Handling & Fault Recovery

Audit all external boundaries:
1. **Model Gateway Network Failure**: Maps network dropouts to structured `NETWORK_ERROR` with retry advice instead of crashing Extension Host.
2. **Invalid API Key**: Maps 401/403 to `AUTH_FAILURE` prompting user to run `JAGGU: Manage API Keys`.
3. **Local Daemon Down**: Detects offline Ollama/vLLM daemon and provides actionable startup command (`ollama serve`).
4. **Git Conflict**: Detects dirty worktrees and aborts with user notification rather than force-overwriting.

---

## 19. Cancellation Robustness

- Validate `AbortController` propagation:
  - Triggers immediate HTTP stream abort on active model request.
  - Aborts child process terminal tasks in pseudo-terminal.
  - Clears `VirtualDocStore` pending shadow diffs.
  - Emits `agent.cancelled` event and resets status bar to `IDLE`.

---

## 20. Packaged-Extension Testing Strategy

Automated validation will test the actual packaged output:
- Verify that `dist/extension.js` can be loaded by Node without missing module errors.
- Validate that all required assets exist in the `.vsix` archive using `unzip -l`.
- Ensure package size is reasonable (< 15 MB).

---

## 21. Clean Installation Testing Protocol

A rigorous clean-room test will be executed:
1. Package extension into `jaggu-0.1.0.vsix`.
2. Set up an isolated temporary test directory simulating a clean machine without access to the monorepo root.
3. Test unzipping and instantiating the packaged bundle in a headless mock VS Code harness.
4. Verify end-to-end activation, webview asset loading, and RPC dispatch.

---

## 22. Marketplace Publishing Requirements

- **Publisher ID:** Check if `jaggu` is owned. If unverified, flag `PUBLISHER VERIFICATION REQUIRED` and document how the developer updates `publisher` in `package.json` with their personal Visual Studio Marketplace publisher name.
- **Personal Access Token (PAT):** Document how to use `vsce publish -p <PAT>` securely without hardcoding tokens.
- **Open VSX Registry:** Document publishing to the Eclipse Open VSX registry (for VSCodium and Gitpod users).

---

## 23. Versioning Strategy

- Initial public release: **`0.1.0`**.
- Semantic versioning:
  - `0.1.x`: Patch releases (bug fixes, packaging updates).
  - `0.2.x`: Minor feature additions (new models, enhanced diffs).
  - `1.0.0`: Reached only after widespread real-world developer validation.

---

## 24. Release Checklist (`docs/MARKETPLACE_RELEASE_CHECKLIST.md`)

We will generate a step-by-step interactive checklist tracking all 18 pre-flight release gates:
- Account setup, asset preparation, packaging, audit, smoke testing, and submission.

---

## 25. Known Limitations & Disclosure

Document the following upfront in `README.md` and `docs/RELEASE_READINESS_REPORT.md`:
1. **File-Level vs Hunk-Level Approval**: The MVP supports selective file-level approval and diff reviews; individual hunk-level staging will arrive in v0.2.0.
2. **Local Model Hardware**: Local Ollama execution requires sufficient host RAM/VRAM (minimum 8GB for 7B models, 16GB+ recommended).
3. **Network Requirements**: External cloud providers (Claude, GPT, Gemini, Hugging Face) require outbound Internet access.
4. **Non-Deterministic Reasoning**: Agent reasoning depends on the underlying LLM selected; code output must always be verified by the human developer.

---

## Verification Plan

### Automated Regression
```bash
npm run typecheck
npm run lint
npm test
```

### Packaging Verification
```bash
npm run build:extension
npx @vscode/vsce package --no-git-tag-version
```

### Content Inspection
```bash
unzip -l jaggu-vscode-0.1.0.vsix
```

---

## Stop Condition
> **STOP 1**: This plan is now complete and saved at `docs/RELEASE_READINESS_PLAN.md`.  
> We will wait for user approval before making any code modifications or packaging executions.
