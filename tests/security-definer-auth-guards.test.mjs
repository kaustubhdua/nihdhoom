import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const migrationPath = new URL('../supabase/migrations/202610110001_nirdhoom_security_definer_auth_guards.sql', import.meta.url);
const bundlePath = new URL('../supabase/all-migrations.sql', import.meta.url);
const migration = fs.readFileSync(migrationPath, 'utf8');
const bundle = fs.readFileSync(bundlePath, 'utf8');

const functions = [
  'accept_buyer_offer',
  'cancel_clearance_booking',
  'create_residue_pool',
  'join_residue_pool',
  'record_verification_review',
  'reserve_clearance_booking_v2',
  'transition_job',
  'verify_field_geometry',
];

function bodyFor(name) {
  const start = migration.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  assert.notEqual(start, -1, `missing replacement for ${name}`);
  const end = migration.indexOf('$function$;', start);
  assert.notEqual(end, -1, `unterminated function body for ${name}`);
  return migration.slice(start, end + '$function$;'.length);
}

test('all flagged SECURITY DEFINER RPCs are replaced with explicit auth guards', () => {
  for (const name of functions) {
    const body = bodyFor(name);
    assert.match(body, /SECURITY DEFINER/i, `${name} must remain SECURITY DEFINER`);
    assert.match(body, /SET search_path TO ''/i, `${name} must pin an empty search_path`);
    if (name === 'create_residue_pool' || name === 'join_residue_pool') {
      assert.match(body, /if actor is null then raise exception 'authentication required'; end if;/i, `${name} must reject missing auth`);
    } else {
      assert.match(body, /if auth\.uid\(\) is null then raise exception 'authentication required'; end if;/i, `${name} must reject missing auth`);
    }
  }
});

test('role-gated RPCs reject null or missing profile roles', () => {
  for (const name of ['accept_buyer_offer', 'create_residue_pool', 'record_verification_review', 'verify_field_geometry']) {
    assert.match(bodyFor(name), /coalesce\(role_name, ''\) not in/i, `${name} must fail closed for a missing role`);
  }
});

test('job transitions require a linked operator or an operations role', () => {
  assert.match(bodyFor('transition_job'), /role_name = 'operator' and j\.operator_id=auth\.uid\(\)/i);
  assert.match(bodyFor('transition_job'), /coalesce\(role_name, ''\) in \('dispatcher','admin'\)/i);
});

test('authenticated operational RPC grants are restored and anonymous execution revoked', () => {
  for (const name of functions) {
    assert.match(migration, new RegExp(`revoke all on function public\\.${name}\\(`, 'i'));
    assert.match(migration, new RegExp(`grant execute on function public\\.${name}\\(.*?\\) to authenticated;`, 'is'));
  }
});

test('fresh-install bundle contains the same security migration', () => {
  const marker = '-- >>> 202610110001_nirdhoom_security_definer_auth_guards.sql';
  assert.ok(bundle.includes(marker), 'security migration marker is missing from bundle');
  assert.ok(bundle.includes(migration.trim()), 'security migration content differs from bundled content');
});
