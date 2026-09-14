import * as vscode from 'vscode';
import { EventBus } from '@jaggu/core';

export class JagguSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly VIEW_ID = 'jaggu.sidebarView';
  private _view?: vscode.WebviewView;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _eventBus: EventBus,
  ) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage((message: { type: string; payload?: unknown }) => {
      switch (message.type) {
        case 'SUBMIT_PROMPT': {
          const payload = message.payload as { prompt: string };
          this._eventBus.emit('agent.started', {
            taskId: `task_${Date.now()}`,
            conversationId: `conv_${Date.now()}`,
            prompt: payload.prompt,
            timestamp: Date.now(),
          });
          break;
        }
        case 'CANCEL_ACTIVE_TASK': {
          this._eventBus.emit('agent.cancelled', {
            taskId: 'active',
            reason: 'Cancelled by user from webview',
            timestamp: Date.now(),
          });
          break;
        }
      }
    });
  }

  public postMessageToWebview(message: unknown): Thenable<boolean> | undefined {
    return this._view?.webview.postMessage(message);
  }

  private _getHtmlForWebview(_webview: vscode.Webview): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>JAGGU Assistant</title>
  <style>
    body {
      font-family: var(--vscode-font-family, sans-serif);
      color: var(--vscode-foreground, #cccccc);
      background-color: var(--vscode-sideBar-background, #252526);
      padding: 12px;
      margin: 0;
    }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 600;
      background: var(--vscode-badge-background, #3c3c3c);
      color: var(--vscode-badge-foreground, #ffffff);
    }
    .intro {
      font-size: 12px;
      color: var(--vscode-descriptionForeground, #858585);
      margin-top: 16px;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div style="display: flex; justify-content: space-between; align-items: center;">
    <h3 style="margin: 0; font-size: 14px;">JAGGU</h3>
    <span class="badge">READY</span>
  </div>
  <p class="intro">
    Autonomous AI coding agent ready. Submit tasks or inspect repository architecture.
  </p>
</body>
</html>`;
  }
}
