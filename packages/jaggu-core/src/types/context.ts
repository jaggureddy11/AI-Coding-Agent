export * from '../context/types.js';

export interface ContextQuery {
  prompt: string;
  activeFilePath?: string;
  activeSelection?: string;
  maxTokens?: number;
}

export interface IContextEngine {
  gatherContext(query: ContextQuery, abortSignal?: AbortSignal): Promise<unknown>;
  estimateTokens(text: string): number;
}

