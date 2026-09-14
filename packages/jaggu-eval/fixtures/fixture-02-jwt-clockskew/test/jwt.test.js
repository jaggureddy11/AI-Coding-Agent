import assert from 'assert';
import { verifyToken } from '../src/jwtVerifier.ts';

console.log('Running JWT Verification clock skew test suite...');

const now = 1700000000;

// 1. Valid unexpired token
const valid = verifyToken({ sub: 'user_1', exp: now + 100 }, now, { clockToleranceSec: 5 });
assert.strictEqual(valid, true, 'Valid token should verify');

// 2. Token expired by 2 seconds, but clockToleranceSec is 5 seconds.
// MUST pass if clock skew is properly handled!
const skewed = verifyToken({ sub: 'user_2', exp: now - 2 }, now, { clockToleranceSec: 5 });
if (!skewed) {
  console.error('FAIL: Token expired by 2 seconds was rejected despite 5 second clock skew tolerance.');
  process.exit(1);
}

// 3. Token expired by 10 seconds, with clockToleranceSec of 5 seconds.
// MUST fail because it exceeds the tolerance window.
const expired = verifyToken({ sub: 'user_3', exp: now - 10 }, now, { clockToleranceSec: 5 });
assert.strictEqual(expired, false, 'Token exceeding clock skew tolerance should fail');

console.log('PASS: All JWT clock skew tests passed.');
process.exit(0);
