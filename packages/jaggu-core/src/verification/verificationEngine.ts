import * as fs from 'fs';
import * as path from 'path';
import { ToolExecutor } from '../tools/executor.js';
import { EventBus } from '../events/eventBus.js';
import { VerificationResult, VerificationStatus } from '../types/verification.js';

export interface VerificationEngineOptions {
  toolExecutor: ToolExecutor;
  eventBus: EventBus;
  workspaceRoots: string[];
}

export class VerificationEngine {
  private readonly toolExecutor: ToolExecutor;
  private readonly eventBus: EventBus;
  private readonly workspaceRoots: string[];

  constructor(options: VerificationEngineOptions) {
    this.toolExecutor = options.toolExecutor;
    this.eventBus = options.eventBus;
    this.workspaceRoots = options.workspaceRoots;
  }

  /**
   * Infers the appropriate test verification command from plan specifications or repository conventions.
   */
  public determineVerificationCommand(planVerification?: string[], modifiedFiles?: string[]): string {
    // 1. If plan explicitly lists a valid command, prefer it
    if (planVerification && planVerification.length > 0 && planVerification[0]) {
      const explicit = planVerification[0].trim();
      if (explicit) return explicit;
    }

    const primaryRoot = this.workspaceRoots[0];
    if (!primaryRoot) return 'npm test';

    // 2. Node / JS / TS repository
    const pkgJsonPath = path.join(primaryRoot, 'package.json');
    if (fs.existsSync(pkgJsonPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
        if (pkg.scripts && pkg.scripts.test) {
          // If specific test file was modified, check if targeted test can be run
          const testFile = modifiedFiles?.find((f) => f.includes('.test.') || f.includes('.spec.'));
          if (testFile) {
            return `npm test -- ${testFile}`;
          }
          return 'npm test';
        }
      } catch {
        // fallback
      }
    }

    // 3. Python repository
    if (
      fs.existsSync(path.join(primaryRoot, 'pytest.ini')) ||
      fs.existsSync(path.join(primaryRoot, 'setup.py')) ||
      fs.existsSync(path.join(primaryRoot, 'pyproject.toml'))
    ) {
      const pyTestFile = modifiedFiles?.find((f) => f.startsWith('test_') || f.endsWith('_test.py'));
      if (pyTestFile) {
        return `pytest ${pyTestFile}`;
      }
      return 'pytest';
    }

    // 4. Rust repository
    if (fs.existsSync(path.join(primaryRoot, 'Cargo.toml'))) {
      return 'cargo test';
    }

    // 5. Go repository
    if (fs.existsSync(path.join(primaryRoot, 'go.mod'))) {
      return 'go test ./...';
    }

    return 'npm test';
  }

  /**
   * Runs verification via the controlled run_tests tool and produces a normalized VerificationResult.
   */
  public async runVerification(
    command: string,
    abortSignal?: AbortSignal,
  ): Promise<VerificationResult> {
    const startTime = Date.now();

    this.eventBus.emit('verification.started', {
      command,
      timestamp: startTime,
    });

    const primaryRoot = this.workspaceRoots[0] || process.cwd();

    try {
      const execution = await this.toolExecutor.executeTool(
        `verify_${Date.now()}`,
        'run_tests',
        { command },
        {
          taskId: 'task_verify',
          workspaceRoot: primaryRoot,
          workspaceRoots: this.workspaceRoots,
          abortSignal: abortSignal || new AbortController().signal,
        },
      );

      const durationMs = Date.now() - startTime;

      const outputData = execution.data as {
        exitCode: number;
        stdout: string;
        stderr: string;
      } | undefined;

      if (!outputData) {
        const errMessage = execution.error || 'Verification execution failed';
        const isTimeout = errMessage.toLowerCase().includes('timeout');
        const status: VerificationStatus = isTimeout ? 'TIMEOUT' : 'ERROR';
        const result: VerificationResult = {
          status,
          command,
          exitCode: 1,
          stdout: '',
          stderr: errMessage,
          durationMs,
          summary: `Verification ${status.toLowerCase()}: ${errMessage}`,
        };

        this.eventBus.emit('verification.failed', {
          command,
          status,
          error: errMessage,
          durationMs,
          timestamp: Date.now(),
        });

        return result;
      }

      const parsed = this.parseTestSummary(outputData.stdout || '', outputData.stderr || '');
      const status: VerificationStatus = outputData.exitCode === 0 ? 'PASS' : 'FAIL';

      const result: VerificationResult = {
        status,
        command,
        exitCode: outputData.exitCode,
        stdout: outputData.stdout || '',
        stderr: outputData.stderr || '',
        durationMs,
        testsPassed: parsed.passed,
        testsFailed: parsed.failed,
        summary: parsed.summary,
      };

      if (status === 'PASS') {
        this.eventBus.emit('verification.completed', {
          command,
          status: 'PASS',
          testsPassed: parsed.passed,
          durationMs,
          timestamp: Date.now(),
        });
      } else {
        this.eventBus.emit('verification.failed', {
          command,
          status: 'FAIL',
          exitCode: outputData.exitCode,
          testsFailed: parsed.failed,
          durationMs,
          timestamp: Date.now(),
        });
      }

      return result;
    } catch (err) {
      const durationMs = Date.now() - startTime;
      const isAbort = abortSignal?.aborted;
      const status: VerificationStatus = isAbort ? 'CANCELLED' : 'ERROR';

      const result: VerificationResult = {
        status,
        command,
        exitCode: 1,
        stdout: '',
        stderr: err instanceof Error ? err.message : String(err),
        durationMs,
        summary: `Verification ${status.toLowerCase()}`,
      };

      this.eventBus.emit('verification.failed', {
        command,
        status,
        error: result.stderr,
        durationMs,
        timestamp: Date.now(),
      });

      return result;
    }
  }

  /**
   * Parses common test framework outputs (Vitest/Jest, Pytest, Go, Cargo) for passed/failed numbers.
   */
  public parseTestSummary(stdout: string, stderr: string): { passed?: number; failed?: number; summary: string } {
    const combined = `${stdout}\n${stderr}`;

    // Vitest / Jest: "Tests  2 passed (2)" or "Tests  1 failed | 5 passed (6)"
    const vitestMatch = combined.match(/Tests\s+(?:(\d+)\s+failed\s*\|\s*)?(\d+)\s+passed/i);
    if (vitestMatch && vitestMatch[2]) {
      const failed = vitestMatch[1] ? parseInt(vitestMatch[1], 10) : 0;
      const passed = parseInt(vitestMatch[2], 10);
      return {
        passed,
        failed,
        summary: `${passed} passed${failed > 0 ? `, ${failed} failed` : ''}`,
      };
    }

    // Pytest: "1 failed, 5 passed in 0.23s" or "6 passed in 0.12s"
    const pytestMatch = combined.match(/(?:(\d+)\s+failed,\s*)?(\d+)\s+passed/i);
    if (pytestMatch && pytestMatch[2]) {
      const failed = pytestMatch[1] ? parseInt(pytestMatch[1], 10) : 0;
      const passed = parseInt(pytestMatch[2], 10);
      return {
        passed,
        failed,
        summary: `${passed} passed${failed > 0 ? `, ${failed} failed` : ''}`,
      };
    }

    // Cargo test: "test result: ok. 5 passed; 0 failed"
    const cargoMatch = combined.match(/test result:\s*(\w+)\.\s*(\d+)\s+passed;\s*(\d+)\s+failed/i);
    if (cargoMatch && cargoMatch[2] && cargoMatch[3]) {
      const passed = parseInt(cargoMatch[2], 10);
      const failed = parseInt(cargoMatch[3], 10);
      return {
        passed,
        failed,
        summary: `${passed} passed, ${failed} failed`,
      };
    }

    return {
      summary: combined.includes('FAIL') || combined.includes('error') ? 'Tests failed' : 'Tests passed',
    };
  }
}
