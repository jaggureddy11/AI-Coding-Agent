import { z } from 'zod';

export type ModelRuntimeType = 'cloud' | 'local';

export type ModelHealthStatus =
  | 'available'
  | 'unreachable'
  | 'missing_credentials'
  | 'not_installed'
  | 'unknown';

export interface ModelDescriptor {
  readonly id: string;
  readonly displayName: string;
  readonly providerId: string;
  readonly runtimeType: ModelRuntimeType;
  readonly contextWindow: number;
  readonly maxOutputTokens: number;
  readonly capabilities: {
    readonly streaming: boolean;
    readonly toolCalling: boolean;
    readonly structuredOutput: boolean;
    readonly vision: boolean;
  };
  readonly health: ModelHealthStatus;
  readonly healthDetail?: string;
  readonly huggingFaceModelId?: string;
}

export const ModelDescriptorSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  providerId: z.string().min(1),
  runtimeType: z.enum(['cloud', 'local']),
  contextWindow: z.number().int().positive(),
  maxOutputTokens: z.number().int().positive(),
  capabilities: z.object({
    streaming: z.boolean(),
    toolCalling: z.boolean(),
    structuredOutput: z.boolean(),
    vision: z.boolean(),
  }),
  health: z.enum(['available', 'unreachable', 'missing_credentials', 'not_installed', 'unknown']),
  healthDetail: z.string().optional(),
  huggingFaceModelId: z.string().optional(),
});
