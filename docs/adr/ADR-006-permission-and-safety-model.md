# ADR-006: Three-Tier Safety & Permission Verification Model

## Status
Accepted

## Context
AI agents equipped with terminal runners and file-deletion tools can execute arbitrary code on developer workstations. Vulnerabilities such as prompt injection (e.g. from malicious comments in untrusted open-source repos) could instruct the agent to run destructive commands (`rm -rf ~`, `curl | bash`, exfiltrating `.env` secrets).

## Decision
JAGGU implements a **Strict Three-Tier Permission Classification Engine**:
- **SAFE (Tier 1)**: Read-only, idempotent operations (`read_file`, `search_code`, `list_directory`, `git_status`). Auto-executed.
- **MODERATE (Tier 2)**: File edits and standard build/test runners (`write_file`, `npm test`). Configurable auto or single plan approval.
- **HIGH_RISK (Tier 3)**: File deletions, arbitrary shell executions, package installations, network calls, dotfile/credential reads. Mandatory explicit modal authorization.

In addition, a hard denylist immediately aborts dangerous commands (`sudo`, fork bombs, raw disk writes).

## Alternatives Considered
- **Unrestricted Autonomous Execution (Autonomous Mode)**:
  - *Why Rejected*: Unacceptable security liability for professional engineering environments.
- **Ask Permission for Every Single File Read**:
  - *Why Rejected*: Creates extreme prompt fatigue. Developers quickly develop "click-through blindness," approving everything blindly without reading.

## Reasoning
1. **Ergonomic Safety**: Safe operations run at maximum speed; genuine dangers require conscious intervention.
2. **Deterministic Denylist**: Critical system vectors are blocked before any prompt reaches the user.
3. **Secret Protection**: Dedicated regex sanitizers scrub sensitive keys before prompts are dispatched over the network.

## Consequences
- **Positive**: Enterprise-grade security posture; zero risk of unattended disastrous commands; minimizes developer alert fatigue.
- **Negative**: High-risk tasks require at least one human interaction step.
