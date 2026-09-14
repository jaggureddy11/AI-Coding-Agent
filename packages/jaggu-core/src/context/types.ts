export type FileClassification =
  | 'source'
  | 'test'
  | 'config'
  | 'documentation'
  | 'asset'
  | 'generated'
  | 'unknown';

export interface WorkspaceFile {
  relativePath: string;
  absolutePath: string;
  sizeBytes: number;
  lineCount?: number;
  language: string;
  classification: FileClassification;
  isBinary: boolean;
  lastModifiedMs: number;
}

export interface SearchMatch {
  filePath: string;
  relativeFilePath: string;
  lineNumber: number;
  lineContent: string;
  column?: number;
}

export interface SearchQueryOptions {
  query: string;
  isRegex?: boolean;
  caseSensitive?: boolean;
  maxResults?: number;
  globIncludes?: string[];
  globExcludes?: string[];
  abortSignal?: AbortSignal;
}

export type RetrievalReason =
  | 'active_selection'
  | 'active_file'
  | 'explicit_reference'
  | 'filename_match'
  | 'text_search_match'
  | 'test_pairing';

export interface ContextSnippet {
  filePath: string;
  relativeFilePath: string;
  startLine: number;
  endLine: number;
  content: string;
  byteSize: number;
  reason: RetrievalReason;
  score: number;
}

export interface ContextSnippetSummary {
  relativeFilePath: string;
  startLine: number;
  endLine: number;
  reason: RetrievalReason;
  score: number;
  byteSize: number;
}

export interface ContextPackage {
  snippets: ContextSnippet[];
  totalEstimatedTokens: number;
  totalBytes: number;
  filesCount: number;
  truncated: boolean;
  query: string;
  provenance: ContextSnippetSummary[];
  promptContextText: string;
}

export interface ContextBudgetPolicy {
  maxFiles: number;
  maxBytesPerFile: number;
  maxTotalContextBytes: number;
  maxLinesPerSnippet: number;
  maxContextTokens: number;
}

export const DEFAULT_CONTEXT_BUDGET_POLICY: ContextBudgetPolicy = {
  maxFiles: 6,
  maxBytesPerFile: 32 * 1024,      // 32 KB
  maxTotalContextBytes: 128 * 1024, // 128 KB
  maxLinesPerSnippet: 100,
  maxContextTokens: 12000,
};

export interface ActiveEditorContext {
  filePath?: string;
  selectedText?: string;
  cursorLine?: number;
  visibleLineRange?: { start: number; end: number };
  languageId?: string;
}
