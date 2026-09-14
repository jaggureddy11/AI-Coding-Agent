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

export class OpenAIProvider implements IModelProvider {
  public readonly id = 'openai' as const;
  public readonly name = 'OpenAI';
  public readonly defaultModel = 'gpt-4o';

  public readonly supportedModels: ModelMetadata[] = [
    {
      id: 'gpt-4o',
      displayName: 'GPT-4o (Omni)',
      providerId: 'openai',
      capabilities: {
        streaming: true,
        toolCalling: true,
        vision: true,
        structuredOutput: true,
        maxContextTokens: 128000,
        maxOutputTokens: 16384,
      },
    },
    {
      id: 'gpt-4o-mini',
      displayName: 'GPT-4o Mini',
      providerId: 'openai',
      capabilities: {
        streaming: true,
        toolCalling: true,
        vision: true,
        structuredOutput: true,
        maxContextTokens: 128000,
        maxOutputTokens: 16384,
      },
    },
    {
      id: 'o3-mini',
      displayName: 'o3-mini (Reasoning)',
      providerId: 'openai',
      capabilities: {
        streaming: true,
        toolCalling: true,
        vision: false,
        structuredOutput: true,
        maxContextTokens: 200000,
        maxOutputTokens: 100000,
      },
    },
  ];

  public getCapabilities(model: string): ModelCapabilities {
    const found = this.supportedModels.find((m) => m.id === model);
    return (
      found?.capabilities || {
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
    const apiKey = options.apiKey;
    if (!apiKey) {
      throw new ModelError('OpenAI API key is missing. Configure it in JAGGU settings.', 'AUTH_FAILURE', this.id);
    }

    const baseUrl = options.baseUrl || 'https://api.openai.com/v1';
    const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;

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

    const response = await resilientFetch(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: options.abortSignal,
      },
      this.id,
    );

    const activeToolCalls: Record<number, { id: string; name: string; args: string }> = {};

    for await (const line of parseSseStream(response, options.abortSignal)) {
      if (line === '[DONE]') {
        // Emit any completed tool calls
        for (const tc of Object.values(activeToolCalls)) {
          let parsedArgs = {};
          try {
            parsedArgs = JSON.parse(tc.args || '{}');
          } catch {
            // retain empty
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
                activeToolCalls[idx] = { id: tc.id || `tc_${idx}`, name: tc.function?.name || '', args: '' };
                yield { type: 'tool_call_start', id: activeToolCalls[idx].id, name: activeToolCalls[idx].name };
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

  public estimateTokens(text: string): number {
    return Math.ceil(text.length / 3.8);
  }
}
