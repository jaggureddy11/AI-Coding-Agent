# 10 — Context Engine & Retrieval Architecture

## 1. Context Engine Mission & Pipeline

Modern repositories easily span hundreds of thousands of lines of code, far exceeding effective LLM reasoning attention spans and token budgets. Sending an entire repository into a prompt degrades reasoning, induces hallucinations, and multiplies inference costs.

The **ForgeAI Context Engine** extracts high-relevance semantic ground truth while staying strictly within a defined token budget (typically 6,000 to 12,000 tokens).

```
+-----------------------------------------------------------------------------------------+
|                                CONTEXT ENGINE PIPELINE                                  |
|                                                                                         |
|  [Repository Codebase & Workspace State]                                                |
|        │                                                                                |
|        ├── 1. DISCOVERY: File discovery, ignore list (.gitignore, .forgeignore)        |
|        │                                                                                |
|        ├── 2. LEXICAL & AST RETRIEVAL: Ripgrep keyword search + LSP symbol references   |
|        │                                                                                |
|        ├── 3. EDITOR STATE CAPTURE: Cursor, active selection, open tabs, diagnostics   |
|        │                                                                                |
|        ├── 4. DEPENDENCY GRAPH TRAVERSAL: Parse imports & exported signatures           |
|        │                                                                                |
|        ▼                                                                                |
|  [Candidate Chunk Assembler]                                                            |
|        │                                                                                |
|        ▼                                                                                |
|  [Priority Ranker & Deduplicator]                                                       |
|        │                                                                                |
|        ▼                                                                                |
|  [Token Budget Enforcer & Trimmer]                                                      |
|        │                                                                                |
|        ▼                                                                                |
|  [Synthesized Prompt Context Package] ───────> Model Gateway                            |
+-----------------------------------------------------------------------------------------+
```

---

## 2. Eight-Tier Context Priority Hierarchy

When constructing the final prompt context, snippets are added in descending order of strict priority. When the token budget is reached, lower tiers are truncated or omitted:

| Priority Tier | Context Source | Description & Rationale | Token Allocation |
|---|---|---|---|
| **Tier 1 (Highest)** | **Active Selection** | Highlighted code currently selected by developer in the active Monaco editor. | 100% Guaranteed (~1,000 tok) |
| **Tier 2** | **Current Active File** | Surrounding lines or full content of the currently open editor file. | Up to 2,500 tokens |
| **Tier 3** | **Active Diagnostics & Errors** | Compiler errors, linter diagnostics, or recent terminal test failure traces. | Up to 1,500 tokens |
| **Tier 4** | **Related Symbols & Definitions** | Type definitions, interfaces, and function signatures fetched via LSP for identifiers in active file. | Up to 2,000 tokens |
| **Tier 5** | **Directly Imported Files** | Files imported by or importing the active file (1-hop dependency graph). | Up to 2,500 tokens |
| **Tier 6** | **Task-Relevant Retrieved Code** | High-scoring ripgrep matches corresponding to the user's prompt keywords. | Up to 2,500 tokens |
| **Tier 7** | **Associated Unit Tests** | Corresponding test files matching `*.test.*` or `*.spec.*`. | Up to 1,500 tokens |
| **Tier 8 (Lowest)** | **Repository Overview & Docs** | `README.md`, package manifests, directory tree, architectural docs. | Up to 1,000 tokens |

---

## 3. Retrieval Strategies

### 3.1 Lexical Ripgrep Retrieval
- **Mechanism**: Embedded ripgrep binary runs directly against workspace files.
- **Speed**: Sub-50ms execution across 100k LOC.
- **Query Processing**:
  - Extracts key identifiers from the user's prompt (e.g., `"Add rate limiting to projects"` -> keywords: `rateLimit`, `projects`, `middleware`, `Router`).
  - Executes case-insensitive word matching, filtering out matches in `node_modules/`, `dist/`, `.git/`, and binary files.

### 3.2 LSP Semantic Retrieval
- **Mechanism**: Connects to active Language Server Protocol extensions running in VS Code.
- **Commands**:
  - `vscode.executeWorkspaceSymbolProvider(symbolQuery)`: Finds class/function declarations.
  - `vscode.executeDefinitionProvider(uri, position)`: Finds exact definition of an identifier.
  - `vscode.executeReferenceProvider(uri, position)`: Discovers all consumers of an interface or function.

### 3.3 Dynamic Import Dependency Traversal
- Lightweight regex-based AST parser parses imports for JavaScript, TypeScript, Python, Go, and Rust:
  - TypeScript: `import { x } from './path'`
  - Python: `from path import x`
  - Go: `import "module/path"`
- Resolves relative paths to physical workspace files and extracts interface signatures rather than full implementations to conserve tokens.

---

## 4. Token Budgeting & Compaction Algorithm

ForgeAI uses a sliding token budget:
```typescript
export interface ContextBudgetConfig {
  maxContextTokens: number;      // Default: 12,000
  reservedResponseTokens: number; // Default: 4,000
  systemPromptTokens: number;     // Default: 2,000
}

export class ContextAssembler {
  assemble(candidates: ContextCandidate[], budget: number): AssembledContext {
    let currentTokens = 0;
    const included: ContextSnippet[] = [];

    // Sort by strict priority tier, then by relevance score
    candidates.sort((a, b) => a.tier - b.tier || b.score - a.score);

    for (const candidate of candidates) {
      const estimatedTokens = Math.ceil(candidate.content.length / 3.8);
      if (currentTokens + estimatedTokens <= budget) {
        included.push(candidate);
        currentTokens += estimatedTokens;
      } else if (candidate.tier <= 2) {
        // High priority item: trim middle of file to fit
        const truncated = this.compactSnippet(candidate, budget - currentTokens);
        included.push(truncated);
        break;
      }
    }

    return { snippets: included, totalTokens: currentTokens };
  }
}
```

---

## 5. Caching & Performance

1. **Anthropic Prompt Caching (`cache_control: { type: "ephemeral" }`)**:
   - System prompt and static repository context blocks are tagged with Anthropic cache breakpoints.
   - On multi-turn conversations, cached context is retrieved at 90% discount and with 80% lower latency.
2. **File Invalidation Events**:
   - Listens to `vscode.workspace.onDidChangeTextDocument`.
   - When a file is modified, its cached snippet and AST entries are marked dirty and re-indexed lazily.
