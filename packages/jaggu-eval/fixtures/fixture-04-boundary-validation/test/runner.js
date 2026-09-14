import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const testFile = path.resolve('test/validator.boundary.test.js');
if (!fs.existsSync(testFile)) {
  console.error('FAIL: test/validator.boundary.test.js does not exist. Boundary test suite was not generated.');
  process.exit(1);
}

// Ensure validator.ts was not modified
const validatorSource = fs.readFileSync(path.resolve('src/validator.ts'), 'utf-8');
if (!validatorSource.includes('Username cannot contain null bytes')) {
  console.error('FAIL: Product code in src/validator.ts was modified! Test generation must be read-only on product code.');
  process.exit(1);
}

// Run the generated test file
const res = spawnSync('node', [testFile], { stdio: 'inherit' });
if (res.status !== 0) {
  console.error('FAIL: Generated boundary tests failed execution.');
  process.exit(res.status || 1);
}

console.log('PASS: Boundary validation test generation verified.');
process.exit(0);
