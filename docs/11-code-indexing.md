# 11 — Code Indexing & Search Architecture Analysis

## 1. Executive Decision on Indexing Strategy

A common failure mode of AI coding extensions is premature adoption of heavy vector databases (Chroma, Pinecone, LanceDB) and embedding pipelines. In practice, vector-only retrieval across codebases suffers from severe limitations:
1. **Semantic Vagueness**: Vector search struggles with exact identifier lookups (e.g., finding `handleUserAuthRefreshV2` vs generic "user authentication").
2. **Cold-Start Penalty**: Generating embeddings for a 100,000-line repository on startup takes minutes, spikes CPU, drains laptop battery, and consumes gigabytes of RAM.
3. **Staleness & Cache Drift**: Every keystroke invalidates vector chunks, requiring complex incremental re-embedding logic.

**JAGGU MVP Architecture Decision:**
> **For the MVP, JAGGU relies on a Hybrid Lexical + Structural Indexing Engine combining native Ripgrep with VS Code Language Server Protocol (LSP) services. Vector embeddings are deliberately deferred to Phase 8+ post-MVP.**

---

## 2. Comparative Evaluation Matrix

| Indexing Technology | Exact Identifier Recall | Conceptual Search | Latency (100k LOC) | Memory Footprint | Cold Start Time | MVP Decision |
|---|---|---|---|---|---|---|
| **Ripgrep (Lexical)** | 100% (Exact/Regex) | Poor | 15–40 ms | <15 MB | 0 ms (Instant) | **PRIMARY (Included)** |
| **LSP (Structural)** | 100% (Type/AST exact) | N/A | 10–50 ms | Reuses VS Code's | 0 ms (Pre-existing) | **PRIMARY (Included)** |
| **Tree-sitter (AST)** | 95% (Syntactic) | Poor | 50–120 ms | 30–50 MB | <1s | **SECONDARY (Post-MVP)** |
| **Local Embeddings (e.g., all-MiniLM)** | Poor (Approximate) | Excellent | 200–500 ms | 300–800 MB | 45–120s | **DEFERRED (Phase 8+)** |
| **Cloud Vector DB (Pinecone/Milvus)** | Moderate | Excellent | 300–800 ms | Network dependent | Variable | **REJECTED (Privacy/Cost)** |

---

## 3. The Lexical + Structural Retrieval Architecture

JAGGU coordinates search through a lightweight **Hybrid Search Coordinator**:

```
                              [Search Query]
                                    │
                  ┌─────────────────┴─────────────────┐
                  │                                   │
                  ▼                                   ▼
         [Ripgrep Lexical Match]             [LSP Symbol Resolution]
         - Regex keyword search              - Definition Provider
         - File path glob match              - Reference Provider
         - Case-insensitive search           - Workspace Symbol Provider
                  │                                   │
                  └─────────────────┬─────────────────┘
                                    │
                                    ▼
                         [Merged Candidate Pool]
                                    │
                                    ▼
                         [BM25 + Distance Ranker]
                                    │
                                    ▼
                           [Top-K Code Snippets]
```

### 3.1 Subsystem 1: Bundled Ripgrep Engine
- **Implementation**: JAGGU bundles pre-compiled platform-specific `rg` binaries (`darwin-arm64`, `darwin-x64`, `linux-x64`, `win32-x64`) or uses VS Code's internal ripgrep module located in `@vscode/ripgrep`.
- **Search Execution**:
  - Automatically respects `.gitignore`, `.git/info/exclude`, and `.forgeignore`.
  - Automatically excludes binary files, SVG assets, lockfiles (`package-lock.json`, `pnpm-lock.yaml`, `Cargo.lock`), and minified bundles.
  - Returns structured line-indexed matches in JSON format.

### 3.2 Subsystem 2: VS Code LSP Integration
Instead of bundling massive language parsers, JAGGU piggybacks on the rich language servers already running in VS Code:
- TypeScript/JavaScript: `vscode.typescript-language-features`
- Python: `ms-python.python` / Pylance
- Rust: `rust-lang.rust-analyzer`
- Go: `golang.go`

JAGGU accesses these servers via the standard VS Code command surface:
```typescript
// 1. Locate all workspace definitions of a symbol
const symbols = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
  'vscode.executeWorkspaceSymbolProvider',
  symbolName
);

// 2. Discover all references to an active function
const references = await vscode.commands.executeCommand<vscode.Location[]>(
  'vscode.executeReferenceProvider',
  documentUri,
  cursorPosition
);
```

---

## 4. When Will Embeddings Be Added? (Post-MVP Trigger Criteria)

Embeddings and semantic vector search will only be introduced when the following conditions are met:
1. Lexical + LSP search demonstrably fails on high-level thematic queries (e.g., *"Find where errors are converted to HTTP responses"* when no file contains the word "converted").
2. Local embedding models can run in WebAssembly / ONNX runtime with <50MB RAM and sub-2-second background index times.
3. Privacy rules permit local on-device vector storage with zero external vector transmission.
