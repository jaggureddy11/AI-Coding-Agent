import { z } from 'zod';
import { ModelToolDefinition } from './models.js';

export type PermissionTier = 'SAFE' | 'MUTATING' | 'EXECUTION';

export interface IToolExecutionContext {
  readonly taskId: string;
  readonly workspaceRoot: string;
  readonly workspaceRoots?: string[];
  readonly abortSignal: AbortSignal;
}

export interface IToolResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  executionDurationMs: number;
}

export interface ITool<TInput = unknown, TOutput = unknown> {
  readonly name: string;
  readonly description: string;
  readonly permissionTier: PermissionTier;
  readonly schema: z.ZodType<TInput>;
  readonly timeoutMs: number;

  execute(args: TInput, context: IToolExecutionContext): Promise<IToolResult<TOutput>>;
  toModelToolDefinition(): ModelToolDefinition;
}

export interface ProposedEditRecord {
  readonly proposalId: string;
  readonly filePath: string;
  readonly originalContent: string;
  readonly proposedContent: string;
  readonly baseContentHash: string;
  readonly diffSummary: string;
  readonly createdAt: number;
  approved?: boolean;
}
