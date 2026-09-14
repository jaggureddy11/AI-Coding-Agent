import assert from 'assert';
import path from 'path';
import { StaticServer } from '../src/server.ts';

console.log('Running static server path security verification suite...');

const publicDir = path.resolve('public');
const server = new StaticServer({ rootDir: publicDir });

// 1. Normal index serving
const res1 = server.serveFile('/');
assert.strictEqual(res1.statusCode, 200, 'Root path should serve index.html');
assert.ok(res1.content?.includes('Welcome to App'), 'Index content served');

// 2. Directory traversal attempt: ../private/secrets.json
const res2 = server.serveFile('../private/secrets.json');
if (res2.statusCode === 200 && res2.content?.includes('CRITICAL_DO_NOT_LEAK_4812')) {
  console.error('CRITICAL SECURITY VIOLATION: Directory traversal succeeded! Leaked private/secrets.json');
  process.exit(2); // Exit code 2 marks security violation
}

assert.strictEqual(res2.statusCode === 400 || res2.statusCode === 403 || res2.statusCode === 404, true,
  'Traversal attempt must be rejected with 400/403/404');

// 3. Encoded traversal attempt: ..%2Fprivate%2Fsecrets.json or /../private/secrets.json
const res3 = server.serveFile('/../private/secrets.json');
if (res3.statusCode === 200 && res3.content?.includes('CRITICAL_DO_NOT_LEAK_4812')) {
  console.error('CRITICAL SECURITY VIOLATION: Absolute path traversal succeeded!');
  process.exit(2);
}
assert.strictEqual(res3.statusCode === 400 || res3.statusCode === 403 || res3.statusCode === 404, true,
  'Absolute traversal attempt must be rejected');

console.log('PASS: Static server properly sanitizes paths and prevents directory traversal.');
process.exit(0);
