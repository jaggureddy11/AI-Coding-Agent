import { spawn } from 'child_process';
import { z } from 'zod';
import { ITool, IToolExecutionContext, IToolResult, PermissionTier } from '../../types/tools.js';
import { ModelToolDefinition } from '../../types/models.js';

const ALLOWED_TEST_PREFIXES = [
  'npm test',
  'npm run test',
  'npx vitest',
  'npx jest',
  'pytest',
  'python -m unittest',
  'python -m pytest',
  'cargo test',
  'go test',
  'dotnet test',
  'mvn test',
  'gradle test',
];

const DISALLOWED_PATTERNS = [
  /[;&|><$`\\]/, // Shell injection & redirection metacharacters
  /\brm\b/i, // File deletion
  /\bdel\b/i,
  /\bcurl\b/i, // Network transfer / exfiltration
  /\bwget\b/i,
  /\bsudo\b/i, // Privilege escalation
  /\bchmod\b/i,
  /\bchown\b/i,
  /\bformat\b/i,
  /\b(bash|sh|zsh|powershell|cmd)\b/i,
];

const RunTestsInputSchema = z.object({
  command: z.string().optional(),
  testFilter: z.string().optional(),
  timeoutMs: z.number().int().min(1000).max(60000).optional(),
});

export type RunTestsInput = z.infer<typeof RunTestsInputSchema>;

export interface RunTestsOutput {
  command: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  passed: boolean;
  durationMs: number;
}

export class RunTestsTool implements ITool<RunTestsInput, RunTestsOutput> {
  public readonly name = 'run_tests';
  public readonly description =
    'Runs a controlled project test suite command (e.g. npm test, vitest, pytest) within the workspace to verify code correctness.';
  public readonly permissionTier: PermissionTier = 'EXECUTION';
  public readonly schema = RunTestsInputSchema;
  public readonly timeoutMs = 30000;

  public toModelToolDefinition(): ModelToolDefinition {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description:
              'Test runner command to execute (e.g. "npm test", "npm test -- test/auth.test.ts", "pytest", "cargo test"). Defaults to "npm test".',
          },
          testFilter: {
            type: 'string',
            description: 'Optional path or keyword filter passed to the test runner',
          },
          timeoutMs: {
            type: 'integer',
            description: 'Execution timeout in milliseconds (default: 30000, max: 60000)',
          },
        },
      },
    };
  }

  public async execute(
    args: RunTestsInput,
    context: IToolExecutionContext,
  ): Promise<IToolResult<RunTestsOutput>> {
    const startTime = Date.now();

    // Default to 'npm test' if not specified
    let cmdString = (args.command || 'npm test').trim();

    if (args.testFilter && !cmdString.includes(args.testFilter)) {
      cmdString += ` ${args.testFilter}`;
    }

    // 1. Safety verification against command policy
    for (const pattern of DISALLOWED_PATTERNS) {
      if (pattern.test(cmdString)) {
        return {
          success: false,
          error: `Security violation: command contains prohibited character or command pattern "${pattern}". Only standard test runners are allowed.`,
          executionDurationMs: Date.now() - startTime,
        };
      }
    }

    const isAllowed = ALLOWED_TEST_PREFIXES.some(
      (prefix) => cmdString === prefix || cmdString.startsWith(`${prefix} `),
    );

    if (!isAllowed) {
      return {
        success: false,
        error: `Security violation: command "${cmdString}" does not match recognized test prefixes: [${ALLOWED_TEST_PREFIXES.join(', ')}].`,
        executionDurationMs: Date.now() - startTime,
      };
    }

    // 2. Parse command line into binary + args
    const parts = cmdString.split(/\s+/).filter(Boolean);
    const executable = parts[0];
    const cmdArgs = parts.slice(1);

    if (!executable) {
      return {
        success: false,
        error: 'No executable specified',
        executionDurationMs: Date.now() - startTime,
      };
    }

    const timeout = Math.min(60000, args.timeoutMs ?? this.timeoutMs);
    const primaryRoot = context.workspaceRoots?.[0] || context.workspaceRoot;

    return new Promise<IToolResult<RunTestsOutput>>((resolve) => {
      let stdout = '';
      let stderr = '';
      const MAX_OUTPUT_BYTES = 64 * 1024; // 64 KB

      const proc = spawn(executable, cmdArgs, {
        cwd: primaryRoot,
        env: { ...process.env, CI: 'true' },
        shell: false,
      });

      let finished = false;

      const cleanupTimer = setTimeout(() => {
        if (!finished) {
          finished = true;
          proc.kill('SIGTERM');
          setTimeout(() => {
            try {
              proc.kill('SIGKILL');
            } catch {
              // ignore
            }
          }, 1000);
          resolve({
            success: false,
            error: `Test execution timed out after ${timeout}ms`,
            executionDurationMs: Date.now() - startTime,
          });
        }
      }, timeout);

      const abortHandler = () => {
        if (!finished) {
          finished = true;
          clearTimeout(cleanupTimer);
          proc.kill('SIGTERM');
          resolve({
            success: false,
            error: 'Test execution cancelled',
            executionDurationMs: Date.now() - startTime,
          });
        }
      };

      context.abortSignal.addEventListener('abort', abortHandler);

      proc.stdout.on('data', (chunk: Buffer) => {
        if (stdout.length < MAX_OUTPUT_BYTES) {
          stdout += chunk.toString('utf8');
          if (stdout.length >= MAX_OUTPUT_BYTES) {
            stdout += '\n... [truncated stdout: exceeded 64KB output limit]';
          }
        }
      });

      proc.stderr.on('data', (chunk: Buffer) => {
        if (stderr.length < MAX_OUTPUT_BYTES) {
          stderr += chunk.toString('utf8');
          if (stderr.length >= MAX_OUTPUT_BYTES) {
            stderr += '\n... [truncated stderr: exceeded 64KB output limit]';
          }
        }
      });

      proc.on('error', (err: Error) => {
        if (!finished) {
          finished = true;
          clearTimeout(cleanupTimer);
          context.abortSignal.removeEventListener('abort', abortHandler);
          resolve({
            success: false,
            error: `Failed to spawn test process: ${err.message}`,
            executionDurationMs: Date.now() - startTime,
          });
        }
      });

      proc.on('close', (code: number | null) => {
        if (!finished) {
          finished = true;
          clearTimeout(cleanupTimer);
          context.abortSignal.removeEventListener('abort', abortHandler);
          resolve({
            success: code === 0,
            data: {
              command: cmdString,
              exitCode: code,
              stdout,
              stderr,
              passed: code === 0,
              durationMs: Date.now() - startTime,
            },
            executionDurationMs: Date.now() - startTime,
          });
        }
      });
    });
  }
}
