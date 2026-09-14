import { z } from 'zod';

export type PermissionTier = 'SAFE' | 'MODERATE' | 'HIGH_RISK';

export interface IToolExecutionContext {
  readonly taskId: string;
  readonly workspaceRoot: string;
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
}
