import * as vscode from 'vscode';
import { EventBus, InMemoryVirtualDocStore } from '@jaggu/core';
import { JagguSidebarProvider } from './sidebarProvider.js';
import { JagguShadowDocProvider } from './virtualDocProvider.js';

export function activate(context: vscode.ExtensionContext): {
  eventBus: EventBus;
  docStore: InMemoryVirtualDocStore;
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
    vscode.commands.registerCommand('jaggu.startSession', () => {
      vscode.window.showInformationMessage('JAGGU: Session started.');
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('jaggu.cancelSession', () => {
      eventBus.emit('agent.cancelled', {
        taskId: 'current',
        reason: 'User triggered jaggu.cancelSession command',
        timestamp: Date.now(),
      });
      vscode.window.showInformationMessage('JAGGU: Task cancelled.');
    }),
  );

  // 4. Status Bar Indicator
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.text = '$(sparkle) JAGGU';
  statusBarItem.tooltip = 'JAGGU AI Coding Agent: Ready';
  statusBarItem.command = 'jaggu.startSession';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  return { eventBus, docStore };
}

export function deactivate(): void {
  // Cleanup managed resources
}
