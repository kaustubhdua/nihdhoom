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
