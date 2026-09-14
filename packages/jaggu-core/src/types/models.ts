export interface ModelMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
  name?: string;
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
}

export type ModelStreamChunk =
  | { type: 'token'; text: string }
  | { type: 'tool_call_start'; id: string; name: string }
  | { type: 'tool_call_delta'; id: string; argumentsDelta: string }
  | { type: 'tool_call_complete'; id: string; name: string; arguments: Record<string, unknown> }
  | { type: 'usage'; promptTokens: number; completionTokens: number; costEstimateUsd: number }
  | { type: 'error'; error: Error };

export interface IModelProvider {
  readonly id: string;
  readonly name: string;
  readonly defaultModel: string;

  streamChat(
    messages: ModelMessage[],
    options: ModelRequestOptions,
  ): AsyncIterable<ModelStreamChunk>;

  estimateTokens(text: string): number;
}
