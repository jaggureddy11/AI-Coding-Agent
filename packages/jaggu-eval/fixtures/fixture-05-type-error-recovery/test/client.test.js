import assert from 'assert';
import fs from 'fs';
import path from 'path';

// Check that client.ts returns structured object { id, data }
const clientSource = fs.readFileSync(path.resolve('src/client.ts'), 'utf-8');
if (!clientSource.includes('{ id: string; data: string }') && !clientSource.includes('Promise<RecordResult>')) {
  console.error('FAIL: ApiClient.getRecord signature was not updated to return structured object.');
  process.exit(1);
}

// Check that service.ts properly handles the updated structured object
const serviceSource = fs.readFileSync(path.resolve('src/service.ts'), 'utf-8');
if (!serviceSource.includes('raw.data.length') && !serviceSource.includes('raw.data')) {
  console.error('FAIL: ConsumerService in src/service.ts was not updated to resolve the type mismatch.');
  process.exit(1);
}

console.log('PASS: Type error recovery successfully verified.');
process.exit(0);
