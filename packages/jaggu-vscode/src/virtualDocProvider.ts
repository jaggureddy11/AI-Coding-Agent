import * as vscode from 'vscode';
import { IVirtualDocStore } from '@jaggu/core';

export class JagguShadowDocProvider implements vscode.TextDocumentContentProvider {
  public static readonly SCHEME = 'jaggu-shadow';

  private readonly _onDidChange = new vscode.EventEmitter<vscode.Uri>();
  public readonly onDidChange = this._onDidChange.event;

  constructor(private readonly docStore: IVirtualDocStore) {}

  provideTextDocumentContent(uri: vscode.Uri): string {
    const doc = this.docStore.get(uri.toString());
    return doc?.proposedContent ?? '';
  }

  notifyChanged(uri: vscode.Uri): void {
    this._onDidChange.fire(uri);
  }
}
