# 01 — JAGGU Product Vision & Core Philosophy

## 1. Product Identification
- **Product Name**: JAGGU (Official Name)
- **Product Description**: AI Coding Agent
- **Tagline**: The Autonomous Software Engineering Partner Built on the VS Code Foundation.
- **Classification**: AI-Native Integrated Development Environment (IDE) & Autonomous Agent.

---

## 2. Executive Vision

Current developer tools treat artificial intelligence as an external novelty: a side-panel chatbot that answers questions in prose, or an inline autocompletion engine that predicts the next 15 characters of syntax. When developers face genuine engineering tasks—refactoring a legacy authentication module across six files, diagnosing a flaking integration test, or implementing a new REST endpoint with database migrations—they are forced to act as the human translation layer between an AI chat window and the code editor.

**JAGGU fundamentally breaks this paradigm.**

JAGGU is an **AI-native engineering environment** where developers can safely delegate end-to-end engineering tasks to an autonomous agent while retaining complete architectural oversight and transaction-level control. JAGGU does not merely talk about code; it navigates repositories, reasons about cross-file dependencies, applies surgical multi-file diffs, runs test suites in pseudo-terminals, parses compiler error diagnostics, heals its own mistakes, and presents clean, verifiable diffs for developer approval.

---

## 3. Core Philosophy: "Act, Do Not Merely Chat"

Traditional AI assistants are **passive text responders**. JAGGU is an **active engineering agent**.

```
                           THE JAGGU INTERACTION LOOP
                           
   [User Intent] ───────────────> "Add GitHub OAuth login with JWT session"
         │
         ▼
   [1. UNDERSTAND] ────────────> Analyze repository conventions & existing auth files
         │
         ▼
   [2. RETRIEVE CONTEXT] ──────> Ripgrep symbols, parse AST imports, read schemas
         │
         ▼
   [3. FORMULATE PLAN] ────────> Construct structured, phased milestone plan
         │
         ▼
   [4. HUMAN APPROVAL] ────────> Present plan to developer (Accept / Modify / Cancel)
         │
         ▼
   [5. MODIFY CODE] ───────────> Generate multi-file Myers diffs in shadow buffer
         │
         ▼
   [6. EXECUTE RUNTIME] ───────> Run build commands & test suites in pseudo-terminal
         │
         ▼
   [7. OBSERVE & DIAGNOSE] ────> Capture exit codes, stack traces, compiler errors
         │
         ▼
   [8. SELF-HEAL] ─────────────> Iterate on failures (up to max retry budget)
         │
         ▼
   [9. VERIFY & EXPLAIN] ──────> Present unified diff review with explanation & test proof
```

---

## 4. Product Tenets

### Tenet 1: Total Transparency and Deterministic Observability
The agent must never operate as an opaque black box. At every second of execution, the developer must clearly observe:
- Exactly what tool is executing (`read_file`, `search_code`, `run_command`).
- The explicit reasoning behind each decision.
- Which specific files are being inspected or modified.
- The raw output of terminal and compiler operations.

### Tenet 2: Zero-Surprise Modification (Diffs are Sovereign)
The agent shall never silently overwrite files on disk. Code changes are maintained in a transactional staging layer and presented as unified, interactive diffs where the developer can inspect additions/deletions line by line, accept hunks selectively, or reject changes entirely with a single keypress.

### Tenet 3: Close the Loop with Runtime Verification
An AI coding agent that cannot test its own code is only half an engineer. JAGGU insists on closing the feedback loop: compiling the code, running test runners (Jest, PyTest, Cargo, Go test), reading runtime stdout/stderr, and autonomously correcting syntax and logical flaws before declaring completion.

### Tenet 4: Human-in-the-Loop Authority
Developers are lead architects; JAGGU is the staff engineer. The agent must proactively ask for approval before initiating potentially destructive actions (file deletions, package installations, system shell executions, database migrations). Permissions are granular, observable, and revokeable at any instant.

### Tenet 5: Provider Agnosticism & Privacy Preservation
Developers must never be locked into a single proprietary LLM provider. JAGGU natively supports Anthropic Claude 3.5/3.7 Sonnet, OpenAI GPT-4o / o1 / o3-mini, Google Gemini 2.0 Flash / Pro, and local privacy-first models running via Ollama / vLLM. Source code must never be transmitted to external servers without explicit user consent.

---

## 5. User Experience Persona: "The Lead Engineer & Staff Pair"

When a developer uses JAGGU, the experience should emulate collaborating with a senior peer sitting beside them:
- **Concise communication**: The agent does not bloat output with unnecessary conversational pleasantries.
- **Evidence over assumption**: The agent searches for ground truth in the codebase rather than guessing API signatures.
- **Minimal surgical changes**: The agent touches only what is necessary to solve the problem, respecting existing formatting, linting rules, and architectural idioms.
- **Accountability**: If an approach fails, the agent explains why it failed, what was learned, and what alternative strategy is being deployed.
