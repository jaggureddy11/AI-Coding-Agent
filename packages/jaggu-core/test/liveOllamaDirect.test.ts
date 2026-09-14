import { describe, it, expect } from 'vitest';
import { OllamaProvider, ModelError } from '../src/index.js';

describe('Live Local Ollama Daemon Verification', () => {
  it('should probe live Ollama daemon on localhost:11434', async () => {
    const provider = new OllamaProvider();
    const health = await provider.checkHealth('http://localhost:11434');

    if (health.reachable) {
      expect(health.reachable).toBe(true);
      expect(Array.isArray(health.models)).toBe(true);
    } else {
      expect(health.reachable).toBe(false);
      expect(health.models).toEqual([]);
    }
  });

  it('should receive real 404 from live Ollama daemon for uninstalled model and classify as MODEL_NOT_FOUND', async () => {
    const provider = new OllamaProvider();
    const health = await provider.checkHealth('http://localhost:11434');
    if (!health.reachable) {
      // In environments without live Ollama daemon, skip live daemon assertion
      return;
    }

    let caughtError: ModelError | undefined;
    try {
      for await (const _ of provider.streamChat(
        [{ role: 'user', content: 'hello' }],
        { model: 'qwen2.5-coder:7b', baseUrl: 'http://localhost:11434' },
      )) {
        // should not stream
      }
    } catch (err: unknown) {
      if (err instanceof ModelError) {
        caughtError = err;
      }
    }

    expect(caughtError).toBeDefined();
    expect(caughtError?.code).toBe('MODEL_NOT_FOUND');
    expect(caughtError?.providerId).toBe('ollama');
    expect(caughtError?.message).toContain('is not installed in local Ollama');
  });

  it('should classify connection refusal on invalid port as NETWORK_ERROR', async () => {
    const provider = new OllamaProvider();

    let caughtError: ModelError | undefined;
    try {
      for await (const _ of provider.streamChat(
        [{ role: 'user', content: 'hello' }],
        { model: 'qwen2.5-coder:7b', baseUrl: 'http://localhost:59999' },
      )) {
        // should not stream
      }
    } catch (err: unknown) {
      if (err instanceof ModelError) {
        caughtError = err;
      }
    }

    expect(caughtError).toBeDefined();
    expect(caughtError?.code).toBe('NETWORK_ERROR');
    expect(caughtError?.providerId).toBe('ollama');
  });
});
