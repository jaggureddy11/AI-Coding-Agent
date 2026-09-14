import {
  IModelProvider,
  ModelCapabilities,
  ModelMessage,
  ModelMetadata,
  ModelRequestOptions,
  ModelStreamChunk,
} from '../types/models.js';
import { resilientFetch, parseNdjsonStream } from './transport.js';

export class OllamaProvider implements IModelProvider {
  public readonly id = 'ollama' as const;
  public readonly name = 'Ollama (Local)';
  public readonly defaultModel = 'qwen2.5-coder:7b';

  public readonly supportedModels: ModelMetadata[] = [
    {
      id: 'qwen2.5-coder:7b',
      displayName: 'Qwen 2.5 Coder 7B',
      providerId: 'ollama',
      capabilities: {
        streaming: true,
        toolCalling: true,
        vision: false,
        structuredOutput: true,
        maxContextTokens: 32768,
        maxOutputTokens: 8192,
      },
    },
    {
      id: 'deepseek-r1:8b',
      displayName: 'DeepSeek-R1 8B (Reasoning)',
      providerId: 'ollama',
      capabilities: {
        streaming: true,
        toolCalling: false,
        vision: false,
        structuredOutput: false,
        maxContextTokens: 32768,
        maxOutputTokens: 8192,
      },
    },
    {
      id: 'llama3.3:70b',
      displayName: 'Llama 3.3 70B',
      providerId: 'ollama',
      capabilities: {
        streaming: true,
        toolCalling: true,
        vision: false,
        structuredOutput: true,
        maxContextTokens: 131072,
        maxOutputTokens: 8192,
      },
    },
  ];

  public getCapabilities(model: string): ModelCapabilities {
    const found = this.supportedModels.find((m) => m.id === model);
    return (
      found?.capabilities || {
        streaming: true,
        toolCalling: true,
        vision: false,
        structuredOutput: false,
        maxContextTokens: 32768,
        maxOutputTokens: 4096,
      }
    );
  }

  public async *streamChat(
    messages: ModelMessage[],
    options: ModelRequestOptions,
  ): AsyncIterable<ModelStreamChunk> {
    const baseUrl = options.baseUrl || 'http://localhost:11434';
    const url = `${baseUrl.replace(/\/+$/, '')}/api/chat`;

    const body: Record<string, unknown> = {
      model: options.model || this.defaultModel,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      stream: true,
      options: {
        temperature: options.temperature ?? 0.2,
      },
    };

    const response = await resilientFetch(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: options.abortSignal,
      },
      this.id,
      { maxRetries: 1 }, // Fail fast on local server connection issues
    );

    for await (const chunk of parseNdjsonStream<{
      message?: { content?: string };
      done?: boolean;
      prompt_eval_count?: number;
      eval_count?: number;
    }>(response, options.abortSignal)) {
      if (chunk.message?.content) {
        yield { type: 'token', text: chunk.message.content };
      }

      if (chunk.done) {
        yield {
          type: 'usage',
          promptTokens: chunk.prompt_eval_count || 0,
          completionTokens: chunk.eval_count || 0,
        };
        break;
      }
    }
  }

  public estimateTokens(text: string): number {
    return Math.ceil(text.length / 3.8);
  }
}
