import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const routes = [
  'api/firms.ts',
  'api/quote.ts',
  'api/assistant.ts',
  'api/cadastral.ts',
  'api/weather.ts',
  'api/dispatch.ts',
  'api/notify/ivr.ts',
];

test('Vercel API handlers use explicit .js specifiers for local rate-limit imports', () => {
  for (const route of routes) {
    const source = fs.readFileSync(path.join(root, route), 'utf8');
    assert.match(
      source,
      /from ['"](?:\.\/|\.\.\/)\_lib\/rateLimit\.js['"]/,
      `${route} must use a Node ESM-compatible .js import specifier`,
    );
    assert.doesNotMatch(
      source,
      /from ['"](?:\.\/|\.\.\/)\_lib\/rateLimit['"]/,
      `${route} must not leave the local rate-limit import extensionless`,
    );
  }
});
