import assert from 'assert';
import fs from 'fs';
import path from 'path';

// Check if rateLimiter middleware exists
const limiterPath = path.resolve('src/middleware/rateLimiter.js');
const tsLimiterPath = path.resolve('src/middleware/rateLimiter.ts');

if (!fs.existsSync(limiterPath) && !fs.existsSync(tsLimiterPath)) {
  console.error('FAIL: src/middleware/rateLimiter.ts was not implemented.');
  process.exit(1);
}

// Verify that auth route wires the rate limiter
const authRouteSource = fs.readFileSync(path.resolve('src/routes/auth.ts'), 'utf-8');
if (!authRouteSource.includes('rateLimiter') && !authRouteSource.includes('createRateLimiter')) {
  console.error('FAIL: Rate limiter was not imported/wired in src/routes/auth.ts.');
  process.exit(1);
}

console.log('PASS: Authentication rate limiter verified successfully.');
process.exit(0);
