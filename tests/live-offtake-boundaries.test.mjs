import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');

test('live offtake view uses connected demand and does not rank placeholder prices', () => {
  const auction = read('../src/components/OfftakeAndForecast/MultiOfftakeAuction.tsx');
  const app = read('../src/App.tsx');
  assert.match(auction, /buyers: liveBuyers, demoMode/);
  assert.match(auction, /if \(!demoMode\) \{/);
  assert.match(auction, /Connected buyer demand/);
  assert.match(auction, /No sample buyers or prices are shown in live mode/);
  assert.match(auction, /Price.*Not supplied/s);
  assert.match(auction, /price comparison is disabled until buyer identity/);
  assert.match(auction, /const buyers = demoMode \? INITIAL_BUYERS : liveBuyers/);
  assert.match(app, /<MultiOfftakeAuction buyers=\{liveBuyers\} demoMode=\{demoMode\} \/>/);
});
