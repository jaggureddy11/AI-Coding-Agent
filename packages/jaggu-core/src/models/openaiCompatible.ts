import {
  IModelProvider,
  ModelCapabilities,
  ModelMessage,
  ModelMetadata,
  ModelRequestOptions,
  ModelStreamChunk,
} from '../types/models.js';
import { resilientFetch, parseSseStream } from './transport.js';

export class OpenAICompatibleProvider implements IModelProvider {
  public readonly id = 'openai-compatible' as const;
  public readonly name = 'OpenAI-Compatible Local Endpoint';
  public readonly defaultModel = 'local-openai-default';

  public readonly supportedModels: ModelMetadata[] = [
    {
      id: 'local-openai-default',
      displayName: 'Local Server (vLLM / LM Studio)',
      providerId: 'openai-compatible',
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
      id: 'deepseek-coder-v2',
      displayName: 'DeepSeek Coder V2 (Local vLLM)',
      providerId: 'openai-compatible',
      capabilities: {
        streaming: true,
        toolCalling: true,
        vision: false,
        structuredOutput: true,
        maxContextTokens: 64000,
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
        structuredOutput: true,
        maxContextTokens: 32768,
        maxOutputTokens: 4096,
      }
    );
  }

  public async *streamChat(
    messages: ModelMessage[],
    options: ModelRequestOptions,
  ): AsyncIterable<ModelStreamChunk> {
    const baseUrl = (options.baseUrl || 'http://localhost:1234/v1').replace(/\/+$/, '');
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
    };
    if (options.apiKey && options.apiKey.trim().length > 0) {
      headers.Authorization = `Bearer ${options.apiKey.trim()}`;
    }

    const response = await resilientFetch(
      url,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: options.abortSignal,
      },
      this.id,
      { maxRetries: 1 }, // Fail fast on local server connection errors
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

  /**
   * Probes endpoint reachability and lists available models via GET /models.
   */
  public async checkHealth(
    baseUrlOrOptions?: string | { baseUrl?: string; apiKey?: string; abortSignal?: AbortSignal },
    explicitApiKey?: string,
    explicitAbortSignal?: AbortSignal,
  ): Promise<{ reachable: boolean; models?: string[]; error?: string; detail?: string }> {
    const rawBaseUrl = typeof baseUrlOrOptions === 'string' ? baseUrlOrOptions : baseUrlOrOptions?.baseUrl;
    const apiKey = typeof baseUrlOrOptions === 'object' && baseUrlOrOptions?.apiKey ? baseUrlOrOptions.apiKey : explicitApiKey;
    const abortSignal = typeof baseUrlOrOptions === 'object' && baseUrlOrOptions?.abortSignal ? baseUrlOrOptions.abortSignal : explicitAbortSignal;
    const url = `${(rawBaseUrl || 'http://localhost:1234/v1').replace(/\/+$/, '')}/models`;
    const headers: Record<string, string> = {};
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey.trim()}`;
    }

    try {
      const response = await resilientFetch(
        url,
        {
          method: 'GET',
          headers,
          signal: abortSignal,
        },
        this.id,
        { maxRetries: 0 },
      );

      if (response.ok) {
        const data = (await response.json()) as { data?: Array<{ id: string }> };
        const models = Array.isArray(data.data) ? data.data.map((m) => m.id) : [];
        return { reachable: true, models };
      }
      return { reachable: false, error: `HTTP ${response.status} ${response.statusText}` };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { reachable: false, error: msg };
    }
  }

  public estimateTokens(text: string): number {
    return Math.ceil(text.length / 3.8);
  }
}
