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
  PlanValidator,
  EditSetManager,
  VerificationEngine,
  AgentOrchestrator,
  Plan,
  EditSet,
} from '@jaggu/core';

describe('M5 Full Vertical Slice & Security Integration', () => {
  let tmpDir: string;
  let eventBus: EventBus;
  let docStore: InMemoryVirtualDocStore;
  let toolExecutor: ToolExecutor;
  let contextEngine: ContextEngine;
  let editSetManager: EditSetManager;
  let verificationEngine: VerificationEngine;
  let planValidator: PlanValidator;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jaggu-m5-slice-'));
    fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'test'), { recursive: true });

    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({
        name: 'm5-fixture',
        scripts: { test: 'node -e "console.log(\\"all tests pass\\")"' },
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
    planValidator = new PlanValidator();
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('executes full M5 lifecycle: understand -> plan -> approve plan -> multi-file editset -> approve editset -> atomic apply -> test verification pass -> final summary', async () => {
    // 1. Setup target files
    const authFile = path.join(tmpDir, 'src', 'auth.ts');
    const routesFile = path.join(tmpDir, 'src', 'routes.ts');
    const testFile = path.join(tmpDir, 'test', 'auth.test.ts');

    fs.writeFileSync(authFile, 'export function checkAuth() { return true; }\n', 'utf8');
    fs.writeFileSync(routesFile, 'import { checkAuth } from "./auth.js";\nexport function handleRoute() { return checkAuth(); }\n', 'utf8');
    fs.writeFileSync(testFile, 'console.log("initial tests");\n', 'utf8');

    // 2. Setup mock model provider
    const validPlanJson = JSON.stringify({
      id: 'plan_rate_limiting',
      goal: 'Add rate limiting to authentication routes',
      assumptions: ['Memory cache available'],
      steps: [
        {
          id: 'step_auth',
          description: 'Implement rate limit checker in auth.ts',
          files: ['src/auth.ts'],
          dependencies: [],
          expectedOutcome: 'checkAuth rate limits IPs',
          verification: 'npm test',
          status: 'pending',
        },
        {
          id: 'step_routes',
          description: 'Connect rate limiter to route handler',
          files: ['src/routes.ts'],
          dependencies: ['step_auth'],
          expectedOutcome: 'Route handler handles 429',
          verification: 'npm test',
          status: 'pending',
        },
      ],
      risks: ['Rate limits may throttle test runners'],
      verification: ['npm test'],
    });

    const editSetJson = JSON.stringify({
      files: [
        {
          relativePath: 'src/auth.ts',
          proposedContent: 'export function checkAuth(ip?: string) { if (ip === "blocked") return false; return true; }\n',
          isNewFile: false,
        },
        {
          relativePath: 'src/routes.ts',
          proposedContent: 'import { checkAuth } from "./auth.js";\nexport function handleRoute(ip?: string) { return checkAuth(ip); }\n',
          isNewFile: false,
        },
      ],
    });

    const mockProvider = new MockModelProvider({
      turns: [
        // Turn 1: Planning
        { textResponse: validPlanJson },
        // Turn 2: Multi-file edit creation
        { textResponse: editSetJson },
        // Turn 3: Final response
        { textResponse: 'Rate limiting successfully integrated across src/auth.ts and src/routes.ts. All tests passed.' },
      ],
    });

    const modelGateway = new ModelGateway();
    modelGateway.registerProvider(mockProvider);

    const planner = new Planner({
      modelGateway,
      eventBus,
      workspaceRoots: [tmpDir],
    });

    let planApprovalCalled = false;
    let editApprovalCalled = false;
    const activities: string[] = [];

    const orchestrator = new AgentOrchestrator({
      modelGateway,
      toolExecutor,
      editSetManager,
      verificationEngine,
      planner,
      contextEngine,
      eventBus,
      workspaceRoots: [tmpDir],
      onRequestPlanApproval: async (plan: Plan) => {
        planApprovalCalled = true;
        expect(plan.id).toBe('plan_rate_limiting');
        expect(plan.steps.length).toBe(2);
        return true;
      },
      onRequestEditApproval: async (editSet: EditSet) => {
        editApprovalCalled = true;
        expect(editSet.files.length).toBe(2);
        return true;
      },
      onActivity: (act) => {
        activities.push(act);
      },
    });

    const result = await orchestrator.executeTask('Add rate limiting to authentication routes');

    expect(result.success).toBe(true);
    expect(planApprovalCalled).toBe(true);
    expect(editApprovalCalled).toBe(true);
    expect(result.appliedFiles).toContain('src/auth.ts');
    expect(result.appliedFiles).toContain('src/routes.ts');
    expect(result.verificationResult?.status).toBe('PASS');

    // Confirm files updated on disk
    const updatedAuth = fs.readFileSync(authFile, 'utf8');
    expect(updatedAuth).toContain('checkAuth(ip?: string)');
  });

  it('demonstrates self-healing diagnosis & repair loop: test fail -> diagnosis -> repair -> test pass', async () => {
    const authFile = path.join(tmpDir, 'src', 'auth.ts');
    fs.writeFileSync(authFile, 'export function login() { return true; }\n', 'utf8');

    // Script fails on first run, passes after repair
    const testRunner = path.join(tmpDir, 'run_test.js');
    fs.writeFileSync(
      testRunner,
      `const fs = require('fs');
       const auth = fs.readFileSync('src/auth.ts', 'utf8');
       if (auth.includes('v2_fixed')) {
         console.log('PASS: 2 tests passed');
         process.exit(0);
       } else {
         console.error('FAIL: login test failed with missing v2_fixed');
         process.exit(1);
       }
      `,
      'utf8',
    );

    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({
        name: 'm5-fixture',
        scripts: { test: 'node run_test.js' },
      }),
      'utf8',
    );

    const validPlanJson = JSON.stringify({
      id: 'plan_login_v2',
      goal: 'Update login function',
      assumptions: [],
      steps: [
        {
          id: 'step_1',
          description: 'Update auth.ts',
          files: ['src/auth.ts'],
          dependencies: [],
          expectedOutcome: 'login updated',
          verification: 'npm test',
          status: 'pending',
        },
      ],
      risks: [],
      verification: ['npm test'],
    });

    // Initial buggy proposal
    const buggyEditSetJson = JSON.stringify({
      files: [
        {
          relativePath: 'src/auth.ts',
          proposedContent: 'export function login() { return false; /* v1_buggy */ }\n',
          isNewFile: false,
        },
      ],
    });

    // Corrective proposal during diagnosis
    const fixedEditSetJson = JSON.stringify({
      files: [
        {
          relativePath: 'src/auth.ts',
          proposedContent: 'export function login() { return true; /* v2_fixed */ }\n',
          isNewFile: false,
        },
      ],
    });

    const mockProvider = new MockModelProvider({
      turns: [
        // Turn 1: Planning
        { textResponse: validPlanJson },
        // Turn 2: Initial edit
        { textResponse: buggyEditSetJson },
        // Turn 3: Diagnostic repair edit after test failure
        { textResponse: fixedEditSetJson },
        // Turn 4: Final response
        { textResponse: 'Fixed login issue and verified test suite passes.' },
      ],
    });

    const modelGateway = new ModelGateway();
    modelGateway.registerProvider(mockProvider);

    const planner = new Planner({
      modelGateway,
      eventBus,
      workspaceRoots: [tmpDir],
    });

    let repairCount = 0;

    const orchestrator = new AgentOrchestrator({
      modelGateway,
      toolExecutor,
      editSetManager,
      verificationEngine,
      planner,
      contextEngine,
      eventBus,
      workspaceRoots: [tmpDir],
      onRequestPlanApproval: async () => true,
      onRequestEditApproval: async (editSet) => {
        if (editSet.files.some((f) => f.proposedContent.includes('v2_fixed'))) {
          repairCount++;
        }
        return true;
      },
    });

    const result = await orchestrator.executeTask('Update login function to pass tests');

    expect(result.success).toBe(true);
    expect(result.repairCount).toBe(1);
    expect(repairCount).toBe(1);
    expect(result.verificationResult?.status).toBe('PASS');

    const finalContent = fs.readFileSync(authFile, 'utf8');
    expect(finalContent).toContain('v2_fixed');
  });

  it('stops and rejects when human rejects the engineering plan', async () => {
    const authFile = path.join(tmpDir, 'src', 'auth.ts');
    fs.writeFileSync(authFile, 'export function auth() {}\n', 'utf8');

    const validPlanJson = JSON.stringify({
      id: 'plan_rejected',
      goal: 'Delete auth system',
      assumptions: [],
      steps: [
        {
          id: 'step_1',
          description: 'Delete auth.ts',
          files: ['src/auth.ts'],
          dependencies: [],
          expectedOutcome: 'file deleted',
          verification: 'npm test',
          status: 'pending',
        },
      ],
      risks: ['High risk'],
      verification: ['npm test'],
    });

    const mockProvider = new MockModelProvider({
      turns: [{ textResponse: validPlanJson }],
    });

    const modelGateway = new ModelGateway();
    modelGateway.registerProvider(mockProvider);

    const planner = new Planner({
      modelGateway,
      eventBus,
      workspaceRoots: [tmpDir],
    });

    const orchestrator = new AgentOrchestrator({
      modelGateway,
      toolExecutor,
      editSetManager,
      verificationEngine,
      planner,
      contextEngine,
      eventBus,
      workspaceRoots: [tmpDir],
      onRequestPlanApproval: async () => false, // REJECT PLAN
      onRequestEditApproval: async () => true,
    });

    const result = await orchestrator.executeTask('Delete auth system');
    expect(result.success).toBe(false);
    expect(result.summary).toContain('engineering plan was rejected');
  });

  it('stops and leaves files untouched when human rejects the multi-file edit set', async () => {
    const authFile = path.join(tmpDir, 'src', 'auth.ts');
    const originalContent = 'export function safe() {}\n';
    fs.writeFileSync(authFile, originalContent, 'utf8');

    const validPlanJson = JSON.stringify({
      id: 'plan_test',
      goal: 'Update safe function',
      assumptions: [],
      steps: [
        {
          id: 'step_1',
          description: 'Update safe.ts',
          files: ['src/auth.ts'],
          dependencies: [],
          expectedOutcome: 'done',
          verification: 'npm test',
          status: 'pending',
        },
      ],
      risks: [],
      verification: ['npm test'],
    });

    const editSetJson = JSON.stringify({
      files: [
        {
          relativePath: 'src/auth.ts',
          proposedContent: 'export function modified() {}\n',
          isNewFile: false,
        },
      ],
    });

    const mockProvider = new MockModelProvider({
      turns: [
        { textResponse: validPlanJson },
        { textResponse: editSetJson },
      ],
    });

    const modelGateway = new ModelGateway();
    modelGateway.registerProvider(mockProvider);

    const planner = new Planner({
      modelGateway,
      eventBus,
      workspaceRoots: [tmpDir],
    });

    const orchestrator = new AgentOrchestrator({
      modelGateway,
      toolExecutor,
      editSetManager,
      verificationEngine,
      planner,
      contextEngine,
      eventBus,
      workspaceRoots: [tmpDir],
      onRequestPlanApproval: async () => true,
      onRequestEditApproval: async () => false, // REJECT EDIT SET
    });

    const result = await orchestrator.executeTask('Update safe function');
    expect(result.success).toBe(false);
    expect(result.summary).toContain('proposed edits were rejected');

    // Confirm file on disk was NOT modified
    expect(fs.readFileSync(authFile, 'utf8')).toBe(originalContent);
  });

  it('security: detects scope escalation when proposed edits affect files not in approved plan', async () => {
    const authFile = path.join(tmpDir, 'src', 'auth.ts');
    fs.writeFileSync(authFile, 'export function auth() {}\n', 'utf8');

    const validPlanJson = JSON.stringify({
      id: 'plan_scoped',
      goal: 'Update auth only',
      assumptions: [],
      steps: [
        {
          id: 'step_auth',
          description: 'Update auth.ts',
          files: ['src/auth.ts'],
          dependencies: [],
          expectedOutcome: 'auth updated',
          verification: 'npm test',
          status: 'pending',
        },
      ],
      risks: [],
      verification: ['npm test'],
    });

    // Model attempts scope creep: modifies auth.ts AND config/database.env
    const maliciousEditSetJson = JSON.stringify({
      files: [
        { relativePath: 'src/auth.ts', proposedContent: 'export const x = 1;\n', isNewFile: false },
        { relativePath: 'config/database.env', proposedContent: 'SECRET=exposed\n', isNewFile: true },
      ],
    });

    const mockProvider = new MockModelProvider({
      turns: [
        { textResponse: validPlanJson },
        { textResponse: maliciousEditSetJson },
      ],
    });

    const modelGateway = new ModelGateway();
    modelGateway.registerProvider(mockProvider);

    const planner = new Planner({
      modelGateway,
      eventBus,
      workspaceRoots: [tmpDir],
    });

    let scopeApprovalPrompted = false;

    const orchestrator = new AgentOrchestrator({
      modelGateway,
      toolExecutor,
      editSetManager,
      verificationEngine,
      planner,
      contextEngine,
      eventBus,
      workspaceRoots: [tmpDir],
      onRequestPlanApproval: async () => true,
      onRequestEditApproval: async () => true,
      onRequestScopeApproval: async (unplannedFiles) => {
        scopeApprovalPrompted = true;
        expect(unplannedFiles).toContain('config/database.env');
        return false; // User rejects scope creep
      },
    });

    const result = await orchestrator.executeTask('Update auth only');
    expect(scopeApprovalPrompted).toBe(true);
    expect(result.success).toBe(false);
    expect(result.summary).toContain('Scope change rejected by user');
  });

  it('security: path traversal in multi-file edit set is rejected immediately without disk mutation', async () => {
    const authFile = path.join(tmpDir, 'src', 'auth.ts');
    fs.writeFileSync(authFile, 'export function auth() {}\n', 'utf8');

    const validPlanJson = JSON.stringify({
      id: 'plan_traversal',
      goal: 'Test traversal',
      assumptions: [],
      steps: [
        {
          id: 'step_1',
          description: 'Try write outside workspace',
          files: ['src/auth.ts'],
          dependencies: [],
          expectedOutcome: 'none',
          verification: 'npm test',
          status: 'pending',
        },
      ],
      risks: [],
      verification: ['npm test'],
    });

    const traversalEditSetJson = JSON.stringify({
      files: [
        {
          relativePath: '../../etc/passwd',
          proposedContent: 'root:hacked',
          isNewFile: false,
        },
      ],
    });

    const mockProvider = new MockModelProvider({
      turns: [
        { textResponse: validPlanJson },
        { textResponse: traversalEditSetJson },
      ],
    });

    const modelGateway = new ModelGateway();
    modelGateway.registerProvider(mockProvider);

    const planner = new Planner({
      modelGateway,
      eventBus,
      workspaceRoots: [tmpDir],
    });

    const orchestrator = new AgentOrchestrator({
      modelGateway,
      toolExecutor,
      editSetManager,
      verificationEngine,
      planner,
      contextEngine,
      eventBus,
      workspaceRoots: [tmpDir],
      onRequestPlanApproval: async () => true,
      onRequestEditApproval: async () => true,
    });

    const result = await orchestrator.executeTask('Test traversal');
    expect(result.success).toBe(false);
    expect(result.summary).toContain('Failed to stage edits');
  });
});
