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
    docStore,
  );
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      JagguSidebarProvider.VIEW_ID,
      sidebarProvider,
      {
        webviewOptions: {
          retainContextWhenHidden: true,
        },
      },
    ),
  );

  // 6. Register Review Diff & Edit Commands (M4)
  context.subscriptions.push(
    vscode.commands.registerCommand('jaggu.reviewDiff', async (filePath: string) => {
      const originalUri = vscode.Uri.file(filePath);
      const shadowUri = vscode.Uri.parse(`jaggu-shadow:${filePath}`);
      const title = `${filePath} (Working Tree ↔ Proposed Changes)`;
      await vscode.commands.executeCommand('vscode.diff', originalUri, shadowUri, title);
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('jaggu.approveEdit', async (proposalId: string) => {
      await sidebarProvider.handleIncomingMessage({
        type: 'agent.approve',
        payload: { proposalId },
      });
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('jaggu.rejectEdit', async (proposalId: string) => {
      await sidebarProvider.handleIncomingMessage({
        type: 'agent.reject',
        payload: { proposalId },
      });
    }),
  );

  // M5: Plan & EditSet commands
  context.subscriptions.push(
    vscode.commands.registerCommand('jaggu.approvePlan', async (planId: string) => {
      await sidebarProvider.handleIncomingMessage({
        type: 'agent.plan_approve',
        payload: { planId },
      });
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('jaggu.rejectPlan', async (planId: string) => {
      await sidebarProvider.handleIncomingMessage({
        type: 'agent.plan_reject',
        payload: { planId },
      });
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('jaggu.approveEditSet', async (editSetId: string) => {
      await sidebarProvider.handleIncomingMessage({
        type: 'agent.editset_approve',
        payload: { editSetId },
      });
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('jaggu.rejectEditSet', async (editSetId: string) => {
      await sidebarProvider.handleIncomingMessage({
        type: 'agent.editset_reject',
        payload: { editSetId },
      });
    }),
  );

  // 7. Register Core & Model Commands
  context.subscriptions.push(
    vscode.commands.registerCommand('jaggu.openChat', () => {
      vscode.commands.executeCommand('jaggu.sidebarView.focus');
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('jaggu.startSession', async () => {
      await vscode.commands.executeCommand('jaggu.sidebarView.focus');
      await sidebarProvider.handleIncomingMessage({ type: 'ui.clear', payload: {} });
      vscode.window.showInformationMessage('JAGGU: Fresh session started.');
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
        ['openai', 'anthropic', 'gemini', 'huggingface'],
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
    vscode.commands.registerCommand('jaggu.setHuggingFaceToken', async () => {
      const token = await vscode.window.showInputBox({
        prompt: 'Enter your Hugging Face User Access Token (hf_...)',
        placeHolder: 'hf_...',
        password: true,
        ignoreFocusOut: true,
      });

      if (token !== undefined) {
        await credentialManager.setHuggingFaceToken(token);
        if (token.trim()) {
          vscode.window.showInformationMessage('JAGGU: Hugging Face token saved securely in SecretStorage.');
        } else {
          vscode.window.showInformationMessage('JAGGU: Hugging Face token removed.');
        }
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('jaggu.removeHuggingFaceToken', async () => {
      await credentialManager.removeHuggingFaceToken();
      vscode.window.showInformationMessage('JAGGU: Hugging Face token removed from SecretStorage.');
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('jaggu.testHuggingFaceConnection', async () => {
      const token = await credentialManager.getHuggingFaceToken();
      if (!token) {
        vscode.window.showWarningMessage('JAGGU: No Hugging Face token found. Run "JAGGU: Set Hugging Face Token" first.');
        return;
      }

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'JAGGU: Testing Hugging Face Connection...',
          cancellable: false,
        },
        async () => {
          try {
            const hfProvider = modelGateway.getProvider('huggingface');
            const stream = hfProvider.streamChat(
              [{ role: 'user', content: 'Ping' }],
              { apiKey: token, maxTokens: 4, model: 'Qwen/Qwen3-Coder-30B-A3B-Instruct' },
            );
            // Read at least 1 chunk to verify credentials and endpoint
            for await (const _chunk of stream) {
              break;
            }
            vscode.window.showInformationMessage('✓ Connected — Model available (Qwen 3 Coder 30B via Hugging Face)');
          } catch (err: any) {
            const code = err?.code || '';
            if (code === 'AUTH_FAILURE') {
              vscode.window.showErrorMessage('✗ Authentication failed — Invalid or expired Hugging Face token.');
            } else if (code === 'RATE_LIMITED') {
              vscode.window.showWarningMessage('✗ Rate limited — Hugging Face inference is temporarily busy.');
            } else if (code === 'NETWORK_ERROR') {
              vscode.window.showErrorMessage('✗ Network error — Unable to reach Hugging Face inference router.');
            } else {
              vscode.window.showErrorMessage(`✗ Hugging Face connection test failed: ${err?.message || String(err)}`);
            }
          }
        },
      );
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
