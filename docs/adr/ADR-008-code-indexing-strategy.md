# ADR-008: Code Indexing & Search Engine Strategy (Lexical + LSP vs Vector DB)

## Status
Accepted

## Context
Codebase search is the foundational sensory input for an AI coding agent. Two architectural paradigms exist:
1. **Vector Embeddings + Vector Database (e.g. Chroma, LanceDB, Pinecone)**: Chunks all workspace files into vectors and performs cosine similarity search.
2. **Hybrid Lexical + Structural Search (Ripgrep + VS Code LSP)**: Combines regex/keyword ripgrep search with compiler-driven symbol graphs from Language Server Protocol extensions.

## Decision
JAGGU implements a **Hybrid Lexical + Structural Retrieval Engine** for the MVP. Vector databases and embedding models are deliberately deferred to post-MVP (Phase 8+).

## Alternatives Considered
- **Local Embedded Vector Database (Chroma / LanceDB)**:
  - *Why Rejected for MVP*: High cold-start indexing overhead (takes minutes and spikes CPU on large projects); high memory usage (300MB+); poor precision on exact symbol names (e.g. `getUserById` vs `findUserById`); complex incremental cache invalidation when files are actively edited.
- **Remote Vector Indexing Cloud**:
  - *Why Rejected*: Exfiltrates developer source code to external servers; violates enterprise privacy policies; introduces network latency and recurring infrastructure cost.

## Reasoning
1. **Instant Cold Start**: Ripgrep requires zero pre-indexing. Search runs instantly upon opening a 100k-LOC repository.
2. **Exact Recall**: Developers search for concrete functions, classes, and error messages. Ripgrep and LSP provide 100% precision on exact identifiers.
3. **Zero Resource Overhead**: Ripgrep consumes <15MB RAM and exits immediately after execution.

## Consequences
- **Positive**: Blazing speed (<50ms searches); zero indexing delay; minimal memory footprint; 100% privacy.
- **Negative**: Broad thematic queries with zero overlapping keywords (e.g. "where is the math done?") require ripgrep keyword heuristics or user clarification.
