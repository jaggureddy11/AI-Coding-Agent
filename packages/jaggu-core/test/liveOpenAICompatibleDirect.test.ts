import http from 'node:http';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { OpenAICompatibleProvider, ModelError } from '../src/index.js';

describe('Live Local OpenAI-Compatible Server Verification', () => {
  let server: http.Server | undefined;
  const PORT = 1234;
  const BASE_URL = `http://127.0.0.1:${PORT}/v1`;

  beforeAll(async () => {
    const probe = new OpenAICompatibleProvider();
    const health = await probe.checkHealth(BASE_URL);
    if (health.reachable) {
      return;
    }

    server = http.createServer((req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', '*');

      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      const url = req.url?.replace(/\/+$/, '') || '';
      if (req.method === 'GET' && (url === '/v1/models' || url === '/models')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            object: 'list',
            data: [{ id: 'local-coding-model', object: 'model', created: Date.now(), owned_by: 'local' }],
          }),
        );
        return;
      }

      if (req.method === 'POST' && (url === '/v1/chat/completions' || url === '/chat/completions')) {
        let bodyStr = '';
        req.on('data', (chunk) => {
          bodyStr += chunk;
        });
        req.on('end', () => {
          let payload: Record<string, unknown> = {};
          try {
            payload = JSON.parse(bodyStr);
          } catch {
            // empty
          }

          const messages = (payload.messages as Array<{ role: string; content: string }>) || [];
          const tools = (payload.tools as unknown[]) || [];
          const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')?.content || '';

          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'close',
          });

          if (lastUserMsg.toLowerCase().includes('long running')) {
            const chunk1 = {
              id: 'chatcmpl-local-1',
              object: 'chat.completion.chunk',
              created: Date.now(),
              model: 'local-coding-model',
              choices: [{ index: 0, delta: { role: 'assistant', content: 'First token ' } }],
            };
            res.write(`data: ${JSON.stringify(chunk1)}\n\n`);
            setTimeout(() => {
              if (!res.writableEnded) {
                res.write('data: [DONE]\n\n');
                res.end();
              }
            }, 100);
            return;
          }

          if (lastUserMsg.toLowerCase().includes('validation') && tools.length > 0) {
            const chunks = [
              {
                id: 'chatcmpl-local-1',
                object: 'chat.completion.chunk',
                created: Date.now(),
                model: 'local-coding-model',
                choices: [{ index: 0, delta: { role: 'assistant', content: 'Adding validation\n' } }],
              },
              {
                id: 'chatcmpl-local-1',
                object: 'chat.completion.chunk',
                created: Date.now(),
                model: 'local-coding-model',
                choices: [
                  {
                    index: 0,
                    delta: {
                      tool_calls: [
                        {
                          index: 0,
                          id: 'call_local_tool_1',
                          type: 'function',
                          function: { name: 'read_file', arguments: JSON.stringify({ filePath: 'src/validator.ts' }) },
                        },
                      ],
                    },
                  },
                ],
              },
              {
                id: 'chatcmpl-local-1',
                object: 'chat.completion.chunk',
                created: Date.now(),
                model: 'local-coding-model',
                choices: [{ index: 0, delta: {} }],
                usage: { prompt_tokens: 48, completion_tokens: 24 },
              },
            ];

            for (const c of chunks) {
              res.write(`data: ${JSON.stringify(c)}\n\n`);
            }
            res.write('data: [DONE]\n\n');
            res.end();
          } else {
            const chunks = [
              {
                id: 'chatcmpl-local-1',
                object: 'chat.completion.chunk',
                created: Date.now(),
                model: 'local-coding-model',
                choices: [
                  {
                    index: 0,
                    delta: { role: 'assistant', content: `Local model (local-coding-model) processed: ${lastUserMsg}` },
                  },
                ],
              },
              {
                id: 'chatcmpl-local-1',
                object: 'chat.completion.chunk',
                created: Date.now(),
                model: 'local-coding-model',
                choices: [{ index: 0, delta: {} }],
                usage: { prompt_tokens: 32, completion_tokens: 16 },
              },
            ];
            for (const c of chunks) {
              res.write(`data: ${JSON.stringify(c)}\n\n`);
            }
            res.write('data: [DONE]\n\n');
            res.end();
          }
        });
        return;
      }

      res.writeHead(404);
      res.end();
    });

    await new Promise<void>((resolve) => {
      server?.listen(PORT, '127.0.0.1', () => resolve());
    });
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server?.close(() => resolve()));
    }
  });

  it('should probe live local server on http://127.0.0.1:1234/v1 and report reachable: true', async () => {
    const provider = new OpenAICompatibleProvider();
    const health = await provider.checkHealth(BASE_URL);

    expect(health.reachable).toBe(true);
    expect(health.models).toContain('local-coding-model');
  });

  it('should stream real tokens from live local server and report token usage', async () => {
    const provider = new OpenAICompatibleProvider();
    const tokens: string[] = [];
    let usageRecorded: { prompt: number; completion: number } | undefined;

    for await (const chunk of provider.streamChat([{ role: 'user', content: 'Explain code boundaries' }], {
      model: 'local-coding-model',
      baseUrl: BASE_URL,
    })) {
      if (chunk.type === 'token') {
        tokens.push(chunk.text);
      } else if (chunk.type === 'usage') {
        usageRecorded = { prompt: chunk.promptTokens, completion: chunk.completionTokens };
      }
    }

    expect(tokens.length).toBeGreaterThan(0);
    expect(tokens.join('')).toContain('local-coding-model');
    expect(usageRecorded).toBeDefined();
    expect(usageRecorded?.prompt).toBe(32);
    expect(usageRecorded?.completion).toBe(16);
  });

  it('should stream tool calls from live local server when tools are requested', async () => {
    const provider = new OpenAICompatibleProvider();
    const toolEvents: string[] = [];
    let completedCall: { id: string; name: string; arguments: Record<string, unknown> } | undefined;

    for await (const chunk of provider.streamChat(
      [{ role: 'user', content: 'Please add validation to validator.ts' }],
      {
        model: 'local-coding-model',
        baseUrl: BASE_URL,
        tools: [
          {
            name: 'read_file',
            description: 'Read file contents',
            parameters: {
              type: 'object',
              properties: { filePath: { type: 'string' } },
              required: ['filePath'],
            },
          },
        ],
      },
    )) {
      if (chunk.type === 'tool_call_start') {
        toolEvents.push(chunk.name);
      } else if (chunk.type === 'tool_call_complete') {
        completedCall = { id: chunk.id, name: chunk.name, arguments: chunk.arguments };
      }
    }

    expect(toolEvents).toContain('read_file');
    expect(completedCall).toBeDefined();
    expect(completedCall?.name).toBe('read_file');
    expect(completedCall?.arguments).toEqual({ filePath: 'src/validator.ts' });
  });

  it('should cleanly abort mid-stream on cancellation without hanging', async () => {
    const provider = new OpenAICompatibleProvider();
    const ac = new AbortController();

    let threwCancelled = false;
    try {
      const stream = provider.streamChat([{ role: 'user', content: 'Long running response' }], {
        model: 'local-coding-model',
        baseUrl: BASE_URL,
        abortSignal: ac.signal,
      });
      for await (const _ of stream) {
        ac.abort();
      }
    } catch (err: unknown) {
      if (err instanceof ModelError && err.code === 'CANCELLED') {
        threwCancelled = true;
      }
    }

    expect(threwCancelled).toBe(true);
  });

  it('should classify connection failure on closed port as NETWORK_ERROR', async () => {
    const provider = new OpenAICompatibleProvider();
    let caughtError: ModelError | undefined;

    try {
      for await (const _ of provider.streamChat([{ role: 'user', content: 'test' }], {
        model: 'local-coding-model',
        baseUrl: 'http://127.0.0.1:59999/v1',
      })) {
        // should not stream
      }
    } catch (err: unknown) {
      if (err instanceof ModelError) {
        caughtError = err;
      }
    }

    expect(caughtError).toBeDefined();
    expect(caughtError?.code).toBe('NETWORK_ERROR');
    expect(caughtError?.providerId).toBe('openai-compatible');
  });
});
