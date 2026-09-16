import * as fs from 'fs';
import * as crypto from 'crypto';
import { z } from 'zod';
import {
  ITool,
  IToolExecutionContext,
  IToolResult,
  PermissionTier,
  ProposedEditRecord,
} from '../../types/tools.js';
import { ModelToolDefinition } from '../../types/models.js';
import { IVirtualDocStore } from '../../types/diff.js';
import { resolveAndValidateWorkspacePath } from '../security.js';
import { EventBus } from '../../events/eventBus.js';

const ProposeEditInputSchema = z.object({
  path: z.string().min(1, 'Target file path must not be empty'),
  proposedContent: z.string(),
  reason: z.string().optional(),
});

export type ProposeEditInput = z.infer<typeof ProposeEditInputSchema>;

export interface ProposeEditOutput {
  proposalId: string;
  filePath: string;
  shadowUri: string;
  linesAdded: number;
  linesDeleted: number;
  diffSummary: string;
  requiresApproval: true;
}

export class ProposeEditTool implements ITool<ProposeEditInput, ProposeEditOutput> {
  public readonly name = 'propose_edit';
  public readonly description =
    'Proposes a modification to a workspace file. Staged into a virtual shadow document for diff review. Does NOT write to disk until approved.';
  public readonly permissionTier: PermissionTier = 'MUTATING';
  public readonly schema = ProposeEditInputSchema;
  public readonly timeoutMs = 5000;

  constructor(
    private readonly docStore: IVirtualDocStore,
    private readonly eventBus?: EventBus,
    private readonly proposalRegistry?: Map<string, ProposedEditRecord>,
  ) {}

  public toModelToolDefinition(): ModelToolDefinition {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Workspace-relative path of the file to modify or create',
          },
          proposedContent: {
            type: 'string',
            description: 'The new complete proposed text content of the file',
          },
          reason: {
            type: 'string',
            description: 'Explanation or rationale for proposing this edit',
          },
        },
        required: ['path', 'proposedContent'],
      },
    };
  }

  public async execute(
    args: ProposeEditInput,
    context: IToolExecutionContext,
  ): Promise<IToolResult<ProposeEditOutput>> {
    const startTime = Date.now();
    try {
      const roots = context.workspaceRoots || [context.workspaceRoot];
      const validatedPath = resolveAndValidateWorkspacePath(args.path, roots);

      let originalContent = '';
      if (fs.existsSync(validatedPath)) {
        const stat = fs.statSync(validatedPath);
        if (stat.isDirectory()) {
          return {
            success: false,
            error: `Target path is a directory: ${args.path}`,
            executionDurationMs: Date.now() - startTime,
          };
        }
        originalContent = fs.readFileSync(validatedPath, 'utf8');
      }

      // Compute base hash for concurrency checking upon apply
      const baseContentHash = crypto.createHash('sha256').update(originalContent).digest('hex');

      const proposalId = `prop_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const shadowUri = `jaggu-shadow:${validatedPath}`;

      // Save into virtual doc store
      this.docStore.set(shadowUri, originalContent, args.proposedContent);

      // Calculate diff metrics
      const origLines = originalContent.split(/\r?\n/);
      const propLines = args.proposedContent.split(/\r?\n/);
      const linesAdded = Math.max(0, propLines.length - origLines.length);
      const linesDeleted = Math.max(0, origLines.length - propLines.length);
      const diffSummary = `+${linesAdded} / -${linesDeleted} lines (${args.reason || 'code modification'})`;

      const record: ProposedEditRecord = {
        proposalId,
        filePath: validatedPath,
        originalContent,
        proposedContent: args.proposedContent,
        baseContentHash,
        diffSummary,
        createdAt: Date.now(),
        approved: false,
      };

      if (this.proposalRegistry) {
        this.proposalRegistry.set(proposalId, record);
      }

      this.eventBus?.emit('edit.proposed', {
        taskId: context.taskId,
        proposalId,
        filePath: validatedPath,
        diffSummary,
        timestamp: Date.now(),
      });

      return {
        success: true,
        data: {
          proposalId,
          filePath: args.path,
          shadowUri,
          linesAdded,
          linesDeleted,
          diffSummary,
          requiresApproval: true,
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
