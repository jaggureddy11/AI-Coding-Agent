export type BenchmarkArchetype = 'EXPLAIN' | 'FEATURE' | 'DEBUG' | 'REFACTOR' | 'TESTGEN';
export type BenchmarkDifficulty = 'EASY' | 'MEDIUM' | 'HARD';

export interface BenchmarkTask {
  readonly taskId: string;
  readonly archetype: BenchmarkArchetype;
  readonly difficulty: BenchmarkDifficulty;
  readonly repository: string;
  readonly prompt: string;
  readonly expectedFilesModified: string[];
  readonly forbiddenFilesModified?: string[];
  readonly timeoutSeconds: number;
}

export interface BenchmarkResult {
  readonly taskId: string;
  readonly passed: boolean;
  readonly executionTimeMs: number;
  readonly tokensConsumed: number;
  readonly toolCallsCount: number;
  readonly error?: string;
}

export interface BenchmarkScorecard {
  readonly timestamp: number;
  readonly totalTasks: number;
  readonly successfulTasks: number;
  readonly taskSuccessRate: number;
  readonly averageLatencyMs: number;
  readonly totalTokens: number;
  readonly results: BenchmarkResult[];
}
