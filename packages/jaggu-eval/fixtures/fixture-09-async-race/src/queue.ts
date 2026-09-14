import type { Job } from './types.ts';

export class JobQueue<T = unknown> {
  private queue: Job<T>[] = [];

  enqueue(job: Job<T>): void {
    this.queue.push(job);
  }

  dequeue(): Job<T> | undefined {
    return this.queue.shift();
  }

  size(): number {
    return this.queue.length;
  }

  isEmpty(): boolean {
    return this.queue.length === 0;
  }
}
