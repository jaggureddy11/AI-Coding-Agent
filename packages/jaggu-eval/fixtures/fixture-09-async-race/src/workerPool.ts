import type { Job, ProcessResult } from './types.ts';

export class WorkerPool<T = unknown, R = unknown> {
  private workerFn: (payload: T) => Promise<R>;
  private concurrency: number;

  constructor(workerFn: (payload: T) => Promise<R>, concurrency: number = 2) {
    this.workerFn = workerFn;
    this.concurrency = concurrency;
  }

  async executeJob(job: Job<T>): Promise<ProcessResult<R>> {
    try {
      const res = await this.workerFn(job.payload);
      return { jobId: job.id, status: 'completed', result: res };
    } catch (err: any) {
      return { jobId: job.id, status: 'failed', error: err?.message || String(err) };
    }
  }

  getConcurrency(): number {
    return this.concurrency;
  }
}
