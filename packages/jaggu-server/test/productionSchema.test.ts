import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { JagguProxyServer } from '../src/server.js';
import { ServerConfig } from '../src/config.js';

describe('Production Schema & Security Validations', () => {
  let server: JagguProxyServer;
  const testPort = 3988;
  const baseUrl = `http://localhost:${testPort}`;

  beforeAll(async () => {
    const testConfig: ServerConfig = {
      port: testPort,
      host: '127.0.0.1',
      serverAuthSecret: 'test-secret-123',
      defaultProvider: 'mock',
      keys: {
        huggingface: 'test-hf-token',
        // openai intentionally omitted to test MissingBackendKeyError
      },
      ollamaBaseUrl: 'http://127.0.0.1:11434',
    };
    server = new JagguProxyServer(testConfig);
    await server.start();
  });

  afterAll(async () => {
    await server.stop();
  });

  it('enforces Bearer token authentication when serverAuthSecret is set', async () => {
    const res = await fetch(`${baseUrl}/v1/models`);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error.type).toBe('authentication_error');
    expect(data.error.code).toBe('invalid_api_key');
  });

  it('rejects malformed JSON with 400 invalid_request_error', async () => {
    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-secret-123',
      },
      body: '{ malformed json: true, ',
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.type).toBe('invalid_request_error');
    expect(data.error.code).toBe('invalid_json');
  });

  it('rejects payload missing messages array with 400 invalid_payload', async () => {
    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-secret-123',
      },
      body: JSON.stringify({
        model: 'mock-fast',
      }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.type).toBe('invalid_request_error');
    expect(data.error.code).toBe('invalid_payload');
    expect(data.error.message).toContain('messages');
  });

  it('rejects messages with invalid role with 400 invalid_payload', async () => {
    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-secret-123',
      },
      body: JSON.stringify({
        model: 'mock-fast',
        messages: [{ role: 'invalid_role', content: 'test' }],
      }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.type).toBe('invalid_request_error');
    expect(data.error.message).toContain('role');
  });

  it('returns 503 when requesting a model whose backend API key is missing', async () => {
    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-secret-123',
      },
      body: JSON.stringify({
        model: 'gpt-4o', // Maps to openai provider, whose key is not configured in testConfig
        messages: [{ role: 'user', content: 'Hello' }],
      }),
    });

    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.error.type).toBe('authentication_error');
    expect(data.error.code).toBe('missing_backend_api_key');
    expect(data.error.message).toContain('openai');
  });

  it('successfully validates and executes tool calling requests', async () => {
    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-secret-123',
      },
      body: JSON.stringify({
        model: 'mock-fast',
        messages: [{ role: 'user', content: 'Read file test.ts' }],
        tools: [
          {
            type: 'function',
            function: {
              name: 'read_file',
              description: 'Reads a file from workspace',
              parameters: {
                type: 'object',
                properties: { path: { type: 'string' } },
                required: ['path'],
              },
            },
          },
        ],
        stream: false,
      }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.object).toBe('chat.completion');
    expect(data.choices[0].message.role).toBe('assistant');
  });

  it('GET /health reports detailed uptime, memory, and provider readiness', async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.version).toBe('0.1.0');
    expect(typeof data.uptimeSeconds).toBe('number');
    expect(typeof data.memoryUsageMb.heapUsed).toBe('number');
    expect(data.providers.huggingface).toBe(true);
    expect(data.providers.openai).toBe(false);
  });

  it('returns 404 invalid_request_error on unknown endpoints', async () => {
    const res = await fetch(`${baseUrl}/v1/unknown-endpoint`, {
      headers: { Authorization: 'Bearer test-secret-123' },
    });
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error.type).toBe('invalid_request_error');
    expect(data.error.code).toBe('not_found');
  });
});

