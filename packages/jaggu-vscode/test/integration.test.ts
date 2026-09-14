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

    expect(receivedInWebview.length).toBe(2);
    expect(receivedInWebview[0].type).toBe('agent.config');
    expect(receivedInWebview[1].type).toBe('agent.status');
    expect((receivedInWebview[1] as any).payload.state).toBe('IDLE');

    // 2. Webview user submits prompt
    const submitMsg: WebviewToExtensionMessage = {
      type: 'user.submit',
      payload: {
        id: 'req_123',
        text: 'Explain this project',
        timestamp: Date.now(),
      },
    };
    const submitPromise = provider.handleIncomingMessage(submitMsg);

    // Should immediately transition to PROCESSING
    expect(provider.currentStatus).toBe('PROCESSING');

    // 3. Advance timer for mock streaming tokens (mock tokens delayed by 10ms each)
    await vi.advanceTimersByTimeAsync(300);
    await submitPromise;

    // Should receive token.delta messages and token.complete
    const deltas = receivedInWebview.filter((m) => m.type === 'token.delta');
    expect(deltas.length).toBeGreaterThan(0);

    const completeMsg = receivedInWebview.find((m) => m.type === 'token.complete');
    expect(completeMsg).toBeDefined();
    expect((completeMsg as any).payload.fullText).toContain('Explain this project');

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
    const submitPromise = provider.handleIncomingMessage({
      type: 'user.submit',
      payload: { id: 'task_to_cancel', text: 'Build a complex feature', timestamp: Date.now() },
    });
    expect(provider.currentStatus).toBe('PROCESSING');

    // 2. User cancels midway
    await vi.advanceTimersByTimeAsync(30);
    provider.handleIncomingMessage({
      type: 'agent.cancel',
      payload: {},
    });
    await submitPromise;

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

  it('should discover workspace files, assemble bounded context, and transmit provenance to Webview', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const os = await import('os');
    const { WorkspaceDiscovery, ContextEngine, ModelGateway, MockModelProvider } = await import('@jaggu/core');

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jaggu-m3-integ-'));
    fs.mkdirSync(path.join(tmpDir, 'src', 'auth'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, 'src', 'auth', 'authService.ts'),
      'export class AuthService {\n  login(user: string) { return "jwt_token"; }\n}\n',
    );
    fs.writeFileSync(
      path.join(tmpDir, 'src', 'auth', 'authService.test.ts'),
      'describe("AuthService", () => { it("logs in", () => {}); });\n',
    );

    const eventBus = new EventBus();
    const discovery = new WorkspaceDiscovery([tmpDir]);
    const contextEngine = new ContextEngine(discovery);
    const mockGateway = new ModelGateway();
    mockGateway.registerProvider(new MockModelProvider({ chunkDelayMs: 0 }));

    const extensionUri = { toString: () => 'file:///mock/ext', fsPath: '/mock/ext' } as any;
    const provider = new JagguSidebarProvider(extensionUri, eventBus, mockGateway, undefined, contextEngine);

    const receivedInWebview: ExtensionToWebviewMessage[] = [];
    provider.postMessageToWebview = (msg: any) => {
      receivedInWebview.push(msg);
      return Promise.resolve(true);
    };

    await provider.handleIncomingMessage({
      type: 'user.submit',
      payload: {
        id: 'task_auth_search',
        text: 'Where is authentication implemented in this project?',
        timestamp: Date.now(),
      },
    });

    // Verify context.assembled was posted to Webview
    const contextAssembled = receivedInWebview.find((m) => m.type === 'context.assembled');
    expect(contextAssembled).toBeDefined();
    expect((contextAssembled as any).payload.filesCount).toBeGreaterThan(0);
    expect((contextAssembled as any).payload.provenance.length).toBeGreaterThan(0);

    // Verify token.complete carries provenance
    const completeMsg = receivedInWebview.find((m) => m.type === 'token.complete');
    expect(completeMsg).toBeDefined();
    expect((completeMsg as any).payload.provenance).toBeDefined();
    expect(
      (completeMsg as any).payload.provenance.some((p: any) =>
        p.relativeFilePath.includes('authService.ts'),
      ),
    ).toBe(true);

    // Clean up
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
