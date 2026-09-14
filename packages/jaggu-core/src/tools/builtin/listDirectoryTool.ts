import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';
import { ITool, IToolExecutionContext, IToolResult, PermissionTier } from '../../types/tools.js';
import { ModelToolDefinition } from '../../types/models.js';
import { resolveAndValidateWorkspacePath } from '../security.js';

const DEFAULT_IGNORED = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  'out',
  '.gemini',
  '.vscode',
  'coverage',
  'target',
  'vendor',
  'venv',
  '.venv',
  '__pycache__',
  '.turbo',
  '.next',
]);

const ListDirectoryInputSchema = z.object({
  path: z.string().optional(),
  recursive: z.boolean().optional(),
  maxDepth: z.number().int().min(1).max(5).optional(),
  maxEntries: z.number().int().positive().max(500).optional(),
});

export type ListDirectoryInput = z.infer<typeof ListDirectoryInputSchema>;

export interface DirectoryEntry {
  name: string;
  relativePath: string;
  type: 'file' | 'directory';
  sizeBytes?: number;
}

export interface ListDirectoryOutput {
  path: string;
  entries: DirectoryEntry[];
  totalEntries: number;
  truncated: boolean;
}

export class ListDirectoryTool implements ITool<ListDirectoryInput, ListDirectoryOutput> {
  public readonly name = 'list_directory';
  public readonly description =
    'Lists contents of a directory in the workspace with bounded depth and entries, ignoring build and vendor directories.';
  public readonly permissionTier: PermissionTier = 'SAFE';
  public readonly schema = ListDirectoryInputSchema;
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
            description: 'Workspace-relative directory path to inspect (defaults to workspace root ".")',
          },
          recursive: {
            type: 'boolean',
            description: 'Whether to recursively traverse subdirectories (default: false)',
          },
          maxDepth: {
            type: 'integer',
            description: 'Maximum recursion depth if recursive is true (default: 2, max: 5)',
          },
          maxEntries: {
            type: 'integer',
            description: 'Maximum entries to return (default: 100, max: 500)',
          },
        },
      },
    };
  }

  public async execute(
    args: ListDirectoryInput,
    context: IToolExecutionContext,
  ): Promise<IToolResult<ListDirectoryOutput>> {
    const startTime = Date.now();
    try {
      const targetPath = args.path || '.';
      const roots = context.workspaceRoots || [context.workspaceRoot];
      const validatedDir = resolveAndValidateWorkspacePath(targetPath, roots);

      if (!fs.existsSync(validatedDir)) {
        return {
          success: false,
          error: `Directory not found: ${targetPath}`,
          executionDurationMs: Date.now() - startTime,
        };
      }

      const stat = fs.statSync(validatedDir);
      if (!stat.isDirectory()) {
        return {
          success: false,
          error: `Path is not a directory: ${targetPath}`,
          executionDurationMs: Date.now() - startTime,
        };
      }

      const recursive = args.recursive ?? false;
      const maxDepth = args.maxDepth ?? 2;
      const maxEntries = args.maxEntries ?? 100;
      const entries: DirectoryEntry[] = [];

      const primaryRoot = roots[0] || context.workspaceRoot;

      const scan = (currentDir: string, currentDepth: number) => {
        if (entries.length >= maxEntries || context.abortSignal.aborted) return;

        let items: fs.Dirent[];
        try {
          items = fs.readdirSync(currentDir, { withFileTypes: true });
        } catch {
          return;
        }

        for (const item of items) {
          if (entries.length >= maxEntries || context.abortSignal.aborted) break;
          if (DEFAULT_IGNORED.has(item.name)) continue;

          const itemPath = path.join(currentDir, item.name);
          const relPath = path.relative(primaryRoot, itemPath).replace(/\\/g, '/');

          if (item.isDirectory()) {
            entries.push({
              name: item.name,
              relativePath: relPath,
              type: 'directory',
            });

            if (recursive && currentDepth < maxDepth) {
              scan(itemPath, currentDepth + 1);
            }
          } else {
            let sizeBytes: number | undefined;
            try {
              sizeBytes = fs.statSync(itemPath).size;
            } catch {
              // ignore
            }
            entries.push({
              name: item.name,
              relativePath: relPath,
              type: 'file',
              sizeBytes,
            });
          }
        }
      };

      scan(validatedDir, 1);

      return {
        success: true,
        data: {
          path: targetPath,
          entries,
          totalEntries: entries.length,
          truncated: entries.length >= maxEntries,
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
