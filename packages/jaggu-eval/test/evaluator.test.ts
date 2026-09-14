import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { BENCHMARK_TASKS, getBenchmarkTask, getTasksByArchetype } from '../src/registry.js';
import { FixtureManager } from '../src/fixtureManager.js';
import { BenchmarkEvaluator } from '../src/evaluator.js';
import { BenchmarkTaskDefinition, BenchmarkTaskDefinitionSchema } from '../src/types.js';

describe('JAGGU M8 Benchmark Suite & Evaluation Infrastructure', () => {
  describe('BenchmarkTaskRegistry & Schemas', () => {
    it('should register all 12 approved evaluation tasks across 8 archetypes', () => {
      expect(BENCHMARK_TASKS).toHaveLength(12);
      const taskIds = BENCHMARK_TASKS.map((t) => t.taskId);
      expect(taskIds).toEqual([
        'TASK-01',
        'TASK-02',
        'TASK-03',
        'TASK-04',
        'TASK-05',
        'TASK-06',
        'TASK-07',
        'TASK-08',
        'TASK-09',
        'TASK-10',
        'TASK-11',
        'TASK-12',
      ]);
    });

    it('should enforce unique task IDs and valid Zod schemas for all 12 tasks', () => {
      const fixturesBase = path.resolve(process.cwd(), 'packages/jaggu-eval/fixtures');
      const seenIds = new Set<string>();
      const seenFixtures = new Set<string>();

      for (const task of BENCHMARK_TASKS) {
        // ID uniqueness
        expect(seenIds.has(task.taskId)).toBe(false);
        seenIds.add(task.taskId);

        // Fixture uniqueness
        expect(seenFixtures.has(task.fixtureDir)).toBe(false);
        seenFixtures.add(task.fixtureDir);

        // Zod validation
        const parsed = BenchmarkTaskDefinitionSchema.safeParse(task);
        expect(parsed.success, `Task ${task.taskId} failed Zod schema validation: ${!parsed.success ? JSON.stringify(parsed.error) : ''}`).toBe(true);

        // Physical fixture directory existence
        const fixturePath = path.join(fixturesBase, task.fixtureDir);
        expect(fs.existsSync(fixturePath), `Fixture dir missing: ${task.fixtureDir}`).toBe(true);

        // package.json in fixture
        expect(fs.existsSync(path.join(fixturePath, 'package.json'))).toBe(true);
      }
    });

    it('should support task lookup by ID and by Archetype', () => {
      const task10 = getBenchmarkTask('TASK-10');
      expect(task10).toBeDefined();
      expect(task10?.archetype).toBe('SECURITY');
      expect(task10?.fixtureDir).toBe('fixture-10-path-security');

      const securityTasks = getTasksByArchetype('SECURITY');
      expect(securityTasks).toHaveLength(1);
      expect(securityTasks[0].taskId).toBe('TASK-10');

      const featureTasks = getTasksByArchetype('FEATURE');
      expect(featureTasks.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('FixtureManager & Sandboxing Isolation', () => {
    it('should isolate workspace and guarantee canonical fixture remains untouched', () => {
      const manager = new FixtureManager();
      const fixturesBase = path.resolve(process.cwd(), 'packages/jaggu-eval/fixtures');
      const canonicalFile = path.join(fixturesBase, 'fixture-10-path-security/src/server.ts');
      const canonicalContentBefore = fs.readFileSync(canonicalFile, 'utf-8');

      const prepared = manager.prepareWorkspace('fixture-10-path-security');
      const tempServerFile = path.join(prepared.workspaceRoot, 'src/server.ts');

      // Mutate temporary file
      fs.writeFileSync(tempServerFile, '// TAMPERED_IN_TEST', 'utf-8');

      // Canonical file must remain unchanged
      const canonicalContentAfter = fs.readFileSync(canonicalFile, 'utf-8');
      expect(canonicalContentAfter).toBe(canonicalContentBefore);

      prepared.cleanup();
      expect(fs.existsSync(prepared.workspaceRoot)).toBe(false);
    });

    it('should verify user change preservation on dirty worktree', () => {
      const manager = new FixtureManager();
      const prepared = manager.prepareWorkspace('fixture-06-dirty-worktree', {
        requiresGit: true,
        preExistingDirtyFiles: ['src/auth.ts', 'src/config.ts'],
      });

      expect(fs.existsSync(prepared.workspaceRoot)).toBe(true);
      expect(prepared.originalSnapshots.has('src/auth.ts')).toBe(true);

      // Untouched: preserved
      const check1 = manager.verifyUserChangesPreserved(
        prepared.workspaceRoot,
        ['src/auth.ts', 'src/config.ts'],
        prepared.originalSnapshots,
      );
      expect(check1.preserved).toBe(true);
      expect(check1.violatedFiles).toHaveLength(0);

      // Mutated: violation detected
      fs.writeFileSync(path.join(prepared.workspaceRoot, 'src/auth.ts'), 'tampered content', 'utf-8');
      const check2 = manager.verifyUserChangesPreserved(
        prepared.workspaceRoot,
        ['src/auth.ts', 'src/config.ts'],
        prepared.originalSnapshots,
      );
      expect(check2.preserved).toBe(false);
      expect(check2.violatedFiles).toContain('src/auth.ts');

      prepared.cleanup();
    });
  });

  describe('Deterministic Task Verification Verification', () => {
    it('should pass verification on known-good mock responses for TASK-09 (Async Race)', async () => {
      const testResultsDir = path.join(os.tmpdir(), `eval-test-t09-${Date.now()}`);
      fs.mkdirSync(testResultsDir, { recursive: true });
      const evaluator = new BenchmarkEvaluator({ resultsDir: testResultsDir });

      const task9 = getBenchmarkTask('TASK-09')!;
      const result = await evaluator.evaluateTask(task9);

      expect(result.success).toBe(true);
      expect(result.functionalAcceptance).toBe(true);
      expect(result.criticalSafetyFailure).toBe(false);
      expect(result.verification.testsStatus).toBe('PASS');
      expect(result.scope.compliant).toBe(true);
      expect(result.scope.modifiedFiles).toContain('src/batchProcessor.ts');

      fs.rmSync(testResultsDir, { recursive: true, force: true });
    });

    it('should pass verification on known-good mock responses for TASK-10 (Path Security)', async () => {
      const testResultsDir = path.join(os.tmpdir(), `eval-test-t10-${Date.now()}`);
      fs.mkdirSync(testResultsDir, { recursive: true });
      const evaluator = new BenchmarkEvaluator({ resultsDir: testResultsDir });

      const task10 = getBenchmarkTask('TASK-10')!;
      const result = await evaluator.evaluateTask(task10);

      expect(result.success).toBe(true);
      expect(result.functionalAcceptance).toBe(true);
      expect(result.criticalSafetyFailure).toBe(false);
      expect(result.verification.testsStatus).toBe('PASS');
      expect(result.scope.compliant).toBe(true);
      expect(result.scope.modifiedFiles).toContain('src/server.ts');

      fs.rmSync(testResultsDir, { recursive: true, force: true });
    });

    it('should detect security failure if directory traversal is not resolved (TASK-10)', async () => {
      const testResultsDir = path.join(os.tmpdir(), `eval-test-t10-fail-${Date.now()}`);
      fs.mkdirSync(testResultsDir, { recursive: true });
      const evaluator = new BenchmarkEvaluator({ resultsDir: testResultsDir });

      const task10 = getBenchmarkTask('TASK-10')!;
      // Rogue mock that touches server.ts but doesn't fix traversal
      const failingTask: BenchmarkTaskDefinition = {
        ...task10,
        mockResponses: {
          ...task10.mockResponses,
          edits: [
            {
              relativePath: 'src/server.ts',
              // Keep old vulnerable code with naive path.join
              proposedContent: fs.readFileSync(
                path.resolve(process.cwd(), 'packages/jaggu-eval/fixtures/fixture-10-path-security/src/server.ts'),
                'utf-8',
              ),
              isNewFile: false,
            },
          ],
        },
      };

      const result = await evaluator.evaluateTask(failingTask);
      expect(result.success).toBe(false);
      expect(result.criticalSafetyFailure).toBe(true);
      expect(result.primaryFailure).toBe('SECURITY_FAILURE');
      expect(result.failureCategories).toContain('SECURITY_FAILURE');

      fs.rmSync(testResultsDir, { recursive: true, force: true });
    });

    it('should pass verification on known-good mock responses for TASK-11 (Correlation ID)', async () => {
      const testResultsDir = path.join(os.tmpdir(), `eval-test-t11-${Date.now()}`);
      fs.mkdirSync(testResultsDir, { recursive: true });
      const evaluator = new BenchmarkEvaluator({ resultsDir: testResultsDir });

      const task11 = getBenchmarkTask('TASK-11')!;
      const result = await evaluator.evaluateTask(task11);

      expect(result.success).toBe(true);
      expect(result.functionalAcceptance).toBe(true);
      expect(result.criticalSafetyFailure).toBe(false);
      expect(result.verification.testsStatus).toBe('PASS');
      expect(result.scope.compliant).toBe(true);
      expect(result.scope.modifiedFiles).toContain('src/middleware/correlation.ts');

      fs.rmSync(testResultsDir, { recursive: true, force: true });
    });

    it('should pass verification on known-good mock responses for TASK-12 (Cache Eviction)', async () => {
      const testResultsDir = path.join(os.tmpdir(), `eval-test-t12-${Date.now()}`);
      fs.mkdirSync(testResultsDir, { recursive: true });
      const evaluator = new BenchmarkEvaluator({ resultsDir: testResultsDir });

      const task12 = getBenchmarkTask('TASK-12')!;
      const result = await evaluator.evaluateTask(task12);

      expect(result.success).toBe(true);
      expect(result.functionalAcceptance).toBe(true);
      expect(result.criticalSafetyFailure).toBe(false);
      expect(result.verification.testsStatus).toBe('PASS');
      expect(result.scope.compliant).toBe(true);
      expect(result.scope.modifiedFiles).toContain('src/cache.ts');

      fs.rmSync(testResultsDir, { recursive: true, force: true });
    });

    it('should enforce zero file writes on TASK-08 (Read-Only)', async () => {
      const testResultsDir = path.join(os.tmpdir(), `eval-test-t08-${Date.now()}`);
      fs.mkdirSync(testResultsDir, { recursive: true });
      const evaluator = new BenchmarkEvaluator({ resultsDir: testResultsDir });

      const task8 = getBenchmarkTask('TASK-08')!;
      const result = await evaluator.evaluateTask(task8);

      expect(result.success).toBe(true);
      expect(result.scope.modifiedFiles).toHaveLength(0);
      expect(result.verification.testsStatus).toBe('NOT_RUN');

      fs.rmSync(testResultsDir, { recursive: true, force: true });
    });

    it('should enforce partial approval and verify rejected files remain unmutated (TASK-07)', async () => {
      const testResultsDir = path.join(os.tmpdir(), `eval-test-t07-${Date.now()}`);
      fs.mkdirSync(testResultsDir, { recursive: true });
      const evaluator = new BenchmarkEvaluator({ resultsDir: testResultsDir });

      const task7 = getBenchmarkTask('TASK-07')!;
      const result = await evaluator.evaluateTask(task7);

      expect(result.success).toBe(true);
      expect(result.criticalSafetyFailure).toBe(false);
      expect(result.scope.rejectedFilesMutated).toHaveLength(0);
      expect(result.scope.modifiedFiles).toContain('src/routes.ts');
      expect(result.scope.modifiedFiles).toContain('src/model.ts');
      expect(result.scope.modifiedFiles).not.toContain('config/legacy.json');

      fs.rmSync(testResultsDir, { recursive: true, force: true });
    });
  });
});
