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
  AgentState,
} from '../src/index.js';

describe('AgentOrchestrator — Read-Only & Explanatory Workflows', () => {
  let tmpDir: string;
  let eventBus: EventBus;
  let docStore: InMemoryVirtualDocStore;
  let toolExecutor: ToolExecutor;
  let contextEngine: ContextEngine;
  let editSetManager: EditSetManager;
  let verificationEngine: VerificationEngine;
  let planValidator: PlanValidator;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jaggu-readonly-test-'));
    fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, 'src', 'auth.ts'),
      'export function authenticate() { return true; }\n',
    );
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'test-readonly', scripts: { test: 'node -e "process.exit(0)"' } }),
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
      // ignore cleanup errors
    }
  });

  it('should successfully execute read-only inquiry without staging empty EditSet or mutating disk', async () => {
    // 1. Plan response for read-only inquiry
    const mockPlan = {
      id: 'plan_trace_1',
      goal: 'Explain the authentication flow across modules',
      assumptions: ['No code changes required'],
      steps: [
        {
          id: 'step-1',
          description: 'Analyze authentication entrypoint in src/auth.ts',
          files: ['src/auth.ts'],
          expectedOutcome: 'Grounded understanding of auth flow',
          verification: 'None needed',
          status: 'PENDING',
        },
      ],
      risks: ['None'],
      verification: ['None'],
    };

    const mockProvider = new MockModelProvider({
      turns: [
        { text: JSON.stringify(mockPlan) },
        { text: '[]' },
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
    const completedEvents: any[] = [];

    eventBus.on('agent.completed', (data) => {
      completedEvents.push(data);
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
      onRequestPlanApproval: async () => {
        planApprovalCalled = true;
        return true;
      },
      onRequestEditApproval: async () => {
        editApprovalCalled = true;
        return true;
      },
    });

    const result = await orchestrator.executeTask('Trace the authentication architecture');

    expect(result.success).toBe(true);
    expect(result.appliedFiles).toHaveLength(0);
    expect(planApprovalCalled).toBe(true);
    // Should NOT call edit approval for zero files
    expect(editApprovalCalled).toBe(false);
    expect(completedEvents).toHaveLength(1);
    expect(completedEvents[0].totalFilesChanged).toBe(0);

    // Verify disk was completely untouched
    const authContent = fs.readFileSync(path.join(tmpDir, 'src', 'auth.ts'), 'utf8');
    expect(authContent).toBe('export function authenticate() { return true; }\n');
  });
});
