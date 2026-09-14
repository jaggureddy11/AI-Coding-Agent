# JAGGU Milestone M7-A: Live Local-Model Validation Plan

## Objective

Validate that JAGGU's developer-controlled AI coding agent architecture functions end-to-end when powered by a **real, locally hosted coding model**, rather than deterministic test mocks.

The invariant boundary must be proven:

$$\text{Model Proposes} \longrightarrow \text{JAGGU Validates} \longrightarrow \text{Developer Approves} \longrightarrow \text{JAGGU Executes}$$

This live validation determines whether local open-weight models can generate structured plans, adhere to bounded repository context, produce tool calls, submit multi-file edit sets for developer review, and navigate diagnostics/verification without compromising JAGGU's security guarantees.

---

## 1. Hardware & Environment Baseline

Current host environment inspected:
- **Operating System**: macOS (Darwin 24.6.0, x86_64)
- **CPU**: Intel(R) Core(TM) i7-1068NG7 CPU @ 2.30GHz (8 cores)
- **RAM**: 34,359,738,368 bytes (~32 GB Unified / System RAM)
- **Package Manager**: Homebrew (`/usr/local/bin/brew`)
- **Current Runtime Status**: Ollama not currently installed or running on port 11434.

### Resource & Model Sizing Analysis
- The machine has ample RAM (32 GB) to run models up to 14B parameters in 4-bit quantization, but operates on an Intel CPU (AVX2/Metal CPU inference) without an Apple Silicon Neural Engine or discrete NVIDIA GPU.
- **Inference Speed Expectation on CPU**:
  - 1.5B–3B parameter models: ~18–30 tokens/sec.
  - 7B parameter models (e.g. Qwen 2.5 Coder 7B Q4_K_M ~4.7 GB): ~6–12 tokens/sec.
  - 8B reasoning models (DeepSeek-R1 8B Q4 ~4.9 GB): ~5–10 tokens/sec.
- Both 7B and smaller coding models fit comfortably within the 32 GB RAM budget with zero swap overhead.

---

## 2. Model Selection Strategy

### Primary Live Model: `qwen2.5-coder:7b` (or `qwen2.5-coder:1.5b` fallback for speed)
* **Model**: Qwen 2.5 Coder 7B Instruct (`Qwen/Qwen2.5-Coder-7B-Instruct`)
* **Provider**: `ollama` (Local)
* **Why this model is appropriate**:
  1. Already registered in JAGGU's `ModelRegistry` catalog as the primary recommended local coding model.
  2. Native function calling / tool calling capability supported directly in Ollama `/api/chat`.
  3. Pre-calibrated for structured output, JSON generation, and multi-file code diff generation.
  4. 32K context window fits localized repository tasks with headroom.
  5. Fits cleanly into the 32 GB RAM footprint.

### Secondary Non-Tool Model (Phase 6): `deepseek-r1:8b`
* **Model**: DeepSeek-R1 Distill 8B (`deepseek-ai/DeepSeek-R1-Distill-Llama-8B`)
* **Provider**: `ollama` (Local)
* **Why this model is appropriate**:
  1. Explicitly designated in JAGGU's `ModelRegistry` with `capabilities.toolCalling: false`.
  2. Directly validates that JAGGU does not force tool definitions onto reasoning-only models or interpret free-form text as unauthorized tool executions.

---

## 3. Required Setup & Installation Commands

To enable live execution, the following setup steps are required:

```bash
# 1. Install Ollama via Homebrew
brew install ollama

# 2. Start Ollama service in background
ollama serve > /tmp/ollama.log 2>&1 &

# 3. Verify daemon connectivity
curl -s http://localhost:11434/api/tags

# 4. Pull the target coding model (Qwen 2.5 Coder 7B, ~4.7 GB)
ollama pull qwen2.5-coder:7b

# Optional: For non-tool capability test (Phase 6)
ollama pull deepseek-r1:8b
```

*Note: If network restrictions or environment policies prevent downloading multi-gigabyte models in this session, this plan defines the exact criteria to report honest fallback without fabrication.*

---

## 4. Test Matrix & Detailed Workflow

### Test 1: Direct Provider Verification (`OllamaProvider` Direct)
- **Goal**: Verify JAGGU's `OllamaProvider` communicates directly with the live Ollama daemon.
- **Workflow**:
  ```text
  ModelGateway -> OllamaProvider.streamChat -> http://localhost:11434/api/chat -> stream tokens
  ```
- **Assertions**:
  - Health check `checkHealth()` returns `reachable: true` and includes `qwen2.5-coder:7b`.
  - Non-tool chat stream emits `token` events with real text deltas.
  - Streaming usage metrics (`prompt_eval_count`, `eval_count`) are populated.
  - Mid-stream cancellation via `AbortController` cleanly terminates the HTTP request.

### Test 2: Real Agent Workflow (Controlled Fixture Task)
- **Fixture**: `packages/jaggu-eval/fixtures/fixture-04-boundary-validation`
- **Task Prompt**:
  > "Add input validation for email and password to the existing validator module. Email must contain '@' and '.', password must be at least 8 characters. Add comprehensive tests in test/validator.test.ts. Do not modify unrelated files."
- **Expected Step-by-Step Lifecycle**:
  1. **Task Submission & Context Assembly**: ContextEngine grounds the prompt with `validator.ts` and `package.json`.
  2. **Plan Generation (`PLANNING` -> `PLAN_REVIEW`)**: Live model proposes a structured plan with steps and affected files. PlanValidator validates schema.
  3. **Human Gate 1 (Plan Approval)**: Approval required before code generation.
  4. **Code Generation & EditSet (`EDIT_REVIEW`)**: Live model requests tools or emits structured edit changes in shadow documents.
  5. **Human Gate 2 (Edit Approval)**: Developer approves the changes.
  6. **Atomic Application**: EditSetManager validates base hashes and updates disk.
  7. **Diagnostics & Test Verification**: `run_tests` tool executes the fixture test suite.
  8. **Self-Healing (if test fails)**: If the local model makes a typo, bounded repair loop kicks in.
  9. **Summary**: Clean task completion report.

### Test 3: Model Without Tool Calling (`deepseek-r1:8b`)
- **Goal**: Verify that switching to a reasoning model with `toolCalling: false` does not pass tool definitions or execute unvalidated tool commands.
- **Workflow**:
  - Developer selects `deepseek-r1:8b` via `model.select`.
  - Submit request asking for code explanation.
  - Verify no tool definitions are sent in `/api/chat`.
  - Verify model provides explanation safely without executing tools.

### Test 4: Model Switching & State Preservation
- **Goal**: Switch between `qwen2.5-coder:7b` and `local-openai-default` (or `mock-fast`).
- **Assertions**:
  - `model.select` RPC updates active model without restarting extension.
  - Health state indicators in Webview reflect real-time status.
  - No secrets leak into RPC payloads.

### Test 5: Safe Failure Handling
- **Scenarios**:
  1. Request an uninstalled model (`ollama-non-existent-model`).
  2. Point `jaggu.ollama.endpoint` to an invalid port (e.g. `http://localhost:59999`).
- **Assertions**:
  - Provider surfaces `MODEL_NOT_FOUND` or `NETWORK_ERROR`.
  - Extension host emits structured `agent.error` rather than unhandled promise rejections or crashes.

---

## 5. Security & Invariant Verification Checklist

During all live tests, the following invariants are strictly validated:

| Security Invariant | Verification Mechanism | Success Criteria |
| :--- | :--- | :--- |
| **Untrusted Output** | Schema parse in `ToolExecutor` and `PlanValidator` | Model output cannot bypass Zod schema or inject arbitrary keys |
| **Workspace Containment** | Path validation in file tools | Paths outside fixture root are rejected with permission errors |
| **Human Approval Gates** | Orchestrator state transitions | Edits cannot touch disk without explicit developer approval |
| **Secret Isolation** | Webview message interceptor | Zero API keys or tokens in `ExtensionToWebviewMessage` |
| **Command Execution** | Tool whitelist | No arbitrary shell or bash tool exposed to the model |
| **Cancellation Integrity** | AbortSignal listener on fetch stream | Cancellation immediately halts Ollama token generation |

---

## 6. Evidence Collection & Metrics

During the live validation run, the following observational metrics will be recorded:
1. **Environment Spec**: OS version, CPU, available RAM, Ollama version.
2. **Model Metadata**: Parameter size, quantization type, context size.
3. **Observational Latencies**:
   - Time to First Token (TTFT).
   - Generation tokens per second (approximate completion latency).
   - End-to-end task turnaround time.
4. **Agent Lifecycle Tracing**:
   - Number of tokens evaluated and generated.
   - Plan validation iterations (self-corrections if any).
   - EditSet file count and diff accuracy.
   - Verification test results.
5. **Transcript & Log Output**:
   - Verifiable raw output snippets preserved in `docs/M7A_LIVE_VALIDATION.md`.

---

## 7. Failure Criteria & Honesty Policy

- **Defect Threshold**: Any uncaught exception, tool escape, secret leak, or bypassed approval gate is an immediate critical failure.
- **Honesty Invariant**:
  If Ollama cannot be installed or models cannot be downloaded (e.g. storage/bandwidth/permission limits), we will state explicitly:
  > `Live local-model validation could not be completed in this environment.`
  > `The provider implementation was verified through deterministic mocked tests.`
  We will **under no circumstances** fabricate live model outputs or artificial latencies.
