import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { PlanValidator } from '../src/planning/planValidator.js';
import { Planner } from '../src/planning/planner.js';
import { EventBus } from '../src/events/eventBus.js';
import { ModelGateway } from '../src/models/gateway.js';
import { MockModelProvider } from '../src/models/mock.js';
import { ContextPackage } from '../src/context/types.js';

describe('PlanValidator', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jaggu-plan-test-'));
    fs.mkdirSync(path.join(tmpDir, 'src', 'auth'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'src', 'auth', 'login.ts'), 'export function login() {}');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should accept a valid structured plan', () => {
    const plan = {
      id: 'plan-01',
      goal: 'Add rate limiting to login endpoint',
      assumptions: ['Using express rate limit'],
      steps: [
        {
          id: 'step-1',
          description: 'Create rate limit middleware',
          files: [],
          newFiles: ['src/auth/rateLimit.ts'],
          dependencies: [],
          expectedOutcome: 'Middleware created',
          verification: 'Unit test',
          status: 'PENDING',
        },
        {
          id: 'step-2',
          description: 'Integrate into login endpoint',
          files: ['src/auth/login.ts'],
          newFiles: [],
          dependencies: ['step-1'],
          expectedOutcome: 'Rate limit applied to endpoint',
          verification: 'Integration test',
          status: 'PENDING',
        },
      ],
      risks: ['May impact high-throughput clients'],
      verification: ['npm test'],
    };

    const result = PlanValidator.validate(plan, [tmpDir]);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('should reject a plan referencing a non-existent file not declared in newFiles', () => {
    const plan = {
      id: 'plan-02',
      goal: 'Modify ghost file',
      assumptions: [],
      steps: [
        {
          id: 'step-1',
          description: 'Edit phantom file',
          files: ['src/auth/ghost.ts'],
          newFiles: [],
          dependencies: [],
          expectedOutcome: 'None',
          verification: 'None',
          status: 'PENDING',
        },
      ],
      risks: [],
      verification: ['npm test'],
    };

    const result = PlanValidator.validate(plan, [tmpDir]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('does not exist on disk'))).toBe(true);
  });

  it('should reject a plan referencing a path outside the workspace', () => {
    const plan = {
      id: 'plan-03',
      goal: 'Escape workspace',
      assumptions: [],
      steps: [
        {
          id: 'step-1',
          description: 'Traverse up',
          files: ['../../etc/passwd'],
          newFiles: [],
          dependencies: [],
          expectedOutcome: 'Escape',
          verification: 'Check',
          status: 'PENDING',
        },
      ],
      risks: [],
      verification: ['npm test'],
    };

    const result = PlanValidator.validate(plan, [tmpDir]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('out-of-workspace path'))).toBe(true);
  });

  it('should reject a plan with circular step dependencies', () => {
    const plan = {
      id: 'plan-04',
      goal: 'Circular dependencies',
      assumptions: [],
      steps: [
        {
          id: 'step-1',
          description: 'Step 1 depends on 2',
          files: ['src/auth/login.ts'],
          newFiles: [],
          dependencies: ['step-2'],
          expectedOutcome: 'Outcome 1',
          verification: 'Check 1',
          status: 'PENDING',
        },
        {
          id: 'step-2',
          description: 'Step 2 depends on 1',
          files: ['src/auth/login.ts'],
          newFiles: [],
          dependencies: ['step-1'],
          expectedOutcome: 'Outcome 2',
          verification: 'Check 2',
          status: 'PENDING',
        },
      ],
      risks: [],
      verification: ['npm test'],
    };

    const result = PlanValidator.validate(plan, [tmpDir]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('circular dependency'))).toBe(true);
  });

  it('should reject a plan with non-existent step dependency', () => {
    const plan = {
      id: 'plan-05',
      goal: 'Bad dependency',
      assumptions: [],
      steps: [
        {
          id: 'step-1',
          description: 'Step 1 depends on missing step',
          files: ['src/auth/login.ts'],
          newFiles: [],
          dependencies: ['step-999'],
          expectedOutcome: 'Outcome',
          verification: 'Check',
          status: 'PENDING',
        },
      ],
      risks: [],
      verification: ['npm test'],
    };

    const result = PlanValidator.validate(plan, [tmpDir]);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('references non-existent dependency'))).toBe(true);
  });
});

describe('Planner', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jaggu-planner-test-'));
    fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'src', 'index.ts'), 'console.log("hello");');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should generate a valid plan from mock model', async () => {
    const validPlanJson = JSON.stringify({
      id: 'plan-auto-1',
      goal: 'Update index greeting',
      assumptions: ['TypeScript environment'],
      steps: [
        {
          id: 'step-1',
          description: 'Modify greeting in src/index.ts',
          files: ['src/index.ts'],
          newFiles: [],
          dependencies: [],
          expectedOutcome: 'Greeting updated',
          verification: 'npm test',
          status: 'PENDING',
        },
      ],
      risks: ['None'],
      verification: ['npm test'],
    });

    const mockProvider = new MockModelProvider({
      mockResponseText: `Here is the plan:\n\`\`\`json\n${validPlanJson}\n\`\`\``,
    });

    const gateway = new ModelGateway();
    gateway.registerProvider(mockProvider);

    const eventBus = new EventBus();
    const planner = new Planner({
      modelGateway: gateway,
      eventBus,
      workspaceRoots: [tmpDir],
      providerId: 'mock',
    });

    const dummyContext: ContextPackage = {
      workspaceSummary: { rootUri: tmpDir, fileCount: 1, structureTree: 'src/index.ts' },
      relevantFiles: [{ relativePath: 'src/index.ts', content: 'console.log("hello");', score: 1 }],
      tokenCount: 50,
      timestamp: Date.now(),
    };

    const result = await planner.createPlan('Update index.ts', dummyContext);
    expect(result.success).toBe(true);
    expect(result.plan?.id).toBe('plan-auto-1');
    expect(result.plan?.steps.length).toBe(1);
  });
});
