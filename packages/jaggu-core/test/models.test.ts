import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ModelGateway,
  OpenAIProvider,
  AnthropicProvider,
  GeminiProvider,
  OllamaProvider,
  MockModelProvider,
  ModelError,
  EventBus,
} from '../src/index.js';

describe('JAGGU Multi-Provider Model Gateway & Adapters', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('ModelGateway Provider Registry & Capabilities', () => {
    it('should register and resolve all 5 core providers', () => {
      const gateway = new ModelGateway();
      expect(gateway.getProvider('openai')).toBeInstanceOf(OpenAIProvider);
      expect(gateway.getProvider('anthropic')).toBeInstanceOf(AnthropicProvider);
      expect(gateway.getProvider('gemini')).toBeInstanceOf(GeminiProvider);
      expect(gateway.getProvider('ollama')).toBeInstanceOf(OllamaProvider);
      expect(gateway.getProvider('mock')).toBeInstanceOf(MockModelProvider);
    });

    it('should throw error when requesting unknown provider', () => {
      const gateway = new ModelGateway();
      expect(() => gateway.getProvider('nonexistent')).toThrowError('Unknown model provider');
    });

    it('should report model capabilities accurately', () => {
      const gateway = new ModelGateway();
      const anthropic = gateway.getProvider('anthropic');
      const caps = anthropic.getCapabilities('claude-3-5-sonnet-latest');

      expect(caps.streaming).toBe(true);
      expect(caps.toolCalling).toBe(true);
      expect(caps.maxContextTokens).toBe(200000);
      expect(caps.maxOutputTokens).toBe(8192);
    });
  });

  describe('MockModelProvider', () => {
    it('should stream simulated tokens and return usage metadata', async () => {
      const provider = new MockModelProvider({
        chunks: ['Hello', ' from', ' JAGGU'],
        chunkDelayMs: 1,
      });

      const tokens: string[] = [];
      let usageRecorded = false;

      for await (const chunk of provider.streamChat(
        [{ role: 'user', content: 'Hi' }],
        { model: 'mock-fast' },
      )) {
        if (chunk.type === 'token') {
          tokens.push(chunk.text);
        } else if (chunk.type === 'usage') {
          usageRecorded = true;
          expect(chunk.promptTokens).toBeGreaterThan(0);
          expect(chunk.completionTokens).toBeGreaterThan(0);
        }
      }

      expect(tokens.join('')).toBe('Hello from JAGGU');
      expect(usageRecorded).toBe(true);
    });

    it('should throw CANCELLED ModelError when aborted signal is triggered', async () => {
      const provider = new MockModelProvider({ chunkDelayMs: 50 });
      const controller = new AbortController();

      const run = async () => {
        const stream = provider.streamChat(
          [{ role: 'user', content: 'Test' }],
          { model: 'mock-fast', abortSignal: controller.signal },
        );
        controller.abort();
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for await (const _ of stream) {
          // should abort
        }
      };

      await expect(run()).rejects.toThrowError('Request was cancelled by user');
    });

    it('should simulate classified errors when configured', async () => {
      const authErrProvider = new MockModelProvider({ simulateError: 'AUTH_FAILURE' });
      await expect(async () => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for await (const _ of authErrProvider.streamChat([], { model: 'mock-fast' })) {}
      }).rejects.toThrowError('Invalid mock API credential');

      const rateLimitProvider = new MockModelProvider({ simulateError: 'RATE_LIMIT' });
      await expect(async () => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for await (const _ of rateLimitProvider.streamChat([], { model: 'mock-fast' })) {}
      }).rejects.toThrowError('Mock rate limit exceeded');
    });

    it('should stream simulated tool calls', async () => {
      const provider = new MockModelProvider({
        simulateToolCall: {
          id: 'call_123',
          name: 'read_file',
          arguments: { path: 'src/app.ts' },
        },
      });

      const events: string[] = [];
      for await (const chunk of provider.streamChat([], { model: 'mock-fast' })) {
        events.push(chunk.type);
      }

      expect(events).toContain('tool_call_start');
      expect(events).toContain('tool_call_delta');
      expect(events).toContain('tool_call_complete');
    });
  });

  describe('OpenAIProvider with Simulated SSE Streams', () => {
    it('should parse OpenAI chat completion SSE chunks and usage', async () => {
      const mockSseBody = [
        'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":" world"}}]}\n\n',
        'data: {"usage":{"prompt_tokens":10,"completion_tokens":5}}\n\n',
        'data: [DONE]\n\n',
      ].join('');

      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(mockSseBody, {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        }),
      );

      const provider = new OpenAIProvider();
      const tokens: string[] = [];
      let usageFound = false;

      for await (const chunk of provider.streamChat(
        [{ role: 'user', content: 'Say hello' }],
        { model: 'gpt-4o', apiKey: 'test-sk-key' },
      )) {
        if (chunk.type === 'token') {
          tokens.push(chunk.text);
        } else if (chunk.type === 'usage') {
          usageFound = true;
          expect(chunk.promptTokens).toBe(10);
          expect(chunk.completionTokens).toBe(5);
        }
      }

      expect(tokens.join('')).toBe('Hello world');
      expect(usageFound).toBe(true);
    });

    it('should throw ModelError on missing API key', async () => {
      const provider = new OpenAIProvider();
      await expect(async () => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for await (const _ of provider.streamChat([], { model: 'gpt-4o' })) {}
      }).rejects.toThrowError('OpenAI API key is missing');
    });

    it('should classify 401 response as non-retryable AUTH_FAILURE', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response('{"error":{"message":"Invalid API key"}}', {
          status: 401,
          statusText: 'Unauthorized',
        }),
      );

      const provider = new OpenAIProvider();
      try {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for await (const _ of provider.streamChat([], { model: 'gpt-4o', apiKey: 'invalid-key' })) {}
        expect.unreachable();
      } catch (err: any) {
        expect(err).toBeInstanceOf(ModelError);
        expect(err.code).toBe('AUTH_FAILURE');
      }
    });
  });

  describe('AnthropicProvider with Simulated SSE Streams', () => {
    it('should parse Anthropic message stream chunks and usage', async () => {
      const mockSseBody = [
        'data: {"type":"message_start","message":{"usage":{"input_tokens":15}}}\n\n',
        'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Building"}}\n\n',
        'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":" with JAGGU"}}\n\n',
        'data: {"type":"message_delta","usage":{"output_tokens":8}}\n\n',
      ].join('');

      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(mockSseBody, {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        }),
      );

      const provider = new AnthropicProvider();
      const tokens: string[] = [];
      let usageFound = false;

      for await (const chunk of provider.streamChat(
        [{ role: 'user', content: 'Build' }],
        { model: 'claude-3-5-sonnet-latest', apiKey: 'test-ant-key' },
      )) {
        if (chunk.type === 'token') {
          tokens.push(chunk.text);
        } else if (chunk.type === 'usage') {
          usageFound = true;
          expect(chunk.promptTokens).toBe(15);
          expect(chunk.completionTokens).toBe(8);
        }
      }

      expect(tokens.join('')).toBe('Building with JAGGU');
      expect(usageFound).toBe(true);
    });

    it('should throw on missing Anthropic API key', async () => {
      const provider = new AnthropicProvider();
      await expect(async () => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for await (const _ of provider.streamChat([], { model: 'claude-3-5-sonnet-latest' })) {}
      }).rejects.toThrowError('Anthropic API key is missing');
    });
  });

  describe('GeminiProvider with Simulated SSE Streams', () => {
    it('should parse Gemini streaming response chunks', async () => {
      const mockSseBody = [
        'data: {"candidates":[{"content":{"parts":[{"text":"Gemini"}]}}]}\n\n',
        'data: {"candidates":[{"content":{"parts":[{"text":" Flash response"}]}}],"usageMetadata":{"promptTokenCount":12,"candidatesTokenCount":6}}\n\n',
      ].join('');

      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(mockSseBody, {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        }),
      );

      const provider = new GeminiProvider();
      const tokens: string[] = [];

      for await (const chunk of provider.streamChat(
        [{ role: 'user', content: 'Hello' }],
        { model: 'gemini-2.0-flash', apiKey: 'test-gemini-key' },
      )) {
        if (chunk.type === 'token') {
          tokens.push(chunk.text);
        }
      }

      expect(tokens.join('')).toBe('Gemini Flash response');
    });
  });

  describe('OllamaProvider with Simulated NDJSON Stream', () => {
    it('should parse Ollama NDJSON chunks and completion stats', async () => {
      const mockNdjson = [
        JSON.stringify({ message: { content: 'Local' }, done: false }) + '\n',
        JSON.stringify({ message: { content: ' LLM' }, done: false }) + '\n',
        JSON.stringify({ done: true, prompt_eval_count: 20, eval_count: 10 }) + '\n',
      ].join('');

      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(mockNdjson, {
          status: 200,
        }),
      );

      const provider = new OllamaProvider();
      const tokens: string[] = [];
      let usageFound = false;

      for await (const chunk of provider.streamChat(
        [{ role: 'user', content: 'Local prompt' }],
        { model: 'qwen2.5-coder:7b' },
      )) {
        if (chunk.type === 'token') {
          tokens.push(chunk.text);
        } else if (chunk.type === 'usage') {
          usageFound = true;
          expect(chunk.promptTokens).toBe(20);
          expect(chunk.completionTokens).toBe(10);
        }
      }

      expect(tokens.join('')).toBe('Local LLM');
      expect(usageFound).toBe(true);
    });

    it('should classify local daemon connection failure as NETWORK_ERROR', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:11434'));

      const provider = new OllamaProvider();
      try {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for await (const _ of provider.streamChat([], { model: 'qwen2.5-coder:7b' })) {}
        expect.unreachable();
      } catch (err: any) {
        expect(err).toBeInstanceOf(ModelError);
        expect(err.code).toBe('NETWORK_ERROR');
      }
    });
  });

  describe('ModelGateway Event Emission & Telemetry', () => {
    it('should emit typed model lifecycle events on EventBus', async () => {
      const eventBus = new EventBus();
      const eventsEmitted: string[] = [];

      eventBus.on('model.requested', () => eventsEmitted.push('model.requested'));
      eventBus.on('model.stream_started', () => eventsEmitted.push('model.stream_started'));
      eventBus.on('model.text_delta', () => eventsEmitted.push('model.text_delta'));
      eventBus.on('model.completed', () => eventsEmitted.push('model.completed'));

      const gateway = new ModelGateway();
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _ of gateway.streamChat(
        'mock',
        [{ role: 'user', content: 'Run test' }],
        { model: 'mock-fast' },
        eventBus,
        'task_test_01',
      )) {
        // stream all
      }

      expect(eventsEmitted).toContain('model.requested');
      expect(eventsEmitted).toContain('model.stream_started');
      expect(eventsEmitted).toContain('model.text_delta');
      expect(eventsEmitted).toContain('model.completed');
    });
  });
});
