import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('..', import.meta.url).pathname;
const read = (file) => fs.readFileSync(`${root}/${file}`, 'utf8');
const has = (source, snippet) => assert.ok(source.includes(snippet), `Expected source to include: ${snippet}`);

test('NASA GIBS imagery is a separate map basemap', () => {
  const map = read('src/components/OpsConsole/OpsMap.tsx');
  const language = read('src/i18n/LanguageContext.tsx');
  has(map, "useState<'satellite' | 'street' | 'nasa'>");
  has(map, 'gibs.earthdata.nasa.gov/wmts/epsg3857/best');
  has(map, 'MODIS_Terra_CorrectedReflectance_TrueColor');
  has(map, 'NASA GIBS / NASA EOSDIS');
  has(map, 'maxNativeZoom: 9');
  has(map, "tileMode === 'nasa'");
  has(language, "'NASA imagery': 'NASA इमेजरी'");
  has(map, 'NASA FIRMS VIIRS Active Fire');
});

test('FIRMS secret is server-side and absence of detections is not proof of no burning', () => {
  const api = read('api/firms.ts');
  const env = read('.env.example');
  const map = read('src/components/OpsConsole/OpsMap.tsx');
  has(api, 'process.env.FIRMS_MAP_KEY');
  has(api, 'DETECTION_SCREENING_NOT_PROOF_OF_NO_BURNING');
  has(env, 'FIRMS_MAP_KEY=');
  assert.ok(!map.includes('VITE_FIRMS_MAP_KEY'));
  has(map, 'NASA FIRMS VIIRS Active Fire');
});

test('OTP requests catch failures and release loading state', () => {
  const onboarding = read('src/components/FarmerOnboarding/FarmerOnboarding.tsx');
  has(onboarding, 'supabase.auth.signInWithOtp');
  has(onboarding, 'supabase.auth.verifyOtp');
  has(onboarding, 'catch (error)');
  has(onboarding, 'finally {');
  has(onboarding, 'phoneDigits.length !== 10');
  has(onboarding, 'missing its Supabase URL or publishable key');
  has(onboarding, 'OTP request failed before Supabase returned a response');
  has(onboarding, 'aria-live="assertive"');
  has(onboarding, 'Phone sign-in and an SMS provider must be enabled in Supabase');
});

test('Telegram webhook validates secrets, bounds payloads and deduplicates updates', () => {
  const webhook = read('api/notify/telegram-webhook.ts');
  const migration = read('supabase/migrations/202610050002_nirdhoom_telegram_webhook_idempotency.sql');
  has(webhook, 'x-telegram-bot-api-secret-token');
  has(webhook, 'claimTelegramUpdate');
  has(webhook, "claim === 'unavailable'");
  has(webhook, "claim === 'duplicate'");
  has(webhook, '32_768');
  has(webhook, 'consume_telegram_link_token');
  has(migration, 'update_id bigint primary key');
  has(webhook, 'TELEGRAM_WEBHOOK_SECRET');
});

test('Telegram account linking authenticates users and uses short-lived hashed tokens', () => {
  const link = read('api/notify/telegram-link.ts');
  const miniapp = read('api/notify/telegram-miniapp-auth.ts');
  has(link, 'getUser(bearer(req))');
  has(link, 'randomBytes(32)');
  has(link, "createHash('sha256')");
  has(link, '10 * 60 * 1000');
  has(miniapp, 'WebAppData');
  has(miniapp, 'auth_date');
  has(miniapp, 'telegram_identities');
});

test('farmer onboarding wires OTP, consent and field creation', () => {
  const onboarding = read('src/components/FarmerOnboarding/FarmerOnboarding.tsx');
  const codeSlots = read('src/components/FarmerOnboarding/CodeSlots.tsx');
  const language = read('src/i18n/LanguageContext.tsx');
  has(onboarding, 'signInWithOtp');
  has(onboarding, 'verifyOtp');
  has(onboarding, 'CONSENT');
  has(onboarding, 'consent_status');
  has(onboarding, "from('fields')");
  has(onboarding, '.insert({');
  has(codeSlots, 'autoComplete="one-time-code"');
  has(codeSlots, 'onComplete');
  has(language, 'document.documentElement.lang = language');
});

test('Telegram UI exposes readiness, loading, and account-link errors', () => {
  const ui = read('src/components/FarmerSurface/TelegramChannel.tsx');
  for (const item of ['botReady', 'accountFeatures', 'linking', 'linkError', 'api/notify/telegram-link', 'Connect my NIRDHOOM account']) has(ui, item);
});


test('React Bits LatticeLoader supports lifecycle states, patterns, timer, and reduced motion', () => {
  const loader = read('src/components/LatticeLoader/LatticeLoader.tsx');
  const css = read('src/components/LatticeLoader/LatticeLoader.css');
  const workspace = read('src/components/WorkspaceLoading.tsx');
  const onboarding = read('src/components/FarmerOnboarding/FarmerOnboarding.tsx');
  const booking = read('src/components/ClearanceBooking/ClearanceBooking.tsx');
  has(loader, "type LoaderStatus = 'working' | 'done' | 'error'");
  has(loader, "'orbit'");
  has(loader, "'pulse'");
  has(css, '@media (prefers-reduced-motion: reduce)');
  has(css, 'lattice-on-45');
  has(workspace, 'LatticeLoader');
  has(onboarding, 'LatticeLoader');
  has(booking, 'LatticeLoader');
});

test('farmer login asks only for name and phone before OTP; field location stays in field registration', () => {
  const onboarding = read('src/components/FarmerOnboarding/FarmerOnboarding.tsx');
  const phoneStart = onboarding.lastIndexOf("currentStep === 'PHONE'");
  const otpStart = onboarding.lastIndexOf("currentStep === 'OTP'");
  const phoneStep = onboarding.slice(phoneStart, otpStart);
  const fieldStep = onboarding.slice(onboarding.indexOf('id="live-block"'));
  assert.ok(!phoneStep.includes('>Village<'), 'Village must not be part of initial phone login');
  assert.ok(!phoneStep.includes('Select Block'), 'Block/tehsil must not be part of initial phone login');
  has(phoneStep, 'farmer-full-name');
  has(phoneStep, 'farmer-mobile-number');
  has(fieldStep, 'live-block');
  has(fieldStep, 'live-district');
  has(onboarding, 'Phone sign-in and an SMS provider must be enabled in Supabase');
  has(onboarding, 'finally {');
});


test('React Bits CodeSlots is wired for accessible six-digit OTP entry and motion dependencies', () => {
  const slots = read('src/components/FarmerOnboarding/CodeSlots.tsx');
  const css = read('src/components/FarmerOnboarding/CodeSlots.css');
  const onboarding = read('src/components/FarmerOnboarding/FarmerOnboarding.tsx');
  const pkg = JSON.parse(read('package.json'));
  has(slots, "from 'motion/react'");
  has(slots, "from '@hugeicons/react'");
  has(slots, "from '@hugeicons/core-free-icons'");
  has(slots, "autoComplete=\"one-time-code\"");
  has(slots, 'aria-invalid={status === \'error\'}');
  has(slots, "if (!isFull(prev) && isFull(next)) onComplete?.(code)");
  has(slots, "if (status !== 'error') return");
  has(css, '@media (prefers-reduced-motion: reduce)');
  has(onboarding, "import CodeSlots from './CodeSlots'");
  has(onboarding, 'onComplete={verifyLiveOtp}');
  has(onboarding, 'otpVerificationInFlight.current = true');
  has(onboarding, 'otpVerificationInFlight.current = false');
  assert.ok(pkg.dependencies.motion, 'motion must be installed');
  assert.ok(pkg.dependencies['@hugeicons/react'], '@hugeicons/react must be installed');
  assert.ok(pkg.dependencies['@hugeicons/core-free-icons'], '@hugeicons/core-free-icons must be installed');
});
