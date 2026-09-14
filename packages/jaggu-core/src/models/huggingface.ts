import {
  IModelProvider,
  ModelCapabilities,
  ModelMessage,
  ModelMetadata,
  ModelRequestOptions,
  ModelStreamChunk,
  ModelError,
} from '../types/models.js';
import { resilientFetch, parseSseStream } from './transport.js';

export const HUGGINGFACE_SUPPORTED_MODELS: ModelMetadata[] = [
  {
    id: 'Qwen/Qwen2.5-Coder-32B-Instruct',
    displayName: 'Qwen 2.5 Coder 32B (Hugging Face)',
    providerId: 'huggingface',
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
    id: 'Qwen/Qwen2.5-Coder-7B-Instruct',
    displayName: 'Qwen 2.5 Coder 7B (Hugging Face)',
    providerId: 'huggingface',
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
    id: 'meta-llama/Llama-3.1-8B-Instruct',
    displayName: 'Llama 3.1 8B Instruct (Hugging Face)',
    providerId: 'huggingface',
    capabilities: {
      streaming: true,
      toolCalling: true,
      vision: false,
      structuredOutput: true,
      maxContextTokens: 128000,
      maxOutputTokens: 8192,
    },
  },
  {
    id: 'deepseek-ai/DeepSeek-R1-Distill-Qwen-7B',
    displayName: 'DeepSeek R1 Distill Qwen 7B (Hugging Face)',
    providerId: 'huggingface',
    capabilities: {
      streaming: true,
      toolCalling: false,
      vision: false,
      structuredOutput: false,
      maxContextTokens: 32768,
      maxOutputTokens: 8192,
    },
  },
];

export class HuggingFaceProvider implements IModelProvider {
  public readonly id = 'huggingface';
  public readonly name = 'Hugging Face Inference';
  public readonly defaultModel = 'Qwen/Qwen2.5-Coder-32B-Instruct';
  public readonly supportedModels = HUGGINGFACE_SUPPORTED_MODELS;

  public getCapabilities(model: string): ModelCapabilities {
    const found = this.supportedModels.find((m) => m.id === model);
    if (found) {
      return found.capabilities;
    }
    return {
      streaming: true,
      toolCalling: true,
      vision: false,
      structuredOutput: true,
      maxContextTokens: 32768,
      maxOutputTokens: 8192,
    };
  }

  public estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  public async *streamChat(
    messages: ModelMessage[],
    options: ModelRequestOptions,
  ): AsyncIterable<ModelStreamChunk> {
    if (!options.apiKey || options.apiKey.trim().length === 0) {
      throw new ModelError(
        'Hugging Face API token is required. Please set jaggu.apiKey.huggingface in SecretStorage.',
        'AUTH_FAILURE',
        this.id,
        401,
        false,
      );
    }

    const baseUrl = (options.baseUrl || 'https://router.huggingface.co/v1').replace(/\/+$/, '');
    const url = `${baseUrl}/chat/completions`;

    const formattedMessages = messages.map((m) => {
      if (m.role === 'tool') {
        return {
          role: 'tool',
          content: m.content,
          tool_call_id: m.toolCallId,
        };
      }
      return {
        role: m.role,
        content: m.content,
      };
    });

    const body: Record<string, unknown> = {
      model: options.model || this.defaultModel,
      messages: formattedMessages,
      stream: true,
      stream_options: { include_usage: true },
      temperature: options.temperature ?? 0.2,
      max_tokens: options.maxTokens,
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

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${options.apiKey.trim()}`,
    };

    const response = await resilientFetch(
      url,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: options.abortSignal,
      },
      this.id,
    );

    const activeToolCalls: Record<number, { id: string; name: string; args: string }> = {};

    for await (const line of parseSseStream(response, options.abortSignal)) {
      if (line === '[DONE]') {
        for (const tc of Object.values(activeToolCalls)) {
          let parsedArgs = {};
          try {
            parsedArgs = JSON.parse(tc.args || '{}');
          } catch {
            // retain empty object
          }
          yield {
            type: 'tool_call_complete',
            id: tc.id,
            name: tc.name,
            arguments: parsedArgs,
          };
        }
        break;
      }

      try {
        const chunk = JSON.parse(line) as {
          choices?: Array<{
            delta?: {
              content?: string;
              tool_calls?: Array<{
                index: number;
                id?: string;
                function?: { name?: string; arguments?: string };
              }>;
            };
            finish_reason?: string;
          }>;
          usage?: { prompt_tokens: number; completion_tokens: number };
        };

        if (chunk.choices && chunk.choices[0]?.delta) {
          const delta = chunk.choices[0].delta;
          if (delta.content) {
            yield { type: 'token', text: delta.content };
          }

          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index;
              if (!activeToolCalls[idx]) {
                activeToolCalls[idx] = {
                  id: tc.id || `tc_${idx}`,
                  name: tc.function?.name || '',
                  args: '',
                };
                yield {
                  type: 'tool_call_start',
                  id: activeToolCalls[idx].id,
                  name: activeToolCalls[idx].name,
                };
              }
              if (tc.function?.arguments) {
                activeToolCalls[idx].args += tc.function.arguments;
                yield {
                  type: 'tool_call_delta',
                  id: activeToolCalls[idx].id,
                  argumentsDelta: tc.function.arguments,
                };
              }
            }
          }
        }

        if (chunk.usage) {
          yield {
            type: 'usage',
            promptTokens: chunk.usage.prompt_tokens,
            completionTokens: chunk.usage.completion_tokens,
          };
        }
      } catch {
        // Ignore unparseable line
      }
    }
  }

  public async checkHealth(
    baseUrlOrOptions?: string | { baseUrl?: string; apiKey?: string; abortSignal?: AbortSignal },
    explicitApiKeyOrSignal?: string | AbortSignal,
    explicitAbortSignal?: AbortSignal,
  ): Promise<{ reachable: boolean; models: string[]; error?: string; detail?: string }> {
    let baseUrl = 'https://router.huggingface.co/v1';
    let apiKey: string | undefined;
    let abortSignal: AbortSignal | undefined;

    if (typeof baseUrlOrOptions === 'object' && baseUrlOrOptions !== null) {
      baseUrl = baseUrlOrOptions.baseUrl || baseUrl;
      apiKey = baseUrlOrOptions.apiKey;
      abortSignal = baseUrlOrOptions.abortSignal;
    } else if (typeof baseUrlOrOptions === 'string') {
      baseUrl = baseUrlOrOptions;
      if (typeof explicitApiKeyOrSignal === 'string') {
        apiKey = explicitApiKeyOrSignal;
        abortSignal = explicitAbortSignal;
      } else if (explicitApiKeyOrSignal instanceof AbortSignal) {
        abortSignal = explicitApiKeyOrSignal;
      }
    }

    if (!apiKey || apiKey.trim().length === 0) {
      return {
        reachable: false,
        models: [],
        error: 'Missing Hugging Face access token in SecretStorage',
        detail: 'Authentication token required for Hugging Face inference',
      };
    }

    const cleanBaseUrl = baseUrl.replace(/\/+$/, '');
    try {
      const resp = await resilientFetch(
        `${cleanBaseUrl}/models`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${apiKey.trim()}`,
          },
          signal: abortSignal,
        },
        this.id,
        { maxRetries: 1 },
      );

      if (!resp.ok) {
        return {
          reachable: false,
          models: [],
          error: `HTTP ${resp.status}: ${resp.statusText}`,
        };
      }

      const data = (await resp.json()) as { data?: Array<{ id: string }> };
      const modelList = Array.isArray(data.data) ? data.data.map((m) => m.id) : [];

      return {
        reachable: true,
        models: modelList,
        detail: `Hugging Face Router reached (${modelList.length} models available)`,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        reachable: false,
        models: [],
        error: msg,
      };
    }
  }
}
