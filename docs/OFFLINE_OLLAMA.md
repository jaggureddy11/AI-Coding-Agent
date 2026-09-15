# Offline & Local Model Integration (Ollama & vLLM)

## Overview

JAGGU provides first-class support for **100% offline, privacy-first local AI inference** via:
1. **Ollama** (`http://127.0.0.1:11434`)
2. **OpenAI-Compatible Local Servers** (vLLM, LM Studio, LocalAI at `http://127.0.0.1:8000/v1`)

---

## 1. Supported Local Coding Models

| Model | Size / Quant | Tool Calling | Context | Recommended Use |
| :--- | :--- | :--- | :--- | :--- |
| **`qwen2.5-coder:7b`** | ~4.7 GB (q4_K_M) | Yes | 32,768 | Fast local coding, refactoring, test gen |
| **`deepseek-r1:8b`** | ~4.9 GB (q4_K_M) | No | 32,768 | Offline reasoning & architectural planning |
| **`llama3.3:70b`** | ~42 GB (q4_K_M) | Yes | 131,072 | Enterprise-grade local workstation model |
| **`deepseek-coder-v2`** | 16B - 236B | Yes | 64,000 | High-performance vLLM local coding |

---

## 2. Auto-Discovery & Health Checks

When JAGGU initializes or when the user triggers **Refresh Runtimes Health** from the model picker:
1. JAGGU performs a non-blocking `GET http://127.0.0.1:11434/api/tags` request.
2. Discovered local models are verified against the catalog.
3. If Ollama is running and has `qwen2.5-coder` or compatible models installed, they are marked `available` with the `LOCAL` badge in the UI.
4. If offline or if cloud services are unreachable, Auto mode automatically routes to the local model.

---

## 3. Quick Setup Guide

### 1. Install Ollama
Download and install Ollama from [ollama.com](https://ollama.com).

### 2. Pull Recommended Coding Model
```bash
ollama pull qwen2.5-coder:7b
```

### 3. Verify in VS Code
Open JAGGU sidebar in VS Code. The model picker will show `Qwen 2.5 Coder 7B (Ollama)` with a green `LOCAL` badge.

In Auto mode or `Local Only` mode (`jaggu.localOnly: true`), JAGGU will route all coding tasks to your local hardware with zero internet egress.
