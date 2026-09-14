import { describe, it, expect } from 'vitest';
import {
  Diagnostic,
  IDiagnosticsProvider,
  summarizeDiagnostics,
} from '../src/types/diagnostics.js';

class MockDiagnosticsProvider implements IDiagnosticsProvider {
  constructor(private diags: Diagnostic[] = []) {}

  public async getDiagnostics(_files: string[]): Promise<Diagnostic[]> {
    return this.diags;
  }

  public setDiagnostics(diags: Diagnostic[]) {
    this.diags = diags;
  }
}

describe('LSP Diagnostics Core & Normalization (M6 Pillar 1)', () => {
  it('should summarize clean diagnostics accurately', async () => {
    const provider = new MockDiagnosticsProvider([]);
    const diags = await provider.getDiagnostics(['src/auth.ts']);
    const summary = summarizeDiagnostics(diags);

    expect(summary.status).toBe('CLEAN');
    expect(summary.errorCount).toBe(0);
    expect(summary.warningCount).toBe(0);
    expect(summary.diagnostics).toHaveLength(0);
  });

  it('should categorize error diagnostics and mark status ERRORS', async () => {
    const provider = new MockDiagnosticsProvider([
      {
        file: 'src/limiter.ts',
        severity: 'error',
        message: "Cannot find name 'RateLimiterOptions'",
        line: 14,
        column: 22,
        source: 'typescript',
        code: 2304,
      },
    ]);

    const diags = await provider.getDiagnostics(['src/limiter.ts']);
    const summary = summarizeDiagnostics(diags);

    expect(summary.status).toBe('ERRORS');
    expect(summary.errorCount).toBe(1);
    expect(summary.warningCount).toBe(0);
    expect(summary.diagnostics[0]?.file).toBe('src/limiter.ts');
    expect(summary.diagnostics[0]?.code).toBe(2304);
  });

  it('should prioritize ERRORS status when both warnings and errors coexist', async () => {
    const provider = new MockDiagnosticsProvider([
      {
        file: 'src/limiter.ts',
        severity: 'warning',
        message: "'unusedVar' is declared but never used",
        line: 3,
        column: 9,
        source: 'eslint',
        code: 'no-unused-vars',
      },
      {
        file: 'src/limiter.ts',
        severity: 'error',
        message: "Type 'number' is not assignable to type 'string'",
        line: 20,
        column: 5,
        source: 'typescript',
        code: 2322,
      },
    ]);

    const diags = await provider.getDiagnostics(['src/limiter.ts']);
    const summary = summarizeDiagnostics(diags);

    expect(summary.status).toBe('ERRORS');
    expect(summary.errorCount).toBe(1);
    expect(summary.warningCount).toBe(1);
  });

  it('should mark status WARNINGS when only warnings are present', async () => {
    const provider = new MockDiagnosticsProvider([
      {
        file: 'src/auth.ts',
        severity: 'warning',
        message: 'Missing JSDoc comment',
        line: 1,
        column: 1,
        source: 'eslint',
      },
    ]);

    const diags = await provider.getDiagnostics(['src/auth.ts']);
    const summary = summarizeDiagnostics(diags);

    expect(summary.status).toBe('WARNINGS');
    expect(summary.errorCount).toBe(0);
    expect(summary.warningCount).toBe(1);
  });
});
