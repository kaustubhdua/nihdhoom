import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const migrationPath = 'supabase/migrations/202610120005_nirdhoom_p0_booking_verification_privileges.sql';

test('P0 migration is registered in the approved bundle order', () => {
  const manifest = read('supabase/migration-order.txt').trim().split(/\r?\n/);
  const bundle = read('supabase/all-migrations.sql');
  assert.equal(manifest.filter((name) => name === '202610120005_nirdhoom_p0_booking_verification_privileges.sql').length, 1);
  assert.ok(bundle.includes('-- >>> 202610120005_nirdhoom_p0_booking_verification_privileges.sql'));
  assert.ok(bundle.includes('CREATE CONSTRAINT TRIGGER bookings_require_capacity_reservation'));
});

test('booking only guarantees a date after locking and reserving a matching capacity window', () => {
  const sql = read(migrationPath);
  assert.match(sql, /FOR UPDATE OF cw, m SKIP LOCKED/i);
  assert.match(sql, /existing reserved acres lack auditable reservation rows/i);
  assert.match(sql, /capacity_window_matches_reservations/i);
  assert.match(sql, /active_w\.window_start < cw\.window_end/i);
  assert.match(sql, /A machine cannot have active reservations in overlapping capacity windows/i);
  assert.match(sql, /cw\.reserved_acres \+ f\.acreage <= cw\.capacity_acres/i);
  assert.match(sql, /INSERT INTO public\.booking_capacity_reservations/i);
  assert.match(sql, /v_booking_status text := 'REQUESTED'/i);
  assert.match(sql, /v_guaranteed := p_requested_date/i);
  assert.match(sql, /penalty_status','disabled_until_contract_approval/i);
  assert.match(sql, /A guaranteed booking requires an active matching machine-capacity reservation/i);
});

test('cancellation releases the capacity reservation and clears the guarantee', () => {
  const sql = read(migrationPath);
  assert.match(sql, /SET status = 'RELEASED', released_at = now\(\)/i);
  assert.match(sql, /reserved_acres = greatest\(0, reserved_acres - r\.reserved_acres\)/i);
  assert.match(sql, /guaranteed_by_date = NULL/i);
});

test('verification records only explicitly selected, field-matched FIRMS observations', () => {
  const sql = read(migrationPath);
  assert.match(sql, /o\.id = ANY\(firms_ids\) AND o\.matched_field_id = p_field_id/i);
  assert.match(sql, /verification_method := CASE[\s\S]*'reviewer_assessment_only'/i);
  assert.match(sql, /'acquired_at', o\.acquired_at/i);
  assert.match(sql, /Absence of a matching or selected FIRMS observation is not proof that burning did not occur/i);
});

test('anonymous access is revoked without revoking authenticated application table reads', () => {
  const sql = read(migrationPath);
  assert.match(sql, /REVOKE ALL PRIVILEGES ON TABLE public\.%I FROM PUBLIC, anon/i);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.reserve_clearance_booking_v2\(uuid,date\) TO authenticated/i);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.record_verification_review\(uuid,text,numeric,jsonb\) TO authenticated/i);
});
