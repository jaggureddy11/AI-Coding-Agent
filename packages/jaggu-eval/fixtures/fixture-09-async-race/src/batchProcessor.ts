import { JobQueue } from './queue.ts';
import { WorkerPool } from './workerPool.ts';
import type { Job, ProcessResult, BatchProcessingSummary } from './types.ts';

export class BatchProcessor<T = unknown, R = unknown> {
  private queue: JobQueue<T>;
  private pool: WorkerPool<T, R>;

  constructor(queue: JobQueue<T>, pool: WorkerPool<T, R>) {
    this.queue = queue;
    this.pool = pool;
  }

  /**
   * Processes all jobs currently in the queue.
   * Defect: fires off promises in parallel without capturing rejections properly or coordinating completion,
   * leading to race conditions and unhandled promise rejections if jobs fail concurrently.
   */
  async processBatch(): Promise<BatchProcessingSummary<R>> {
    const results: ProcessResult<R>[] = [];
    const jobs: Job<T>[] = [];

    while (!this.queue.isEmpty()) {
      const job = this.queue.dequeue();
      if (job) jobs.push(job);
    }

    // Flawed implementation: iterates with forEach and doesn't properly catch or await errors
    const promises = jobs.map((job) => {
      return this.pool.executeJob(job).then((res) => {
        if (res.status === 'failed') {
          // Unhandled throw inside asynchronous handler triggers unhandled rejection
          throw new Error(`Job ${res.jobId} failed: ${res.error}`);
        }
        results.push(res);
      });
    });

    // Promise.all fails fast on first rejection and leaves others dangling / unhandled
    await Promise.all(promises);

    return {
      total: jobs.length,
      completed: results.filter((r) => r.status === 'completed').length,
      failed: results.filter((r) => r.status === 'failed').length,
      results,
    };
  }
}
