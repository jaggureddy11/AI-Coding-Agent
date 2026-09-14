import * as vscode from 'vscode';
import * as crypto from 'crypto';
import {
  EventBus,
  UiAgentStatus,
  ModelGateway,
  ModelMessage,
  ModelError,
} from '@jaggu/core';
import {
  isValidWebviewMessage,
  WebviewToExtensionMessage,
  ExtensionToWebviewMessage,
} from '@jaggu/ui';
import { CredentialManager } from './credentials.js';

export class JagguSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly VIEW_ID = 'jaggu.sidebarView';
  private _view?: vscode.WebviewView;
  private _currentStatus: UiAgentStatus = 'IDLE';
  private _activeAbortController?: AbortController;
  private _statusResetTimer?: NodeJS.Timeout;

  private readonly _onDidChangeStatus = new vscode.EventEmitter<{
    state: UiAgentStatus;
    detail?: string;
  }>();
  public readonly onDidChangeStatus = this._onDidChangeStatus.event;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _eventBus: EventBus,
    private readonly _modelGateway: ModelGateway = new ModelGateway(),
    private readonly _credentialManager?: CredentialManager,
  ) {}

  public get currentStatus(): UiAgentStatus {
    return this._currentStatus;
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this._extensionUri, 'media'),
      ],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage((rawMessage: unknown) => {
      this.handleIncomingMessage(rawMessage);
    });
  }

  /**
   * Dispatches and handles incoming RPC messages from the Webview with strict schema validation.
   */
  public async handleIncomingMessage(rawMessage: unknown): Promise<void> {
    if (!isValidWebviewMessage(rawMessage)) {
      this.postMessageToWebview({
        type: 'agent.error',
        payload: {
          code: 'INVALID_RPC_PAYLOAD',
          message: 'Malformed or invalid message format received by Extension Host.',
        },
      });
      return;
    }

    const message = rawMessage as WebviewToExtensionMessage;

    switch (message.type) {
      case 'ui.ready': {
        const providerId = this._credentialManager?.getActiveProvider() || 'mock';
        const modelId = this._credentialManager?.getActiveModel() || '';
        this.postMessageToWebview({
          type: 'agent.config',
          payload: { provider: providerId, model: modelId },
        });
        this.postMessageToWebview({
          type: 'agent.status',
          payload: { state: this._currentStatus, detail: 'Ready' },
        });
        break;
      }

      case 'user.submit': {
        const { id, text, timestamp } = message.payload;
        await this.processUserPrompt(id, text, timestamp);
        break;
      }

      case 'SUBMIT_PROMPT': {
        const prompt = message.payload.prompt;
        const now = Date.now();
        await this.processUserPrompt(`task_${now}`, prompt, now);
        break;
      }

      case 'agent.cancel':
      case 'CANCEL_ACTIVE_TASK': {
        this.cancelActiveTask('Cancelled by user');
        break;
      }

      case 'ui.clear': {
        if (this._activeAbortController) {
          this._activeAbortController.abort();
          this._activeAbortController = undefined;
        }
        if (this._statusResetTimer) {
          clearTimeout(this._statusResetTimer);
          this._statusResetTimer = undefined;
        }
        this._setStatus('IDLE');
        break;
      }
    }
  }

  private async processUserPrompt(id: string, text: string, timestamp: number): Promise<void> {
    // 1. Abort previous in-flight task if any
    if (this._activeAbortController) {
      this._activeAbortController.abort();
      this._activeAbortController = undefined;
    }
    if (this._statusResetTimer) {
      clearTimeout(this._statusResetTimer);
      this._statusResetTimer = undefined;
    }

    this._activeAbortController = new AbortController();
    const abortSignal = this._activeAbortController.signal;

    // 2. Transition to PROCESSING state
    this._setStatus('PROCESSING', 'Streaming model response...');
    this._eventBus.emit('agent.started', {
      taskId: id,
      conversationId: 'conv_main',
      prompt: text,
      timestamp,
    });

    // 3. Resolve active provider and credentials
    const providerId = this._credentialManager?.getActiveProvider() || 'mock';
    const model = this._credentialManager?.getActiveModel() || undefined;
    let apiKey: string | undefined;

    try {
      apiKey = await this._credentialManager?.getApiKey(providerId);
    } catch {
      // ignore
    }

    if (!apiKey && providerId !== 'mock' && providerId !== 'ollama') {
      this.postMessageToWebview({
        type: 'agent.error',
        payload: {
          code: 'MISSING_API_KEY',
          message: `API key for [${providerId}] is not configured. Use command "JAGGU: Set API Key" or switch to "mock" provider.`,
        },
      });
      this._setStatus('ERROR', 'API key missing');
      return;
    }

    const messages: ModelMessage[] = [
      {
        role: 'system',
        content: 'You are JAGGU, an autonomous AI coding agent designed to assist with software engineering tasks.',
      },
      { role: 'user', content: text },
    ];

    const messageId = `asst_${Date.now()}`;
    let fullResponseText = '';

    try {
      const stream = this._modelGateway.streamChat(
        providerId,
        messages,
        {
          model: model || this._modelGateway.getProvider(providerId).defaultModel,
          apiKey,
          baseUrl: providerId === 'ollama' ? this._credentialManager?.getOllamaBaseUrl() : undefined,
          temperature: this._credentialManager?.getTemperature() ?? 0.2,
          abortSignal,
        },
        this._eventBus,
        id,
      );

      for await (const chunk of stream) {
        if (abortSignal.aborted) {
          break;
        }

        if (chunk.type === 'token') {
          fullResponseText += chunk.text;
          this.postMessageToWebview({
            type: 'token.delta',
            payload: {
              text: chunk.text,
              messageId,
            },
          });
        }
      }

      if (!abortSignal.aborted) {
        this.postMessageToWebview({
          type: 'token.complete',
          payload: {
            messageId,
            fullText: fullResponseText,
          },
        });

        this._setStatus('SUCCESS', 'Response completed');

        this._statusResetTimer = setTimeout(() => {
          this._setStatus('IDLE', 'Ready');
          this._statusResetTimer = undefined;
        }, 1500);
      }
    } catch (error: unknown) {
      if (abortSignal.aborted || (error instanceof ModelError && error.code === 'CANCELLED')) {
        // Handled in cancelActiveTask
        return;
      }

      const errMsg = error instanceof Error ? error.message : String(error);
      this.postMessageToWebview({
        type: 'agent.error',
        payload: {
          code: error instanceof ModelError ? error.code : 'MODEL_ERROR',
          message: errMsg,
        },
      });
      this._setStatus('ERROR', 'Error occurred');
    } finally {
      this._activeAbortController = undefined;
    }
  }

  public cancelActiveTask(reason: string): void {
    if (this._activeAbortController) {
      this._activeAbortController.abort();
      this._activeAbortController = undefined;
    }
    if (this._statusResetTimer) {
      clearTimeout(this._statusResetTimer);
      this._statusResetTimer = undefined;
    }

    this._eventBus.emit('agent.cancelled', {
      taskId: 'active',
      reason,
      timestamp: Date.now(),
    });

    this.postMessageToWebview({
      type: 'agent.message',
      payload: {
        id: `sys_${Date.now()}`,
        role: 'system',
        text: `[${reason}]`,
        timestamp: Date.now(),
      },
    });

    this._setStatus('CANCELLED', reason);

    this._statusResetTimer = setTimeout(() => {
      this._setStatus('IDLE', 'Ready');
      this._statusResetTimer = undefined;
    }, 1000);
  }

  private _setStatus(state: UiAgentStatus, detail?: string): void {
    this._currentStatus = state;
    this._onDidChangeStatus.fire({ state, detail });
    this.postMessageToWebview({
      type: 'agent.status',
      payload: { state, detail },
    });
  }

  public postMessageToWebview(message: ExtensionToWebviewMessage): Thenable<boolean> | undefined {
    return this._view?.webview.postMessage(message);
  }

  public getHtmlForWebview(webview: vscode.Webview): string {
    return this._getHtmlForWebview(webview);
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'webview.js'),
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'webview.css'),
    );

    const nonce = crypto.randomBytes(16).toString('base64');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} https: data:; font-src ${webview.cspSource};">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>JAGGU</title>
  <link rel="stylesheet" href="${styleUri}">
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}
