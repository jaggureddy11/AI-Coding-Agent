import { describe, it, expect } from 'vitest';

import * as vscode from 'vscode';
import { activate, deactivate } from '../src/extension.js';
import { JagguSidebarProvider } from '../src/sidebarProvider.js';
import { JagguShadowDocProvider } from '../src/virtualDocProvider.js';
import { InMemoryVirtualDocStore, EventBus } from '@jaggu/core';

describe('Extension Host Lifecycle and Registration', () => {
  it('should activate extension and register all core providers and commands', () => {
    const context = {
      subscriptions: [] as any[],
      extensionUri: { toString: () => 'file:///mock/ext', fsPath: '/mock/ext' },
    } as any;

    const result = activate(context);

    expect(result.eventBus).toBeInstanceOf(EventBus);
    expect(result.docStore).toBeInstanceOf(InMemoryVirtualDocStore);
    expect(result.sidebarProvider).toBeInstanceOf(JagguSidebarProvider);
    expect(result.statusBarItem).toBeDefined();
    expect(result.statusBarItem.text).toBe('$(sparkle) JAGGU: Ready');
    expect(result.statusBarItem.command).toBe('jaggu.openChat');

    // Verify commands registered
    const cmds = (vscode.commands as any).__getRegisteredCommands();
    expect(cmds['jaggu.openChat']).toBeDefined();
    expect(cmds['jaggu.startSession']).toBeDefined();
    expect(cmds['jaggu.cancelSession']).toBeDefined();

    // Verify subscriptions populated
    expect(context.subscriptions.length).toBeGreaterThanOrEqual(5);

    deactivate();
  });

  it('should render Webview HTML with strict CSP and nonce', () => {
    const eventBus = new EventBus();
    const extensionUri = { toString: () => 'file:///mock/ext', fsPath: '/mock/ext' } as any;
    const provider = new JagguSidebarProvider(extensionUri, eventBus);

    const mockWebview = {
      asWebviewUri: (uri: any) => uri,
      cspSource: 'vscode-webview:',
    } as any;

    const html = provider.getHtmlForWebview(mockWebview);
    expect(html).toContain('Content-Security-Policy');
    expect(html).toContain("default-src 'none'");
    expect(html).toContain('nonce-');
    expect(html).toContain('webview.js');
    expect(html).toContain('webview.css');
    expect(html).toContain('<div id="root"></div>');
  });

  it('should manage status transitions and fire onDidChangeStatus', () => {
    const eventBus = new EventBus();
    const extensionUri = { toString: () => 'file:///mock/ext', fsPath: '/mock/ext' } as any;
    const provider = new JagguSidebarProvider(extensionUri, eventBus);

    const states: string[] = [];
    provider.onDidChangeStatus((e) => {
      states.push(e.state);
    });

    // Send invalid payload -> should reject
    let sentMessage: any = null;
    provider.postMessageToWebview = (msg: any) => {
      sentMessage = msg;
      return Promise.resolve(true);
    };

    provider.handleIncomingMessage({ type: 'invalid.unknown' });
    expect(sentMessage?.type).toBe('agent.error');
    expect(sentMessage?.payload?.code).toBe('INVALID_RPC_PAYLOAD');

    // Send ui.ready -> should send agent.status IDLE
    provider.handleIncomingMessage({ type: 'ui.ready' });
    expect(sentMessage?.type).toBe('agent.status');
    expect(sentMessage?.payload?.state).toBe('IDLE');
  });
});
