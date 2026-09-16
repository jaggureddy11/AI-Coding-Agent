import { z } from 'zod';

export type ModelRuntimeType = 'cloud' | 'local' | 'openai-compatible';

export type ModelHealthStatus =
  'available' | 'unreachable' | 'missing_credentials' | 'not_installed' | 'unknown';

export type ModelAvailabilityStatus =
  'available' | 'auth-required' | 'rate-limited' | 'offline' | 'unavailable' | 'unknown';

export type ModelAccessTier = 'free' | 'local' | 'paid' | 'unknown';

export interface ModelHealthInfo {
  healthy: boolean;
  latencyMs?: number;
  checkedAt?: number;
  detail?: string;
}

export interface ModelDescriptorCapabilities {
  readonly streaming: boolean;
  readonly toolCalling: boolean;
  readonly structuredOutput: boolean;
  readonly vision: boolean;
  readonly coding?: number;
  readonly reasoning?: number;
}

export interface ModelDescriptor {
  readonly id: string;
  readonly displayName: string;
  readonly providerId: string;
  readonly runtimeType: ModelRuntimeType;
  readonly modelFamily?: string;
  readonly contextWindow: number;
  readonly maxOutputTokens: number;
  readonly capabilities: ModelDescriptorCapabilities;
  readonly health: ModelHealthStatus;
  readonly healthDetail?: string;
  readonly healthInfo?: ModelHealthInfo;
  readonly availability?: ModelAvailabilityStatus;
  readonly access?: ModelAccessTier;
  readonly hfModelId?: string;
  readonly huggingFaceModelId?: string;
}

export const ModelDescriptorSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  providerId: z.string().min(1),
  runtimeType: z.enum(['cloud', 'local', 'openai-compatible']),
  modelFamily: z.string().optional(),
  contextWindow: z.number().int().positive(),
  maxOutputTokens: z.number().int().positive().optional().default(8192),
  capabilities: z.object({
    streaming: z.boolean().default(true),
    toolCalling: z.boolean().default(true),
    structuredOutput: z.boolean().default(true),
    vision: z.boolean().default(false),
    coding: z.number().min(0).max(100).optional().default(80),
    reasoning: z.number().min(0).max(100).optional().default(80),
  }),
  health: z
    .enum(['available', 'unreachable', 'missing_credentials', 'not_installed', 'unknown'])
    .optional()
    .default('unknown'),
  healthDetail: z.string().optional(),
  healthInfo: z
    .object({
      healthy: z.boolean(),
      latencyMs: z.number().optional(),
      checkedAt: z.number().optional(),
      detail: z.string().optional(),
    })
    .optional(),
  availability: z
    .enum(['available', 'auth-required', 'rate-limited', 'offline', 'unavailable', 'unknown'])
    .optional()
    .default('unknown'),
  access: z.enum(['free', 'local', 'paid', 'unknown']).optional().default('unknown'),
  hfModelId: z.string().optional(),
  huggingFaceModelId: z.string().optional(),
});
