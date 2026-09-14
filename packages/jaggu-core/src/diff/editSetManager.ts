import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { IVirtualDocStore } from './virtualDocStore.js';
import { EventBus } from '../events/eventBus.js';
import { EditSet, ProposedFileEdit, EditSetApplyResult } from '../types/editSet.js';
import { resolveAndValidateWorkspacePath } from '../tools/security.js';

export interface CreateEditFileInput {
  relativePath: string;
  proposedContent: string;
  isNewFile?: boolean;
}

export class EditSetManager {
  private readonly editSets = new Map<string, EditSet>();

  constructor(
    private readonly docStore: IVirtualDocStore,
    private readonly eventBus: EventBus,
    private readonly workspaceRoots: string[],
  ) {}

  /**
   * Creates a multi-file EditSet staged non-destructively in the virtual doc store.
   */
  public createEditSet(
    files: CreateEditFileInput[],
    planId?: string,
  ): { success: boolean; editSet?: EditSet; error?: string } {
    if (!files || files.length === 0) {
      return { success: false, error: 'Cannot create an empty EditSet' };
    }

    const id = `editset_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const proposedFiles: ProposedFileEdit[] = [];

    for (const fileInput of files) {
      try {
        const absolutePath = resolveAndValidateWorkspacePath(fileInput.relativePath, this.workspaceRoots);
        const exists = fs.existsSync(absolutePath);
        const isNew = fileInput.isNewFile ?? !exists;

        let originalContent = '';
        let baseContentHash = '';

        if (exists) {
          originalContent = fs.readFileSync(absolutePath, 'utf-8');
          baseContentHash = crypto.createHash('sha256').update(originalContent, 'utf-8').digest('hex');
        } else {
          baseContentHash = crypto.createHash('sha256').update('', 'utf-8').digest('hex');
        }

        const shadowUri = `jaggu-shadow://${absolutePath}`;

        // Stage into virtual doc store
        this.docStore.set(shadowUri, originalContent, fileInput.proposedContent);

        proposedFiles.push({
          relativePath: fileInput.relativePath,
          absolutePath,
          originalContent,
          proposedContent: fileInput.proposedContent,
          baseContentHash,
          isNewFile: isNew,
          shadowUri,
          status: 'PENDING',
        });
      } catch (err) {
        // Evict any already staged files in this batch
        for (const staged of proposedFiles) {
          this.docStore.delete(staged.shadowUri);
        }
        return {
          success: false,
          error: `Failed to stage file "${fileInput.relativePath}": ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    }

    const editSet: EditSet = {
      id,
      planId,
      files: proposedFiles,
      status: 'PROPOSED',
      createdAt: Date.now(),
    };

    this.editSets.set(id, editSet);

    this.eventBus.emit('editset.created', {
      editSetId: id,
      planId,
      fileCount: proposedFiles.length,
      files: proposedFiles.map((f) => f.relativePath),
      timestamp: Date.now(),
    });

    this.eventBus.emit('editset.review_requested', {
      editSetId: id,
      files: proposedFiles.map((f) => ({
        relativePath: f.relativePath,
        shadowUri: f.shadowUri,
        isNew: f.isNewFile,
      })),
      timestamp: Date.now(),
    });

    return { success: true, editSet };
  }

  public getEditSet(id: string): EditSet | undefined {
    return this.editSets.get(id);
  }

  /**
   * Rejects an EditSet and evicts its virtual documents.
   */
  public rejectEditSet(id: string, reason?: string): boolean {
    const editSet = this.editSets.get(id);
    if (!editSet) return false;

    editSet.status = 'REJECTED';
    for (const f of editSet.files) {
      this.docStore.delete(f.shadowUri);
    }

    this.eventBus.emit('editset.rejected', {
      editSetId: id,
      reason,
      timestamp: Date.now(),
    });

    return true;
  }

  /**
   * Atomically applies an approved EditSet.
   * Supports selective partial file approval via approvedFilesFilter.
   * Enforces SHA-256 pre-validation across approved files.
   * If any file fails validation or has changed on disk, rejects without writing anything.
   */
  public applyEditSet(id: string, approved: boolean, approvedFilesFilter?: string[]): EditSetApplyResult {
    const editSet = this.editSets.get(id);
    if (!editSet) {
      return { success: false, editSetId: id, appliedFiles: [], error: `EditSet "${id}" not found` };
    }

    if (!approved) {
      return { success: false, editSetId: id, appliedFiles: [], error: 'EditSet requires explicit user approval before apply' };
    }

    if (editSet.status !== 'PROPOSED') {
      return { success: false, editSetId: id, appliedFiles: [], error: `EditSet is in status "${editSet.status}", cannot apply` };
    }

    // Determine target files based on selective approval filter
    let filesToApply = editSet.files;
    const rejectedFiles: string[] = [];

    if (approvedFilesFilter) {
      const approvedSet = new Set(approvedFilesFilter);
      filesToApply = [];
      for (const f of editSet.files) {
        if (approvedSet.has(f.relativePath)) {
          f.status = 'APPROVED';
          filesToApply.push(f);
        } else {
          f.status = 'REJECTED';
          rejectedFiles.push(f.relativePath);
          // Delete virtual shadow document for rejected file so memory stays clean
          this.docStore.delete(f.shadowUri);
        }
      }
    } else {
      for (const f of editSet.files) {
        f.status = 'APPROVED';
      }
    }

    if (filesToApply.length === 0) {
      editSet.status = 'REJECTED';
      this.eventBus.emit('editset.rejected', {
        editSetId: id,
        reason: 'All proposed files were excluded or rejected by user',
        timestamp: Date.now(),
      });
      return {
        success: false,
        editSetId: id,
        appliedFiles: [],
        rejectedFiles,
        error: 'No files were approved for application in this EditSet',
      };
    }

    // --- PHASE 1: PRE-VALIDATION ACROSS ALL APPROVED FILES ---
    for (const f of filesToApply) {
      // 1. Re-validate workspace containment
      try {
        resolveAndValidateWorkspacePath(f.relativePath, this.workspaceRoots);
      } catch (err) {
        editSet.status = 'CONFLICT';
        this.eventBus.emit('editset.conflict', {
          editSetId: id,
          conflictedFile: f.relativePath,
          reason: `Security validation failed: ${err instanceof Error ? err.message : String(err)}`,
          timestamp: Date.now(),
        });
        return {
          success: false,
          editSetId: id,
          appliedFiles: [],
          rejectedFiles,
          failedFile: f.relativePath,
          error: `Security boundary validation failed for "${f.relativePath}"`,
        };
      }

      // 2. Base Hash Verification
      if (f.isNewFile) {
        if (fs.existsSync(f.absolutePath)) {
          editSet.status = 'CONFLICT';
          this.eventBus.emit('editset.conflict', {
            editSetId: id,
            conflictedFile: f.relativePath,
            reason: 'File declared as new already exists on disk',
            timestamp: Date.now(),
          });
          return {
            success: false,
            editSetId: id,
            appliedFiles: [],
            rejectedFiles,
            failedFile: f.relativePath,
            error: `File declared as new already exists on disk: "${f.relativePath}"`,
          };
        }
      } else {
        if (!fs.existsSync(f.absolutePath)) {
          editSet.status = 'CONFLICT';
          this.eventBus.emit('editset.conflict', {
            editSetId: id,
            conflictedFile: f.relativePath,
            reason: 'Target file was deleted on disk since proposal was created',
            timestamp: Date.now(),
          });
          return {
            success: false,
            editSetId: id,
            appliedFiles: [],
            rejectedFiles,
            failedFile: f.relativePath,
            error: `Target file was deleted on disk: "${f.relativePath}"`,
          };
        }

        const currentDiskContent = fs.readFileSync(f.absolutePath, 'utf-8');
        const currentHash = crypto.createHash('sha256').update(currentDiskContent, 'utf-8').digest('hex');

        if (currentHash !== f.baseContentHash) {
          editSet.status = 'CONFLICT';
          this.eventBus.emit('editset.conflict', {
            editSetId: id,
            conflictedFile: f.relativePath,
            reason: 'File content on disk has changed since proposal was generated',
            timestamp: Date.now(),
          });
          return {
            success: false,
            editSetId: id,
            appliedFiles: [],
            rejectedFiles,
            failedFile: f.relativePath,
            error: `Conflict detected on file "${f.relativePath}": disk contents modified since proposal`,
          };
        }
      }
    }

    // --- PHASE 2: WRITE WITH ROLLBACK RECOVERY ---
    const writtenFiles: { path: string; isNew: boolean; originalContent: string }[] = [];

    for (const f of filesToApply) {
      try {
        const dir = path.dirname(f.absolutePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(f.absolutePath, f.proposedContent, 'utf-8');
        writtenFiles.push({
          path: f.absolutePath,
          isNew: f.isNewFile,
          originalContent: f.originalContent,
        });
      } catch (err) {
        // Rollback all files written so far in this set
        for (const w of writtenFiles) {
          try {
            if (w.isNew) {
              if (fs.existsSync(w.path)) {
                fs.unlinkSync(w.path);
              }
            } else {
              fs.writeFileSync(w.path, w.originalContent, 'utf-8');
            }
          } catch {
            // Best-effort rollback
          }
        }

        editSet.status = 'CONFLICT';
        return {
          success: false,
          editSetId: id,
          appliedFiles: [],
          rejectedFiles,
          failedFile: f.relativePath,
          error: `I/O error applying changes to "${f.relativePath}": ${err instanceof Error ? err.message : String(err)}`,
          rolledBack: true,
        };
      }
    }

    // Clean up virtual doc store for applied files
    for (const f of filesToApply) {
      f.status = 'APPLIED';
      this.docStore.delete(f.shadowUri);
    }

    editSet.status = 'APPLIED';

    this.eventBus.emit('editset.applied', {
      editSetId: id,
      appliedCount: filesToApply.length,
      files: filesToApply.map((f) => f.relativePath),
      timestamp: Date.now(),
    });

    return {
      success: true,
      editSetId: id,
      appliedFiles: filesToApply.map((f) => f.relativePath),
      rejectedFiles,
    };
  }
}
