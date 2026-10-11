import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const migrationNames = read('supabase/migration-order.txt').trim().split(/\r?\n/);
const migrationSql = migrationNames.map((name) => read(`supabase/migrations/${name}`)).join('\n');

function latestFunction(name) {
  const pattern = new RegExp('CREATE OR REPLACE FUNCTION public\\\\.' + name + '\\\\s*\\\\(', 'gi');
  const matches = [...migrationSql.matchAll(pattern)];
  assert.ok(matches.length > 0, `missing SQL definition for public.${name}`);
  const start = matches[matches.length - 1].index;
  const end = migrationSql.indexOf('$function$;', start);
  assert.ok(end > start, `could not locate function body for public.${name}`);
  return migrationSql.slice(start, end + '$function$;'.length);
}

const contracts = [
  ['accept_buyer_offer', /role_name[^;]{0,180}not in \('buyer','dispatcher','admin'\)/is, /offer does not belong to the authenticated buyer/i],
  ['cancel_clearance_booking', /f\.owner_id=auth\.uid\(\)/i, /Booking is not owned by the current farmer/i],
  ['create_residue_pool', /role_name[^;]{0,180}not in \('buyer','dispatcher','admin'\)/is, /buyer demand is not available to this user/i],
  ['join_residue_pool', /f\.owner_id=actor/i, /no verified residue lot with sufficient uncommitted quantity/i],
  ['record_farmer_network_consent', /role_name[^;]{0,180}<>\s*'farmer'/is, /authentication required/i],
  ['record_verification_review', /role_name[^;]{0,180}not in \('verifier','dispatcher','admin'\)/is, /authentication required/i],
  ['reserve_clearance_booking_v2', /f\.owner_id\s*<>\s*auth\.uid\(\)/i, /Active farmer consent is required/i],
  ['transition_job', /j\.operator_id=auth\.uid\(\)/i, /Invalid job transition/i],
  ['verify_field_geometry', /role_name[^;]{0,180}not in \('verifier','dispatcher','admin'\)/is, /boundary is required/i],
];

test('all exposed SECURITY DEFINER workflow RPCs pin search_path and reject anonymous actors', () => {
  for (const [name] of contracts) {
    const sql = latestFunction(name);
    assert.match(sql, /SECURITY DEFINER/i, `${name} must be SECURITY DEFINER`);
    assert.match(sql, /SET search_path TO ''/i, `${name} must pin an empty search_path`);
    assert.match(sql, /(?:auth\.uid\(\)|actor)\s+is\s+null/i, `${name} must reject a missing actor`);
  }
});

test('workflow RPCs enforce role, ownership or assignment predicates rather than trusting UI visibility', () => {
  for (const [name, roleOrOwner, stateGuard] of contracts) {
    const sql = latestFunction(name);
    assert.match(sql, roleOrOwner, `${name} must enforce its role/ownership predicate`);
    assert.match(sql, stateGuard, `${name} must enforce a server-side state/ownership guard`);
  }
});
