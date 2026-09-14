import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventBus } from '@jaggu/core';
import { JagguSidebarProvider } from '../src/sidebarProvider.js';
import {
  WebviewToExtensionMessage,
  ExtensionToWebviewMessage,
  isValidExtensionMessage,
} from '@jaggu/ui';

describe('M7-A Multi-Model Selection & Local Runtime Integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should deliver complete model catalog on ui.ready and support model.select switching', async () => {
    const eventBus = new EventBus();
    const extensionUri = { toString: () => 'file:///mock/ext', fsPath: '/mock/ext' } as any;
    const provider = new JagguSidebarProvider(extensionUri, eventBus);

    const received: ExtensionToWebviewMessage[] = [];
    provider.postMessageToWebview = (msg: any) => {
      if (isValidExtensionMessage(msg)) {
        received.push(msg);
      }
      return Promise.resolve(true);
    };

    // 1. Webview sends ui.ready
    const readyMsg: WebviewToExtensionMessage = {
      type: 'ui.ready',
      payload: { timestamp: Date.now() },
    };
    await provider.handleIncomingMessage(readyMsg);

    const configMsg = received.find((m) => m.type === 'agent.config');
    expect(configMsg).toBeDefined();
    const payload = (configMsg as any).payload;
    expect(payload.models).toBeDefined();
    expect(payload.models.length).toBeGreaterThan(5);

    // Verify presence of local coding models
    const qwenModel = payload.models.find((m: any) => m.id === 'qwen2.5-coder:7b');
    expect(qwenModel).toBeDefined();
    expect(qwenModel.runtimeType).toBe('local');
    expect(qwenModel.providerId).toBe('ollama');
    expect(qwenModel.capabilities.toolCalling).toBe(true);

    // 2. Select local Ollama model
    const selectMsg: WebviewToExtensionMessage = {
      type: 'model.select',
      payload: { modelId: 'qwen2.5-coder:7b' },
    };
    await provider.handleIncomingMessage(selectMsg);

    const updatedConfigMsg = received.filter((m) => m.type === 'agent.config').pop();
    expect(updatedConfigMsg).toBeDefined();
    expect((updatedConfigMsg as any).payload.model).toBe('qwen2.5-coder:7b');
    expect((updatedConfigMsg as any).payload.provider).toBe('ollama');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should allow local models to run without requiring a cloud API key', async () => {
    const eventBus = new EventBus();
    const extensionUri = { toString: () => 'file:///mock/ext', fsPath: '/mock/ext' } as any;
    const provider = new JagguSidebarProvider(extensionUri, eventBus);

    const received: ExtensionToWebviewMessage[] = [];
    provider.postMessageToWebview = (msg: any) => {
      if (isValidExtensionMessage(msg)) {
        received.push(msg);
      }
      return Promise.resolve(true);
    };

    // Select Ollama local model
    await provider.handleIncomingMessage({
      type: 'model.select',
      payload: { modelId: 'qwen2.5-coder:7b' },
    });

    // Mock fetch for local Ollama chat
    const originalFetch = globalThis.fetch;
    const ndjsonLine = JSON.stringify({
      message: { role: 'assistant', content: 'Local Ollama response' },
      done: true,
    }) + '\n';

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(ndjsonLine));
          controller.close();
        },
      }),
    });

    // Submit prompt with no API key configured
    await provider.handleIncomingMessage({
      type: 'user.submit',
      payload: {
        id: 'task_local_1',
        text: 'Write hello world',
        timestamp: Date.now(),
      },
    });

    // Verify it did NOT fail with MISSING_API_KEY error
    const apiKeyError = received.find(
      (m) => m.type === 'agent.error' && (m as any).payload.code === 'MISSING_API_KEY',
    );
    expect(apiKeyError).toBeUndefined();

    // Verify token was received
    const tokens = received.filter((m) => m.type === 'token.delta');
    expect(tokens.length).toBeGreaterThan(0);

    globalThis.fetch = originalFetch;
  });

  it('should require an API key when a cloud provider model is selected', async () => {
    const eventBus = new EventBus();
    const extensionUri = { toString: () => 'file:///mock/ext', fsPath: '/mock/ext' } as any;
    const provider = new JagguSidebarProvider(extensionUri, eventBus);

    const received: ExtensionToWebviewMessage[] = [];
    provider.postMessageToWebview = (msg: any) => {
      if (isValidExtensionMessage(msg)) {
        received.push(msg);
      }
      return Promise.resolve(true);
    };

    // Select OpenAI cloud model
    await provider.handleIncomingMessage({
      type: 'model.select',
      payload: { modelId: 'gpt-4o' },
    });

    // Submit prompt without API key
    await provider.handleIncomingMessage({
      type: 'user.submit',
      payload: {
        id: 'task_cloud_1',
        text: 'Hello cloud',
        timestamp: Date.now(),
      },
    });

    // Should receive MISSING_API_KEY error
    const apiKeyError = received.find(
      (m) => m.type === 'agent.error' && (m as any).payload.code === 'MISSING_API_KEY',
    );
    expect(apiKeyError).toBeDefined();
    expect((apiKeyError as any).payload.message).toContain('openai');
  });

  it('should probe local runtimes in checkRuntimesHealth and notify webview of health updates', async () => {
    const eventBus = new EventBus();
    const extensionUri = { toString: () => 'file:///mock/ext', fsPath: '/mock/ext' } as any;
    const provider = new JagguSidebarProvider(extensionUri, eventBus);

    const received: ExtensionToWebviewMessage[] = [];
    provider.postMessageToWebview = (msg: any) => {
      if (isValidExtensionMessage(msg)) {
        received.push(msg);
      }
      return Promise.resolve(true);
    };

    // Mock fetch for health checks
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes(':11434/api/tags')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              models: [{ name: 'qwen2.5-coder:7b' }, { name: 'deepseek-r1:8b' }],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        );
      }
      if (url.includes('/models')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: [{ id: 'local-model' }],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        );
      }
      return Promise.reject(new Error('Network error'));
    });

    await provider.checkRuntimesHealth();

    const healthMessages = received.filter((m) => m.type === 'model.health_changed');
    expect(healthMessages.length).toBeGreaterThan(0);

    const qwenHealth = healthMessages.find((m: any) => m.payload.modelId === 'qwen2.5-coder:7b');
    expect(qwenHealth).toBeDefined();
    expect((qwenHealth as any).payload.health).toBe('available');

    globalThis.fetch = originalFetch;
  });
});
