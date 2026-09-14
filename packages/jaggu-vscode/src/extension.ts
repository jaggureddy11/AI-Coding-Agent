import * as vscode from 'vscode';
import { EventBus, InMemoryVirtualDocStore, UiAgentStatus } from '@jaggu/core';
import { JagguSidebarProvider } from './sidebarProvider.js';
import { JagguShadowDocProvider } from './virtualDocProvider.js';

export function activate(context: vscode.ExtensionContext): {
  eventBus: EventBus;
  docStore: InMemoryVirtualDocStore;
  sidebarProvider: JagguSidebarProvider;
  statusBarItem: vscode.StatusBarItem;
} {
  const eventBus = new EventBus();
  const docStore = new InMemoryVirtualDocStore();

  // 1. Register Virtual Document Content Provider for native diff previews
  const virtualDocProvider = new JagguShadowDocProvider(docStore);
  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(
      JagguShadowDocProvider.SCHEME,
      virtualDocProvider,
    ),
  );

  // 2. Register Webview Sidebar View Provider
  const sidebarProvider = new JagguSidebarProvider(context.extensionUri, eventBus);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      JagguSidebarProvider.VIEW_ID,
      sidebarProvider,
    ),
  );

  // 3. Register Core Commands
  context.subscriptions.push(
    vscode.commands.registerCommand('jaggu.openChat', () => {
      vscode.commands.executeCommand('jaggu.sidebarView.focus');
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('jaggu.startSession', () => {
      vscode.commands.executeCommand('jaggu.sidebarView.focus');
      vscode.window.showInformationMessage('JAGGU: Session ready.');
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('jaggu.cancelSession', () => {
      eventBus.emit('agent.cancelled', {
        taskId: 'current',
        reason: 'User triggered jaggu.cancelSession command',
        timestamp: Date.now(),
      });
      sidebarProvider.handleIncomingMessage({ type: 'agent.cancel', payload: {} });
      vscode.window.showInformationMessage('JAGGU: Task cancelled.');
    }),
  );

  // 4. Status Bar Indicator
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'jaggu.openChat';
  statusBarItem.tooltip = 'Click to open JAGGU AI Coding Agent';

  const updateStatusBar = (status: UiAgentStatus) => {
    switch (status) {
      case 'IDLE':
        statusBarItem.text = '$(sparkle) JAGGU: Ready';
        statusBarItem.backgroundColor = undefined;
        break;
      case 'PROCESSING':
        statusBarItem.text = '$(sync~spin) JAGGU: Processing...';
        statusBarItem.backgroundColor = undefined;
        break;
      case 'SUCCESS':
        statusBarItem.text = '$(check) JAGGU: Done';
        statusBarItem.backgroundColor = undefined;
        break;
      case 'ERROR':
        statusBarItem.text = '$(error) JAGGU: Error';
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        break;
      case 'CANCELLED':
        statusBarItem.text = '$(stop) JAGGU: Cancelled';
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        break;
    }
  };

  updateStatusBar('IDLE');
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // Synchronize status bar with sidebar status
  sidebarProvider.onDidChangeStatus((e) => {
    updateStatusBar(e.state);
  });

  return { eventBus, docStore, sidebarProvider, statusBarItem };
}

export function deactivate(): void {
  // Clean up resources on extension host shutdown
}
