import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { IGitService, GitCliService } from './gitService.js';
import { TaskGitBaseline, TaskGitDiffSummary } from '../types/git.js';

export interface TaskCheckpointManagerOptions {
  gitService?: IGitService;
  workspaceRoots: string[];
}

export class TaskCheckpointManager {
  private gitService: IGitService;
  private workspaceRoots: string[];
  private baselines: Map<string, TaskGitBaseline> = new Map();

  constructor(options: TaskCheckpointManagerOptions) {
    this.gitService = options.gitService || new GitCliService();
    this.workspaceRoots = options.workspaceRoots;
  }

  /**
   * Capture a pristine baseline of git status before any mutations begin for a task.
   */
  public async captureBaseline(taskId: string): Promise<TaskGitBaseline> {
    const primaryRoot = this.workspaceRoots[0];
    if (!primaryRoot) {
      const emptyBaseline: TaskGitBaseline = {
        taskId,
        branch: 'unknown',
        headCommit: 'uncommitted',
        dirtyFiles: {},
        capturedAt: Date.now(),
      };
      this.baselines.set(taskId, emptyBaseline);
      return emptyBaseline;
    }

    const isRepo = await this.gitService.isGitRepository(primaryRoot);
    if (!isRepo) {
      const nonGitBaseline: TaskGitBaseline = {
        taskId,
        branch: 'non-git',
        headCommit: 'none',
        dirtyFiles: {},
        capturedAt: Date.now(),
      };
      this.baselines.set(taskId, nonGitBaseline);
      return nonGitBaseline;
    }

    const [branch, headCommit, statusMap] = await Promise.all([
      this.gitService.getBranch(primaryRoot),
      this.gitService.getHeadCommit(primaryRoot),
      this.gitService.getStatus(primaryRoot),
    ]);

    // Pre-calculate SHA-256 for all existing dirty files to record their exact pre-task baseline
    for (const [relPath, fileState] of Object.entries(statusMap)) {
      if (!fileState.isDeleted) {
        const fullPath = path.join(primaryRoot, relPath);
        if (fs.existsSync(fullPath)) {
          try {
            const content = fs.readFileSync(fullPath);
            fileState.preExistingSha256 = crypto.createHash('sha256').update(content).digest('hex');
          } catch {
            // Ignore file read error
          }
        }
      }
    }

    const baseline: TaskGitBaseline = {
      taskId,
      branch,
      headCommit,
      dirtyFiles: statusMap,
      capturedAt: Date.now(),
    };

    this.baselines.set(taskId, baseline);
    return baseline;
  }

  public getBaseline(taskId: string): TaskGitBaseline | undefined {
    return this.baselines.get(taskId);
  }

  /**
   * Check if any files targeted by the agent plan had pre-existing user modifications.
   */
  public detectPreExistingModifications(
    targetFiles: string[],
    baseline: TaskGitBaseline,
  ): { hasPreExistingChanges: boolean; preExistingFiles: string[] } {
    const preExistingFiles: string[] = [];

    for (const file of targetFiles) {
      const norm = path.normalize(file);
      if (baseline.dirtyFiles[norm]) {
        preExistingFiles.push(norm);
      }
    }

    return {
      hasPreExistingChanges: preExistingFiles.length > 0,
      preExistingFiles,
    };
  }

  /**
   * Compare applied task files against initial baseline to isolate JAGGU modifications
   * from pre-existing user work.
   */
  public calculateTaskSummary(
    baseline: TaskGitBaseline,
    appliedFiles: string[],
  ): TaskGitDiffSummary {
    const preExistingModifiedFiles: string[] = [];
    const jagguModifiedFiles: string[] = [];

    for (const file of appliedFiles) {
      const norm = path.normalize(file);
      if (baseline.dirtyFiles[norm]) {
        preExistingModifiedFiles.push(norm);
      } else {
        jagguModifiedFiles.push(norm);
      }
    }

    return {
      preExistingModifiedFiles,
      jagguModifiedFiles,
      cleanFiles: [],
    };
  }

  /**
   * Synthesize a Conventional Commit message suggestion based on task goal and modified files.
   * NOTE: This only generates a suggestion string; it NEVER executes git commit.
   */
  public generateSuggestedCommitMessage(taskGoal: string, appliedFiles: string[]): string {
    const normalizedGoal = taskGoal.trim();
    // Infer scope from common path directory
    let scope = '';
    if (appliedFiles.length > 0 && appliedFiles[0]) {
      const parts = appliedFiles[0].split(path.sep);
      if (parts.length > 1 && parts[0] === 'src') {
        scope = parts[1]?.replace(/\.[^.]+$/, '') || '';
      } else if (parts.length > 1) {
        scope = parts[0]?.replace(/\.[^.]+$/, '') || '';
      }
    }

    // Infer type prefix
    const lowerGoal = normalizedGoal.toLowerCase();
    let type = 'feat';
    if (lowerGoal.startsWith('fix') || lowerGoal.includes('bug')) {
      type = 'fix';
    } else if (lowerGoal.startsWith('refactor')) {
      type = 'refactor';
    } else if (lowerGoal.startsWith('test') || lowerGoal.startsWith('add test')) {
      type = 'test';
    } else if (lowerGoal.startsWith('doc')) {
      type = 'docs';
    }

    const cleanGoal = normalizedGoal
      .replace(/^(add|implement|fix|refactor|update|create)\s+/i, '')
      .trim();

    const scopePart = scope ? `(${scope})` : '';
    const subject =
      cleanGoal.length > 0
        ? `${cleanGoal[0]?.toLowerCase()}${cleanGoal.slice(1)}`
        : 'update codebase';

    return `${type}${scopePart}: ${subject}`;
  }
}
