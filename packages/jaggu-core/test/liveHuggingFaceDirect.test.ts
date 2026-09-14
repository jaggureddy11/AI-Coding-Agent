import { describe, it, expect } from 'vitest';
import { HuggingFaceProvider, ModelError } from '../src/index.js';

describe('Live Online Hugging Face Router Direct Verification', () => {
  const HF_TOKEN =
    process.env.HF_TOKEN ||
    process.env.HUGGINGFACE_API_KEY ||
    'REDACTED_HF_TOKEN';

  it('should probe live Hugging Face Router endpoint and discover models', async () => {
    const provider = new HuggingFaceProvider();
    const health = await provider.checkHealth({ apiKey: HF_TOKEN });

    expect(health.reachable).toBe(true);
    expect(health.models.length).toBeGreaterThan(0);
    expect(health.models).toContain('Qwen/Qwen2.5-Coder-32B-Instruct');
  });

  it('should stream real live tokens from Qwen/Qwen2.5-Coder-32B-Instruct over HF Router', async () => {
    const provider = new HuggingFaceProvider();
    const tokens: string[] = [];
    let usageRecorded: { prompt: number; completion: number } | undefined;

    const stream = provider.streamChat(
      [
        {
          role: 'user',
          content: 'Return only a valid JSON object with {"status": "ok", "agent": "jaggu"}. No other text.',
        },
      ],
      {
        model: 'Qwen/Qwen2.5-Coder-32B-Instruct',
        apiKey: HF_TOKEN,
        maxTokens: 50,
      },
    );

    for await (const chunk of stream) {
      if (chunk.type === 'token') {
        tokens.push(chunk.text);
      } else if (chunk.type === 'usage') {
        usageRecorded = { prompt: chunk.promptTokens, completion: chunk.completionTokens };
      }
    }

    const fullResponse = tokens.join('');
    expect(tokens.length).toBeGreaterThan(0);
    expect(fullResponse).toContain('status');
    expect(usageRecorded).toBeDefined();
    expect(usageRecorded?.completion).toBeGreaterThan(0);
  }, 25000);

  it('should cleanly abort mid-stream on cancellation when requested', async () => {
    const provider = new HuggingFaceProvider();
    const ac = new AbortController();

    let threwCancelled = false;
    try {
      const stream = provider.streamChat(
        [
          {
            role: 'user',
            content: 'Write a comprehensive 500-word explanation of compiler architecture.',
          },
        ],
        {
          model: 'Qwen/Qwen2.5-Coder-32B-Instruct',
          apiKey: HF_TOKEN,
          abortSignal: ac.signal,
          maxTokens: 500,
        },
      );

      for await (const _ of stream) {
        ac.abort();
      }
    } catch (err: unknown) {
      if (err instanceof ModelError && err.code === 'CANCELLED') {
        threwCancelled = true;
      }
    }

    expect(threwCancelled).toBe(true);
  }, 25000);

  it('should classify invalid API token as AUTH_FAILURE', async () => {
    const provider = new HuggingFaceProvider();
    let caughtError: ModelError | undefined;

    try {
      for await (const _ of provider.streamChat(
        [{ role: 'user', content: 'test' }],
        {
          model: 'Qwen/Qwen2.5-Coder-32B-Instruct',
          apiKey: 'hf_invalid_token_xyz_1234567890',
        },
      )) {
        // should not stream
      }
    } catch (err: unknown) {
      if (err instanceof ModelError) {
        caughtError = err;
      }
    }

    expect(caughtError).toBeDefined();
    expect(caughtError?.code).toBe('AUTH_FAILURE');
    expect(caughtError?.providerId).toBe('huggingface');
  });
});
