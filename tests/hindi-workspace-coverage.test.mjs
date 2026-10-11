import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const app = read('../src/App.tsx');
const header = read('../src/components/Header.tsx');
const language = read('../src/i18n/LanguageContext.tsx');

test('workspace title, eyebrow, description, action and journey all use the shared translator', () => {
  assert.match(app, /\{t\(meta\.eyebrow\)\}/);
  assert.match(app, /\{t\(meta\.title\)\}/);
  assert.match(app, /\{t\(meta\.description\)\}/);
  assert.match(app, /\{t\(meta\.action\.label\)\}/);
  assert.match(app, /\{t\(item\.label\)\}/);
  assert.match(app, /demoMode \? t\('Demo records'\) : t\('Live records'\)/);
});

test('Hindi dictionary covers the workspace metadata and navigation labels', () => {
  const keys = [
    'My Fields & Clearance Jobs', 'Book crop-residue clearance', 'Farmer onboarding',
    'Track clearance', 'Operator field workspace', 'Pool verified residue for offtake',
    'Evidence & verification', 'Harvest pressure & timing', 'Impact & research',
    'Buyer offtake & demand', 'Demo records', 'Live records', 'All NIRDHOOM surfaces',
    'Book Parali Pickup', 'Track My Machine', 'Check My Proof', 'My Profile',
  ];
  for (const key of keys) {
    assert.ok(language.includes(`'${key.replaceAll("'", "\\'")}':`), `missing Hindi translation for "${key}"`);
  }
});

test('language switch remains shared, persisted, and accessible on desktop and mobile', () => {
  assert.match(language, /nirdhoom\.farmer\.language/);
  assert.match(language, /document\.documentElement\.lang = language/);
  assert.match(header, /setLanguage\(farmerLanguage === 'en' \? 'hi' : 'en'\)/);
  assert.match(header, /aria-label=\{farmerLabels\.language\}/);
  assert.match(header, /t\('Close navigation'\)/);
  assert.match(header, /t\('All NIRDHOOM surfaces'\)/);
});
