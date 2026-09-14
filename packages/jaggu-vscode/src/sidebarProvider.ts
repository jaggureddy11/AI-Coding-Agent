import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { EventBus, UiAgentStatus } from '@jaggu/core';
import {
  isValidWebviewMessage,
  WebviewToExtensionMessage,
  ExtensionToWebviewMessage,
} from '@jaggu/ui';

export class JagguSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly VIEW_ID = 'jaggu.sidebarView';
  private _view?: vscode.WebviewView;
  private _currentStatus: UiAgentStatus = 'IDLE';
  private _activeTaskTimer?: NodeJS.Timeout;

  private readonly _onDidChangeStatus = new vscode.EventEmitter<{
    state: UiAgentStatus;
    detail?: string;
  }>();
  public readonly onDidChangeStatus = this._onDidChangeStatus.event;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _eventBus: EventBus,
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
  public handleIncomingMessage(rawMessage: unknown): void {
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
        this.postMessageToWebview({
          type: 'agent.status',
          payload: { state: this._currentStatus, detail: 'Ready' },
        });
        break;
      }

      case 'user.submit': {
        const { id, text, timestamp } = message.payload;
        this.processUserPrompt(id, text, timestamp);
        break;
      }

      case 'SUBMIT_PROMPT': {
        const prompt = message.payload.prompt;
        const now = Date.now();
        this.processUserPrompt(`task_${now}`, prompt, now);
        break;
      }

      case 'agent.cancel':
      case 'CANCEL_ACTIVE_TASK': {
        this.cancelActiveTask('Cancelled by user');
        break;
      }

      case 'ui.clear': {
        if (this._activeTaskTimer) {
          clearTimeout(this._activeTaskTimer);
          this._activeTaskTimer = undefined;
        }
        this._setStatus('IDLE');
        break;
      }
    }
  }

  private processUserPrompt(id: string, text: string, timestamp: number): void {
    // Abort previous in-flight task if any
    if (this._activeTaskTimer) {
      clearTimeout(this._activeTaskTimer);
      this._activeTaskTimer = undefined;
    }

    // 1. Transition to PROCESSING state
    this._setStatus('PROCESSING', 'Analyzing task...');
    this._eventBus.emit('agent.started', {
      taskId: id,
      conversationId: 'conv_main',
      prompt: text,
      timestamp,
    });

    // 2. Deterministic mock agent response pipeline
    this._activeTaskTimer = setTimeout(() => {
      const replyText = `I received your request: "${text}". In Milestone M1, the Webview ↔ Extension Host RPC channel is active and verified. The LLM Model Gateway and Code Editing tools will be connected in M2–M4.`;

      this.postMessageToWebview({
        type: 'agent.message',
        payload: {
          id: `asst_${Date.now()}`,
          role: 'assistant',
          text: replyText,
          timestamp: Date.now(),
        },
      });

      // 3. Transition to SUCCESS state
      this._setStatus('SUCCESS', 'Task completed');

      // 4. Return to IDLE after brief acknowledgment
      this._activeTaskTimer = setTimeout(() => {
        this._setStatus('IDLE', 'Ready');
        this._activeTaskTimer = undefined;
      }, 1500);
    }, 400);
  }

  private cancelActiveTask(reason: string): void {
    if (this._activeTaskTimer) {
      clearTimeout(this._activeTaskTimer);
      this._activeTaskTimer = undefined;
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

    // Reset to IDLE after a short pause
    setTimeout(() => {
      this._setStatus('IDLE', 'Ready');
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
