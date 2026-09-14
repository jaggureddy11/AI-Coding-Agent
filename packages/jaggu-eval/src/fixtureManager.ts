import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { execFileSync } from 'child_process';

export interface PreparedFixture {
  workspaceRoot: string;
  originalSnapshots: Map<string, string>; // relativePath -> file content
  cleanup: () => void;
}

export class FixtureManager {
  private readonly fixturesBaseDir: string;

  constructor(fixturesBaseDir?: string) {
    if (fixturesBaseDir) {
      this.fixturesBaseDir = fixturesBaseDir;
    } else {
      const localCandidate = path.resolve(process.cwd(), 'fixtures');
      const rootCandidate = path.resolve(process.cwd(), 'packages/jaggu-eval/fixtures');
      this.fixturesBaseDir = fs.existsSync(localCandidate) ? localCandidate : rootCandidate;
    }
  }

  public prepareWorkspace(
    fixtureDirName: string,
    options: {
      requiresGit?: boolean;
      preExistingDirtyFiles?: string[];
    } = {},
  ): PreparedFixture {
    const sourceDir = path.join(this.fixturesBaseDir, fixtureDirName);
    if (!fs.existsSync(sourceDir)) {
      throw new Error(`Fixture source directory not found: ${sourceDir}`);
    }

    const tempDir = path.join(
      os.tmpdir(),
      `jaggu-eval-${fixtureDirName}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
    );
    fs.mkdirSync(tempDir, { recursive: true });

    // Recursively copy fixture files into sandboxed tempDir
    this.copyRecursive(sourceDir, tempDir);

    // Initialize Git if required
    if (options.requiresGit) {
      try {
        execFileSync('git', ['init'], { cwd: tempDir, stdio: 'ignore' });
        execFileSync('git', ['config', 'user.name', 'Jaggu Evaluator'], { cwd: tempDir, stdio: 'ignore' });
        execFileSync('git', ['config', 'user.email', 'eval@jaggu.local'], { cwd: tempDir, stdio: 'ignore' });
        execFileSync('git', ['add', '.'], { cwd: tempDir, stdio: 'ignore' });
        execFileSync('git', ['commit', '-m', 'Initial baseline commit'], { cwd: tempDir, stdio: 'ignore' });
      } catch (err) {
        throw new Error(`Failed to initialize git repository in fixture sandbox: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // Apply pre-existing dirty modifications if requested
    const originalSnapshots = new Map<string, string>();
    if (options.preExistingDirtyFiles) {
      for (const relPath of options.preExistingDirtyFiles) {
        const fullPath = path.join(tempDir, relPath);
        if (fs.existsSync(fullPath)) {
          // Read content to snapshot
          const content = fs.readFileSync(fullPath, 'utf-8');
          originalSnapshots.set(relPath, content);
        }
      }
    }

    const cleanup = () => {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // ignore cleanup errors
      }
    };

    return {
      workspaceRoot: tempDir,
      originalSnapshots,
      cleanup,
    };
  }

  public verifyUserChangesPreserved(
    workspaceRoot: string,
    dirtyFiles: string[],
    snapshots: Map<string, string>,
  ): { preserved: boolean; violatedFiles: string[] } {
    const violatedFiles: string[] = [];
    for (const relPath of dirtyFiles) {
      const fullPath = path.join(workspaceRoot, relPath);
      if (!fs.existsSync(fullPath)) {
        violatedFiles.push(relPath);
        continue;
      }
      const currentContent = fs.readFileSync(fullPath, 'utf-8');
      const expectedContent = snapshots.get(relPath);
      if (expectedContent !== undefined && currentContent !== expectedContent) {
        violatedFiles.push(relPath);
      }
    }
    return {
      preserved: violatedFiles.length === 0,
      violatedFiles,
    };
  }

  private copyRecursive(src: string, dest: string): void {
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        fs.mkdirSync(destPath, { recursive: true });
        this.copyRecursive(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
}
