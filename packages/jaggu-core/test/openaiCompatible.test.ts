import { describe, it, expect, vi, afterEach } from 'vitest';
import { OpenAICompatibleProvider } from '../src/index.js';

describe('OpenAICompatibleProvider (M7-A)', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('should stream tokens and report usage from local OpenAI-compatible endpoint', async () => {
    const sseChunks = [
      'data: {"choices":[{"delta":{"content":"class"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":" Calculator"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":" {}"}}],"usage":{"prompt_tokens":16,"completion_tokens":8}}\n\n',
      'data: [DONE]\n\n',
    ];

    let requestUrl = '';
    let authHeader: string | undefined;

    globalThis.fetch = vi.fn().mockImplementation((url, init) => {
      requestUrl = url;
      authHeader = init.headers?.Authorization;
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        body: new ReadableStream({
          start(controller) {
            for (const chunk of sseChunks) {
              controller.enqueue(new TextEncoder().encode(chunk));
            }
            controller.close();
          },
        }),
      });
    });

    const provider = new OpenAICompatibleProvider();
    const tokens: string[] = [];
    let usage: { prompt: number; completion: number } | undefined;

    for await (const chunk of provider.streamChat(
      [{ role: 'user', content: 'Define Calculator' }],
      {
        model: 'local-openai-default',
        baseUrl: 'http://localhost:8000/v1',
        apiKey: 'sk-local-test',
      },
    )) {
      if (chunk.type === 'token') {
        tokens.push(chunk.text);
      } else if (chunk.type === 'usage') {
        usage = { prompt: chunk.promptTokens, completion: chunk.completionTokens };
      }
    }

    expect(requestUrl).toBe('http://localhost:8000/v1/chat/completions');
    expect(authHeader).toBe('Bearer sk-local-test');
    expect(tokens.join('')).toBe('class Calculator {}');
    expect(usage).toEqual({ prompt: 16, completion: 8 });
  });

  it('should format and reconstruct tool calls from streaming SSE chunks', async () => {
    const sseChunks = [
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","function":{"name":"read_file","arguments":"{\\"path\\""}}]}}]}\n\n',
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":":\\"main.ts\\"}"}}]}}]}\n\n',
      'data: [DONE]\n\n',
    ];

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      body: new ReadableStream({
        start(controller) {
          for (const chunk of sseChunks) {
            controller.enqueue(new TextEncoder().encode(chunk));
          }
          controller.close();
        },
      }),
    });

    const provider = new OpenAICompatibleProvider();
    const chunks = [];

    for await (const chunk of provider.streamChat(
      [{ role: 'user', content: 'Read main.ts' }],
      {
        model: 'deepseek-coder-v2',
        tools: [
          {
            name: 'read_file',
            description: 'Read a file',
            parameters: { type: 'object', properties: { path: { type: 'string' } } },
          },
        ],
      },
    )) {
      chunks.push(chunk);
    }

    const completeChunk = chunks.find((c) => c.type === 'tool_call_complete');
    expect(completeChunk).toBeDefined();
    expect(completeChunk?.name).toBe('read_file');
    expect(completeChunk?.arguments).toEqual({ path: 'main.ts' });
  });

  it('should probe health and list models via GET /models', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: () =>
        Promise.resolve({
          data: [
            { id: 'deepseek-coder-v2-lite' },
            { id: 'qwen2.5-coder-32b' },
          ],
        }),
    });

    const provider = new OpenAICompatibleProvider();
    const health = await provider.checkHealth('http://localhost:1234/v1');

    expect(health.reachable).toBe(true);
    expect(health.models).toEqual(['deepseek-coder-v2-lite', 'qwen2.5-coder-32b']);
  });

  it('should return reachable=false on health check connection error', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'));

    const provider = new OpenAICompatibleProvider();
    const health = await provider.checkHealth('http://localhost:9999/v1');

    expect(health.reachable).toBe(false);
    expect(health.error).toContain('Connection refused');
  });
});
