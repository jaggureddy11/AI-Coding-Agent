import assert from 'assert';
import { MemoryCache } from '../src/cache.ts';

console.log('Running MemoryCache TTL eviction verification suite...');

async function testCache() {
  const cache = new MemoryCache(50); // 50ms default TTL

  // 1. Basic store and retrieve with longer TTL
  cache.set('key1', 'val1', 5000);
  assert.strictEqual(cache.get('key1'), 'val1', 'Value should be retrieved');

  // 2. Immediate retention check
  assert.strictEqual(cache.getRetainedSize(), 1, 'Retained size should be 1');

  // 3. Set short TTL entry and wait for expiry
  cache.set('shortKey', 'ephemeral', 20);
  assert.strictEqual(cache.getRetainedSize(), 2, 'Retained size should be 2');

  await new Promise((r) => setTimeout(r, 60));

  // 4. Verification of TTL expiration
  const val = cache.get('shortKey');
  assert.strictEqual(val, undefined, 'Expired key should return undefined');

  // 5. Memory leak verification:
  // After expiration and access (or active purge), the expired key MUST be evicted from retained storage!
  const retained = cache.getRetainedSize();
  if (retained > 1) {
    console.error(`FAIL: Memory leak detected! Expired key 'shortKey' remains retained in cache store. Retained size: ${retained} (expected 1).`);
    process.exit(1);
  }

  assert.strictEqual(retained, 1, 'Expired entry must be pruned from retained storage');
  assert.strictEqual(cache.has('shortKey'), false, 'Expired entry must not be present');

  console.log('PASS: Cache TTL eviction and memory leak fix verified.');
  process.exit(0);
}

testCache().catch((err) => {
  console.error('Test threw unexpected error:', err);
  process.exit(1);
});
