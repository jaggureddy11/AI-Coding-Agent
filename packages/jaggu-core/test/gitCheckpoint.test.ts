import { describe, it, expect } from 'vitest';
import { GitCliService, IGitService } from '../src/git/gitService.js';
import { TaskCheckpointManager } from '../src/git/taskCheckpointManager.js';
import { GitFileState, TaskGitBaseline } from '../src/types/git.js';

class MockGitService implements IGitService {
  constructor(
    private isRepo = true,
    private branch = 'main',
    private headCommit = 'a1b2c3d4e5f6',
    private status: Record<string, GitFileState> = {},
  ) {}

  public async isGitRepository(_dir: string): Promise<boolean> {
    return this.isRepo;
  }
  public async getBranch(_dir: string): Promise<string> {
    return this.branch;
  }
  public async getHeadCommit(_dir: string): Promise<string> {
    return this.headCommit;
  }
  public async getStatus(_dir: string): Promise<Record<string, GitFileState>> {
    return this.status;
  }
}

describe('Git-Aware Task Checkpoints & User Change Preservation (M6 Pillar 2)', () => {
  describe('GitCliService Security Constraints', () => {
    it('should strictly reject forbidden mutating verbs with security violation error', async () => {
      const gitService = new GitCliService();
      const forbiddenVerbs = ['commit', 'push', 'reset', 'checkout', 'clean', 'rebase', 'stash'];

      for (const verb of forbiddenVerbs) {
        await expect(gitService.runGitQuery(process.cwd(), [verb])).rejects.toThrow(
          /Security violation: GitCliService disallows destructive\/mutating verb/i,
        );
      }
    });

    it('should disallow path traversal sequences in git queries', async () => {
      const gitService = new GitCliService();
      await expect(
        gitService.runGitQuery(process.cwd(), ['status', '../../etc/passwd']),
      ).rejects.toThrow(/Security violation: Argument contains path traversal/i);
    });
  });

  describe('TaskCheckpointManager Baseline & Attribution', () => {
    it('should capture baseline on a dirty repository and record pre-existing dirty files', async () => {
      const mockGit = new MockGitService(true, 'feature/rate-limit', 'abc1234', {
        'src/auth.ts': {
          relativePath: 'src/auth.ts',
          staged: false,
          unstaged: true,
          untracked: false,
          isNew: false,
          isDeleted: false,
        },
      });

      const manager = new TaskCheckpointManager({
        gitService: mockGit,
        workspaceRoots: ['/dummy/workspace'],
      });

      const baseline = await manager.captureBaseline('task_100');
      expect(baseline.taskId).toBe('task_100');
      expect(baseline.branch).toBe('feature/rate-limit');
      expect(baseline.headCommit).toBe('abc1234');
      expect(baseline.dirtyFiles['src/auth.ts']).toBeDefined();
    });

    it('should detect pre-existing user modifications when plan targets dirty files', () => {
      const baseline: TaskGitBaseline = {
        taskId: 'task_100',
        branch: 'main',
        headCommit: 'abc1234',
        dirtyFiles: {
          'src/auth.ts': {
            relativePath: 'src/auth.ts',
            staged: false,
            unstaged: true,
            untracked: false,
            isNew: false,
            isDeleted: false,
          },
        },
        capturedAt: Date.now(),
      };

      const manager = new TaskCheckpointManager({
        workspaceRoots: ['/dummy/workspace'],
      });

      const plannedFiles = ['src/auth.ts', 'src/limiter.ts'];
      const detection = manager.detectPreExistingModifications(plannedFiles, baseline);

      expect(detection.hasPreExistingChanges).toBe(true);
      expect(detection.preExistingFiles).toEqual(['src/auth.ts']);
    });

    it('should calculate task summary isolating JAGGU changes from user changes', () => {
      const baseline: TaskGitBaseline = {
        taskId: 'task_100',
        branch: 'main',
        headCommit: 'abc1234',
        dirtyFiles: {
          'src/auth.ts': {
            relativePath: 'src/auth.ts',
            staged: false,
            unstaged: true,
            untracked: false,
            isNew: false,
            isDeleted: false,
          },
        },
        capturedAt: Date.now(),
      };

      const manager = new TaskCheckpointManager({
        workspaceRoots: ['/dummy/workspace'],
      });

      const appliedFiles = ['src/auth.ts', 'src/limiter.ts'];
      const summary = manager.calculateTaskSummary(baseline, appliedFiles);

      expect(summary.preExistingModifiedFiles).toContain('src/auth.ts');
      expect(summary.jagguModifiedFiles).toContain('src/limiter.ts');
      expect(summary.jagguModifiedFiles).not.toContain('src/auth.ts');
    });

    it('should synthesize Conventional Commit suggestions without performing any git mutation', () => {
      const manager = new TaskCheckpointManager({
        workspaceRoots: ['/dummy/workspace'],
      });

      const featMsg = manager.generateSuggestedCommitMessage(
        'Add authentication rate limiting and tests',
        ['src/auth/limiter.ts', 'src/auth/limiter.test.ts'],
      );
      expect(featMsg).toBe('feat(auth): authentication rate limiting and tests');

      const fixMsg = manager.generateSuggestedCommitMessage(
        'Fix token validation expiration bug',
        ['src/auth/token.ts'],
      );
      expect(fixMsg).toBe('fix(auth): token validation expiration bug');
    });
  });
});
