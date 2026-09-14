import {
  IModelProvider,
  ModelMessage,
  ModelRequestOptions,
  ModelStreamChunk,
  ModelError,
} from '../types/models.js';
import { EventBus } from '../events/eventBus.js';
import { OpenAIProvider } from './openai.js';
import { AnthropicProvider } from './anthropic.js';
import { GeminiProvider } from './gemini.js';
import { HuggingFaceProvider } from './huggingface.js';
import { OllamaProvider } from './ollama.js';
import { OpenAICompatibleProvider } from './openaiCompatible.js';
import { MockModelProvider } from './mock.js';
import { ModelRegistry } from './registry.js';

export interface ModelTelemetry {
  provider: string;
  model: string;
  durationMs: number;
  firstTokenMs?: number;
  promptTokens: number;
  completionTokens: number;
  cancelled: boolean;
  errorCategory?: string;
}

export class ModelGateway {
  private readonly providers = new Map<string, IModelProvider>();
  private readonly modelRegistry: ModelRegistry;

  constructor(modelRegistry?: ModelRegistry) {
    this.modelRegistry = modelRegistry ?? new ModelRegistry();
    this.registerProvider(new OpenAIProvider());
    this.registerProvider(new AnthropicProvider());
    this.registerProvider(new GeminiProvider());
    this.registerProvider(new HuggingFaceProvider());
    this.registerProvider(new OllamaProvider());
    this.registerProvider(new OpenAICompatibleProvider());
    this.registerProvider(new MockModelProvider());
  }

  public getModelRegistry(): ModelRegistry {
    return this.modelRegistry;
  }

  public registerProvider(provider: IModelProvider): void {
    this.providers.set(provider.id, provider);
  }

  public getProvider(id: string): IModelProvider {
    const provider = this.providers.get(id);
    if (!provider) {
      throw new ModelError(
        `Unknown model provider "${id}". Supported providers: ${Array.from(this.providers.keys()).join(', ')}`,
        'MALFORMED_RESPONSE',
        id,
      );
    }
    return provider;
  }

  public listProviders(): IModelProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Orchestrates model streaming, metrics collection, and lifecycle event emission.
   */
  public async *streamChat(
    providerId: string,
    messages: ModelMessage[],
    options: ModelRequestOptions,
    eventBus?: EventBus,
    taskId: string = 'task_default',
  ): AsyncIterable<ModelStreamChunk> {
    const provider = this.getProvider(providerId);
    const model = options.model || provider.defaultModel;
    const startTime = Date.now();
    let firstTokenTime: number | undefined;
    let promptTokens = 0;
    let completionTokens = 0;

    eventBus?.emit('model.requested', {
      taskId,
      provider: provider.id,
      model,
      messageCount: messages.length,
      timestamp: startTime,
    });

    try {
      for await (const chunk of provider.streamChat(messages, options)) {
        if (chunk.type === 'token') {
          if (!firstTokenTime) {
            firstTokenTime = Date.now();
            eventBus?.emit('model.stream_started', {
              taskId,
              provider: provider.id,
              model,
              timestamp: firstTokenTime,
            });
          }

          eventBus?.emit('model.text_delta', {
            taskId,
            text: chunk.text,
            timestamp: Date.now(),
          });
        } else if (chunk.type === 'tool_call_delta') {
          eventBus?.emit('model.tool_call_delta', {
            taskId,
            toolCallId: chunk.id,
            argumentsDelta: chunk.argumentsDelta,
            timestamp: Date.now(),
          });
        } else if (chunk.type === 'usage') {
          promptTokens = chunk.promptTokens;
          completionTokens = chunk.completionTokens;
        }

        yield chunk;
      }

      const durationMs = Date.now() - startTime;
      eventBus?.emit('model.completed', {
        taskId,
        provider: provider.id,
        model,
        durationMs,
        promptTokens,
        completionTokens,
        timestamp: Date.now(),
      });
    } catch (error: unknown) {
      const isCancelled =
        options.abortSignal?.aborted ||
        (error instanceof ModelError && error.code === 'CANCELLED');

      if (isCancelled) {
        eventBus?.emit('model.cancelled', {
          taskId,
          provider: provider.id,
          model,
          timestamp: Date.now(),
        });
        throw new ModelError('Operation cancelled by user', 'CANCELLED', provider.id, undefined, false);
      }

      const errMessage = error instanceof Error ? error.message : String(error);
      const errCode = error instanceof ModelError ? error.code : 'UNKNOWN';

      eventBus?.emit('model.error', {
        taskId,
        provider: provider.id,
        model,
        error: errMessage,
        code: errCode,
        timestamp: Date.now(),
      });

      throw error;
    }
  }
}
