import { spawn } from 'child_process';
import { z } from 'zod';
import { ITool, IToolExecutionContext, IToolResult, PermissionTier } from '../../types/tools.js';
import { ModelToolDefinition } from '../../types/models.js';
import { resolveAndValidateWorkspacePath } from '../security.js';

const DISALLOWED_PATTERNS = [
  /\brm\s+.*(-[a-zA-Z0-9]*r[a-zA-Z0-9]*).*\s+(\/|~|\/\*|\.\.)(\s|$)/i,
  /\brm\s+(-[a-zA-Z0-9]*r[a-zA-Z0-9]*\s+)?(\/|~|\/\*)(\s|$)/i,
  /\bmkfs\b/i,
  /\b(dd|fdisk|parted)\b.*\bof=\/dev\b/i,
  /\bsudo\b/i,
  /:(){ :|:& };:/, // fork bomb
];

const ExecuteCommandInputSchema = z.object({
  command: z
    .string()
    .min(1, 'Command cannot be empty')
    .describe('The shell or git command to execute (e.g. "git status", "git add . && git commit -m \\"feat: update\\"", "git push", "npm run build").'),
  cwd: z
    .string()
    .optional()
    .describe('Optional directory to execute command in, relative to workspace root. Defaults to workspace root.'),
  timeoutMs: z
    .number()
    .int()
    .min(1000)
    .max(300000)
    .optional()
    .describe('Execution timeout in milliseconds (default: 60000, max: 300000).'),
});

export type ExecuteCommandInput = z.infer<typeof ExecuteCommandInputSchema>;

export interface ExecuteCommandOutput {
  command: string;
  cwd: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export class ExecuteCommandTool implements ITool<ExecuteCommandInput, ExecuteCommandOutput> {
  public readonly name = 'execute_command';
  public readonly description =
    'Executes a shell command or git action within the workspace. Supports git commands (e.g. "git status", "git add .", "git commit -m \\"message\\"", "git push", "git diff", "git log"), build tools, package managers, and inspection commands.';
  public readonly permissionTier: PermissionTier = 'EXECUTION';
  public readonly schema = ExecuteCommandInputSchema;
  public readonly timeoutMs = 60000;

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
              'The terminal or git command line to execute (e.g. "git status", "git add <file>", "git commit -m \\"commit message\\"", "git push origin <branch>", "npm run build").',
          },
          cwd: {
            type: 'string',
            description:
              'Optional subfolder path relative to the workspace root. Omit to run in the workspace root.',
          },
          timeoutMs: {
            type: 'integer',
            description: 'Timeout in milliseconds (default: 60000, max: 300000).',
          },
        },
        required: ['command'],
      },
    };
  }

  public async execute(
    args: ExecuteCommandInput,
    context: IToolExecutionContext,
  ): Promise<IToolResult<ExecuteCommandOutput>> {
    const startTime = Date.now();
    const cmdString = args.command.trim();

    // 1. Safety check against destructive system commands
    for (const pattern of DISALLOWED_PATTERNS) {
      if (pattern.test(cmdString)) {
        return {
          success: false,
          error: `Security violation: command contains prohibited pattern "${pattern}". Destructive system actions and privilege escalation are blocked.`,
          executionDurationMs: Date.now() - startTime,
        };
      }
    }

    // 2. Resolve and validate working directory
    const workspaceRoots = context.workspaceRoots?.length
      ? context.workspaceRoots
      : [context.workspaceRoot];

    let executionCwd = context.workspaceRoot;
    if (args.cwd && args.cwd.trim().length > 0) {
      try {
        executionCwd = resolveAndValidateWorkspacePath(args.cwd, workspaceRoots);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          success: false,
          error: `Invalid working directory: ${message}`,
          executionDurationMs: Date.now() - startTime,
        };
      }
    }

    const timeout = Math.min(300000, args.timeoutMs ?? this.timeoutMs);

    return new Promise<IToolResult<ExecuteCommandOutput>>((resolve) => {
      let stdout = '';
      let stderr = '';
      const MAX_OUTPUT_BYTES = 128 * 1024; // 128 KB
      let finished = false;

      const proc = spawn(cmdString, {
        cwd: executionCwd,
        env: {
          ...process.env,
          GIT_TERMINAL_PROMPT: '0',
          CI: 'true',
        },
        shell: true,
      });

      const cleanupTimer = setTimeout(() => {
        if (!finished) {
          finished = true;
          proc.kill('SIGTERM');
          setTimeout(() => {
            try {
              proc.kill('SIGKILL');
            } catch {
              // Ignore if already terminated
            }
          }, 1000);
          resolve({
            success: false,
            error: `Command execution timed out after ${timeout}ms: "${cmdString}"`,
            data: {
              command: cmdString,
              cwd: executionCwd,
              exitCode: null,
              stdout,
              stderr,
              durationMs: Date.now() - startTime,
            },
            executionDurationMs: Date.now() - startTime,
          });
        }
      }, timeout);

      const abortHandler = () => {
        if (!finished) {
          finished = true;
          clearTimeout(cleanupTimer);
          proc.kill('SIGTERM');
          setTimeout(() => {
            try {
              proc.kill('SIGKILL');
            } catch {
              // Ignore
            }
          }, 1000);
          resolve({
            success: false,
            error: `Command execution cancelled: "${cmdString}"`,
            data: {
              command: cmdString,
              cwd: executionCwd,
              exitCode: null,
              stdout,
              stderr,
              durationMs: Date.now() - startTime,
            },
            executionDurationMs: Date.now() - startTime,
          });
        }
      };

      if (context.abortSignal.aborted) {
        abortHandler();
        return;
      }

      context.abortSignal.addEventListener('abort', abortHandler, { once: true });

      proc.stdout.on('data', (chunk: Buffer) => {
        if (stdout.length < MAX_OUTPUT_BYTES) {
          stdout += chunk.toString('utf8');
          if (stdout.length >= MAX_OUTPUT_BYTES) {
            stdout += '\n... [truncated stdout: exceeded 128KB output limit]';
          }
        }
      });

      proc.stderr.on('data', (chunk: Buffer) => {
        if (stderr.length < MAX_OUTPUT_BYTES) {
          stderr += chunk.toString('utf8');
          if (stderr.length >= MAX_OUTPUT_BYTES) {
            stderr += '\n... [truncated stderr: exceeded 128KB output limit]';
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
            error: `Failed to spawn process for command "${cmdString}": ${err.message}`,
            executionDurationMs: Date.now() - startTime,
          });
        }
      });

      proc.on('close', (code: number | null) => {
        if (!finished) {
          finished = true;
          clearTimeout(cleanupTimer);
          context.abortSignal.removeEventListener('abort', abortHandler);
          const isSuccess = code === 0;
          resolve({
            success: isSuccess,
            data: {
              command: cmdString,
              cwd: executionCwd,
              exitCode: code,
              stdout,
              stderr,
              durationMs: Date.now() - startTime,
            },
            error: isSuccess ? undefined : `Command exited with non-zero code ${code}: ${stderr || stdout || 'Unknown error'}`,
            executionDurationMs: Date.now() - startTime,
          });
        }
      });
    });
  }
}
