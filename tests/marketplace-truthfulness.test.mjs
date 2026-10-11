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

test('live booking records explicit consent before the server booking RPC', () => {
  const booking = fs.readFileSync(new URL('../src/components/ClearanceBooking/ClearanceBooking.tsx', import.meta.url), 'utf8');
  assert.match(booking, /from\('consents'\)/);
  assert.match(booking, /WEB_CLEARANCE_BOOKING/);
  assert.match(booking, /Could not record your consent/);
  assert.ok(booking.indexOf('WEB_CLEARANCE_BOOKING') < booking.indexOf("rpc('reserve_clearance_booking_v2'"));
});

test('booking date validation uses local calendar dates rather than UTC date slices', () => {
  const booking = fs.readFileSync(new URL('../src/components/ClearanceBooking/ClearanceBooking.tsx', import.meta.url), 'utf8');
  assert.match(booking, /function localDateString\(date: Date\)/);
  assert.match(booking, /date < localDateString\(new Date\(\)\)/);
  assert.doesNotMatch(booking, /toISOString\(\)\.slice\(0, 10\)/);
});
