# M7-A Live Validation Report: Online (Hugging Face) + Offline (Ollama) AI Support

**Date:** September 14, 2026  
**Milestone:** M7-A Live Validation (Online & Offline AI)  
**Target:** Proving JAGGU Operates Across Both Online (Hugging Face Serverless) and Offline (Ollama Local) AI Runtimes

---

## 1. Executive Summary & Calibration of Claims

JAGGU's multi-model and local AI architecture was validated across both **ONLINE** and **OFFLINE** execution paths on macOS (`x86_64`).

* **ONLINE AI (Hugging Face Inference) — FULL LIVE VALIDATION PASSED**:
  * Validated live via `HuggingFaceProvider` connecting to `https://router.huggingface.co/v1`.
  * Tested with real open-weight coding model: **`Qwen/Qwen2.5-Coder-32B-Instruct`** (and `meta-llama/Llama-3.1-8B-Instruct`).
  * Real streaming SSE inference, token generation, usage metrics, mid-stream cancellation, and `AUTH_FAILURE` classification were verified directly against the live Hugging Face API.
* **OFFLINE AI (Ollama Local Runtime) — RUNTIME/CONNECTIVITY VALIDATED; LOCAL-MODEL INFERENCE PENDING**:
  * Validated live via `OllamaProvider` connecting to the local Ollama daemon (`0.34.0`) running at `http://localhost:11434`.
  * Probed `/api/tags` endpoint, verified missing model handling (`MODEL_NOT_FOUND`), and verified connection refusal error mapping (`NETWORK_ERROR`).
  * **Honest Assessment**: Because Ollama returned `{"models":[]}` and pulling multi-gigabyte weights (`qwen2.5-coder:7b` / `1.5b`) was throttled by the CDN in this sandboxed environment, **live Ollama runtime reachability, provider abstraction, and error classification are fully proven, while genuine local-model inference on local weights remains pending local model download**.
* **UNIFIED SAFETY ARCHITECTURE**:
  * Both online and offline models operate strictly under the same JAGGU agent boundary:
    $$\text{Model Proposes} \longrightarrow \text{JAGGU Validates} \longrightarrow \text{Developer Approves} \longrightarrow \text{JAGGU Executes}$$
  * Neither provider can bypass human approval gates (`PLAN_REVIEW`, `EDIT_REVIEW`), execute arbitrary shell commands, or escape workspace boundaries.

---

## 2. Environment Details

* **Operating System:** macOS Darwin 24.6.0 (`x86_64`)
* **CPU:** Intel Core i7-1068NG7 (4 cores / 8 threads @ 2.30 GHz)
* **RAM:** 32 GB LPDDR4X
* **Node.js Version:** v20.x+
* **Online Endpoint:** `https://router.huggingface.co/v1` (Hugging Face Serverless Inference Router)
* **Offline Endpoint:** `http://localhost:11434` (Ollama Daemon v0.34.0)
* **Network Status:** Connected to Hugging Face Cloud Router; local Ollama running on localhost (`http://localhost:11434`).

---

## 3. Tested Model Profiles

### Model 1: Online AI — `Qwen/Qwen2.5-Coder-32B-Instruct`
* **Provider:** Hugging Face Serverless Inference (`huggingface`)
* **License:** Apache 2.0 (open-weight)
* **Context Window:** 32,768 tokens (up to 131,072 native)
* **Max Output Tokens:** 8,192
* **Tool Calling Capability:** Supported (`supports_tools: true` on backend vLLM engine)
* **Structured Output Capability:** Supported
* **Authentication:** SecretStorage `jaggu.apiKey.huggingface`
* **Live Inference Status:** **LIVE PASS** (Verified live token streaming, JSON generation, usage stats, abort cancellation)

### Model 2: Online AI Alternative — `meta-llama/Llama-3.1-8B-Instruct`
* **Provider:** Hugging Face Serverless Inference (`huggingface`)
* **License:** Llama 3.1 Community License (open-weight)
* **Context Window:** 128,000 tokens
* **Tool Calling Capability:** Supported
* **Live Discovery Status:** **LIVE PASS** (Discovered in live model router catalogue)

### Model 3: Offline AI — `qwen2.5-coder:7b`
* **Provider:** Ollama Local Daemon (`ollama`)
* **Endpoint:** `http://localhost:11434`
* **License:** Apache 2.0 (open-weight)
* **Context Window:** 32,768 tokens
* **Tool Calling Capability:** Supported via native Ollama tool schema
* **Live Runtime Status:** **RUNTIME LIVE PASS / INFERENCE PENDING** (Daemon reachability verified, `MODEL_NOT_FOUND` classification verified, `NETWORK_ERROR` recovery verified; model weight download pending).

---

## 4. Comprehensive Comparison Matrix

| Capability / Workflow | Hugging Face (Online) | Ollama (Offline) | Validation Type |
| :--- | :--- | :--- | :--- |
| **Runtime Reachable** | **PASS** | **PASS** | **LIVE** |
| **Real Live Inference** | **PASS** | **PENDING WEIGHT DOWNLOAD** | **LIVE (HF) / PENDING (Ollama)** |
| **Token Streaming (SSE/NDJSON)** | **PASS** | **PASS** (Runtime/Mock) | **LIVE (HF) / MOCKED (Ollama)** |
| **Mid-Stream Cancellation** | **PASS** | **PASS** (Runtime/Mock) | **LIVE (HF) / MOCKED (Ollama)** |
| **Authentication Error Handling** | **PASS** (`AUTH_FAILURE`) | **N/A** (Local endpoint) | **LIVE** |
| **Missing Model Error Handling** | **PASS** (`MODEL_NOT_FOUND`) | **PASS** (`MODEL_NOT_FOUND`) | **LIVE** |
| **Network Failure Handling** | **PASS** (`NETWORK_ERROR`) | **PASS** (`NETWORK_ERROR`) | **LIVE** |
| **Tool Calling Translation** | **PASS** | **PASS** | **LIVE (HF) / MOCKED** |
| **Repository Context Grounding** | **PASS** | **PASS** | **MOCKED / HARNESS** |
| **Planning & Plan Validation** | **PASS** | **PASS** | **MOCKED / HARNESS** |
| **PLAN_REVIEW Human Gate** | **PASS** | **PASS** | **MOCKED / HARNESS** |
| **Multi-File EditSet Proposal** | **PASS** | **PASS** | **MOCKED / HARNESS** |
| **EDIT_REVIEW Approval Gate** | **PASS** | **PASS** | **MOCKED / HARNESS** |
| **Atomic Apply with Rollback** | **PASS** | **PASS** | **MOCKED / HARNESS** |
| **LSP Diagnostics Integration** | **PASS** | **PASS** | **MOCKED / HARNESS** |
| **Verification Test Loop** | **PASS** | **PASS** | **MOCKED / HARNESS** |
| **Self-Healing Repair Loop** | **PASS** | **PASS** | **MOCKED / HARNESS** |
| **Git Safety & User Preservation** | **PASS** | **PASS** | **MOCKED / HARNESS** |
| **Model Switching UI & Routing** | **PASS** | **PASS** | **MOCKED / HARNESS** |

---

## 5. Security & Secret Isolation Verification

1. **Hugging Face Token Protection**:
   ```text
   Hugging Face Token
          ↓
   VS Code SecretStorage (jaggu.apiKey.huggingface)
          ↓
   Extension Host (In-Memory Request Header only)
          ↓
   HuggingFaceProvider (HTTPS POST https://router.huggingface.co/v1/chat/completions)
   ```
   * The token is **never** sent to the Webview UI.
   * The token is **never** recorded in logs, diagnostics, git commits, or RPC messages.
   * Webview RPC only receives sanitized health status (`available` vs `missing_credentials`).
   * No plaintext tokens are persisted in test fixtures or documentation.

2. **Invariant Control Boundary**:
   * Changing models between Online (Hugging Face) and Offline (Ollama) switches the *reasoning provider*, but never alters JAGGU's security policy.
   * Path traversal containment, plan approval gates, edit approval gates, and git baseline preservation remain active and non-bypassable.

---

## 6. Performance Observations (Single-Run Observational Measurements)

* **Hugging Face Online Router Health Probe:** ~589 ms (`GET https://router.huggingface.co/v1/models`)
* **Hugging Face Qwen 2.5 Coder 32B TTFT (Time to First Token):** ~650 ms
* **Hugging Face Generation Throughput:** ~40 tokens/sec
* **Hugging Face Abort Latency:** ~866 ms (immediate stream release without socket leak)
* **Ollama Local Daemon Probe:** ~28 ms (`GET http://localhost:11434/api/tags`)

---

## 7. Defects Discovered & Resolved During Validation

1. **`huggingface` Provider Missing in Registry & Gateway**:
   * *Resolution:* Added `HuggingFaceProvider` with full SSE stream parsing, registered `huggingface` in `ModelRegistry`, and wired into `ModelGateway` and `CredentialManager`.
2. **Stream Cancellation `AbortError` Handling**:
   * *Resolution:* Stream readers in `transport.ts` catch DOM `AbortError` during active read and cleanly propagate `ModelError('...', 'CANCELLED')`.
3. **Token Sanitization in Test Files**:
   * *Resolution:* Test suites read credentials strictly from environment variables (`process.env.HF_TOKEN` / `process.env.HUGGINGFACE_API_KEY`) and gracefully skip if unset, ensuring zero secrets are persisted in code or git.

---

## 8. Final Test Suite Results

* **Total Test Suites:** 30 passed (30)
* **Total Automated Tests:** **175 passed (175)** (0 failed)
  * `huggingFaceProvider.test.ts`: 6 tests passed
  * `liveHuggingFaceDirect.test.ts`: 4 tests passed
  * `liveOllamaDirect.test.ts`: 3 tests passed
  * `liveOpenAICompatibleDirect.test.ts`: 5 tests passed
  * Existing core, VS Code, UI, and Eval test suites: 157 tests passed
* **Typecheck (`tsc --noEmit`):** 0 errors across all 4 workspaces.
* **Lint (`eslint`):** 0 errors, 0 warnings.
* **Build (`tsc -b` + `esbuild`):** Clean build across all packages.
