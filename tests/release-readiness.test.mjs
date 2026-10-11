import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const exists = file => fs.existsSync(path.join(root, file));

test('final release gate explicitly separates CI from live environment proof', () => {
  const doc = read('docs/FINAL-RELEASE-GATE.md');
  for (const phrase of [
    'Real end-to-end browser/device flow: not yet evidenced',
    'Supabase schema and migration integrity (P0)',
    'Real farmer authentication and consent (P0)',
    'End-to-end operational journey (P0)',
    'Role matrix and storage security (P0)',
    'Offline evidence and field device reliability (P1)',
    'Telegram, dispatch, and external providers (P1)',
    'Browser automation, accessibility, and UX (P1)',
    'Observability, backup, recovery (P1)',
    'Field pilot and outcome evidence (P1)',
    'P2 — Post-pilot product improvements',
    'never run `supabase db push` against the current production project',
  ]) assert.ok(doc.includes(phrase), `missing release gate: ${phrase}`);
});

test('live assistant requests require authentication unless demo mode is explicitly enabled', () => {
  const assistant = read('api/assistant.ts');
  assert.match(assistant, /const demoMode=process\.env\.VITE_NIRDHOOM_DEMO_MODE==='true'/);
  assert.match(assistant, /const authRequired=!demoMode\|\|process\.env\.REQUIRE_AUTH_FOR_AI==='true'\|\|aiConfigured\|\|Boolean\(field\?\.dbId\)/);
});

test('production auth still requires actual Supabase phone OTP and never fakes live OTP', () => {
  const onboarding = read('src/components/FarmerOnboarding/FarmerOnboarding.tsx');
  assert.match(onboarding, /signInWithOtp/);
  assert.match(onboarding, /verifyOtp/);
  assert.match(onboarding, /type: 'sms'/);
  assert.match(onboarding, /if \(DEMO_MODE\)/);
  assert.match(onboarding, /Live authentication is not configured/);
});

test('live operator completion uses measured values and rejects missing measurements', () => {
  const operator = read('src/components/FieldOperator/BalerPWA.tsx');
  assert.match(operator, /moistureValue: number \| null|useState<number \| null>\(null\)/);
  assert.match(operator, /completionMeasurementsValid/);
  assert.match(operator, /p_moisture_pct: moistureValue/);
  assert.match(operator, /p_bales_count: balesCount/);
  assert.doesNotMatch(operator, /p_moisture_pct: Number\(moistureValue\)/);
});

test('Telegram Mini App identity is verified server-side and webhook has persistent dedupe contract', () => {
  const miniApp = read('api/notify/telegram-miniapp-auth.ts');
  const webhook = read('api/notify/telegram-webhook.ts');
  assert.match(miniApp, /WebAppData/);
  assert.match(miniApp, /auth_date/);
  assert.match(miniApp, /TELEGRAM_BOT_TOKEN/);
  assert.match(webhook, /claimTelegramUpdate/);
  assert.match(webhook, /telegram_webhook_updates/);
});

test('marketplace and money movement remain fail-closed until their release gates pass', () => {
  const scope = read('docs/NON-PAYMENT-RELEASE-SCOPE.md');
  const ledger = read('docs/DATABASE-RELEASE-LEDGER.md');
  assert.match(scope, /explicitly excludes integrating a real payment or payout provider/);
  assert.match(ledger, /not approved for production/);
  assert.match(ledger, /authorization matrix/);
  assert.ok(!exists('api/payments/initiate.ts'));
  assert.ok(!exists('api/payments/webhook.ts'));
});

test('CI is configured to run source-contract tests and isolated PostgreSQL integration tests', () => {
  const workflow = read('.github/workflows/ci.yml');
  assert.match(workflow, /npm test/);
  assert.match(workflow, /postgres:16/);
  assert.match(workflow, /atomic job completion migration/);
  assert.match(workflow, /npm run build/);
});

test('field registration always clears its busy state after network exceptions', () => {
  const onboarding = read('src/components/FarmerOnboarding/FarmerOnboarding.tsx');
  const start = onboarding.indexOf('const registerField = async () =>');
  const end = onboarding.indexOf('const withdrawConsent = async () =>', start);
  assert.ok(start >= 0 && end > start, 'field registration function should be present');
  const registration = onboarding.slice(start, end);
  assert.match(registration, /try\s*\{/);
  assert.match(registration, /catch\s*\{/);
  assert.match(registration, /finally\s*\{\s*setFieldBusy\(false\);/);
  assert.match(registration, /Field registration could not reach the server/);
});

test('consent withdrawal always clears its busy state after network exceptions', () => {
  const onboarding = read('src/components/FarmerOnboarding/FarmerOnboarding.tsx');
  const start = onboarding.indexOf('const withdrawConsent = async () =>');
  const end = onboarding.indexOf('useEffect(() => {\n    if (resendSeconds', start);
  assert.ok(start >= 0 && end > start, 'consent withdrawal function should be present');
  const withdrawal = onboarding.slice(start, end);
  assert.match(withdrawal, /try\s*\{/);
  assert.match(withdrawal, /catch\s*\{/);
  assert.match(withdrawal, /finally\s*\{\s*setWithdrawBusy\(false\);/);
  assert.match(withdrawal, /rpc\('revoke_farmer_network_consent'\)/);
  assert.doesNotMatch(withdrawal, /from\('consents'\)\s*\.update/);
  assert.match(withdrawal, /Consent could not be updated because the server was unreachable/);
});

test('field registration rejects acreage that would round to zero', () => {
  const onboarding = read('src/components/FarmerOnboarding/FarmerOnboarding.tsx');
  assert.match(onboarding, /acres < 0\.01 \|\| acres > 500/);
  assert.match(onboarding, /Math\.round\(acres \* 100\) \/ 100/);
});
