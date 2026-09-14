export type DiagnosticSeverity = 'error' | 'warning' | 'info' | 'hint';

export interface Diagnostic {
  file: string;           // Relative workspace path
  severity: DiagnosticSeverity;
  message: string;
  line: number;           // 1-indexed
  column: number;         // 1-indexed
  source?: string;        // e.g. "typescript", "eslint", "pylance"
  code?: string | number; // e.g. 2345, "no-unused-vars"
}

export type DiagnosticsStatus = 'CLEAN' | 'ERRORS' | 'WARNINGS' | 'UNAVAILABLE';

export interface DiagnosticsSummary {
  status: DiagnosticsStatus;
  errorCount: number;
  warningCount: number;
  diagnostics: Diagnostic[];
}

export interface IDiagnosticsProvider {
  /**
   * Harvest diagnostics for specific relative file paths in workspace.
   */
  getDiagnostics(files: string[]): Promise<Diagnostic[]>;

  /**
   * Optional wait for language server to settle diagnostics after buffer writes.
   */
  waitForSettled?(files: string[], timeoutMs?: number): Promise<Diagnostic[]>;
}

export function summarizeDiagnostics(diagnostics: Diagnostic[]): DiagnosticsSummary {
  const errorCount = diagnostics.filter((d) => d.severity === 'error').length;
  const warningCount = diagnostics.filter((d) => d.severity === 'warning').length;
  let status: DiagnosticsStatus = 'CLEAN';
  if (errorCount > 0) status = 'ERRORS';
  else if (warningCount > 0) status = 'WARNINGS';

  return {
    status,
    errorCount,
    warningCount,
    diagnostics,
  };
}
