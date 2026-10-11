import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');

test('verification UI does not claim an unsupported confidence or auto-verify fields', () => {
  const audit = read('../src/components/VerificationLayer/SatelliteAudit.tsx');
  assert.doesNotMatch(audit, /p_confidence:\s*92\b/);
  assert.match(audit, /p_result:\s*'REVIEW_REQUIRED'/);
  assert.match(audit, /manual_review_required_no_validated_confidence_model/);
  assert.doesNotMatch(audit, /onVerified\?\.\(field\.id\)/);
});

test('demo walkthrough is browser-local and discloses simulation-only behavior', () => {
  const journey = read('../src/components/DemoScenarioJourney/DemoScenarioJourney.tsx');
  assert.match(journey, /SIMULATION ONLY/);
  assert.match(journey, /nirdhoom\.demo\.journey\.v1/);
  assert.match(journey, /does not create a real booking/);
  assert.doesNotMatch(journey, /supabase|fetch\(/i);
});

test('demo map labels synthetic fire, buyer and inventory records', () => {
  const map = read('../src/components/OpsConsole/OpsMap.tsx');
  assert.match(map, /SIMULATED FIRE OBSERVATION — NOT NASA DATA/);
  assert.match(map, /TRAINING SCENARIO ONLY — NOT A REAL FIRE ALERT/);
  assert.match(map, /SIMULATED BUYER/);
  assert.match(map, /SIMULATED CAPACITY \/ STOCK/);
});
