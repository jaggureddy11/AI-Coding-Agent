import assert from 'assert';
import { createApp } from '../src/app.ts';
import { verifyAuthHeader } from '../src/services/authService.ts';

console.log('Verifying architecture trace fixture integrity...');
const app = createApp();
assert.strictEqual(app.routes.length, 2);

const valid = verifyAuthHeader('Bearer token_user123_admin');
assert.strictEqual(valid, true, 'Valid token should be authenticated');

const invalid = verifyAuthHeader('Bearer invalid_token');
assert.strictEqual(invalid, false, 'Invalid token should be rejected');

console.log('PASS: Architecture trace fixture verified.');
process.exit(0);
