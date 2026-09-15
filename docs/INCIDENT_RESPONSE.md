# JAGGU Incident Response & Remediation Plan

This document outlines the operational procedures for managing and resolving security, reliability, or integrity incidents affecting the JAGGU VS Code extension.

---

## 1. Incident Classifications & Playbooks

### 1.1 Credential / Secret Exposure
**Triggers**: An API token, Bearer token, or credential appears in extension logs, Webview RPC payload, error message, or public repository.
- **Contain**:
  1. Revoke the exposed token/key immediately at the provider console (OpenAI, Anthropic, Hugging Face, Gemini).
  2. If committed to git, purge the commit history using `git filter-repo` / BFG and rotate repository access tokens.
- **Investigate**:
  1. Audit `SecretStorage` retrieval paths and logging calls (`outputChannel.appendLine`, `console.error`, error message strings).
  2. Trace why the redaction filter (`sanitizeSecretStrings`) did not mask the token.
- **Patch**:
  1. Update regex patterns in `packages/jaggu-core/src/tools/security.ts` to cover the unredacted format.
  2. Ensure all error pathways pipe through sanitization before dispatching to Webview or logs.
- **Regression Test**: Add a test case to `packages/jaggu-core/test/adversarialSecurity.test.ts` verifying redaction of the exact token structure.
- **Release**: Issue a patch release (`0.1.x+1`).
- **Communicate**: Notify the affected user with recommended revocation steps.

---

### 1.2 Path Traversal or Workspace Escape Vulnerability
**Triggers**: A model output or malicious payload attempts or succeeds in reading/writing outside the active workspace directory.
- **Contain**:
  1. Disable automatic file mutation tools or advise users to reject edit proposals pending update.
  2. Document the exact attack vector (e.g., symlink chains, Unicode normalization, case-insensitive collision).
- **Investigate**:
  1. Trace `resolveAndValidateWorkspacePath` in `packages/jaggu-core/src/tools/security.ts`.
  2. Inspect realpath canonicalization logic against the active platform (macOS, Linux, Windows).
- **Patch**:
  1. Harden path canonicalization and workspace containment checks.
  2. Enforce strict `fs.realpathSync` comparison against authorized root boundaries.
- **Regression Test**: Add traversal test vector to `adversarialSecurity.test.ts` on all supported OS platforms.
- **Release**: Publish urgent hotfix release.
- **Communicate**: Disclose via GitHub Security Advisory with CVE if applicable.

---

### 1.3 Destructive Command / Git Operation Vulnerability
**Triggers**: Tool execution or model output executes an unapproved or destructive terminal command (e.g., `git reset --hard`, `git clean -fd`, `rm -rf`).
- **Contain**:
  1. Identify the runner or command tool invoked.
  2. Verify command validation gate and runner whitelist.
- **Investigate**:
  1. Determine if shell metacharacters escaped argument parsing (`execFile` vs `spawn` with `shell: false`).
  2. Verify if runner whitelist in `testRunner.ts` was bypassed.
- **Patch**:
  1. Enforce zero `shell: true` execution in all subprocesses.
  2. Restrict arguments to strict alphanumeric/flag whitelists without argument interpolation.
- **Regression Test**: Add command injection and shell metacharacter tests to test suite.
- **Release**: Deploy patch release.
- **Communicate**: Publish advisory documenting the patch and update guidelines.

---

### 1.4 Malicious Model Response / Prompt Injection Exploitation
**Triggers**: Adversarial repo content tricks the LLM into attempting scope expansion, unauthorized edits, or reading sensitive files (`.env`, `id_rsa`).
- **Contain**:
  1. Check if the Edit Review / Scope Approval gate blocked execution. (By design in JAGGU, all mutations require user approval).
- **Investigate**:
  1. Analyze repo files that induced the behavior.
  2. Check prompt defanging and boundary delineation (`<workspace_file path="...">`).
- **Patch**:
  1. Tighten system prompt instruction boundaries.
  2. Ensure sensitive file shields (`isSensitiveFilePath`) reject context inclusion unless explicitly requested.
- **Regression Test**: Add prompt injection benchmark case to `packages/jaggu-eval`.
- **Release**: Update core prompt templates and engine.
- **Communicate**: Detail defensive prompt architecture in documentation.

---

### 1.5 Compromised Dependency / Supply-Chain Alert
**Triggers**: Dependabot, GitHub Security Advisory, or `npm audit` reports a Critical or High severity CVE in a production dependency.
- **Contain**:
  1. Audit if the vulnerable code path is invoked at runtime. Note: JAGGU bundles extension dependencies with esbuild into a single file with zero runtime `node_modules`.
- **Investigate**:
  1. Check `package-lock.json` and dependency tree (`npm ls <pkg>`).
  2. Test whether updating the package introduces breaking API changes.
- **Patch**:
  1. Bump dependency to patched version in `package.json`.
  2. Rebuild and verify bundle size and compatibility.
- **Regression Test**: Run `npm test`, `npm run typecheck`, `npm run lint`, `npm audit`.
- **Release**: Tag and release patched extension.
- **Communicate**: Reference dependency CVE in release notes.

---

## 2. Standard Remediation Lifecycle

Every reported incident must follow the 6-step lifecycle:

```text
1. CONTAIN         Isolate impact, revoke tokens, document vector
       ↓
2. INVESTIGATE     Root cause analysis in sandbox reproduction
       ↓
3. PATCH           Implement minimal, robust, non-regressive fix
       ↓
4. REGRESSION TEST Automated test case proving the vulnerability is closed
       ↓
5. RELEASE         Clean build, typecheck, lint, VSIX verification, publish
       ↓
6. COMMUNICATE     Publish GitHub Security Advisory and release notes
```

---

## 3. Communication Channels & Escalation

- **Private Reporting**: `security@jaggu.dev` or GitHub Security Advisory.
- **Public Disclosure Timing**: In accordance with standard 90-day coordinated disclosure, or immediate disclosure once a patch is published.
- **Release Notes**: Clear, transparent descriptions of what was fixed without exposing exploit details prior to patch availability.
