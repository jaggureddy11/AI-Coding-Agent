# JAGGU Production Runbook & Operator Guide

**Version:** 0.1.x  
**Audience:** Developers, DevOps, QA Engineers, and System Operators

---

## 1. Installation & Environment Setup

### Prerequisites
- VS Code version `>= 1.90.0`
- Node.js version `>= 20.x` (if building from source)
- Git installed on your system PATH

### Installing the Extension VSIX
1. Download the packaged `jaggu-vscode-0.1.0.vsix` artifact.
2. In VS Code, open the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`).
3. Select **Extensions: Install from VSIX...** and choose the `jaggu-vscode-0.1.0.vsix` file.
4. Alternatively, install from terminal:
   ```bash
   code --install-extension packages/jaggu-vscode/jaggu-vscode-0.1.0.vsix
   ```
5. The **JAGGU** robot icon will appear in your primary VS Code activity bar.

---

## 2. Model Provider Configuration

### Option A: Local Ollama (100% Offline / Private)
1. Install and launch Ollama:
   ```bash
   ollama run qwen2.5-coder:7b
   ```
2. In JAGGU, click the provider dropdown and select **Ollama (Local)**.
3. Default endpoint: `http://localhost:11434`. (Can be customized under VS Code Settings: `jaggu.ollama.endpoint`).
4. Zero API keys required.

### Option B: Local OpenAI-Compatible Daemon (vLLM, LM Studio, Ollama)
1. Start your local OpenAI-compatible server at `http://localhost:1234/v1` (or your custom port).
2. Select **OpenAI Compatible (Local/Remote)** in JAGGU.
3. Configure `jaggu.openaiCompatible.endpoint` in VS Code settings.

### Option C: Cloud Providers (OpenAI, Anthropic, Gemini, Hugging Face)
1. Open Command Palette (`Cmd+Shift+P`).
2. Run **JAGGU: Manage API Keys (SecretStorage)**.
3. Select the target provider and enter your API key.
4. Keys are stored securely in your OS keychain via VS Code `SecretStorage`.

---

## 3. Daily Workflow & Safety Operations

### Initiating a Coding Task
1. Open your project folder in VS Code.
2. Open the JAGGU sidebar view.
3. Type or voice-dictate your task prompt (e.g. `"Refactor authentication middleware to use JWT bearer tokens"`).
4. Click **Send**.

### Reviewing the Engineering Plan
1. JAGGU scans the repository, gathers bounded context, and produces a structured **PlanCard**.
2. Inspect the proposed goal, steps, affected files, risks, and verification commands.
3. Click **Approve Plan** to proceed, or **Reject** to cancel.

### Reviewing Diffs & Selective Approval
1. JAGGU stages changes in an in-memory shadow buffer (`jaggu-shadow://`).
2. Click on any proposed file in the **ApprovalCard** to view the native side-by-side VS Code diff preview.
3. Check the boxes for files you approve, and uncheck any files you wish to exclude.
4. Click **Apply Changes**. Rejected files remain completely untouched on disk.

### Verifying and Inspecting Self-Healing
1. JAGGU queries the active VS Code Language Server diagnostics for compiler errors.
2. If tests or compiler diagnostics fail, JAGGU attempts bounded self-healing (up to 2 attempts).
3. If tests pass, JAGGU presents a concise summary and a suggested Git commit message.

---

## 4. Troubleshooting & Failure Recovery

| Symptom | Cause | Solution |
| :--- | :--- | :--- |
| **"Connection Refused" on Ollama** | Local Ollama daemon is not running or listening on port 11434 | Run `ollama serve` in terminal and ensure `http://localhost:11434` is accessible. |
| **"Missing API Key" in Cloud Model** | Key not configured in SecretStorage | Run command `JAGGU: Manage API Keys (SecretStorage)` and enter the key. |
| **"Conflict Detected on File"** | Disk content was modified while the agent was planning | Review your manual edits. Re-submit the prompt to re-anchor on the latest disk state. |
| **"Scope Expansion Blocked"** | Model proposed modifying a file outside the approved plan | Approve the scope prompt in UI, or re-run with an explicit plan step covering that file. |
| **Task Hanging or Slow Stream** | Upstream provider or model timeout | Click the **Cancel** button in the prompt toolbar to instantly abort the active task. |

---

## 5. Safe Bug Reporting Procedure

When reporting an issue on GitHub:
1. **NEVER share API keys, bearer tokens, or sensitive company code.**
2. Run the command **Developer: Toggle Developer Tools** in VS Code to view console logs.
3. Verify that all URLs and tokens in the error message are redacted (JAGGU automatically redacts known key patterns).
4. File an issue at [https://github.com/jaggureddy11/AI-Coding-Agent/issues](https://github.com/jaggureddy11/AI-Coding-Agent/issues).
