import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  HuggingFaceProvider,
  ModelMessage,
  ModelError,
  EventBus,
} from '../src/index.js';

describe('Hugging Face Free-First Provider & Router (Phase 2)', () => {
  let provider: HuggingFaceProvider;
  let eventBus: EventBus;

  beforeEach(() => {
    provider = new HuggingFaceProvider();
    eventBus = new EventBus();
    vi.restoreAllMocks();
  });

  it('should expose Qwen3-Coder-30B-A3B-Instruct as default free coding model', () => {
    expect(provider.defaultModel).toBe('Qwen/Qwen3-Coder-30B-A3B-Instruct');
    const caps = provider.getCapabilities('Qwen/Qwen3-Coder-30B-A3B-Instruct');
    expect(caps.toolCalling).toBe(true);
    expect(caps.streaming).toBe(true);
    expect(caps.maxContextTokens).toBe(131072);
  });

  it('should throw AUTH_FAILURE when attempting streamChat without an API key', async () => {
    const messages: ModelMessage[] = [{ role: 'user', content: 'Hello' }];
    const stream = provider.streamChat(messages, {
      model: 'Qwen/Qwen3-Coder-30B-A3B-Instruct',
      apiKey: '',
    });

    await expect(async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _chunk of stream) {
        // should not reach
      }
    }).rejects.toThrowError(/Hugging Face access token is required/);
  });

  it('should report AUTH_REQUIRED cleanly in checkHealth when no API key is provided', async () => {
    const health = await provider.checkHealth({ apiKey: '' });
    expect(health.reachable).toBe(false);
    expect(health.error).toContain('Missing Hugging Face access token');
    expect(health.detail).toContain('Authentication token required');
  });

  it('should parse streaming tokens and tool calls from SSE stream', async () => {
    const sseLines = [
      'data: {"choices":[{"delta":{"content":"Hello world"}}]}',
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"tc_1","function":{"name":"search_code","arguments":"{\\"query\\":"}}]}}]}',
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\\"auth\\"}"}}]}}]}',
      'data: {"usage":{"prompt_tokens":10,"completion_tokens":5}}',
      'data: [DONE]',
    ].join('\n\n');

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        body: {
          getReader() {
            const encoder = new TextEncoder();
            const chunk = encoder.encode(sseLines);
            let readOnce = false;
            return {
              async read() {
                if (!readOnce) {
                  readOnce = true;
                  return { done: false, value: chunk };
                }
                return { done: true, value: undefined };
              },
            };
          },
        },
      }),
    );

    const chunks: any[] = [];
    const stream = provider.streamChat(
      [{ role: 'user', content: 'Search auth' }],
      {
        model: 'Qwen/Qwen3-Coder-30B-A3B-Instruct',
        apiKey: 'test-hf-key',
      },
    );

    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    const tokenChunks = chunks.filter((c) => c.type === 'token');
    expect(tokenChunks).toHaveLength(1);
    expect(tokenChunks[0].text).toBe('Hello world');

    const toolCallComplete = chunks.find((c) => c.type === 'tool_call_complete');
    expect(toolCallComplete).toBeDefined();
    expect(toolCallComplete.name).toBe('search_code');
    expect(toolCallComplete.arguments).toEqual({ query: 'auth' });
  });

  it('should handle HTTP 429 rate-limit with ModelError classification', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        text: async () => 'Rate limit reached on free router',
      }),
    );

    const stream = provider.streamChat(
      [{ role: 'user', content: 'Fix bug' }],
      {
        model: 'Qwen/Qwen3-Coder-30B-A3B-Instruct',
        apiKey: 'test-hf-key',
      },
    );

    await expect(async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _c of stream) {}
    }).rejects.toThrowError(ModelError);
  });

  it('should honor AbortController cancellation during streaming', async () => {
    const abortController = new AbortController();
    abortController.abort();

    const stream = provider.streamChat(
      [{ role: 'user', content: 'Hello' }],
      {
        model: 'Qwen/Qwen3-Coder-30B-A3B-Instruct',
        apiKey: 'test-hf-key',
        abortSignal: abortController.signal,
      },
    );

    const chunks: any[] = [];
    try {
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
    } catch {
      // abort could reject
    }
    expect(chunks).toHaveLength(0);
  });
});
