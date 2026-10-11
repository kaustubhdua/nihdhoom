import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');

test('offline evidence is bound to the user who captured it', () => {
  const queue = read('../src/lib/offlineEvidenceQueue.ts');
  const baler = read('../src/components/FieldOperator/BalerPWA.tsx');
  assert.match(queue, /ownerUserId: string/);
  assert.equal((baler.match(/ownerUserId: user\.id/g) || []).length, 2);
});

test('offline replay refuses cross-account and legacy unbound queue records', () => {
  const queue = read('../src/lib/offlineEvidenceQueue.ts');
  const guard = queue.indexOf('if (!item.ownerUserId || item.ownerUserId !== user.id) continue;');
  const pathCreation = queue.indexOf('const path =', guard);
  const upload = queue.indexOf("storage.from('evidence').upload(path", guard);
  assert.ok(guard >= 0, 'queue replay must fail closed for missing or mismatched owner');
  assert.ok(pathCreation > guard, 'storage path must not be created before ownership check');
  assert.ok(upload > guard, 'upload must not occur before ownership check');
});

test('offline evidence replay recovers safely after partial upload or lost response', () => {
  const queue = read('../src/lib/offlineEvidenceQueue.ts');
  assert.match(queue, /\.eq\('storage_path', path\)/);
  assert.match(queue, /if \(existing\.error\) continue;/);
  assert.match(queue, /if \(existing\.data\) \{\s*await removeQueued\(item\.id\);/);
  assert.match(queue, /upload\.error\.statusCode !== '409'/);
  assert.match(queue, /upsert: false/);
});
