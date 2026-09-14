import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  EventBus,
  ModelGateway,
  MockModelProvider,
  InMemoryVirtualDocStore,
  ContextEngine,
  WorkspaceDiscovery,
  ToolExecutor,
  ReadFileTool,
  SearchCodeTool,
  ListDirectoryTool,
  RunTestsTool,
  RipgrepSearchService,
  Planner,
  EditSetManager,
  VerificationEngine,
  AgentOrchestrator,
  Plan,
  EditSet,
  EditApprovalDecision,
  IDiagnosticsProvider,
  Diagnostic,
  TaskCheckpointManager,
  IGitService,
  GitFileState,
} from '@jaggu/core';

class MockLspDiagnosticsProvider implements IDiagnosticsProvider {
  public diagnostics: Diagnostic[] = [];

  public async getDiagnostics(_files: string[]): Promise<Diagnostic[]> {
    return this.diagnostics;
  }
}

class MockGitBaselineService implements IGitService {
  constructor(public dirtyStatus: Record<string, GitFileState> = {}) {}

  public async isGitRepository(_dir: string): Promise<boolean> {
    return true;
  }
  public async getBranch(_dir: string): Promise<string> {
    return 'main';
  }
  public async getHeadCommit(_dir: string): Promise<string> {
    return 'c0ffee123456';
  }
  public async getStatus(_dir: string): Promise<Record<string, GitFileState>> {
    return this.dirtyStatus;
  }
}

describe('M6 Code Intelligence, Git Safety & Developer Feedback (Full Vertical Slice)', () => {
  let tmpDir: string;
  let eventBus: EventBus;
  let docStore: InMemoryVirtualDocStore;
  let toolExecutor: ToolExecutor;
  let contextEngine: ContextEngine;
  let editSetManager: EditSetManager;
  let verificationEngine: VerificationEngine;
  let mockGitService: MockGitBaselineService;
  let taskCheckpointManager: TaskCheckpointManager;
  let diagnosticsProvider: MockLspDiagnosticsProvider;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jaggu-m6-slice-'));
    fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'test'), { recursive: true });

    // Mock package.json test script
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({
        name: 'm6-fixture',
        scripts: { test: 'node -e "console.log(\\"rate limiting tests pass\\")"' },
      }),
      'utf8',
    );

    eventBus = new EventBus();
    docStore = new InMemoryVirtualDocStore();

    toolExecutor = new ToolExecutor({ eventBus });
    toolExecutor.registerTool(new ReadFileTool());
    toolExecutor.registerTool(new SearchCodeTool(new RipgrepSearchService()));
    toolExecutor.registerTool(new ListDirectoryTool());
    toolExecutor.registerTool(new RunTestsTool());

    const discovery = new WorkspaceDiscovery([tmpDir]);
    contextEngine = new ContextEngine(discovery);

    editSetManager = new EditSetManager(docStore, eventBus, [tmpDir]);
    verificationEngine = new VerificationEngine({
      toolExecutor,
      eventBus,
      workspaceRoots: [tmpDir],
    });

    mockGitService = new MockGitBaselineService({
      'src/auth.ts': {
        relativePath: 'src/auth.ts',
        staged: false,
        unstaged: true,
        untracked: false,
        isNew: false,
        isDeleted: false,
      },
    });

    taskCheckpointManager = new TaskCheckpointManager({
      gitService: mockGitService,
      workspaceRoots: [tmpDir],
    });

    diagnosticsProvider = new MockLspDiagnosticsProvider();
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('executes target demo: understand -> plan -> checkpoint -> 3-file proposal -> selective approval (reject 1) -> apply -> LSP diagnostic error -> diagnose -> repair -> tests pass -> commit suggestion', async () => {
    // 1. Setup workspace with pre-existing user modification in auth.ts
    const authFile = path.join(tmpDir, 'src', 'auth.ts');
    const configFile = path.join(tmpDir, 'src', 'config.ts');
    const limiterFile = path.join(tmpDir, 'src', 'limiter.ts');

    fs.writeFileSync(authFile, '// User pre-existing WIP changes\nexport const auth = true;\n', 'utf8');
    fs.writeFileSync(configFile, 'export const config = { port: 3000 };\n', 'utf8');

    // 2. Mock model responses for planning, initial 3-file edit proposal, and diagnostic repair
    // Turn 1: Valid Plan
    const planJson = JSON.stringify({
      id: 'plan_rate_limiting',
      goal: 'Add authentication rate limiting and tests',
      assumptions: ['In-memory sliding window limiter'],
      steps: [
        {
          id: 'step_1',
          description: 'Add rate limiting to auth and create limiter module',
          files: ['src/auth.ts', 'src/config.ts'],
          newFiles: ['src/limiter.ts'],
          dependencies: [],
          expectedOutcome: 'Rate limiting active',
          verification: 'npm test',
        },
      ],
      risks: ['Type errors in limiter'],
      verification: ['npm test'],
    });

    // Turn 2: Proposed 3 files (auth.ts, limiter.ts with initial bug, and unwanted config.ts)
    const proposedEditsJson = JSON.stringify([
      {
        relativePath: 'src/auth.ts',
        proposedContent: '// User pre-existing WIP changes\nimport { checkRateLimit } from "./limiter.js";\nexport const auth = checkRateLimit();\n',
        isNewFile: false,
      },
      {
        relativePath: 'src/limiter.ts',
        proposedContent: 'export function checkRateLimit(): boolean { return invalidTypeVar; }\n',
        isNewFile: true,
      },
      {
        relativePath: 'src/config.ts',
        proposedContent: 'export const config = { port: 9999, unwanted: true };\n',
        isNewFile: false,
      },
    ]);

    // Turn 3: Diagnostic corrective change for limiter.ts
    const repairEditsJson = JSON.stringify([
      {
        relativePath: 'src/limiter.ts',
        proposedContent: 'export function checkRateLimit(): boolean { return true; }\n',
        isNewFile: false,
      },
    ]);

    const mockProvider = new MockModelProvider({
      turns: [
        { textResponse: planJson },
        { textResponse: proposedEditsJson },
        { textResponse: repairEditsJson },
      ],
    });

    const modelGateway = new ModelGateway();
    modelGateway.registerProvider(mockProvider);

    const planner = new Planner({
      modelGateway,
      eventBus,
      workspaceRoots: [tmpDir],
    });

    let planApproved = false;
    let selectiveApprovalDone = false;
    let repairApproved = false;
    let capturedBaseline: any = null;

    const orchestrator = new AgentOrchestrator({
      modelGateway,
      toolExecutor,
      editSetManager,
      verificationEngine,
      planner,
      contextEngine,
      eventBus,
      workspaceRoots: [tmpDir],
      diagnosticsProvider,
      taskCheckpointManager,
      onRequestPlanApproval: async (plan: Plan) => {
        expect(plan.id).toBe('plan_rate_limiting');
        planApproved = true;
        return true;
      },
      onRequestEditApproval: async (editSet: EditSet): Promise<boolean | EditApprovalDecision> => {
        if (!selectiveApprovalDone) {
          selectiveApprovalDone = true;
          expect(editSet.files).toHaveLength(3);

          // SIMULATE SELECTIVE / PARTIAL APPROVAL:
          // User approves src/auth.ts and src/limiter.ts, but REJECTS src/config.ts!
          const approvedFiles = ['src/auth.ts', 'src/limiter.ts'];
          const rejectedFiles = ['src/config.ts'];

          // Simulate language server reporting diagnostic error on limiter.ts right after initial apply
          diagnosticsProvider.diagnostics = [
            {
              file: 'src/limiter.ts',
              severity: 'error',
              message: "Cannot find name 'invalidTypeVar'",
              line: 1,
              column: 45,
              source: 'typescript',
            },
          ];

          return {
            approved: true,
            approvedFiles,
            rejectedFiles,
          };
        } else {
          // Diagnostic repair approval for limiter.ts
          repairApproved = true;
          expect(editSet.files).toHaveLength(1);
          expect(editSet.files[0]?.relativePath).toBe('src/limiter.ts');

          // Once repair is approved and applied, diagnostics settle clean
          diagnosticsProvider.diagnostics = [];

          return {
            approved: true,
            approvedFiles: ['src/limiter.ts'],
          };
        }
      },
    });

    const result = await orchestrator.executeTask('Add authentication rate limiting and tests');

    // VERIFICATIONS
    expect(result.success).toBe(true);
    expect(planApproved).toBe(true);
    expect(selectiveApprovalDone).toBe(true);
    expect(repairApproved).toBe(true);
    expect(result.repairCount).toBe(1);

    // 1. Check applied vs rejected files
    expect(result.appliedFiles).toContain('src/auth.ts');
    expect(result.appliedFiles).toContain('src/limiter.ts');
    expect(result.appliedFiles).not.toContain('src/config.ts');
    expect(result.rejectedFiles).toEqual(['src/config.ts']);

    // 2. Verify disk state:
    // - auth.ts was modified and retained the user's WIP comment
    const finalAuth = fs.readFileSync(authFile, 'utf8');
    expect(finalAuth).toContain('// User pre-existing WIP changes');
    expect(finalAuth).toContain('import { checkRateLimit }');

    // - limiter.ts has the corrected code
    const finalLimiter = fs.readFileSync(limiterFile, 'utf8');
    expect(finalLimiter).toBe('export function checkRateLimit(): boolean { return true; }\n');

    // - config.ts was REJECTED: must NEVER be modified on disk!
    const finalConfig = fs.readFileSync(configFile, 'utf8');
    expect(finalConfig).toBe('export const config = { port: 3000 };\n');
    expect(finalConfig).not.toContain('port: 9999');

    // 3. Verify Git Checkpoint Baseline & Attribution
    expect(result.baseline).toBeDefined();
    expect(result.baseline?.dirtyFiles['src/auth.ts']).toBeDefined();

    expect(result.taskGitSummary).toBeDefined();
    expect(result.taskGitSummary?.preExistingModifiedFiles).toContain('src/auth.ts');
    expect(result.taskGitSummary?.jagguModifiedFiles).toContain('src/limiter.ts');
    expect(result.taskGitSummary?.jagguModifiedFiles).not.toContain('src/auth.ts');

    // 4. Verify Suggested Commit Message
    expect(result.suggestedCommitMessage).toBe('feat(auth): authentication rate limiting and tests');

    // 5. Verify Diagnostics Summary
    expect(result.diagnosticsSummary?.status).toBe('CLEAN');
    expect(result.diagnosticsSummary?.errorCount).toBe(0);
  });
});
