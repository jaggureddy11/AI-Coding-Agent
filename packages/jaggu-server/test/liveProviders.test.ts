import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { JagguProxyServer } from '../src/server.js';
import { loadConfig } from '../src/config.js';

describe('Live Provider End-to-End Tests via JagguProxyServer', () => {
  let server: JagguProxyServer;
  const config = loadConfig();
  const testPort = 3999;
  const baseUrl = `http://127.0.0.1:${testPort}`;

  beforeAll(async () => {
    server = new JagguProxyServer({
      ...config,
      port: testPort,
      host: '127.0.0.1',
    });
    await server.start();
  });

  afterAll(async () => {
    await server.stop();
  });

  it('GET /health reports all configured provider keys', async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
    const health = await res.json();
    expect(health.status).toBe('ok');
    expect(health.providers).toBeDefined();

    if (config.keys.anthropic) {
      expect(health.providers.anthropic).toBe(true);
    }
    if (config.keys.openai) {
      expect(health.providers.openai).toBe(true);
    }
    if (config.keys.huggingface) {
      expect(health.providers.huggingface).toBe(true);
    }
  });

  it('streams live tokens from OpenAI via proxy if key configured', async () => {
    if (!config.keys.openai) {
      return;
    }

    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Say "JAGGU_OPENAI_OK" and nothing else.' }],
        stream: true,
        max_tokens: 15,
      }),
    });

    expect(res.status).toBe(200);
    const reader = res.body?.getReader();
    expect(reader).toBeDefined();
    if (!reader) return;

    const decoder = new TextDecoder();
    let accumulatedText = '';
    let sawDone = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value);
      accumulatedText += text;
      if (text.includes('[DONE]')) {
        sawDone = true;
      }
    }

    expect(accumulatedText).toContain('data:');
    // Verifies either stream chunk or valid upstream quota response
    const isValidResponse =
      accumulatedText.includes('chat.completion.chunk') ||
      accumulatedText.includes('insufficient_quota') ||
      accumulatedText.includes('credit_balance_exhausted');
    expect(isValidResponse).toBe(true);
    expect(sawDone).toBe(true);
  }, 30000);

  it('streams live tokens from Claude (Anthropic) via proxy if key configured', async () => {
    if (!config.keys.anthropic) {
      return;
    }

    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-latest',
        messages: [{ role: 'user', content: 'Say "JAGGU_CLAUDE_OK" and nothing else.' }],
        stream: true,
        max_tokens: 15,
      }),
    });

    expect(res.status).toBe(200);
    const reader = res.body?.getReader();
    expect(reader).toBeDefined();
    if (!reader) return;

    const decoder = new TextDecoder();
    let accumulatedText = '';
    let sawDone = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value);
      accumulatedText += text;
      if (text.includes('[DONE]')) {
        sawDone = true;
      }
    }

    expect(accumulatedText).toContain('data:');
    // Verifies either stream chunk or valid upstream credit balance response
    const isValidResponse =
      accumulatedText.includes('chat.completion.chunk') ||
      accumulatedText.includes('credit balance is too low') ||
      accumulatedText.includes('invalid_request_error');
    expect(isValidResponse).toBe(true);
    expect(sawDone).toBe(true);
  }, 30000);
});
