# Contributing to JAGGU

Thank you for your interest in contributing to **JAGGU**!

JAGGU is an autonomous AI coding agent built with strict architectural invariants and professional engineering standards.

---

## Code of Conduct & Architectural Invariants

When submitting PRs or modifying code, please adhere to these non-negotiable standards:
1. **Strict TypeScript**: No unchecked `any`. Enable strict null checks and proper typed contracts across all boundaries.
2. **Minimal Dependencies**: Do not introduce heavy dependencies or frameworks without consensus.
3. **Decoupled Architecture**: Maintain clear package boundaries:
   - `packages/jaggu-core`: Zero VS Code or browser dependencies. Pure TypeScript.
   - `packages/jaggu-ui`: Webview React UI.
   - `packages/jaggu-vscode`: Extension Host integration and VS Code API bridge.
   - `packages/jaggu-eval`: Scientific benchmarking.
4. **100% Test Passing Invariant**: Every change must include automated unit/integration tests and pass the entire test suite (`npm test`).
5. **Zero Secret Leaks**: Never commit API keys, tokens, or personal paths.

---

## Local Development Workflow

```bash
# 1. Clone repository
git clone https://github.com/jaggureddy11/AI-Coding-Agent.git
cd AI-Coding-Agent

# 2. Install dependencies
npm install

# 3. Build monorepo packages
npm run build

# 4. Run test suite
npm test

# 5. Typecheck and lint
npm run typecheck
npm run lint

# 6. Build and package extension
npm run package:extension
```

Press **`F5`** in VS Code to launch the Extension Development Host for interactive debugging.
