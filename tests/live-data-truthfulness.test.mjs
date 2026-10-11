import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');

test('live harvest readiness only summarizes connected field records', () => {
  const forecast = read('../src/components/OfftakeAndForecast/HarvestForecast.tsx');
  const app = read('../src/App.tsx');
  assert.match(forecast, /HarvestForecastProps = \{ fields: Field\[\]; demoMode: boolean; \}/);
  assert.match(forecast, /if \(!demoMode\) \{/);
  assert.match(forecast, /Declared harvest dates/);
  assert.match(forecast, /No sample block statistics or projected baler counts are shown in live mode/);
  assert.match(forecast, /Dates and acreage are declarations from field records/);
  assert.match(app, /<HarvestForecast fields=\{fields\} demoMode=\{demoMode\} \/>/);
});

test('weather endpoint distinguishes fetched forecasts from persisted snapshots', () => {
  const weather = read('../api/weather.ts');
  assert.match(weather, /persistenceStatus: 'saved' \| 'failed' \| 'not_configured'/);
  assert.match(weather, /persistenceStatus = snapshotResponse\.ok \? 'saved' : 'failed'/);
  assert.match(weather, /persistence_status: persistenceStatus/);
  assert.doesNotMatch(weather, /\.catch\(\(\) => undefined\)/);
});
