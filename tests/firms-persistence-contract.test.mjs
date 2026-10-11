import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');

test('FIRMS ingestion requires an authenticated field and server-only persistence credentials', () => {
  const api = read('api/firms.ts');
  assert.match(api, /Authentication required/);
  assert.match(api, /fields\?id=eq\./);
  assert.match(api, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(api, /Server-side Supabase persistence is not configured/);
  assert.match(api, /signal: AbortSignal\.timeout/);
});

test('FIRMS persistence is idempotent and links observations to fields separately', () => {
  const api = read('api/firms.ts');
  assert.match(api, /provider_observation_key/);
  assert.match(api, /new Map<string, typeof parsed\[number\]>/);
  assert.match(api, /on_conflict=provider_observation_key/);
  assert.match(api, /on_conflict=observation_id,field_id/);
  assert.match(api, /firms_observation_field_matches/);
  assert.match(api, /SAVED_WITH_IDEMPOTENT_PROVIDER_KEYS/);
});

test('verification accepts only persisted field matches and never treats no detections as proof', () => {
  const sql = read('supabase/migrations/202610120005_nirdhoom_p0_booking_verification_privileges.sql');
  const ui = read('src/components/VerificationLayer/SatelliteAudit.tsx');
  assert.match(sql, /EXISTS \([\s\S]*firms_observation_field_matches m[\s\S]*m\.field_id = p_field_id/i);
  assert.match(sql, /Absence of a matching or selected FIRMS observation is not proof that burning did not occur/i);
  assert.match(ui, /firms_observation_ids: firmsScreenings\[field\.id\]/);
  assert.match(ui, /Only explicitly selected, persisted observations matched to this field are included/);
  assert.match(ui, /no detection is not proof of no burning/i);
});

test('FIRMS observations and match records remain server-only under RLS', () => {
  const sql = read('supabase/migrations/202610120005_nirdhoom_p0_booking_verification_privileges.sql');
  assert.match(sql, /ALTER TABLE public\.firms_observation_field_matches ENABLE ROW LEVEL SECURITY/i);
  assert.match(sql, /REVOKE ALL PRIVILEGES ON TABLE public\.firms_observation_field_matches FROM PUBLIC, anon, authenticated/i);
  assert.match(sql, /GRANT ALL PRIVILEGES ON TABLE public\.firms_observations, public\.firms_observation_field_matches TO service_role/i);
});

test('live Sathi answers never trust a client-supplied field record', () => {
  const api = read('api/assistant.ts');
  assert.match(api, /else if \(!demoMode\)[\s\S]*?A saved field ID is required for live field-specific answers/);
  assert.match(api, /if \(!liveField\) return res\.status\(404\)\.json\(\{error:'Saved field not found or not accessible to this account'\}\)/);
  assert.match(api, /const source=liveField\|\|\(demoMode\?\(field\|\|\{\}\):\{\}\)/);
});
