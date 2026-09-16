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

export class AnthropicProvider implements IModelProvider {
  public readonly id = 'anthropic' as const;
  public readonly name = 'Anthropic';
  public readonly defaultModel = 'claude-3-5-sonnet-latest';

  public readonly supportedModels: ModelMetadata[] = [
    {
      id: 'claude-3-5-sonnet-latest',
      displayName: 'Claude 3.5 Sonnet',
      providerId: 'anthropic',
      capabilities: {
        streaming: true,
        toolCalling: true,
        vision: true,
        structuredOutput: true,
        maxContextTokens: 200000,
        maxOutputTokens: 8192,
      },
    },
    {
      id: 'claude-3-7-sonnet-latest',
      displayName: 'Claude 3.7 Sonnet (Hybrid)',
      providerId: 'anthropic',
      capabilities: {
        streaming: true,
        toolCalling: true,
        vision: true,
        structuredOutput: true,
        maxContextTokens: 200000,
        maxOutputTokens: 64000,
      },
    },
    {
      id: 'claude-3-5-haiku-latest',
      displayName: 'Claude 3.5 Haiku',
      providerId: 'anthropic',
      capabilities: {
        streaming: true,
        toolCalling: true,
        vision: false,
        structuredOutput: true,
        maxContextTokens: 200000,
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
        vision: true,
        structuredOutput: true,
        maxContextTokens: 200000,
        maxOutputTokens: 8192,
      }
    );
  }

  public async *streamChat(
    messages: ModelMessage[],
    options: ModelRequestOptions,
  ): AsyncIterable<ModelStreamChunk> {
    const apiKey = options.apiKey;
    if (!apiKey) {
      throw new ModelError(
        'Anthropic API key is missing. Configure it in JAGGU settings.',
        'AUTH_FAILURE',
        this.id,
      );
    }

    const baseUrl = options.baseUrl || 'https://api.anthropic.com';
    const url = `${baseUrl.replace(/\/+$/, '')}/v1/messages`;

    // Extract system messages for Anthropic
    const systemMessages = messages.filter((m) => m.role === 'system');
    const systemPrompt = systemMessages.map((m) => m.content).join('\n\n');

    const conversationMessages = messages
      .filter((m) => m.role !== 'system')
      .map((m) => {
        if (m.role === 'tool') {
          return {
            role: 'user' as const,
            content: [
              {
                type: 'tool_result',
                tool_use_id: m.toolCallId,
                content: m.content,
              },
            ],
          };
        }
        return {
          role: m.role as 'user' | 'assistant',
          content: m.content,
        };
      });

    const body: Record<string, unknown> = {
      model: options.model || this.defaultModel,
      messages: conversationMessages,
      max_tokens: options.maxTokens || 4096,
      stream: true,
      temperature: options.temperature ?? 0.2,
    };

    if (systemPrompt) {
      body.system = systemPrompt;
    }

    if (options.tools && options.tools.length > 0) {
      body.tools = options.tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters,
      }));
    }

    const response = await resilientFetch(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
        signal: options.abortSignal,
      },
      this.id,
    );

    let promptTokens = 0;
    let completionTokens = 0;
    let currentToolCall: { id: string; name: string; args: string } | null = null;

    for await (const line of parseSseStream(response, options.abortSignal)) {
      try {
        const event = JSON.parse(line) as {
          type?: string;
          message?: { usage?: { input_tokens?: number } };
          content_block?: { type?: string; id?: string; name?: string };
          delta?: {
            type?: string;
            text?: string;
            partial_json?: string;
            usage?: { output_tokens?: number };
          };
          usage?: { output_tokens?: number };
        };

        if (event.type === 'message_start' && event.message?.usage?.input_tokens) {
          promptTokens = event.message.usage.input_tokens;
        }

        if (event.type === 'content_block_start' && event.content_block?.type === 'tool_use') {
          currentToolCall = {
            id: event.content_block.id || `tc_${Date.now()}`,
            name: event.content_block.name || '',
            args: '',
          };
          yield { type: 'tool_call_start', id: currentToolCall.id, name: currentToolCall.name };
        }

        if (event.type === 'content_block_delta') {
          if (event.delta?.type === 'text_delta' && event.delta.text) {
            yield { type: 'token', text: event.delta.text };
          } else if (
            event.delta?.type === 'input_json_delta' &&
            event.delta.partial_json &&
            currentToolCall
          ) {
            currentToolCall.args += event.delta.partial_json;
            yield {
              type: 'tool_call_delta',
              id: currentToolCall.id,
              argumentsDelta: event.delta.partial_json,
            };
          }
        }

        if (event.type === 'content_block_stop' && currentToolCall) {
          let parsedArgs = {};
          try {
            parsedArgs = JSON.parse(currentToolCall.args || '{}');
          } catch {
            // retain empty
          }
          yield {
            type: 'tool_call_complete',
            id: currentToolCall.id,
            name: currentToolCall.name,
            arguments: parsedArgs,
          };
          currentToolCall = null;
        }

        if (event.type === 'message_delta' && event.usage?.output_tokens) {
          completionTokens = event.usage.output_tokens;
          yield {
            type: 'usage',
            promptTokens,
            completionTokens,
          };
        }
      } catch {
        // Skip unparseable line
      }
    }
  }

  public estimateTokens(text: string): number {
    return Math.ceil(text.length / 3.6);
  }
}
