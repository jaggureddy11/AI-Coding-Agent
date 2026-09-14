import * as vscode from 'vscode';
import * as path from 'path';
import { IDiagnosticsProvider, Diagnostic, DiagnosticSeverity } from '@jaggu/core';

export interface VSCodeDiagnosticsProviderOptions {
  workspaceRoot: string;
}

export class VSCodeDiagnosticsProvider implements IDiagnosticsProvider {
  private readonly workspaceRoot: string;

  constructor(options: VSCodeDiagnosticsProviderOptions) {
    this.workspaceRoot = options.workspaceRoot;
  }

  public async getDiagnostics(files: string[]): Promise<Diagnostic[]> {
    const results: Diagnostic[] = [];

    for (const relFile of files) {
      const fullPath = path.isAbsolute(relFile)
        ? relFile
        : path.join(this.workspaceRoot, relFile);
      const uri = vscode.Uri.file(fullPath);
      const rawDiags = vscode.languages.getDiagnostics(uri);

      for (const d of rawDiags) {
        results.push({
          file: path.relative(this.workspaceRoot, fullPath),
          severity: this.mapSeverity(d.severity),
          message: d.message,
          line: d.range.start.line + 1,
          column: d.range.start.character + 1,
          source: d.source,
          code: typeof d.code === 'object' ? d.code.value : d.code,
        });
      }
    }

    return results;
  }

  public async waitForSettled(files: string[], timeoutMs = 250): Promise<Diagnostic[]> {
    // Wait for language server event processing to settle after buffer writes
    await new Promise((resolve) => setTimeout(resolve, timeoutMs));
    return this.getDiagnostics(files);
  }

  private mapSeverity(vsSeverity: vscode.DiagnosticSeverity): DiagnosticSeverity {
    switch (vsSeverity) {
      case vscode.DiagnosticSeverity.Error:
        return 'error';
      case vscode.DiagnosticSeverity.Warning:
        return 'warning';
      case vscode.DiagnosticSeverity.Information:
        return 'info';
      case vscode.DiagnosticSeverity.Hint:
        return 'hint';
      default:
        return 'error';
    }
  }
}
