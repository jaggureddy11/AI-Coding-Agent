import { describe, it, expect, vi, afterEach } from 'vitest';
import { OllamaProvider, ModelError } from '../src/index.js';

describe('OllamaProvider Hardening (M7-A)', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('should stream tokens and report usage metrics from local Ollama NDJSON stream', async () => {
    const ndjsonLines = [
      JSON.stringify({ message: { content: 'function' }, done: false }) + '\n',
      JSON.stringify({ message: { content: ' add(a, b)' }, done: false }) + '\n',
      JSON.stringify({
        message: { content: ' { return a + b; }' },
        done: true,
        prompt_eval_count: 24,
        eval_count: 12,
      }) + '\n',
    ];

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      body: new ReadableStream({
        start(controller) {
          for (const line of ndjsonLines) {
            controller.enqueue(new TextEncoder().encode(line));
          }
          controller.close();
        },
      }),
    });

    const provider = new OllamaProvider();
    const tokens: string[] = [];
    let usageRecorded: { prompt: number; completion: number } | undefined;

    for await (const chunk of provider.streamChat(
      [{ role: 'user', content: 'Write an add function' }],
      { model: 'qwen2.5-coder:7b' },
    )) {
      if (chunk.type === 'token') {
        tokens.push(chunk.text);
      } else if (chunk.type === 'usage') {
        usageRecorded = { prompt: chunk.promptTokens, completion: chunk.completionTokens };
      }
    }

    expect(tokens.join('')).toBe('function add(a, b) { return a + b; }');
    expect(usageRecorded).toEqual({ prompt: 24, completion: 12 });
  });

  it('should format tools in request and parse Ollama tool call responses', async () => {
    let capturedBody: Record<string, unknown> | undefined;

    const ndjsonLines = [
      JSON.stringify({
        message: {
          content: '',
          tool_calls: [
            {
              function: {
                name: 'search_files',
                arguments: { pattern: 'auth' },
              },
            },
          ],
        },
        done: true,
      }) + '\n',
    ];

    globalThis.fetch = vi.fn().mockImplementation((_url, init) => {
      capturedBody = JSON.parse(init.body as string);
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        body: new ReadableStream({
          start(controller) {
            for (const line of ndjsonLines) {
              controller.enqueue(new TextEncoder().encode(line));
            }
            controller.close();
          },
        }),
      });
    });

    const provider = new OllamaProvider();
    const chunks = [];

    for await (const chunk of provider.streamChat(
      [{ role: 'user', content: 'Find auth files' }],
      {
        model: 'qwen2.5-coder:7b',
        tools: [
          {
            name: 'search_files',
            description: 'Search files by pattern',
            parameters: { type: 'object', properties: { pattern: { type: 'string' } } },
          },
        ],
      },
    )) {
      chunks.push(chunk);
    }

    // Verify request formatted tools
    expect(capturedBody).toBeDefined();
    expect(capturedBody?.tools).toEqual([
      {
        type: 'function',
        function: {
          name: 'search_files',
          description: 'Search files by pattern',
          parameters: { type: 'object', properties: { pattern: { type: 'string' } } },
        },
      },
    ]);

    // Verify tool calls yielded
    const startChunk = chunks.find((c) => c.type === 'tool_call_start');
    const completeChunk = chunks.find((c) => c.type === 'tool_call_complete');

    expect(startChunk).toBeDefined();
    expect(startChunk?.name).toBe('search_files');
    expect(completeChunk).toBeDefined();
    expect(completeChunk?.name).toBe('search_files');
    expect(completeChunk?.arguments).toEqual({ pattern: 'auth' });
  });

  it('should classify 404 model not found as helpful not_installed error', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      text: () => Promise.resolve('{"error":"model \'nonexistent:7b\' not found, try pulling it first"}'),
    });

    const provider = new OllamaProvider();
    const run = async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _ of provider.streamChat([], { model: 'nonexistent:7b' })) {}
    };

    await expect(run()).rejects.toThrowError(ModelError);
    await expect(run()).rejects.toThrowError(
      /Model "nonexistent:7b" is not installed in local Ollama\. Run "ollama pull nonexistent:7b" first\./,
    );
  });

  it('should support real cancellation via AbortSignal', async () => {
    const controller = new AbortController();

    globalThis.fetch = vi.fn().mockImplementation((_url, init) => {
      if (init.signal?.aborted) {
        return Promise.reject(new Error('AbortError'));
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        body: new ReadableStream({
          start(streamController) {
            controller.abort();
            streamController.enqueue(
              new TextEncoder().encode(JSON.stringify({ message: { content: 'chunk' } }) + '\n'),
            );
            streamController.close();
          },
        }),
      });
    });

    const provider = new OllamaProvider();
    const run = async () => {
      for await (const _ of provider.streamChat([], {
        model: 'qwen2.5-coder:7b',
        abortSignal: controller.signal,
      })) {
        // should abort
      }
    };

    await expect(run()).rejects.toThrowError('Request was cancelled by user');
  });

  it('should probe local Ollama health and list installed tags via checkHealth', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: () =>
        Promise.resolve({
          models: [
            { name: 'qwen2.5-coder:7b' },
            { name: 'deepseek-r1:8b' },
            { name: 'llama3.3:70b' },
          ],
        }),
    });

    const provider = new OllamaProvider();
    const health = await provider.checkHealth('http://localhost:11434');

    expect(health.reachable).toBe(true);
    expect(health.models).toEqual(['qwen2.5-coder:7b', 'deepseek-r1:8b', 'llama3.3:70b']);
  });

  it('should report reachable=false on checkHealth connection failure', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('fetch failed: ECONNREFUSED'));

    const provider = new OllamaProvider();
    const health = await provider.checkHealth('http://localhost:11434');

    expect(health.reachable).toBe(false);
    expect(health.error).toContain('ECONNREFUSED');
  });
});
