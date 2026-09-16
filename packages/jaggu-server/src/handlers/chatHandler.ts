import { IncomingMessage, ServerResponse } from 'http';
import { ModelGateway, ModelMessage, ModelRequestOptions, ModelToolDefinition } from '@jaggu/core';
import { ChatCompletionRequestSchema, formatOpenAIError } from '../types/schema.js';
import { ProviderRouter, MissingBackendKeyError } from '../router.js';

export async function handleChatCompletions(
  _req: IncomingMessage,
  res: ServerResponse,
  rawBody: string,
  gateway: ModelGateway,
  router: ProviderRouter,
): Promise<void> {
  // 1. Parse JSON safely
  let rawJson: unknown;
  try {
    rawJson = JSON.parse(rawBody || '{}');
  } catch {
    const errorRes = formatOpenAIError(
      'Malformed JSON payload in request body',
      'invalid_request_error',
      'invalid_json',
    );
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(errorRes));
    return;
  }

  // 2. Validate request schema strictly via Zod
  const parseResult = ChatCompletionRequestSchema.safeParse(rawJson);
  if (!parseResult.success) {
    const issues = parseResult.error.issues;
    const errorMessage = `Invalid request: ${issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; ')}`;
    const errorRes = formatOpenAIError(
      errorMessage,
      'invalid_request_error',
      'invalid_payload',
      issues[0]?.path.join('.') || undefined,
    );
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(errorRes));
    return;
  }

  const payload = parseResult.data;

  // 3. Resolve Provider & Injected Backend API Key
  let providerInfo;
  try {
    providerInfo = router.resolve(payload.model);
  } catch (err) {
    if (err instanceof MissingBackendKeyError) {
      const errorRes = formatOpenAIError(
        err.message,
        'authentication_error',
        'missing_backend_api_key',
      );
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(errorRes));
      return;
    }
    const message = err instanceof Error ? err.message : 'Failed to resolve model provider';
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(formatOpenAIError(message, 'server_error')));
    return;
  }

  // 4. Setup Cancellation (Invariant 11: First-class cancellation support)
  // Client disconnection before stream ends is caught on res 'close'
  const abortController = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) {
      abortController.abort();
    }
  });

  // 5. Convert Tools into ModelToolDefinition[]
  const tools: ModelToolDefinition[] | undefined = payload.tools?.map((t) => ({
    name: t.function.name,
    description: t.function.description,
    parameters: t.function.parameters,
  }));

  // Map messages to ModelMessage[]
  const messages: ModelMessage[] = payload.messages.map((m) => ({
    role: m.role,
    content: m.content || '',
    name: m.name,
    toolCallId: m.tool_call_id,
    toolCalls: m.tool_calls?.map((tc) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: tc.function.arguments,
    })),
  }));

  const requestOptions: ModelRequestOptions = {
    model: payload.model,
    apiKey: providerInfo.apiKey,
    baseUrl: providerInfo.baseUrl,
    temperature: payload.temperature,
    maxTokens: payload.max_tokens,
    tools,
    abortSignal: abortController.signal,
  };

  const completionId = `chatcmpl-${Date.now()}`;
  const created = Math.floor(Date.now() / 1000);

  // 6. Handle Streaming vs Non-Streaming
  if (payload.stream) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    try {
      const stream = gateway.streamChat(providerInfo.providerId, messages, requestOptions);

      for await (const chunk of stream) {
        if (abortController.signal.aborted) {
          break;
        }

        if (chunk.type === 'token') {
          const sseChunk = {
            id: completionId,
            object: 'chat.completion.chunk',
            created,
            model: payload.model,
            choices: [
              {
                index: 0,
                delta: { content: chunk.text },
                finish_reason: null,
              },
            ],
          };
          res.write(`data: ${JSON.stringify(sseChunk)}\n\n`);
        } else if (chunk.type === 'tool_call_delta') {
          const sseChunk = {
            id: completionId,
            object: 'chat.completion.chunk',
            created,
            model: payload.model,
            choices: [
              {
                index: 0,
                delta: {
                  tool_calls: [
                    {
                      index: 0,
                      id: chunk.id,
                      function: { arguments: chunk.argumentsDelta },
                    },
                  ],
                },
                finish_reason: null,
              },
            ],
          };
          res.write(`data: ${JSON.stringify(sseChunk)}\n\n`);
        } else if (chunk.type === 'error') {
          const errorPayload = formatOpenAIError(
            chunk.error.message,
            'server_error',
            chunk.code || 'stream_error',
          );
          res.write(`data: ${JSON.stringify(errorPayload)}\n\n`);
        }
      }

      if (!abortController.signal.aborted) {
        const finalChunk = {
          id: completionId,
          object: 'chat.completion.chunk',
          created,
          model: payload.model,
          choices: [
            {
              index: 0,
              delta: {},
              finish_reason: 'stop',
            },
          ],
        };
        res.write(`data: ${JSON.stringify(finalChunk)}\n\n`);
        res.write('data: [DONE]\n\n');
      }
      res.end();
    } catch (err: unknown) {
      if (abortController.signal.aborted) {
        res.end();
        return;
      }
      const message = err instanceof Error ? err.message : 'Upstream model streaming error';
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(formatOpenAIError(message, 'server_error')));
      } else {
        res.write(`data: ${JSON.stringify(formatOpenAIError(message, 'server_error'))}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
      }
    }
  } else {
    // Non-streaming response
    try {
      let fullText = '';
      const stream = gateway.streamChat(providerInfo.providerId, messages, requestOptions);

      for await (const chunk of stream) {
        if (chunk.type === 'token') {
          fullText += chunk.text;
        }
      }

      const responsePayload = {
        id: completionId,
        object: 'chat.completion',
        created,
        model: payload.model,
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: fullText,
            },
            finish_reason: 'stop',
          },
        ],
      };

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(responsePayload));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Upstream model invocation error';
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(formatOpenAIError(message, 'server_error')));
    }
  }
}
