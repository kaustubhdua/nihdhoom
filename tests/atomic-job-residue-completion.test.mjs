import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('atomic completion migration is registered and bundled in release order', () => {
  const migration = '202610120004_atomic_job_residue_completion.sql';
  const manifest = read('supabase/migration-order.txt').trim().split(/\r?\n/);
  const bundle = read('supabase/all-migrations.sql');
  assert.equal(manifest.filter((name) => name === migration).length, 1);
  assert.ok(bundle.includes(`-- >>> ${migration}`));
  assert.ok(bundle.includes('create or replace function public.complete_job_with_residue_lot'));
});

test('completion RPC locks the job, authorizes the actor, and commits lot plus job state together', () => {
  const sql = read('supabase/migrations/202610120004_atomic_job_residue_completion.sql');
  assert.match(sql, /from public\.jobs where id = p_job_id for update/i);
  assert.match(sql, /role_name = 'operator' and j\.operator_id = auth\.uid\(\)/i);
  assert.match(sql, /from public\.evidence_assets e/i);
  assert.ok(sql.includes('e.created_at >= j.created_at'));
  assert.match(sql, /insert into public\.residue_lots/i);
  assert.match(sql, /update public\.jobs\s+set status = 'COMPLETED'/i);
  assert.match(sql, /update public\.bookings\s+set status = 'CLEARED_PENDING_AUDIT'/i);
  assert.match(sql, /update public\.fields\s+set status = 'CLEARED_PENDING_AUDIT'/i);
  assert.match(sql, /revoke all on function public\.complete_job_with_residue_lot/i);
  assert.match(sql, /grant execute on function public\.complete_job_with_residue_lot.*to authenticated/i);
});

test('operator completion uses one RPC and does not insert residue lots from the browser', () => {
  const source = read('src/components/FieldOperator/BalerPWA.tsx');
  assert.match(source, /rpc\('complete_job_with_residue_lot'/);
  assert.doesNotMatch(source, /from\('residue_lots'\)\s*\.insert\(/);
  assert.match(source, /Enter the measured residue quantity in tonnes before completing this job/);
});


test('completion RPC rejects invalid measurements and malformed metadata before writes', () => {
  const sql = read('supabase/migrations/202610120004_atomic_job_residue_completion.sql');
  assert.match(sql, /p_quantity_tonnes is null or p_quantity_tonnes <= 0 or p_quantity_tonnes > 10000/i);
  assert.match(sql, /p_moisture_pct is null or p_moisture_pct < 0 or p_moisture_pct > 100/i);
  assert.match(sql, /p_bales_count is null or p_bales_count < 1 or p_bales_count > 1000000/i);
  assert.match(sql, /jsonb_typeof\(p_metadata\) <> 'object'/i);
  assert.match(sql, /authentication required/i);
});

test('completion RPC is hardened against search-path substitution and limits execution grants', () => {
  const sql = read('supabase/migrations/202610120004_atomic_job_residue_completion.sql');
  assert.match(sql, /security definer\s+set search_path = ''/i);
  assert.match(sql, /revoke all on function public\.complete_job_with_residue_lot\(uuid, numeric, numeric, integer, jsonb\) from public, anon/i);
  assert.match(sql, /grant execute on function public\.complete_job_with_residue_lot\(uuid, numeric, numeric, integer, jsonb\) to authenticated/i);
  assert.doesNotMatch(sql, /grant execute on function public\.complete_job_with_residue_lot[^;]*to anon/i);
});

test('completion RPC requires fresh stored evidence and is retry-safe for an existing completed lot', () => {
  const sql = read('supabase/migrations/202610120004_atomic_job_residue_completion.sql');
  assert.match(sql, /e\.created_at >= j\.created_at/i);
  assert.match(sql, /e\.kind in \('field_photo', 'bale_photo', 'weighment'\)/i);
  assert.match(sql, /e\.storage_path is not null/i);
  assert.match(sql, /if j\.status = 'COMPLETED' and found then[\s\S]*?'created', false[\s\S]*?'replayed', true/i);
  assert.match(sql, /a residue lot already exists for this unfinished job/i);
  assert.match(sql, /from public\.jobs where id = p_job_id for update/i);
});

test('completion RPC updates job, booking, field, and lot within one database function', () => {
  const sql = read('supabase/migrations/202610120004_atomic_job_residue_completion.sql');
  const insertAt = sql.search(/insert into public\.residue_lots/i);
  const jobUpdateAt = sql.search(/update public\.jobs\s+set status = 'COMPLETED'/i);
  const bookingUpdateAt = sql.search(/update public\.bookings\s+set status = 'CLEARED_PENDING_AUDIT'/i);
  const fieldUpdateAt = sql.search(/update public\.fields\s+set status = 'CLEARED_PENDING_AUDIT'/i);
  assert.ok(insertAt >= 0 && jobUpdateAt > insertAt);
  assert.ok(bookingUpdateAt > jobUpdateAt);
  assert.ok(fieldUpdateAt > bookingUpdateAt);
  assert.match(sql, /return jsonb_build_object\([\s\S]*?'lot_id', lot\.id[\s\S]*?'created', true[\s\S]*?'replayed', false/i);
});
