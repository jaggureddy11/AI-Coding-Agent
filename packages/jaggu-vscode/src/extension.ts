import * as vscode from 'vscode';
import {
  EventBus,
  InMemoryVirtualDocStore,
  UiAgentStatus,
  ModelGateway,
  ContextEngine,
  WorkspaceDiscovery,
} from '@jaggu/core';
import { JagguSidebarProvider } from './sidebarProvider.js';
import { JagguShadowDocProvider } from './virtualDocProvider.js';
import { CredentialManager } from './credentials.js';

export function activate(context: vscode.ExtensionContext): {
  eventBus: EventBus;
  docStore: InMemoryVirtualDocStore;
  sidebarProvider: JagguSidebarProvider;
  statusBarItem: vscode.StatusBarItem;
  credentialManager: CredentialManager;
  modelGateway: ModelGateway;
  contextEngine: ContextEngine;
} {
  const eventBus = new EventBus();
  const docStore = new InMemoryVirtualDocStore();
  const credentialManager = new CredentialManager(context.secrets);
  const modelGateway = new ModelGateway();

  // 1. Initialize Context Engine with current workspace roots
  const workspaceRoots = vscode.workspace.workspaceFolders?.map((f) => f.uri.fsPath) || [];
  const discovery = new WorkspaceDiscovery(workspaceRoots);
  const contextEngine = new ContextEngine(discovery);

  // 2. Invalidate repository index cache when files are modified in editor
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((e) => {
      contextEngine.getRepoMap().markDirty(e.document.uri.fsPath);
    }),
  );

  // 3. Update roots when workspace folders change
  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      const currentRoots = vscode.workspace.workspaceFolders?.map((f) => f.uri.fsPath) || [];
      contextEngine.setWorkspaceRoots(currentRoots);
    }),
  );

  // 4. Register Virtual Document Content Provider for native diff previews
  const virtualDocProvider = new JagguShadowDocProvider(docStore);
  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(
      JagguShadowDocProvider.SCHEME,
      virtualDocProvider,
    ),
  );

  // 5. Register Webview Sidebar View Provider
  const sidebarProvider = new JagguSidebarProvider(
    context.extensionUri,
    eventBus,
    modelGateway,
    credentialManager,
    contextEngine,
  );
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      JagguSidebarProvider.VIEW_ID,
      sidebarProvider,
    ),
  );

  // 3. Register Core & Model Commands
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

  context.subscriptions.push(
    vscode.commands.registerCommand('jaggu.setApiKey', async () => {
      const provider = await vscode.window.showQuickPick(
        ['openai', 'anthropic', 'gemini'],
        { placeHolder: 'Select model provider to configure API Key' },
      );
      if (!provider) return;

      const apiKey = await vscode.window.showInputBox({
        prompt: `Enter API Key for ${provider.toUpperCase()} (leave empty to remove)`,
        password: true,
        ignoreFocusOut: true,
      });

      if (apiKey !== undefined) {
        await credentialManager.setApiKey(provider, apiKey);
        vscode.window.showInformationMessage(`JAGGU: API Key for [${provider}] updated in SecretStorage.`);
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('jaggu.selectProvider', async () => {
      const providers = modelGateway.listProviders().map((p) => ({
        label: p.name,
        description: `ID: ${p.id}`,
        id: p.id,
      }));

      const selected = await vscode.window.showQuickPick(providers, {
        placeHolder: 'Select active model provider for JAGGU',
      });

      if (selected) {
        const config = vscode.workspace.getConfiguration('jaggu');
        await config.update('provider', selected.id, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(`JAGGU: Active provider set to ${selected.label}.`);
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('jaggu.selectModel', async () => {
      const providerId = credentialManager.getActiveProvider();
      const provider = modelGateway.getProvider(providerId);
      const models = provider.supportedModels.map((m) => ({
        label: m.displayName,
        description: m.id,
        id: m.id,
      }));

      const selected = await vscode.window.showQuickPick(models, {
        placeHolder: `Select model for provider [${provider.name}]`,
      });

      if (selected) {
        const config = vscode.workspace.getConfiguration('jaggu');
        await config.update('model', selected.id, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(`JAGGU: Model set to ${selected.label}.`);
      }
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

  return { eventBus, docStore, sidebarProvider, statusBarItem, credentialManager, modelGateway, contextEngine };
}

export function deactivate(): void {
  // Clean up resources on extension host shutdown
}
