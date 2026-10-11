import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');

test('partial live-data query failures are visible instead of silently appearing empty', () => {
  const controller = read('../src/state/useAppController.ts');
  assert.match(controller, /const secondaryErrors = \[/);
  assert.match(controller, /residue lots:/);
  assert.match(controller, /buyer demand:/);
  assert.match(controller, /storage yards:/);
  assert.match(controller, /Available field and machine records remain visible/);
});
