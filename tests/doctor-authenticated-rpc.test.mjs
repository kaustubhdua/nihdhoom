import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('setup doctor does not mislabel protected RPCs as missing from an anon probe', () => {
  const doctor = fs.readFileSync(new URL('../scripts/doctor.mjs', import.meta.url), 'utf8');
  assert.match(doctor, /cannot be verified with a signed-out public key/);
  assert.match(doctor, /do not grant anon execution just to satisfy this check/);
  assert.doesNotMatch(doctor, /Booking functions are missing/);
  assert.doesNotMatch(doctor, /const fns = \['reserve_clearance_booking_v2'/);
});
