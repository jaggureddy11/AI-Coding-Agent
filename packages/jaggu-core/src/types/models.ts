export interface ModelCapabilities {
  streaming: boolean;
  toolCalling: boolean;
  vision: boolean;
  structuredOutput: boolean;
  maxContextTokens: number;
  maxOutputTokens: number;
}

export type ModelProviderId = 'openai' | 'anthropic' | 'gemini' | 'ollama' | 'openai-compatible' | 'mock' | (string & {});

export interface ModelMetadata {
  id: string;
  displayName: string;
  providerId: ModelProviderId;
  capabilities: ModelCapabilities;
}

export interface ModelMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
  name?: string;
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: string;
  }>;
}

export interface ModelToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ModelRequestOptions {
  model: string;
  temperature?: number;
  maxTokens?: number;
  tools?: ModelToolDefinition[];
  abortSignal?: AbortSignal;
  apiKey?: string;
  baseUrl?: string;
}

export type ModelStreamChunk =
  | { type: 'token'; text: string }
  | { type: 'tool_call_start'; id: string; name: string }
  | { type: 'tool_call_delta'; id: string; argumentsDelta: string }
  | { type: 'tool_call_complete'; id: string; name: string; arguments: Record<string, unknown> }
  | { type: 'usage'; promptTokens: number; completionTokens: number; costEstimateUsd?: number }
  | { type: 'error'; error: Error; code?: string };

export type ModelErrorCode =
  | 'AUTH_FAILURE'
  | 'INVALID_API_KEY'
  | 'RATE_LIMIT'
  | 'TIMEOUT'
  | 'NETWORK_ERROR'
  | 'SERVER_ERROR'
  | 'MALFORMED_RESPONSE'
  | 'MODEL_NOT_FOUND'
  | 'CONTEXT_LENGTH_EXCEEDED'
  | 'CANCELLED'
  | 'UNKNOWN';

export class ModelError extends Error {
  constructor(
    message: string,
    public readonly code: ModelErrorCode,
    public readonly providerId: string,
    public readonly status?: number,
    public readonly retryable: boolean = false,
  ) {
    super(message);
    this.name = 'ModelError';
  }
}

export interface IModelProvider {
  readonly id: ModelProviderId;
  readonly name: string;
  readonly defaultModel: string;
  readonly supportedModels: ModelMetadata[];

  getCapabilities(model: string): ModelCapabilities;

  streamChat(
    messages: ModelMessage[],
    options: ModelRequestOptions,
  ): AsyncIterable<ModelStreamChunk>;

  estimateTokens(text: string): number;

  checkHealth?(
    baseUrlOrOptions?: string | { baseUrl?: string; apiKey?: string; abortSignal?: AbortSignal },
    explicitApiKeyOrSignal?: string | AbortSignal,
    explicitAbortSignal?: AbortSignal,
  ): Promise<{
    reachable: boolean;
    models?: string[];
    error?: string;
    detail?: string;
  }>;
}
