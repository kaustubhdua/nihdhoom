import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const marketplace = fs.readFileSync(new URL('../src/components/ResiduePooling/ResiduePooling.tsx', import.meta.url), 'utf8');
const forecast = fs.readFileSync(new URL('../src/components/OfftakeAndForecast/HarvestForecast.tsx', import.meta.url), 'utf8');

test('live marketplace does not invent available supply from field acreage', () => {
  assert.match(marketplace, /if \(!demoMode\) return \[\];/);
  assert.match(marketplace, /verified residue lots will appear here/i);
});

test('pool participation uses an explicit quantity and validates remaining capacity', () => {
  assert.match(marketplace, /Quantity to commit \(tonnes\)/);
  assert.match(marketplace, /tonnes > remaining/);
  assert.match(marketplace, /Number\.isFinite\(tonnes\)/);
  assert.match(marketplace, /Pool full/);
});

test('forecast UI clearly labels static planning scenario and avoids claiming live NDVI', () => {
  assert.match(forecast, /illustrative planning records/i);
  assert.match(forecast, /static scenario—not a live NDVI signal/i);
  assert.doesNotMatch(forecast, /NDVI curves indicate/i);
});

test('live booking persists explicit consent through an authenticated RPC before booking', () => {
  const booking = fs.readFileSync(new URL('../src/components/ClearanceBooking/ClearanceBooking.tsx', import.meta.url), 'utf8');
  const migration = fs.readFileSync(new URL('../supabase/migrations/202610110003_nirdhoom_booking_consent_and_window.sql', import.meta.url), 'utf8');
  const consentCall = booking.indexOf("rpc('record_farmer_network_consent')");
  const bookingCall = booking.indexOf("rpc('reserve_clearance_booking_v2'");
  assert.ok(consentCall >= 0);
  assert.ok(bookingCall > consentCall);
  assert.match(migration, /web_booking/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.record_farmer_network_consent\(\) FROM PUBLIC, anon/);
  assert.doesNotMatch(booking, /from\('consents'\)\s*\.insert/);
  assert.doesNotMatch(booking, /from\('profiles'\)\s*\.update/);
});

test('booking date validation uses local calendar dates rather than UTC date slices', () => {
  const booking = fs.readFileSync(new URL('../src/components/ClearanceBooking/ClearanceBooking.tsx', import.meta.url), 'utf8');
  assert.match(booking, /function localDateString\(date: Date\)/);
  assert.match(booking, /date < localDateString\(new Date\(\)\)/);
  assert.doesNotMatch(booking, /toISOString\(\)\.slice\(0, 10\)/);
});

test('booking RPC field status matches the database constraint and prevents duplicate workflows', () => {
  const migration = fs.readFileSync(new URL('../supabase/migrations/202610120001_nirdhoom_booking_field_status_consistency.sql', import.meta.url), 'utf8');
  assert.match(migration, /SET status = 'SCHEDULED'/);
  assert.doesNotMatch(migration, /UPDATE public\.fields\s+SET status = 'BOOKED'/);
  assert.match(migration, /f\.status NOT IN \('REGISTERED', 'CANCELLED'\)/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.reserve_clearance_booking_v2\(uuid,date\) FROM PUBLIC, anon/);
});

test('live marketplace mutations never fall back to demo behavior when Supabase is missing', () => {
  assert.doesNotMatch(marketplace, /demoMode\s*\|\|\s*!supabase/);
  assert.match(marketplace, /Demo mode: buyer demand is not published to the live marketplace/);
  assert.match(marketplace, /Live Supabase is not configured\. Buyer demand was not published/);
  assert.match(marketplace, /Live Supabase is not configured\. No residue was added to the pool/);
  assert.match(marketplace, /Live marketplace records could not be loaded because the server was unreachable/);
  for (const handler of ['createBuyerDemand', 'createBuyerOffer', 'acceptOffer', 'transitionTransport']) {
    const start = marketplace.indexOf(`async function ${handler}`);
    assert.ok(start >= 0, `missing handler ${handler}`);
    const next = marketplace.indexOf('\n  async function ', start + 1);
    const end = next < 0 ? marketplace.length : next;
    const body = marketplace.slice(start, end);
    assert.match(body, /if \(demoMode\)/, `${handler} must fail closed in demo mode`);
    assert.match(body, /if \(!supabase\)/, `${handler} must explain missing live configuration`);
  }
});
