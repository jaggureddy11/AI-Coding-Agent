import {
  BedrockRuntimeClient,
  ConverseStreamCommand,
  ConverseStreamCommandInput,
  Message,
  ContentBlock,
  Tool,
} from '@aws-sdk/client-bedrock-runtime';
import {
  IModelProvider,
  ModelCapabilities,
  ModelMessage,
  ModelMetadata,
  ModelRequestOptions,
  ModelStreamChunk,
  ModelError,
} from '../types/models.js';
import {
  resolveBedrockCredentials,
  resolveBedrockRegion,
  BedrockAuthOptions,
} from './bedrockAuth.js';

type BedrockDocument =
  null | boolean | number | string | BedrockDocument[] | { [key: string]: BedrockDocument };

export const BEDROCK_DEFAULT_MODEL = 'au.anthropic.claude-sonnet-4-5-20250929-v1:0';

export const BEDROCK_SUPPORTED_MODELS: ModelMetadata[] = [
  {
    id: 'au.anthropic.claude-sonnet-4-5-20250929-v1:0',
    displayName: 'Claude Sonnet 4.5 [AU / APAC] (AWS Bedrock)',
    providerId: 'bedrock',
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
    id: 'apac.amazon.nova-pro-v1:0',
    displayName: 'Amazon Nova Pro [APAC] (AWS Bedrock)',
    providerId: 'bedrock',
    capabilities: {
      streaming: true,
      toolCalling: true,
      vision: true,
      structuredOutput: true,
      maxContextTokens: 300000,
      maxOutputTokens: 5000,
    },
  },
  {
    id: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
    displayName: 'Claude 3.5 Sonnet v2 (AWS Bedrock)',
    providerId: 'bedrock',
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
    id: 'us.anthropic.claude-3-5-sonnet-20241022-v2:0',
    displayName: 'Claude 3.5 Sonnet v2 [US Cross-Region] (AWS Bedrock)',
    providerId: 'bedrock',
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
    id: 'apac.anthropic.claude-3-5-sonnet-20241022-v2:0',
    displayName: 'Claude 3.5 Sonnet v2 [APAC Cross-Region] (AWS Bedrock)',
    providerId: 'bedrock',
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
    id: 'eu.anthropic.claude-3-5-sonnet-20241022-v2:0',
    displayName: 'Claude 3.5 Sonnet v2 [EU Cross-Region] (AWS Bedrock)',
    providerId: 'bedrock',
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
    id: 'anthropic.claude-3-5-haiku-20241022-v1:0',
    displayName: 'Claude 3.5 Haiku (AWS Bedrock)',
    providerId: 'bedrock',
    capabilities: {
      streaming: true,
      toolCalling: true,
      vision: false,
      structuredOutput: true,
      maxContextTokens: 200000,
      maxOutputTokens: 8192,
    },
  },
  {
    id: 'us.anthropic.claude-3-5-haiku-20241022-v1:0',
    displayName: 'Claude 3.5 Haiku [US Cross-Region] (AWS Bedrock)',
    providerId: 'bedrock',
    capabilities: {
      streaming: true,
      toolCalling: true,
      vision: false,
      structuredOutput: true,
      maxContextTokens: 200000,
      maxOutputTokens: 8192,
    },
  },
  {
    id: 'apac.amazon.nova-pro-v1:0',
    displayName: 'Amazon Nova Pro [APAC] (AWS Bedrock)',
    providerId: 'bedrock',
    capabilities: {
      streaming: true,
      toolCalling: true,
      vision: true,
      structuredOutput: true,
      maxContextTokens: 300000,
      maxOutputTokens: 5000,
    },
  },
  {
    id: 'au.anthropic.claude-sonnet-4-5-20250929-v1:0',
    displayName: 'Claude Sonnet 4.5 [AU / APAC] (AWS Bedrock)',
    providerId: 'bedrock',
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
    id: 'au.anthropic.claude-haiku-4-5-20251001-v1:0',
    displayName: 'Claude Haiku 4.5 [AU / APAC] (AWS Bedrock)',
    providerId: 'bedrock',
    capabilities: {
      streaming: true,
      toolCalling: true,
      vision: false,
      structuredOutput: true,
      maxContextTokens: 200000,
      maxOutputTokens: 8192,
    },
  },
  {
    id: 'amazon.nova-pro-v1:0',
    displayName: 'Amazon Nova Pro (AWS Bedrock)',
    providerId: 'bedrock',
    capabilities: {
      streaming: true,
      toolCalling: true,
      vision: true,
      structuredOutput: true,
      maxContextTokens: 300000,
      maxOutputTokens: 5000,
    },
  },
  {
    id: 'amazon.nova-lite-v1:0',
    displayName: 'Amazon Nova Lite (AWS Bedrock)',
    providerId: 'bedrock',
    capabilities: {
      streaming: true,
      toolCalling: true,
      vision: true,
      structuredOutput: true,
      maxContextTokens: 300000,
      maxOutputTokens: 5000,
    },
  },
];

export class BedrockProvider implements IModelProvider {
  public readonly id = 'bedrock' as const;
  public readonly name = 'AWS Bedrock';
  public readonly defaultModel = BEDROCK_DEFAULT_MODEL;
  public readonly supportedModels = BEDROCK_SUPPORTED_MODELS;

  private clientCache = new Map<string, BedrockRuntimeClient>();

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

  public estimateTokens(text: string): number {
    return Math.ceil(text.length / 3.6);
  }

  /**
   * Retrieves or instantiates a cached BedrockRuntimeClient for the given credentials and region.
   */
  public getClient(authOptions?: BedrockAuthOptions): BedrockRuntimeClient {
    const region = resolveBedrockRegion(authOptions);
    const credentials = resolveBedrockCredentials(authOptions);
    const cacheKey = `${region}:${authOptions?.accessKeyId || 'default'}`;

    let client = this.clientCache.get(cacheKey);
    if (!client) {
      client = new BedrockRuntimeClient({
        region,
        credentials,
      });
      this.clientCache.set(cacheKey, client);
    }
    return client;
  }

  /**
   * Streams chat completions and tool calls via AWS Bedrock ConverseStream API.
   */
  public async *streamChat(
    messages: ModelMessage[],
    options: ModelRequestOptions,
  ): AsyncIterable<ModelStreamChunk> {
    const modelId = options.model || this.defaultModel;

    // Parse auth options from options.apiKey or environment
    let authOptions: BedrockAuthOptions | undefined;
    if (options.apiKey) {
      // Allows passing "ACCESS_KEY:SECRET_KEY" or JSON format in apiKey field
      if (options.apiKey.includes(':')) {
        const [accessKeyId, secretAccessKey, sessionToken] = options.apiKey.split(':');
        authOptions = { accessKeyId, secretAccessKey, sessionToken };
      } else {
        try {
          const parsed = JSON.parse(options.apiKey);
          authOptions = parsed;
        } catch {
          // If not split by ':' and not JSON, might be a raw session token or custom
        }
      }
    }

    // Extract system prompt if present
    const systemPrompts: Array<{ text: string }> = [];
    const conversationMessages: Message[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        if (msg.content && msg.content.trim()) {
          systemPrompts.push({ text: msg.content });
        }
        continue;
      }

      if (msg.role === 'tool') {
        const toolResultBlock: ContentBlock = {
          toolResult: {
            toolUseId: msg.toolCallId || 'call_default',
            content: [{ text: msg.content }],
            status: 'success',
          },
        };

        // In Bedrock Converse API, all tool results answering an assistant turn's tool calls
        // MUST be combined into a single user message's content array.
        const lastMsg = conversationMessages[conversationMessages.length - 1];
        if (lastMsg && lastMsg.role === 'user' && Array.isArray(lastMsg.content)) {
          lastMsg.content.push(toolResultBlock);
        } else {
          conversationMessages.push({
            role: 'user',
            content: [toolResultBlock],
          });
        }
        continue;
      }

      if (msg.role === 'assistant') {
        const contentBlocks: ContentBlock[] = [];
        if (msg.content && msg.content.trim()) {
          contentBlocks.push({ text: msg.content });
        }
        if (msg.toolCalls && msg.toolCalls.length > 0) {
          for (const tc of msg.toolCalls) {
            let inputObj: Record<string, unknown> = {};
            try {
              inputObj = typeof tc.arguments === 'string' ? JSON.parse(tc.arguments) : tc.arguments;
            } catch {
              inputObj = {};
            }
            contentBlocks.push({
              toolUse: {
                toolUseId: tc.id,
                name: tc.name,
                input: inputObj as unknown as BedrockDocument,
              },
            });
          }
        }
        conversationMessages.push({
          role: 'assistant',
          content: contentBlocks.length > 0 ? contentBlocks : [{ text: '' }],
        });
        continue;
      }

      // User role
      conversationMessages.push({
        role: 'user',
        content: [{ text: msg.content || '' }],
      });
    }

    // Ensure at least one message exists
    if (conversationMessages.length === 0) {
      conversationMessages.push({
        role: 'user',
        content: [{ text: 'Hello' }],
      });
    }

    // Prepare tools if supplied
    let tools: Tool[] | undefined;
    if (options.tools && options.tools.length > 0) {
      tools = options.tools.map((t) => ({
        toolSpec: {
          name: t.name,
          description: t.description,
          inputSchema: {
            json: t.parameters as unknown as BedrockDocument,
          },
        },
      }));
    }

    const client = this.getClient(authOptions);

    const input: ConverseStreamCommandInput = {
      modelId,
      messages: conversationMessages,
      system: systemPrompts.length > 0 ? systemPrompts : undefined,
      inferenceConfig: {
        maxTokens: options.maxTokens || 8192,
        temperature: options.temperature ?? 0.2,
      },
      toolConfig: tools && tools.length > 0 ? { tools } : undefined,
    };

    try {
      const command = new ConverseStreamCommand(input);
      const response = await client.send(command, {
        abortSignal: options.abortSignal,
      });

      if (!response.stream) {
        throw new ModelError(
          'AWS Bedrock response did not contain an event stream',
          'MALFORMED_RESPONSE',
          this.id,
        );
      }

      let activeToolId = '';
      let activeToolName = '';
      let accumulatedToolArgs = '';

      for await (const chunk of response.stream) {
        if (options.abortSignal?.aborted) {
          throw new ModelError('Request aborted by caller', 'CANCELLED', this.id);
        }

        // 1. Text Token Deltas
        if (chunk.contentBlockDelta?.delta?.text) {
          yield {
            type: 'token',
            text: chunk.contentBlockDelta.delta.text,
          };
        }

        // 2. Tool Use Start
        if (chunk.contentBlockStart?.start?.toolUse) {
          const toolUse = chunk.contentBlockStart.start.toolUse;
          activeToolId = toolUse.toolUseId || `tool_${Date.now()}`;
          activeToolName = toolUse.name || '';
          accumulatedToolArgs = '';

          yield {
            type: 'tool_call_start',
            id: activeToolId,
            name: activeToolName,
          };
        }

        // 3. Tool Use Input Delta
        if (chunk.contentBlockDelta?.delta?.toolUse?.input) {
          const deltaChunk = chunk.contentBlockDelta.delta.toolUse.input;
          accumulatedToolArgs += deltaChunk;

          yield {
            type: 'tool_call_delta',
            id: activeToolId,
            argumentsDelta: deltaChunk,
          };
        }

        // 4. Tool Use Block Stop
        if (chunk.contentBlockStop) {
          if (activeToolName) {
            let parsedArgs: Record<string, unknown> = {};
            try {
              parsedArgs = accumulatedToolArgs ? JSON.parse(accumulatedToolArgs) : {};
            } catch {
              parsedArgs = { raw: accumulatedToolArgs };
            }

            yield {
              type: 'tool_call_complete',
              id: activeToolId,
              name: activeToolName,
              arguments: parsedArgs,
            };

            activeToolId = '';
            activeToolName = '';
            accumulatedToolArgs = '';
          }
        }

        // 5. Usage & Cost Metrics
        if (chunk.metadata?.usage) {
          const promptTokens = chunk.metadata.usage.inputTokens || 0;
          const completionTokens = chunk.metadata.usage.outputTokens || 0;
          // Claude 3.5 Sonnet pricing: ~$3/M input, ~$15/M output
          const cost = (promptTokens * 0.003 + completionTokens * 0.015) / 1000;

          yield {
            type: 'usage',
            promptTokens,
            completionTokens,
            costEstimateUsd: cost,
          };
        }
      }
    } catch (err: unknown) {
      if (err instanceof ModelError) {
        throw err;
      }

      const error = err as { name?: string; message?: string } | undefined;
      const errorName = error?.name || '';
      const message = error?.message || String(err);

      if (errorName === 'AccessDeniedException' || errorName === 'UnauthorizedException') {
        throw new ModelError(
          `AWS Bedrock Access Denied: ${message}. Check IAM permissions or Bedrock Model Access.`,
          'AUTH_FAILURE',
          this.id,
          403,
          false,
        );
      }
      if (errorName === 'UnrecognizedClientException' || errorName === 'ExpiredTokenException') {
        throw new ModelError(
          `AWS Bedrock Session Expired or Invalid Credentials: ${message}. Please re-authenticate via 'aws login'.`,
          'INVALID_API_KEY',
          this.id,
          401,
          false,
        );
      }
      if (errorName === 'ThrottlingException') {
        throw new ModelError(
          `AWS Bedrock Rate Limit / Throttled: ${message}`,
          'RATE_LIMIT',
          this.id,
          429,
          true,
        );
      }
      if (errorName === 'ResourceNotFoundException') {
        throw new ModelError(
          `AWS Bedrock Model Not Found or not enabled in region: ${message}`,
          'MODEL_NOT_FOUND',
          this.id,
          404,
          false,
        );
      }
      if (errorName === 'ValidationException') {
        throw new ModelError(
          `AWS Bedrock Validation Error: ${message}`,
          'MALFORMED_RESPONSE',
          this.id,
          400,
          false,
        );
      }

      throw new ModelError(
        `AWS Bedrock Error [${errorName || 'Unknown'}]: ${message}`,
        'SERVER_ERROR',
        this.id,
        500,
        false,
      );
    }
  }

  /**
   * Health check verifying Bedrock endpoint accessibility.
   */
  public async checkHealth(options?: {
    apiKey?: string;
    abortSignal?: AbortSignal;
  }): Promise<{ reachable: boolean; models?: string[]; latencyMs?: number; error?: string }> {
    const startTime = Date.now();
    try {
      const stream = this.streamChat([{ role: 'user', content: 'Ping' }], {
        model: this.defaultModel,
        maxTokens: 1,
        apiKey: options?.apiKey,
        abortSignal: options?.abortSignal,
      });

      for await (const chunk of stream) {
        if (chunk.type === 'token') {
          break;
        }
      }

      return {
        reachable: true,
        models: this.supportedModels.map((m) => m.id),
        latencyMs: Date.now() - startTime,
      };
    } catch (err: unknown) {
      const error = err as { message?: string } | undefined;
      return {
        reachable: false,
        error: error?.message || String(err),
      };
    }
  }
}
