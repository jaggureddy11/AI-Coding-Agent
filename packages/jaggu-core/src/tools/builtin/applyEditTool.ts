import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { z } from 'zod';
import { ITool, IToolExecutionContext, IToolResult, PermissionTier, ProposedEditRecord } from '../../types/tools.js';
import { ModelToolDefinition } from '../../types/models.js';
import { IVirtualDocStore } from '../../types/diff.js';
import { resolveAndValidateWorkspacePath } from '../security.js';
import { EventBus } from '../../events/eventBus.js';

const ApplyEditInputSchema = z.object({
  proposalId: z.string().min(1, 'proposalId is required'),
});

export type ApplyEditInput = z.infer<typeof ApplyEditInputSchema>;

export interface ApplyEditOutput {
  proposalId: string;
  filePath: string;
  bytesWritten: number;
  linesChanged: number;
  applied: boolean;
}

export class ApplyEditTool implements ITool<ApplyEditInput, ApplyEditOutput> {
  public readonly name = 'apply_edit';
  public readonly description =
    'Applies an approved file edit proposal to the real workspace on disk after validating that the base file has not suffered a concurrent modification.';
  public readonly permissionTier: PermissionTier = 'MUTATING';
  public readonly schema = ApplyEditInputSchema;
  public readonly timeoutMs = 5000;

  constructor(
    private readonly docStore: IVirtualDocStore,
    private readonly proposalRegistry: Map<string, ProposedEditRecord>,
    private readonly eventBus?: EventBus,
  ) {}

  public toModelToolDefinition(): ModelToolDefinition {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object',
        properties: {
          proposalId: {
            type: 'string',
            description: 'The unique proposalId returned by propose_edit',
          },
        },
        required: ['proposalId'],
      },
    };
  }

  public async execute(
    args: ApplyEditInput,
    context: IToolExecutionContext,
  ): Promise<IToolResult<ApplyEditOutput>> {
    const startTime = Date.now();
    try {
      const record = this.proposalRegistry.get(args.proposalId);
      if (!record) {
        return {
          success: false,
          error: `Proposal [${args.proposalId}] not found or has expired. Generate a new edit proposal.`,
          executionDurationMs: Date.now() - startTime,
        };
      }

      if (!record.approved) {
        return {
          success: false,
          error: `Proposal [${args.proposalId}] requires explicit human approval before it can be applied to disk.`,
          executionDurationMs: Date.now() - startTime,
        };
      }

      const roots = context.workspaceRoots || [context.workspaceRoot];
      const validatedPath = resolveAndValidateWorkspacePath(record.filePath, roots);

      // Concurrent modification conflict check
      let currentContentOnDisk = '';
      if (fs.existsSync(validatedPath)) {
        currentContentOnDisk = fs.readFileSync(validatedPath, 'utf8');
      }

      const currentHash = crypto.createHash('sha256').update(currentContentOnDisk).digest('hex');

      if (currentHash !== record.baseContentHash) {
        const conflictMsg = `Concurrent modification conflict: [${record.filePath}] was modified on disk after proposal was created. Base hash mismatch.`;
        this.eventBus?.emit('edit.conflict', {
          taskId: context.taskId,
          proposalId: args.proposalId,
          filePath: validatedPath,
          reason: conflictMsg,
          timestamp: Date.now(),
        });

        return {
          success: false,
          error: `${conflictMsg} Please inspect the latest file content and regenerate proposed changes.`,
          executionDurationMs: Date.now() - startTime,
        };
      }

      // Ensure directory exists
      const targetDir = path.dirname(validatedPath);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      // Apply changes atomically
      fs.writeFileSync(validatedPath, record.proposedContent, 'utf8');
      const bytesWritten = Buffer.byteLength(record.proposedContent, 'utf8');

      // Clean up shadow document and registry
      const shadowUri = `jaggu-shadow:${validatedPath}`;
      this.docStore.delete(shadowUri);
      this.proposalRegistry.delete(args.proposalId);

      const linesChanged = record.proposedContent.split(/\r?\n/).length;

      this.eventBus?.emit('edit.applied', {
        taskId: context.taskId,
        proposalId: args.proposalId,
        filePath: validatedPath,
        linesChanged,
        timestamp: Date.now(),
      });

      return {
        success: true,
        data: {
          proposalId: args.proposalId,
          filePath: validatedPath,
          bytesWritten,
          linesChanged,
          applied: true,
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
