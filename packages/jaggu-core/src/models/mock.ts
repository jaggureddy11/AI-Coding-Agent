import {
  IModelProvider,
  ModelCapabilities,
  ModelMessage,
  ModelMetadata,
  ModelRequestOptions,
  ModelStreamChunk,
  ModelError,
} from '../types/models.js';

export interface MockProviderOptions {
  mockResponseText?: string;
  chunks?: string[];
  chunkDelayMs?: number;
  simulateError?: 'AUTH_FAILURE' | 'RATE_LIMIT' | 'TIMEOUT' | 'NETWORK_ERROR' | 'MALFORMED';
  simulateToolCall?: {
    id: string;
    name: string;
    arguments: Record<string, unknown>;
  };
}

export class MockModelProvider implements IModelProvider {
  public readonly id = 'mock' as const;
  public readonly name = 'Mock Provider';
  public readonly defaultModel = 'mock-fast';

  public readonly supportedModels: ModelMetadata[] = [
    {
      id: 'mock-fast',
      displayName: 'Mock Fast Model',
      providerId: 'mock',
      capabilities: {
        streaming: true,
        toolCalling: true,
        vision: true,
        structuredOutput: true,
        maxContextTokens: 128000,
        maxOutputTokens: 4096,
      },
    },
  ];

  constructor(private readonly config: MockProviderOptions = {}) {}

  public getCapabilities(_model: string): ModelCapabilities {
    return (
      this.supportedModels[0]?.capabilities || {
        streaming: true,
        toolCalling: true,
        vision: true,
        structuredOutput: true,
        maxContextTokens: 128000,
        maxOutputTokens: 4096,
      }
    );
  }

  public async *streamChat(
    messages: ModelMessage[],
    options: ModelRequestOptions,
  ): AsyncIterable<ModelStreamChunk> {
    if (options.abortSignal?.aborted) {
      throw new ModelError('Request was cancelled by user', 'CANCELLED', this.id, undefined, false);
    }

    if (this.config.simulateError === 'AUTH_FAILURE') {
      throw new ModelError('Invalid mock API credential', 'AUTH_FAILURE', this.id, 401, false);
    } else if (this.config.simulateError === 'RATE_LIMIT') {
      throw new ModelError('Mock rate limit exceeded', 'RATE_LIMIT', this.id, 429, true);
    } else if (this.config.simulateError === 'TIMEOUT') {
      throw new ModelError('Mock request timed out', 'TIMEOUT', this.id, 408, true);
    } else if (this.config.simulateError === 'NETWORK_ERROR') {
      throw new ModelError('Mock network socket error', 'NETWORK_ERROR', this.id, undefined, true);
    } else if (this.config.simulateError === 'MALFORMED') {
      throw new ModelError('Unexpected payload schema from mock server', 'MALFORMED_RESPONSE', this.id, 500, false);
    }

    // Tool call streaming simulation if configured
    if (this.config.simulateToolCall) {
      const tc = this.config.simulateToolCall;
      yield { type: 'tool_call_start', id: tc.id, name: tc.name };
      const rawJson = JSON.stringify(tc.arguments);
      const half = Math.ceil(rawJson.length / 2);
      yield { type: 'tool_call_delta', id: tc.id, argumentsDelta: rawJson.slice(0, half) };
      yield { type: 'tool_call_delta', id: tc.id, argumentsDelta: rawJson.slice(half) };
      yield { type: 'tool_call_complete', id: tc.id, name: tc.name, arguments: tc.arguments };
      return;
    }

    const lastMsg = messages[messages.length - 1]?.content || '';
    const defaultResponse = `I received your prompt: "${lastMsg}". JAGGU Multi-Provider Model Gateway is operational.`;
    const fullText = this.config.mockResponseText || defaultResponse;
    const tokens = this.config.chunks || fullText.split(' ').map((w, i) => (i === 0 ? w : ` ${w}`));
    const delay = this.config.chunkDelayMs ?? 10;

    for (const token of tokens) {
      if (options.abortSignal?.aborted) {
        throw new ModelError('Request was cancelled by user', 'CANCELLED', this.id, undefined, false);
      }
      if (delay > 0) {
        await new Promise<void>((resolve) => {
          if (options.abortSignal?.aborted) {
            resolve();
            return;
          }
          const timer = setTimeout(() => {
            options.abortSignal?.removeEventListener('abort', onAbort);
            resolve();
          }, delay);
          const onAbort = () => {
            clearTimeout(timer);
            resolve();
          };
          options.abortSignal?.addEventListener('abort', onAbort, { once: true });
        });
      }
      if (options.abortSignal?.aborted) {
        throw new ModelError('Request was cancelled by user', 'CANCELLED', this.id, undefined, false);
      }
      yield { type: 'token', text: token };
    }

    yield {
      type: 'usage',
      promptTokens: Math.ceil(lastMsg.length / 4),
      completionTokens: Math.ceil(fullText.length / 4),
      costEstimateUsd: 0.0001,
    };
  }

  public estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}
