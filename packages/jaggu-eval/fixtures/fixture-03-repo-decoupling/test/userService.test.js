import assert from 'assert';
import { UserService } from '../src/userService.ts';
import fs from 'fs';
import path from 'path';

console.log('Running UserService decoupling test suite...');

const service = new UserService();
const user = service.getUser('u1');
assert.strictEqual(user?.name, 'Alice', 'User Alice should be fetched correctly');

// Check that IUserRepository or an interface/adapter was introduced
const interfacePath = path.resolve('src/interfaces/IUserRepository.ts');
const adapterPath = path.resolve('src/adapters/SqliteUserRepository.ts');

if (!fs.existsSync(interfacePath)) {
  console.error('FAIL: src/interfaces/IUserRepository.ts was not created.');
  process.exit(1);
}

if (!fs.existsSync(adapterPath)) {
  console.error('FAIL: src/adapters/SqliteUserRepository.ts was not created.');
  process.exit(1);
}

// Check that UserService no longer imports sqliteClient directly
const serviceSource = fs.readFileSync(path.resolve('src/userService.ts'), 'utf-8');
if (serviceSource.includes('./db/sqliteClient.js') || serviceSource.includes('./db/sqliteClient')) {
  console.error('FAIL: UserService still directly imports db/sqliteClient.');
  process.exit(1);
}

console.log('PASS: UserService repository decoupling verified.');
process.exit(0);
