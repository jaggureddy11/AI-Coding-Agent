import { spawn } from 'child_process';
import { GitFileState } from '../types/git.js';

export interface IGitService {
  isGitRepository(cwd: string): Promise<boolean>;
  getBranch(cwd: string): Promise<string>;
  getHeadCommit(cwd: string): Promise<string>;
  getStatus(cwd: string): Promise<Record<string, GitFileState>>;
}

export class GitCliService implements IGitService {
  /**
   * Check if directory is inside a git work tree.
   */
  public async isGitRepository(cwd: string): Promise<boolean> {
    try {
      const { code } = await this.runGit(['rev-parse', '--is-inside-work-tree'], cwd);
      return code === 0;
    } catch {
      return false;
    }
  }

  /**
   * Get current branch name (or 'HEAD' detached).
   */
  public async getBranch(cwd: string): Promise<string> {
    try {
      const { code, stdout } = await this.runGit(['rev-parse', '--abbrev-ref', 'HEAD'], cwd);
      if (code === 0 && stdout.trim()) {
        return stdout.trim();
      }
      return 'HEAD';
    } catch {
      return 'unknown';
    }
  }

  /**
   * Get current HEAD commit hash.
   */
  public async getHeadCommit(cwd: string): Promise<string> {
    try {
      const { code, stdout } = await this.runGit(['rev-parse', 'HEAD'], cwd);
      if (code === 0 && stdout.trim()) {
        return stdout.trim();
      }
      return 'uncommitted';
    } catch {
      return 'uncommitted';
    }
  }

  /**
   * Get parsed porcelain status for working tree using zero-delimited output.
   * Immune to filenames containing spaces or Unicode characters.
   */
  public async getStatus(cwd: string): Promise<Record<string, GitFileState>> {
    const results: Record<string, GitFileState> = {};

    try {
      const { code, stdout } = await this.runGit(['status', '--porcelain=v1', '-z', '-uall'], cwd);
      if (code !== 0 || !stdout) {
        return results;
      }

      // Format of porcelain -z:
      // XY PATH\0 or XY PATH\0ORIG_PATH\0 for renames
      const entries = stdout.split('\0').filter(Boolean);
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        if (!entry || entry.length < 3) continue;

        const x = entry[0];
        const y = entry[1];
        const filePath = entry.substring(3).trim();

        const isUntracked = x === '?' && y === '?';
        const isStaged = x !== ' ' && x !== '?' && x !== '!';
        const isModified = y === 'M' || x === 'M';
        const isDeleted = y === 'D' || x === 'D';

        results[filePath] = {
          relativePath: filePath,
          isStaged,
          isModified,
          isUntracked,
          isDeleted,
        };
      }

      return results;
    } catch {
      return results;
    }
  }

  /**
   * Run a read-only git query with security checks (disallowing mutating verbs & path traversal).
   */
  public async runGitQuery(cwd: string, args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
    for (const arg of args) {
      if (arg.includes('..')) {
        throw new Error(`Security violation: Argument contains path traversal "${arg}"`);
      }
    }
    return this.runGit(args, cwd);
  }

  /**
   * Execute git query command safely without shell expansion.
   */
  private runGit(args: string[], cwd: string): Promise<{ code: number; stdout: string; stderr: string }> {
    // Defense: Disallow any destructive or mutating commands
    const FORBIDDEN_VERBS = [
      'commit',
      'push',
      'reset',
      'checkout',
      'clean',
      'rebase',
      'merge',
      'stash',
      'branch',
      'tag',
      'remote',
    ];

    const verb = args[0]?.toLowerCase() || '';
    if (FORBIDDEN_VERBS.includes(verb)) {
      throw new Error(`Security violation: GitCliService disallows destructive/mutating verb "${verb}"`);
    }

    return new Promise((resolve) => {
      const proc = spawn('git', args, {
        cwd,
        shell: false,
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (c) => (stdout += c.toString('utf8')));
      proc.stderr.on('data', (c) => (stderr += c.toString('utf8')));

      proc.on('close', (code) => {
        resolve({
          code: code ?? 1,
          stdout,
          stderr,
        });
      });

      proc.on('error', () => {
        resolve({
          code: 1,
          stdout: '',
          stderr: 'Failed to spawn git process',
        });
      });
    });
  }
}
