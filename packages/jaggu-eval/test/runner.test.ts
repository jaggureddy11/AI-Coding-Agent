import { describe, it, expect } from 'vitest';
import { BenchmarkRunner } from '../src/runner.js';
import { BenchmarkTask } from '../src/types.js';

describe('BenchmarkRunner', () => {
  it('should run suite and calculate scorecard metrics', async () => {
    const tasks: BenchmarkTask[] = [
      {
        taskId: 'BENCH-001',
        archetype: 'FEATURE',
        difficulty: 'EASY',
        repository: 'mock-repo',
        prompt: 'Add test endpoint',
        expectedFilesModified: ['src/routes.ts'],
        timeoutSeconds: 30,
      },
      {
        taskId: 'BENCH-002',
        archetype: 'DEBUG',
        difficulty: 'MEDIUM',
        repository: 'mock-repo',
        prompt: 'Fix broken test',
        expectedFilesModified: ['src/auth.ts'],
        timeoutSeconds: 30,
      },
    ];

    const runner = new BenchmarkRunner(tasks);
    const scorecard = await runner.runSuite(async (task) => {
      if (task.taskId === 'BENCH-001') {
        return { passed: true, executionTimeMs: 1200, tokensConsumed: 1500, toolCallsCount: 3 };
      }
      return { passed: false, executionTimeMs: 2400, tokensConsumed: 3200, toolCallsCount: 5, error: 'Test failed' };
    });

    expect(scorecard.totalTasks).toBe(2);
    expect(scorecard.successfulTasks).toBe(1);
    expect(scorecard.taskSuccessRate).toBe(0.5);
    expect(scorecard.totalTokens).toBe(4700);
    expect(scorecard.averageLatencyMs).toBe(1800);
  });
});
