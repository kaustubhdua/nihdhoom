import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');

test('clearance status never sets the non-burning verification flag', () => {
  const controller = read('../src/state/useAppController.ts');
  assert.match(controller, /is_verified_non_burn: newStatus === 'VERIFIED_NON_BURN'/);
  assert.doesNotMatch(controller, /is_verified_non_burn:\s*\n\s*newStatus === 'CLEARED_PENDING_AUDIT'/);
});

test('live field drawer cannot open an illustrative verification certificate', () => {
  const drawer = read('../src/components/OpsConsole/FieldDetailDrawer.tsx');
  assert.match(drawer, /demoMode \? \(/);
  assert.match(drawer, /View illustrative demo record/);
  assert.match(drawer, /Production verification record unavailable/);
});
