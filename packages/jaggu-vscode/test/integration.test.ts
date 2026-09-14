import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '@jaggu/core';
import { JagguSidebarProvider } from '../src/sidebarProvider.js';
import {
  WebviewToExtensionMessage,
  ExtensionToWebviewMessage,
  isValidExtensionMessage,
} from '@jaggu/ui';

describe('Webview ↔ Extension Host RPC Integration Flow', () => {
  it('should execute end-to-end user prompt submit -> Extension Host processing -> mock response -> status reset', async () => {
    vi.useFakeTimers();

    const eventBus = new EventBus();
    const extensionUri = { toString: () => 'file:///mock/ext', fsPath: '/mock/ext' } as any;
    const provider = new JagguSidebarProvider(extensionUri, eventBus);

    // Mock Webview message receiver
    const receivedInWebview: ExtensionToWebviewMessage[] = [];
    provider.postMessageToWebview = (msg: any) => {
      if (isValidExtensionMessage(msg)) {
        receivedInWebview.push(msg);
      }
      return Promise.resolve(true);
    };

    // 1. Webview sends ui.ready
    const readyMsg: WebviewToExtensionMessage = {
      type: 'ui.ready',
      payload: { timestamp: Date.now() },
    };
    provider.handleIncomingMessage(readyMsg);

    expect(receivedInWebview.length).toBe(1);
    expect(receivedInWebview[0].type).toBe('agent.status');
    expect((receivedInWebview[0] as any).payload.state).toBe('IDLE');

    // 2. Webview user submits prompt
    const submitMsg: WebviewToExtensionMessage = {
      type: 'user.submit',
      payload: {
        id: 'req_123',
        text: 'Explain this project',
        timestamp: Date.now(),
      },
    };
    provider.handleIncomingMessage(submitMsg);

    // Should immediately transition to PROCESSING
    expect(receivedInWebview.length).toBe(2);
    expect(receivedInWebview[1].type).toBe('agent.status');
    expect((receivedInWebview[1] as any).payload.state).toBe('PROCESSING');
    expect(provider.currentStatus).toBe('PROCESSING');

    // 3. Advance timer for mock agent response (400ms)
    await vi.advanceTimersByTimeAsync(450);

    // Should receive assistant message and SUCCESS status
    const messageMsg = receivedInWebview.find((m) => m.type === 'agent.message');
    expect(messageMsg).toBeDefined();
    expect((messageMsg as any).payload.role).toBe('assistant');
    expect((messageMsg as any).payload.text).toContain('I received your request: "Explain this project"');

    const successStatusMsg = receivedInWebview.find(
      (m) => m.type === 'agent.status' && (m as any).payload.state === 'SUCCESS',
    );
    expect(successStatusMsg).toBeDefined();

    // 4. Advance timer for reset to IDLE (1500ms)
    await vi.advanceTimersByTimeAsync(1600);
    expect(provider.currentStatus).toBe('IDLE');

    vi.useRealTimers();
  });

  it('should support task cancellation mid-flight via agent.cancel', async () => {
    vi.useFakeTimers();

    const eventBus = new EventBus();
    const extensionUri = { toString: () => 'file:///mock/ext', fsPath: '/mock/ext' } as any;
    const provider = new JagguSidebarProvider(extensionUri, eventBus);

    const receivedInWebview: ExtensionToWebviewMessage[] = [];
    provider.postMessageToWebview = (msg: any) => {
      receivedInWebview.push(msg);
      return Promise.resolve(true);
    };

    // 1. Submit prompt
    provider.handleIncomingMessage({
      type: 'user.submit',
      payload: { id: 'task_to_cancel', text: 'Build a complex feature', timestamp: Date.now() },
    });
    expect(provider.currentStatus).toBe('PROCESSING');

    // 2. User cancels midway (before 400ms response)
    await vi.advanceTimersByTimeAsync(100);
    provider.handleIncomingMessage({
      type: 'agent.cancel',
      payload: {},
    });

    expect(provider.currentStatus).toBe('CANCELLED');

    const cancelSysMsg = receivedInWebview.find(
      (m) => m.type === 'agent.message' && (m as any).payload.role === 'system',
    );
    expect(cancelSysMsg).toBeDefined();
    expect((cancelSysMsg as any).payload.text).toContain('Cancelled by user');

    // 3. Advance to reset to IDLE
    await vi.advanceTimersByTimeAsync(1100);
    expect(provider.currentStatus).toBe('IDLE');

    vi.useRealTimers();
  });
});
