import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HuggingFaceProvider } from '../src/models/huggingface.js';
import { ModelError } from '../src/types/models.js';

describe('HuggingFaceProvider Unit Tests', () => {
  let provider: HuggingFaceProvider;

  beforeEach(() => {
    provider = new HuggingFaceProvider();
    vi.restoreAllMocks();
  });

  it('should expose correct provider metadata and capabilities', () => {
    expect(provider.id).toBe('huggingface');
    expect(provider.name).toBe('Hugging Face Inference');
    expect(provider.defaultModel).toBe('Qwen/Qwen2.5-Coder-32B-Instruct');

    const cap32B = provider.getCapabilities('Qwen/Qwen2.5-Coder-32B-Instruct');
    expect(cap32B.streaming).toBe(true);
    expect(cap32B.toolCalling).toBe(true);
    expect(cap32B.maxContextTokens).toBe(32768);

    const capDeepSeek = provider.getCapabilities('deepseek-ai/DeepSeek-R1-Distill-Qwen-7B');
    expect(capDeepSeek.toolCalling).toBe(false);
  });

  it('should throw AUTH_FAILURE if apiKey is missing or empty', async () => {
    await expect(async () => {
      const stream = provider.streamChat([{ role: 'user', content: 'test' }], {
        model: 'Qwen/Qwen2.5-Coder-32B-Instruct',
        apiKey: '',
      });
      for await (const _ of stream) {
        // empty
      }
    }).rejects.toThrow(ModelError);
  });

  it('should parse simulated SSE text stream with usage statistics', async () => {
    const ssePayload = [
      'data: {"choices":[{"index":0,"delta":{"role":"assistant","content":"Hello "}}]}\n\n',
      'data: {"choices":[{"index":0,"delta":{"content":"world!"}}]}\n\n',
      'data: {"choices":[{"index":0,"delta":{}}],"usage":{"prompt_tokens":10,"completion_tokens":5}}\n\n',
      'data: [DONE]\n\n',
    ].join('');

    const mockResponse = new Response(ssePayload, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    });

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse);

    const tokens: string[] = [];
    let usage: { prompt: number; completion: number } | undefined;

    for await (const chunk of provider.streamChat([{ role: 'user', content: 'Say hello' }], {
      model: 'Qwen/Qwen2.5-Coder-32B-Instruct',
      apiKey: 'hf_test_token',
    })) {
      if (chunk.type === 'token') {
        tokens.push(chunk.text);
      } else if (chunk.type === 'usage') {
        usage = { prompt: chunk.promptTokens, completion: chunk.completionTokens };
      }
    }

    expect(tokens.join('')).toBe('Hello world!');
    expect(usage).toEqual({ prompt: 10, completion: 5 });
  });

  it('should parse streaming tool calls and emit tool_call_complete', async () => {
    const ssePayload = [
      'data: {"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"read_file","arguments":"{\\"path\\":\\""}}]}}]}\n\n',
      'data: {"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"src/index.ts\\"}"}}]}}]}\n\n',
      'data: [DONE]\n\n',
    ].join('');

    const mockResponse = new Response(ssePayload, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    });

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse);

    const events: Array<{ type: string; id?: string; name?: string; arguments?: unknown }> = [];

    for await (const chunk of provider.streamChat([{ role: 'user', content: 'read index.ts' }], {
      model: 'Qwen/Qwen2.5-Coder-32B-Instruct',
      apiKey: 'hf_test_token',
      tools: [
        {
          name: 'read_file',
          description: 'read file',
          parameters: { type: 'object' },
        },
      ],
    })) {
      if (chunk.type === 'tool_call_start') {
        events.push({ type: 'start', id: chunk.id, name: chunk.name });
      } else if (chunk.type === 'tool_call_complete') {
        events.push({ type: 'complete', id: chunk.id, name: chunk.name, arguments: chunk.arguments });
      }
    }

    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({ type: 'start', id: 'call_1', name: 'read_file' });
    expect(events[1]).toEqual({
      type: 'complete',
      id: 'call_1',
      name: 'read_file',
      arguments: { path: 'src/index.ts' },
    });
  });

  it('should handle health check probing with valid response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: [{ id: 'Qwen/Qwen2.5-Coder-32B-Instruct' }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const health = await provider.checkHealth({ apiKey: 'hf_test_token' });
    expect(health.reachable).toBe(true);
    expect(health.models).toContain('Qwen/Qwen2.5-Coder-32B-Instruct');
  });

  it('should report missing credentials on checkHealth without apiKey', async () => {
    const health = await provider.checkHealth({ apiKey: '' });
    expect(health.reachable).toBe(false);
    expect(health.error).toContain('Missing Hugging Face access token');
  });
});
