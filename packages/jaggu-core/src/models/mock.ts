import {
  IModelProvider,
  ModelCapabilities,
  ModelMessage,
  ModelMetadata,
  ModelRequestOptions,
  ModelStreamChunk,
  ModelError,
  ModelErrorCode,
} from '../types/models.js';

export interface MockTurn {
  toolCall?: {
    id: string;
    name: string;
    arguments: Record<string, unknown>;
  };
  text?: string;
  simulateError?: ModelErrorCode;
}

export interface MockProviderOptions {
  mockResponseText?: string;
  chunks?: string[];
  chunkDelayMs?: number;
  simulateError?: ModelErrorCode;
  simulateToolCall?: {
    id: string;
    name: string;
    arguments: Record<string, unknown>;
  };
  turns?: MockTurn[];
}

export class MockModelProvider implements IModelProvider {
  public readonly id = 'mock' as const;
  public readonly name = 'Mock Provider';
  public readonly defaultModel = 'mock-fast';
  private _turnIndex = 0;

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
    } else if (this.config.simulateError === 'MALFORMED_RESPONSE') {
      throw new ModelError('Unexpected payload schema from mock server', 'MALFORMED_RESPONSE', this.id, 500, false);
    }

    // Multi-turn simulation if configured
    if (this.config.turns && this.config.turns.length > 0) {
      const turn = this.config.turns[this._turnIndex] || this.config.turns[this.config.turns.length - 1];
      this._turnIndex++;
      if (turn?.simulateError) {
        throw new ModelError('Mock error in turn', turn.simulateError, this.id);
      }
      if (turn?.toolCall) {
        yield { type: 'tool_call_start', id: turn.toolCall.id, name: turn.toolCall.name };
        yield { type: 'tool_call_complete', id: turn.toolCall.id, name: turn.toolCall.name, arguments: turn.toolCall.arguments };
        return;
      }
      if (turn?.text) {
        yield { type: 'token', text: turn.text };
        yield { type: 'usage', promptTokens: 10, completionTokens: 10 };
        return;
      }
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
