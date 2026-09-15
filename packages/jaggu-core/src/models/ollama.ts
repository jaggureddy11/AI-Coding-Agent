import {
  IModelProvider,
  ModelCapabilities,
  ModelMessage,
  ModelMetadata,
  ModelRequestOptions,
  ModelStreamChunk,
  ModelError,
} from '../types/models.js';
import { resilientFetch, parseNdjsonStream } from './transport.js';

export class OllamaProvider implements IModelProvider {
  public readonly id = 'ollama' as const;
  public readonly name = 'Ollama (Local)';
  public readonly defaultModel = 'qwen2.5-coder:7b';

  public readonly supportedModels: ModelMetadata[] = [
    {
      id: 'qwen2.5-coder:7b',
      displayName: 'Qwen 2.5 Coder 7B (Ollama)',
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
      displayName: 'DeepSeek-R1 8B (Ollama)',
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
      displayName: 'Llama 3.3 70B (Ollama)',
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
    const baseUrl = (options.baseUrl || 'http://localhost:11434').replace(/\/+$/, '');
    const url = `${baseUrl}/api/chat`;

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

    if (options.tools && options.tools.length > 0) {
      body.tools = options.tools.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));
    }

    let response: Response;
    try {
      response = await resilientFetch(
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
    } catch (err: unknown) {
      if (err instanceof ModelError && err.status === 404) {
        throw new ModelError(
          `Model "${options.model || this.defaultModel}" is not installed in local Ollama. Run "ollama pull ${options.model || this.defaultModel}" first.`,
          'MODEL_NOT_FOUND',
          this.id,
          404,
          false,
        );
      }
      throw err;
    }

    for await (const chunk of parseNdjsonStream<{
      message?: {
        content?: string;
        tool_calls?: Array<{
          function?: {
            name?: string;
            arguments?: Record<string, unknown> | string;
          };
        }>;
      };
      done?: boolean;
      prompt_eval_count?: number;
      eval_count?: number;
    }>(response, options.abortSignal)) {
      if (chunk.message?.content) {
        yield { type: 'token', text: chunk.message.content };
      }

      if (chunk.message?.tool_calls && chunk.message.tool_calls.length > 0) {
        for (let i = 0; i < chunk.message.tool_calls.length; i++) {
          const tc = chunk.message.tool_calls[i];
          if (!tc) continue;
          const fnName = tc.function?.name || 'unknown_tool';
          let fnArgs: Record<string, unknown> = {};
          if (typeof tc.function?.arguments === 'object' && tc.function.arguments !== null) {
            fnArgs = tc.function.arguments;
          } else if (typeof tc.function?.arguments === 'string') {
            try {
              fnArgs = JSON.parse(tc.function.arguments);
            } catch {
              // keep empty
            }
          }
          const callId = `ollama_tc_${Date.now()}_${i}`;
          yield { type: 'tool_call_start', id: callId, name: fnName };
          yield {
            type: 'tool_call_complete',
            id: callId,
            name: fnName,
            arguments: fnArgs,
          };
        }
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

  /**
   * Checks Ollama reachability and lists installed models via GET /api/tags.
   */
  public async checkHealth(
    baseUrlOrOptions?: string | { baseUrl?: string; apiKey?: string; abortSignal?: AbortSignal },
    explicitAbortSignal?: AbortSignal,
  ): Promise<{ reachable: boolean; models?: string[]; error?: string; detail?: string }> {
    const rawBaseUrl = typeof baseUrlOrOptions === 'string' ? baseUrlOrOptions : baseUrlOrOptions?.baseUrl;
    const abortSignal = typeof baseUrlOrOptions === 'object' && baseUrlOrOptions?.abortSignal ? baseUrlOrOptions.abortSignal : explicitAbortSignal;
    const url = `${(rawBaseUrl || 'http://localhost:11434').replace(/\/+$/, '')}/api/tags`;

    try {
      const response = await resilientFetch(
        url,
        {
          method: 'GET',
          signal: abortSignal,
        },
        this.id,
        { maxRetries: 0 },
      );

      if (response.ok) {
        const data = (await response.json()) as { models?: Array<{ name: string }> };
        const models = Array.isArray(data.models) ? data.models.map((m) => m.name) : [];
        return { reachable: true, models };
      }
      return { reachable: false, models: [], error: `HTTP ${response.status} ${response.statusText}` };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { reachable: false, models: [], error: msg };
    }
  }

  public estimateTokens(text: string): number {
    return Math.ceil(text.length / 3.8);
  }
}
