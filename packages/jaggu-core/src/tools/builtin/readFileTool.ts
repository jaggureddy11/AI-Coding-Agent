import * as fs from 'fs';
import { z } from 'zod';
import { ITool, IToolExecutionContext, IToolResult, PermissionTier } from '../../types/tools.js';
import { ModelToolDefinition } from '../../types/models.js';
import { resolveAndValidateWorkspacePath } from '../security.js';

const ReadFileInputSchema = z.object({
  path: z.string().min(1, 'File path must not be empty'),
  startLine: z.number().int().positive().optional(),
  endLine: z.number().int().positive().optional(),
  maxBytes: z.number().int().positive().optional(),
});

export type ReadFileInput = z.infer<typeof ReadFileInputSchema>;

export interface ReadFileOutput {
  path: string;
  content: string;
  startLine?: number;
  endLine?: number;
  totalLines: number;
  byteSize: number;
  truncated: boolean;
}

export class ReadFileTool implements ITool<ReadFileInput, ReadFileOutput> {
  public readonly name = 'read_file';
  public readonly description =
    'Reads content of a workspace file with optional line-range slicing and byte limits. Returns lines, content, and metadata.';
  public readonly permissionTier: PermissionTier = 'SAFE';
  public readonly schema = ReadFileInputSchema;
  public readonly timeoutMs = 5000;

  public toModelToolDefinition(): ModelToolDefinition {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Workspace-relative or absolute path of the file to read',
          },
          startLine: {
            type: 'integer',
            description: '1-based starting line number to read (optional)',
          },
          endLine: {
            type: 'integer',
            description: '1-based ending line number to read (optional)',
          },
          maxBytes: {
            type: 'integer',
            description: 'Maximum bytes to return before truncating (optional, default 65536)',
          },
        },
        required: ['path'],
      },
    };
  }

  public async execute(
    args: ReadFileInput,
    context: IToolExecutionContext,
  ): Promise<IToolResult<ReadFileOutput>> {
    const startTime = Date.now();
    try {
      const roots = context.workspaceRoots || [context.workspaceRoot];
      const validatedPath = resolveAndValidateWorkspacePath(args.path, roots);

      if (!fs.existsSync(validatedPath)) {
        return {
          success: false,
          error: `File not found: ${args.path}`,
          executionDurationMs: Date.now() - startTime,
        };
      }

      const stat = fs.statSync(validatedPath);
      if (stat.isDirectory()) {
        return {
          success: false,
          error: `Target path is a directory, not a file: ${args.path}. Use list_directory instead.`,
          executionDurationMs: Date.now() - startTime,
        };
      }

      // Inspect first 4KB for binary NULL bytes
      const fd = fs.openSync(validatedPath, 'r');
      const headerBuf = Buffer.alloc(Math.min(4096, stat.size));
      fs.readSync(fd, headerBuf, 0, headerBuf.length, 0);
      fs.closeSync(fd);

      if (headerBuf.includes(0x00)) {
        return {
          success: false,
          error: `Cannot read binary file: ${args.path}`,
          executionDurationMs: Date.now() - startTime,
        };
      }

      const fullContent = fs.readFileSync(validatedPath, 'utf8');
      const lines = fullContent.split(/\r?\n/);
      const totalLines = lines.length;

      let start = 1;
      let end = totalLines;

      if (args.startLine !== undefined) {
        start = Math.max(1, args.startLine);
      }
      if (args.endLine !== undefined) {
        end = Math.min(totalLines, Math.max(start, args.endLine));
      }

      const slicedLines = lines.slice(start - 1, end);
      let content = slicedLines.join('\n');
      let truncated = false;

      const maxBytes = args.maxBytes ?? 64 * 1024;
      if (Buffer.byteLength(content, 'utf8') > maxBytes) {
        content = Buffer.from(content, 'utf8').subarray(0, maxBytes).toString('utf8');
        content += '\n... [truncated: file content exceeded byte limit]';
        truncated = true;
      }

      return {
        success: true,
        data: {
          path: args.path,
          content,
          startLine: start,
          endLine: end,
          totalLines,
          byteSize: Buffer.byteLength(content, 'utf8'),
          truncated,
        },
        executionDurationMs: Date.now() - startTime,
      };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        executionDurationMs: Date.now() - startTime,
      };
    }
  }
}
