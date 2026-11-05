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

export class GeminiProvider implements IModelProvider {
  public readonly id = 'gemini' as const;
  public readonly name = 'Google Gemini';
  public readonly defaultModel = 'gemini-2.0-flash';

  public readonly supportedModels: ModelMetadata[] = [
    {
      id: 'gemini-2.0-flash',
      displayName: 'Gemini 2.0 Flash',
      providerId: 'gemini',
      capabilities: {
        streaming: true,
        toolCalling: true,
        vision: true,
        structuredOutput: true,
        maxContextTokens: 1048576,
        maxOutputTokens: 8192,
      },
    },
    {
      id: 'gemini-1.5-pro',
      displayName: 'Gemini 1.5 Pro',
      providerId: 'gemini',
      capabilities: {
        streaming: true,
        toolCalling: true,
        vision: true,
        structuredOutput: true,
        maxContextTokens: 2097152,
        maxOutputTokens: 8192,
      },
    },
    {
      id: 'gemini-1.5-pro-latest',
      displayName: 'Gemini 1.5 Pro (Latest)',
      providerId: 'gemini',
      capabilities: {
        streaming: true,
        toolCalling: true,
        vision: true,
        structuredOutput: true,
        maxContextTokens: 2097152,
        maxOutputTokens: 8192,
      },
    },
    {
      id: 'gemini-1.5-flash',
      displayName: 'Gemini 1.5 Flash',
      providerId: 'gemini',
      capabilities: {
        streaming: true,
        toolCalling: true,
        vision: true,
        structuredOutput: true,
        maxContextTokens: 1048576,
        maxOutputTokens: 8192,
      },
    },
  ];

  private normalizeModel(rawModel?: string): string {
    if (!rawModel) return this.defaultModel;
    const aliases: Record<string, string> = {
      'gemini-1.5-pro': 'gemini-1.5-pro-latest',
      'gemini-1.5-flash': 'gemini-1.5-flash-latest',
      'gemini-pro': 'gemini-2.0-flash',
      'gemini-flash': 'gemini-2.0-flash',
    };
    return aliases[rawModel] || rawModel;
  }

  public getCapabilities(model: string): ModelCapabilities {
    const normalized = this.normalizeModel(model);
    const found = this.supportedModels.find((m) => m.id === model || m.id === normalized);
    return (
      found?.capabilities || {
        streaming: true,
        toolCalling: true,
        vision: true,
        structuredOutput: true,
        maxContextTokens: 1048576,
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
        'Google Gemini API key is missing. Configure it in settings.',
        'AUTH_FAILURE',
        this.id,
      );
    }

    const requestedModel = options.model || this.defaultModel;
    const primaryModel = this.normalizeModel(requestedModel);
    const baseUrl = options.baseUrl || 'https://generativelanguage.googleapis.com';

    const systemMessages = messages.filter((m) => m.role === 'system');
    const systemInstruction =
      systemMessages.length > 0
        ? { parts: [{ text: systemMessages.map((m) => m.content).join('\n\n') }] }
        : undefined;

    const contents = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: options.temperature ?? 0.2,
        maxOutputTokens: options.maxTokens,
      },
    };

    if (systemInstruction) {
      body.systemInstruction = systemInstruction;
    }

    const executeRequest = async (modelName: string) => {
      const url = `${baseUrl.replace(/\/+$/, '')}/v1beta/models/${modelName}:streamGenerateContent?alt=sse&key=${apiKey}`;
      return await resilientFetch(
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
      );
    };

    let response: Response;
    try {
      response = await executeRequest(primaryModel);
    } catch (err) {
      // If the primary model returned 404 (e.g. models/gemini-1.5-pro not found), fallback to default gemini-2.0-flash
      if (
        err instanceof ModelError &&
        err.code === 'MODEL_NOT_FOUND' &&
        primaryModel !== this.defaultModel
      ) {
        response = await executeRequest(this.defaultModel);
      } else {
        throw err;
      }
    }

    for await (const line of parseSseStream(response, options.abortSignal)) {
      try {
        const chunk = JSON.parse(line) as {
          candidates?: Array<{
            content?: {
              parts?: Array<{
                text?: string;
                functionCall?: { name: string; args: Record<string, unknown> };
              }>;
            };
          }>;
          usageMetadata?: {
            promptTokenCount?: number;
            candidatesTokenCount?: number;
          };
        };

        if (chunk.candidates && chunk.candidates[0]?.content?.parts) {
          for (const part of chunk.candidates[0].content.parts) {
            if (part.text) {
              yield { type: 'token', text: part.text };
            }
            if (part.functionCall) {
              yield {
                type: 'tool_call_complete',
                id: `fc_${Date.now()}`,
                name: part.functionCall.name,
                arguments: part.functionCall.args,
              };
            }
          }
        }

        if (chunk.usageMetadata) {
          yield {
            type: 'usage',
            promptTokens: chunk.usageMetadata.promptTokenCount || 0,
            completionTokens: chunk.usageMetadata.candidatesTokenCount || 0,
          };
        }
      } catch {
        // Skip unparseable lines
      }
    }
  }

  public estimateTokens(text: string): number {
    return Math.ceil(text.length / 4.0);
  }
}
