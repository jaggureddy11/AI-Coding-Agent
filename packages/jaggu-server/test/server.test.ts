import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { JagguProxyServer } from '../src/server.js';
import { ServerConfig } from '../src/config.js';

describe('JagguProxyServer', () => {
  let server: JagguProxyServer;
  const testPort = 3899;
  const baseUrl = `http://localhost:${testPort}`;

  beforeAll(async () => {
    const testConfig: ServerConfig = {
      port: testPort,
      host: '127.0.0.1',
      defaultProvider: 'mock',
      keys: {
        huggingface: 'test-hf-token',
        openai: 'test-openai-key',
      },
      ollamaBaseUrl: 'http://127.0.0.1:11434',
    };
    server = new JagguProxyServer(testConfig);
    await server.start();
  });

  afterAll(async () => {
    await server.stop();
  });

  it('GET /health returns 200 with status and configured providers', async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.configuredProviders.huggingface).toBe(true);
    expect(data.configuredProviders.openai).toBe(true);
    expect(data.configuredProviders.anthropic).toBe(false);
  });

  it('GET /v1/models returns model list in OpenAI format', async () => {
    const res = await fetch(`${baseUrl}/v1/models`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.object).toBe('list');
    expect(Array.isArray(data.data)).toBe(true);
    expect(data.data.length).toBeGreaterThan(0);
  });

  it('POST /v1/chat/completions with stream: false returns assistant message', async () => {
    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'mock-model',
        messages: [{ role: 'user', content: 'Hello Jaggu' }],
        stream: false,
      }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.object).toBe('chat.completion');
    expect(data.choices[0].message.role).toBe('assistant');
    expect(data.choices[0].message.content).toBeDefined();
  });

  it('POST /v1/chat/completions with stream: true streams SSE chunks', async () => {
    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'mock-model',
        messages: [{ role: 'user', content: 'Count to 3' }],
        stream: true,
      }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    const text = await res.text();
    expect(text).toContain('data:');
    expect(text).toContain('[DONE]');
  });
});
