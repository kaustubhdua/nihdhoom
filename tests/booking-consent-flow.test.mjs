import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const booking = read('../src/components/ClearanceBooking/ClearanceBooking.tsx');
const migration = read('../supabase/migrations/202610110003_nirdhoom_booking_consent_and_window.sql');

test('booking consent RPC runs before the booking RPC and allows explicit re-consent', () => {
  assert.ok(booking.indexOf("rpc('record_farmer_network_consent')") < booking.indexOf("rpc('reserve_clearance_booking_v2'"));
  assert.match(migration, /ON CONFLICT \(profile_id, consent_type, version\)/);
  assert.match(migration, /revoked_at = NULL/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.record_farmer_network_consent\(\) TO authenticated/);
});

test('booking date window is enforced in both the UI and database', () => {
  assert.match(booking, /max={maxBookingDate}/);
  assert.match(booking, /date > maxBookingDate/);
  assert.match(migration, /p_requested_date > current_date \+ 90/);
});

test('booking history uses protected read and cancellation workflows', () => {
  assert.match(booking, /from\('bookings'\)/);
  assert.match(booking, /rpc\('cancel_clearance_booking'/);
  assert.match(booking, /\['REQUESTED', 'BOOKED', 'MACHINE_ASSIGNED'\]\.includes\(booking\.status\)/);
  assert.match(booking, /onBookingChanged\?\.\(\)/);
});

test('live booking only offers fields eligible for a new workflow', () => {
  assert.match(booking, /\['REGISTERED', 'CANCELLED'\]\.includes\(f\.status\)/);
  assert.match(migration, /f\.status NOT IN \('REGISTERED', 'CANCELLED'\)/);
  assert.match(migration, /SET status = 'SCHEDULED'/);
});

test('booking RPC remains authenticated-only and server-priced', () => {
  assert.match(migration, /IF auth\.uid\(\) IS NULL THEN RAISE EXCEPTION 'authentication required'/);
  assert.match(migration, /f\.owner_id <> auth\.uid\(\)/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.reserve_clearance_booking_v2\(uuid,date\) FROM PUBLIC, anon/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.reserve_clearance_booking_v2\(uuid,date\) TO authenticated/);
  assert.match(migration, /round\(v_rate \* f\.acreage, 2\)/);
});
