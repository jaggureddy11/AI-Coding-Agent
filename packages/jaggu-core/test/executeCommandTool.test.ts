import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ExecuteCommandTool } from '../src/tools/builtin/executeCommandTool.js';
import { IToolExecutionContext } from '../src/types/tools.js';

describe('ExecuteCommandTool', () => {
  let tmpWorkspace: string;
  let abortController: AbortController;
  let context: IToolExecutionContext;
  let tool: ExecuteCommandTool;

  beforeEach(() => {
    tmpWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), 'jaggu-exec-test-'));
    abortController = new AbortController();
    context = {
      taskId: 'task_exec_test',
      workspaceRoot: tmpWorkspace,
      workspaceRoots: [tmpWorkspace],
      abortSignal: abortController.signal,
    };
    tool = new ExecuteCommandTool();
  });

  afterEach(() => {
    fs.rmSync(tmpWorkspace, { recursive: true, force: true });
  });

  it('exposes a valid model tool definition', () => {
    const def = tool.toModelToolDefinition();
    expect(def.name).toBe('execute_command');
    expect(def.description).toContain('git');
    expect(def.parameters.properties).toHaveProperty('command');
  });

  it('successfully executes a command in the workspace', async () => {
    const result = await tool.execute(
      { command: 'node -e "console.log(\'hello from jaggu\')"' },
      context,
    );

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.exitCode).toBe(0);
    expect(result.data?.stdout).toContain('hello from jaggu');
    expect(result.executionDurationMs).toBeGreaterThanOrEqual(0);
  });

  it('handles non-zero exit code gracefully', async () => {
    const result = await tool.execute(
      { command: 'node -e "process.exit(42)"' },
      context,
    );

    expect(result.success).toBe(false);
    expect(result.data?.exitCode).toBe(42);
    expect(result.error).toContain('42');
  });

  it('blocks dangerous system-destructive commands (e.g. rm -rf /)', async () => {
    const result = await tool.execute(
      { command: 'rm -rf /' },
      context,
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Security violation: command contains prohibited pattern');
  });

  it('blocks privilege escalation with sudo', async () => {
    const result = await tool.execute(
      { command: 'sudo apt-get update' },
      context,
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Security violation');
  });

  it('blocks path traversal outside workspace directory', async () => {
    const result = await tool.execute(
      { command: 'ls', cwd: '../../../../etc' },
      context,
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid working directory');
  });

  it('executes in subdirectories when valid within workspace', async () => {
    const subDir = path.join(tmpWorkspace, 'subdir');
    fs.mkdirSync(subDir);
    fs.writeFileSync(path.join(subDir, 'marker.txt'), 'inside-subdir');

    const result = await tool.execute(
      { command: 'cat marker.txt', cwd: 'subdir' },
      context,
    );

    expect(result.success).toBe(true);
    expect(result.data?.stdout).toContain('inside-subdir');
  });

  it('executes real git workflows (git init, add, commit, status)', async () => {
    // 1. git init
    const initRes = await tool.execute({ command: 'git init' }, context);
    expect(initRes.success).toBe(true);

    // Config user for commit in temp repo
    await tool.execute({ command: 'git config user.email "test@example.com"' }, context);
    await tool.execute({ command: 'git config user.name "Test User"' }, context);

    // 2. create a file and git add
    fs.writeFileSync(path.join(tmpWorkspace, 'README.md'), '# Test Project');
    const addRes = await tool.execute({ command: 'git add README.md' }, context);
    expect(addRes.success).toBe(true);

    // 3. git commit
    const commitRes = await tool.execute(
      { command: 'git commit -m "feat: initial commit"' },
      context,
    );
    expect(commitRes.success).toBe(true);
    expect(commitRes.data?.stdout).toContain('initial commit');

    // 4. git status
    const statusRes = await tool.execute({ command: 'git status' }, context);
    expect(statusRes.success).toBe(true);
    expect(statusRes.data?.stdout).toMatch(/working tree clean|nothing to commit/i);
  });

  it('respects abort signal cancellation', async () => {
    const promise = tool.execute(
      { command: 'node -e "setTimeout(() => {}, 5000)"' },
      context,
    );

    setTimeout(() => {
      abortController.abort();
    }, 50);

    const result = await promise;
    expect(result.success).toBe(false);
    expect(result.error).toContain('cancelled');
  });
});
