# Security Policy

## Reporting Security Issues

We take the security of **JAGGU** and our users' codebases seriously.

If you discover a potential vulnerability or security flaw in JAGGU, **please do not disclose it publicly in GitHub issues or discussions.**

Instead, please report it privately:
- Email: security@jaggu.dev (or via private GitHub Security Advisory)
- Include:
  - Detailed description of the vulnerability
  - Step-by-step reproduction instructions or proof of concept
  - Affected versions and configurations

We will acknowledge receipt within 48 hours and work with you to remediate and patch the issue responsibly.

---

## Security Principles in JAGGU

1. **Secret Containment**: API keys are stored exclusively in VS Code `SecretStorage` (backed by the OS Keychain / Credential Manager). They are never written to disk, committed to git, or sent to Webviews.
2. **Untrusted Model Output**: All AI-generated code edits, commands, and plans are treated as untrusted input. They require explicit developer approval and are staged in an in-memory shadow buffer before disk mutation.
3. **Workspace Isolation**: Tool operations validate file paths against active workspace roots to prevent directory traversal attacks.
4. **Direct TLS**: Communication with cloud model providers occurs over direct HTTPS connections with no intermediate telemetry relay servers.
