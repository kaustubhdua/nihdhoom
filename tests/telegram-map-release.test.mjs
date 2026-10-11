import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('..', import.meta.url).pathname;
const read = (file) => fs.readFileSync(`${root}/${file}`, 'utf8');

test('map offers NASA GIBS imagery separately from operational fire detections', () => {
  const map = read('src/components/OpsConsole/OpsMap.tsx');
  const language = read('src/i18n/LanguageContext.tsx');
  assert.match(map, /useState<'satellite' \\| 'street' \\| 'nasa'>/);
  assert.match(map, /gibs\\.earthdata\\.nasa\\.gov\\/wmts\\/epsg3857\\/best/);
  assert.match(map, /MODIS_Terra_CorrectedReflectance_TrueColor/);
  assert.match(map, /NASA GIBS \\/ NASA EOSDIS/);
  assert.match(map, /maxNativeZoom: 9/);
  assert.match(map, /tileMode === 'nasa'/);
  assert.match(language, /'NASA imagery': 'NASA इमेजरी'/);
  assert.match(map, /NASA FIRMS Active Fire Anomalies/);
});

test('NASA FIRMS credential stays server-side and fire detections are not proof of no burning', () => {
  const api = read('api/firms.ts');
  const env = read('.env.example');
  const map = read('src/components/OpsConsole/OpsMap.tsx');
  assert.match(api, /process\\.env\\.FIRMS_MAP_KEY/);
  assert.match(api, /DETECTION_SCREENING_NOT_PROOF_OF_NO_BURNING/);
  assert.match(env, /^FIRMS_MAP_KEY=/m);
  assert.doesNotMatch(map, /VITE_FIRMS_MAP_KEY/);
  assert.match(map, /NASA FIRMS VIIRS Active Fire/);
});

test('OTP send and verification always release loading state after provider/network failures', () => {
  const onboarding = read('src/components/FarmerOnboarding/FarmerOnboarding.tsx');
  assert.match(onboarding, /supabase\\.auth\\.signInWithOtp/);
  assert.match(onboarding, /supabase\\.auth\\.verifyOtp/);
  assert.match(onboarding, /catch \\(error\\)/);
  assert.match(onboarding, /finally \\{\\s*setLoading\\(false\\);\\s*\\}/);
  assert.match(onboarding, /phoneDigits\\.length !== 10/);
  assert.match(onboarding, /missing its Supabase URL or publishable key/);
  assert.match(onboarding, /OTP request failed before Supabase returned a response/);
});

test('Telegram webhook is authenticated, bounded, persistent-idempotent and fails closed on persistence errors', () => {
  const webhook = read('api/notify/telegram-webhook.ts');
  const migration = read('supabase/migrations/202610050002_nirdhoom_telegram_webhook_idempotency.sql');
  assert.match(webhook, /x-telegram-bot-api-secret-token/);
  assert.match(webhook, /claimTelegramUpdate/);
  assert.match(webhook, /claim === 'unavailable'/);
  assert.match(webhook, /claim === 'duplicate'/);
  assert.match(webhook, /32_768/);
  assert.match(webhook, /consume_telegram_link_token/);
  assert.match(migration, /update_id bigint primary key/);
  assert.match(webhook, /TELEGRAM_WEBHOOK_SECRET/);
});

test('Telegram account linking uses a short-lived hashed token and authenticated user', () => {
  const link = read('api/notify/telegram-link.ts');
  const webhook = read('api/notify/telegram-webhook.ts');
  const miniapp = read('api/notify/telegram-miniapp-auth.ts');
  assert.match(link, /getUser\\(bearer\\(req\\)\\)/);
  assert.match(link, /randomBytes\\(32\\)/);
  assert.match(link, /createHash\\('sha256'\\)/);
  assert.match(link, /10 \\* 60 \\* 1000/);
  assert.match(webhook, /consume_telegram_link_token/);
  assert.match(miniapp, /WebAppData/);
  assert.match(miniapp, /auth_date/);
  assert.match(miniapp, /telegram_identities/);
});

test('Telegram text routing and localized menus include the main farmer workflows', () => {
  const copy = read('api/_lib/telegramCopy.ts');
  const webhook = read('api/notify/telegram-webhook.ts');
  for (const action of ['fields', 'book', 'track', 'verify', 'market', 'status', 'help', 'language']) {
    assert.match(copy, new RegExp(`'?${action}'?`));
    assert.match(webhook, new RegExp(action));
  }
  assert.match(copy, /export function detectLang/);
  assert.match(copy, /export function routeText/);
  assert.match(copy, /\bपंजाबी\b|Punjabi|ਪੰਜਾਬੀ/);
  assert.match(copy, /languageSet/);
});

test('farmer onboarding exposes OTP, consent and owner-scoped field creation paths', () => {
  const onboarding = read('src/components/FarmerOnboarding/FarmerOnboarding.tsx');
  const codeSlots = read('src/components/FarmerOnboarding/CodeSlots.tsx');
  const language = read('src/i18n/LanguageContext.tsx');
  assert.match(onboarding, /signInWithOtp/);
  assert.match(onboarding, /verifyOtp/);
  assert.match(onboarding, /CONSENT/);
  assert.match(onboarding, /consent_status/);
  assert.match(onboarding, /from\\('fields'\\)\\s*\\.insert/);
  assert.match(codeSlots, /autoComplete="one-time-code"/);
  assert.match(codeSlots, /onComplete/);
  assert.match(language, /document\\.documentElement\\.lang = language/);
});

test('Telegram UI has loading, readiness and authenticated account-link states', () => {
  const ui = read('src/components/FarmerSurface/TelegramChannel.tsx');
  assert.match(ui, /botReady/);
  assert.match(ui, /accountFeatures/);
  assert.match(ui, /linking/);
  assert.match(ui, /linkError/);
  assert.match(ui, /api\\/notify\\/telegram-link/);
  assert.match(ui, /Connect my NIRDHOOM account/);
});
