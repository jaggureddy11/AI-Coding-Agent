import assert from 'assert';
import { JobQueue } from '../src/queue.ts';
import { WorkerPool } from '../src/workerPool.ts';
import { BatchProcessor } from '../src/batchProcessor.ts';

console.log('Running asynchronous batch processor verification test...');

let unhandledRejections = 0;
process.on('unhandledRejection', (err) => {
  unhandledRejections++;
  console.error('Captured unhandledRejection:', err);
});

async function run() {
  const queue = new JobQueue();
  const pool = new WorkerPool(async (payload) => {
    // Artificial jitter to surface concurrency race conditions
    await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 20) + 1));
    if (payload.val === 13) {
      throw new Error('Bad luck number 13 failure');
    }
    return payload.val * 2;
  });

  queue.enqueue({ id: 'j1', payload: { val: 1 }, retryCount: 0 });
  queue.enqueue({ id: 'j2', payload: { val: 13 }, retryCount: 0 }); // Intended failure
  queue.enqueue({ id: 'j3', payload: { val: 5 }, retryCount: 0 });
  queue.enqueue({ id: 'j4', payload: { val: 10 }, retryCount: 0 });

  const processor = new BatchProcessor(queue, pool);

  const summary = await processor.processBatch();

  assert.strictEqual(summary.total, 4, 'Should process all 4 queued jobs');
  assert.strictEqual(summary.completed, 3, '3 jobs should succeed');
  assert.strictEqual(summary.failed, 1, '1 job should fail cleanly');
  assert.strictEqual(unhandledRejections, 0, 'No unhandled promise rejections should occur');

  const failedJob = summary.results.find((r) => r.jobId === 'j2');
  assert.ok(failedJob, 'Job j2 should be in results');
  assert.strictEqual(failedJob.status, 'failed');
  assert.ok(failedJob.error?.includes('Bad luck number 13'), 'Error message preserved');

  console.log('PASS: Asynchronous batch processor completed cleanly without unhandled rejections.');
  process.exit(0);
}

run().catch((err) => {
  console.error('Test run failed with error:', err);
  process.exit(1);
});
