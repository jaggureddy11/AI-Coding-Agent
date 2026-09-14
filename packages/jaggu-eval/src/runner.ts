import { BenchmarkTask, BenchmarkResult, BenchmarkScorecard } from './types.js';

export type TaskExecutor = (task: BenchmarkTask) => Promise<Omit<BenchmarkResult, 'taskId'>>;

export class BenchmarkRunner {
  constructor(private readonly tasks: BenchmarkTask[]) {}

  async runSuite(executor: TaskExecutor): Promise<BenchmarkScorecard> {
    const results: BenchmarkResult[] = [];
    let totalLatency = 0;
    let totalTokens = 0;
    let successfulCount = 0;

    for (const task of this.tasks) {
      try {
        const result = await executor(task);
        const fullResult: BenchmarkResult = {
          taskId: task.taskId,
          ...result,
        };
        results.push(fullResult);
        totalLatency += result.executionTimeMs;
        totalTokens += result.tokensConsumed;
        if (result.passed) {
          successfulCount++;
        }
      } catch (err) {
        results.push({
          taskId: task.taskId,
          passed: false,
          executionTimeMs: 0,
          tokensConsumed: 0,
          toolCallsCount: 0,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const taskCount = this.tasks.length;
    return {
      timestamp: Date.now(),
      totalTasks: taskCount,
      successfulTasks: successfulCount,
      taskSuccessRate: taskCount > 0 ? successfulCount / taskCount : 0,
      averageLatencyMs: taskCount > 0 ? totalLatency / taskCount : 0,
      totalTokens,
      results,
    };
  }
}
