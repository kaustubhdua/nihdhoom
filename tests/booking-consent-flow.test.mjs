import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const booking = read('../src/components/ClearanceBooking/ClearanceBooking.tsx');
const migration = read('../supabase/migrations/202610110003_nirdhoom_booking_consent_and_window.sql');

test('live booking persists consent before calling the protected booking RPC', () => {
  const consentCall = booking.indexOf("rpc('record_farmer_network_consent')");
  const bookingCall = booking.indexOf("rpc('reserve_clearance_booking_v2'");
  assert.ok(consentCall >= 0, 'booking consent RPC must be called');
  assert.ok(bookingCall > consentCall, 'consent must be persisted before booking');
  assert.match(migration, /ON CONFLICT \(profile_id, consent_type, version\)/);
  assert.match(migration, /revoked_at = NULL/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.record_farmer_network_consent\(\) TO authenticated/);
});

test('booking dates are limited to the server-supported 90-day window', () => {
  assert.match(booking, /max={maxBookingDate}/);
  assert.match(booking, /date > maxBookingDate/);
  assert.match(migration, /p_requested_date > current_date \+ 90/);
  assert.match(migration, /Choose a pickup date within the next 90 days/);
});

test('live booking quote is server-returned and visible after success', () => {
  assert.match(booking, /setServerQuote\(quote\)/);
  assert.match(booking, /serverQuote\.toLocaleString\('en-IN'\)/);
  assert.match(migration, /'server_authoritative',\s*true/);
});

test('booking history refreshes from Supabase and cancellation uses the protected RPC', () => {
  assert.match(booking, /from\('bookings'\)/);
  assert.match(booking, /rpc\('cancel_clearance_booking'/);
  assert.match(booking, /\['BOOKED', 'MACHINE_ASSIGNED'\]\.includes\(booking\.status\)/);
  assert.match(booking, /onBookingChanged\?\.\(\)/);
});

test('live booking only offers fields eligible for a new booking', () => {
  assert.match(booking, /\['REGISTERED', 'CANCELLED'\]\.includes\(f\.status\)/);
  assert.match(migration, /f\.status NOT IN \('REGISTERED', 'CANCELLED'\)/);
});

test('booking RPC remains authenticated-only and server-priced', () => {
  assert.match(migration, /IF auth\.uid\(\) IS NULL THEN RAISE EXCEPTION 'authentication required'/);
  assert.match(migration, /f\.owner_id <> auth\.uid\(\)/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.reserve_clearance_booking_v2\(uuid, date\) FROM PUBLIC, anon/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.reserve_clearance_booking_v2\(uuid, date\) TO authenticated/);
  assert.match(migration, /round\(v_rate \* f\.acreage, 2\)/);
});
