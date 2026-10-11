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

test('every declared navigation tab is wired to a rendered app surface', () => {
  const tabs = [
    'OVERVIEW', 'RESIDUE_POOLS', 'IMPACT_RESEARCH', 'HARVEST_INTELLIGENCE',
    'FIELD_PROVENANCE', 'FIELD_JOBS', 'OPS_CONSOLE', 'FARMER_SURFACE',
    'BALER_OPERATOR', 'SATELLITE_AUDIT', 'OFFTAKE_AUCTION',
    'FARMER_ONBOARDING', 'FARMER_KYC',
  ];
  for (const tab of tabs) {
    assert.ok(header.includes(`' ${tab}'`.trim()) || header.includes(`'${tab}'`), `navigation type missing ${tab}`);
    if (tab === 'OVERVIEW') {
      assert.match(app, /activeTab === 'OVERVIEW'/, 'overview surface must render');
    } else {
      assert.match(app, new RegExp(`activeTab === '${tab}'`), `no explicit render branch for ${tab}`);
    }
  }
});

test('all primary and secondary navigation destinations exist in the typed tab union', () => {
  const union = header.slice(header.indexOf('export type ActiveTab'), header.indexOf(';', header.indexOf('export type ActiveTab')));
  for (const source of [header.match(/const primaryNav: NavItem\[\] = \[([\s\S]*?)\];/)?.[1], header.match(/const secondaryNav: NavItem\[\] = \[([\s\S]*?)\];/)?.[1]]) {
    assert.ok(source, 'navigation list must be defined');
    for (const match of source.matchAll(/id: '([A-Z_]+)'/g)) {
      assert.ok(union.includes(`'${match[1]}'`), `navigation destination ${match[1]} missing from ActiveTab`);
    }
  }
});

test('operator, verification and buyer workflows are reachable from the app render tree', () => {
  for (const name of ['BalerPWA', 'SatelliteAudit', 'MultiOfftakeAuction', 'HarvestForecast', 'ResiduePooling', 'ImpactResearch', 'HarvestIntelligence', 'FieldProvenancePanel', 'FieldJobBoard', 'FieldEvidenceTimeline', 'ClearanceBooking', 'ResidueControlTower', 'TelegramChannel', 'FarmerOnboarding']) {
    assert.ok(app.includes(name), `expected workflow component ${name} to be imported or rendered`);
  }
});
