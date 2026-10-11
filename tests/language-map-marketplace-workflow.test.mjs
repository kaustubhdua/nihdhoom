import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const language = read('../src/i18n/LanguageContext.tsx');
const main = read('../src/main.jsx');
const header = read('../src/components/Header.tsx');
const map = read('../src/components/OpsConsole/OpsMap.tsx');
const marketplace = read('../src/components/ResiduePooling/ResiduePooling.tsx');
const workflow = read('../supabase/migrations/202610110002_nirdhoom_marketplace_transaction_workflow.sql');
const bundle = read('../supabase/all-migrations.sql');

test('Hindi language is shared across the app and persisted', () => {
  assert.match(main, /<LanguageProvider>/);
  assert.match(header, /useAppLanguage/);
  assert.match(language, /nirdhoom\.farmer\.language/);
  assert.match(language, /document\.documentElement\.lang = language/);
  assert.match(language, /'My Fields': 'मेरे खेत'/);
});

test('live map uses stored device locations instead of simulated GPS movement', () => {
  assert.match(map, /from\('machine_locations'\)/);
  assert.match(map, /setInterval\(\(\) => void refreshLocations\(\), 15_000\)/);
  assert.match(map, /30 \* 60 \* 1000/);
  assert.doesNotMatch(map, /simulate GPS drift|lerp 8% toward target/i);
  assert.match(map, /tile\.openstreetmap\.org/);
  assert.match(map, /Imagery © Esri/);
});

test('buyers can offer only on verified available lots and cannot accept their own offer', () => {
  assert.match(workflow, /CREATE OR REPLACE FUNCTION public\.matchable_residue_lots\(\)/i);
  assert.match(workflow, /l\.verified_quantity_tonnes > 0/i);
  assert.match(workflow, /d\.location_lat IS NOT NULL AND d\.location_lng IS NOT NULL/i);
  assert.match(workflow, /<= d\.radius_km/i);
  assert.match(workflow, /CREATE OR REPLACE FUNCTION public\.create_buyer_offer/i);
  assert.match(workflow, /COALESCE\(role_name, ''\) <> 'buyer'/i);
  assert.match(workflow, /p_quantity_tonnes > LEAST\(lot_row\.quantity_tonnes, lot_row\.verified_quantity_tonnes\)/i);
  assert.match(workflow, /COALESCE\(role_name, ''\) NOT IN \('farmer','dispatcher','admin'\)/i);
  assert.match(workflow, /Only the owning farmer can accept this offer/i);
});

test('accepted offers create a transport job and transport transitions enforce role and status', () => {
  assert.match(workflow, /'accepted_buyer_offer'/);
  assert.match(workflow, /CREATE OR REPLACE FUNCTION public\.transition_residue_transport_job/i);
  for (const status of ['PROPOSED','ASSIGNED','EN_ROUTE','ARRIVED','DELIVERED']) {
    assert.ok(workflow.includes(status), `missing transport status ${status}`);
  }
  assert.match(workflow, /m\.operator_user_id = actor/);
  assert.match(workflow, /REVOKE ALL ON FUNCTION public\.transition_residue_transport_job/i);
  assert.match(workflow, /GRANT EXECUTE ON FUNCTION public\.transition_residue_transport_job/i);
});

test('fresh-install migration bundle contains the workflow migration', () => {
  assert.match(bundle, /-- >>> 202610110002_nirdhoom_marketplace_transaction_workflow\.sql/);
  assert.ok(bundle.includes(workflow.trim()));
});

test('marketplace UI connects offer, acceptance, and delivery RPCs', () => {
  assert.match(marketplace, /rpc\('matchable_residue_lots'/);
  assert.match(marketplace, /rpc\('create_buyer_offer'/);
  assert.match(marketplace, /rpc\('accept_buyer_offer'/);
  assert.match(marketplace, /rpc\('transition_residue_transport_job'/);
});
