import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { App } from '../src/app.ts';
import { defaultLogger } from '../src/logger.ts';

console.log('Running correlation ID tracing verification suite...');

// Check middleware file exists
const mwPath = path.resolve('src/middleware/correlation.ts');
if (!fs.existsSync(mwPath)) {
  console.error('FAIL: src/middleware/correlation.ts was not created.');
  process.exit(1);
}

const { correlationMiddleware } = await import('../src/middleware/correlation.ts');

const app = new App();
app.use(correlationMiddleware);
defaultLogger.clear();

function createMockRes() {
  return {
    statusCode: 200,
    headers: {},
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    status(c) { this.statusCode = c; return this; },
    json(d) { this.body = JSON.stringify(d); },
  };
}

// 1. Incoming correlation ID is preserved
const req1 = {
  headers: { 'x-correlation-id': 'client-trace-999' },
  path: '/api/resource',
  method: 'GET',
};
const res1 = createMockRes();

app.handle(req1, res1, (req, res) => {
  res.json({ ok: true });
});

assert.strictEqual(req1.correlationId, 'client-trace-999', 'Incoming ID should be attached to request');
assert.strictEqual(res1.headers['x-correlation-id'], 'client-trace-999', 'Response header must contain correlation ID');

// 2. Missing incoming ID generates one automatically
const req2 = {
  headers: {},
  path: '/api/resource',
  method: 'POST',
};
const res2 = createMockRes();

app.handle(req2, res2, (req, res) => {
  res.json({ ok: true });
});

assert.ok(req2.correlationId, 'Generated ID must exist on request');
assert.ok(req2.correlationId.length > 5, 'Generated ID must be non-empty');
assert.strictEqual(res2.headers['x-correlation-id'], req2.correlationId, 'Generated ID must be on response');

// 3. Logger received correlation IDs
const logs = defaultLogger.getLogs();
assert.strictEqual(logs.length, 2, '2 logs should be recorded');
assert.strictEqual(logs[0].correlationId, 'client-trace-999', 'Log 1 correlation ID matches');
assert.strictEqual(logs[1].correlationId, req2.correlationId, 'Log 2 correlation ID matches generated ID');

console.log('PASS: Request correlation ID tracing verified.');
process.exit(0);
