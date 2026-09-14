export interface ContextQuery {
  prompt: string;
  activeFilePath?: string;
  activeSelection?: string;
  maxTokens?: number;
}

export interface ContextSnippet {
  filePath: string;
  content: string;
  priorityTier: number; // 1 (highest) to 8 (lowest)
  estimatedTokens: number;
}

export interface AssembledContext {
  snippets: ContextSnippet[];
  totalTokens: number;
  budgetLimit: number;
}

export interface IContextEngine {
  gatherContext(query: ContextQuery, abortSignal?: AbortSignal): Promise<AssembledContext>;
  estimateTokens(text: string): number;
}
