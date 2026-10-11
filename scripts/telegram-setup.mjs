#!/usr/bin/env node
/**
 * Registers NIRDHOOM Sathi with Telegram.
 *
 *   npm run telegram:setup -- --url https://your-domain.vercel.app
 *   npm run telegram:setup -- --check      # show current webhook status
 *   npm run telegram:setup -- --delete     # remove the webhook
 *
 * Reads TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET from the environment
 * (or a local .env file). Optional: TELEGRAM_MINI_APP_URL adds a menu button
 * that opens NIRDHOOM inside Telegram.
 */
import { readFileSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

const { COMMANDS } = await import('../api/_lib/telegramCopy.ts');

function loadDotEnv() {
  for (const file of ['.env.local', '.env']) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
  }
}

function arg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

loadDotEnv();
const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;

if (process.argv.includes('--new-secret')) {
  console.log(`TELEGRAM_WEBHOOK_SECRET=${randomBytes(32).toString('hex')}`);
  process.exit(0);
}
if (!token) {
  console.error('✗ TELEGRAM_BOT_TOKEN is missing. Create a bot with @BotFather and set the token.');
  process.exit(1);
}

async function tg(method, body = {}) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await response.json().catch(() => ({}));
  if (!json.ok) throw new Error(`${method} failed: ${json.description || response.status}`);
  return json.result;
}

const me = await tg('getMe');
console.log(`✓ Bot: @${me.username} (${me.first_name})`);

if (process.argv.includes('--check')) {
  console.log(await tg('getWebhookInfo'));
  process.exit(0);
}
if (process.argv.includes('--delete')) {
  await tg('deleteWebhook', { drop_pending_updates: false });
  console.log('✓ Webhook removed');
  process.exit(0);
}

if (!secret) {
  console.error('✗ TELEGRAM_WEBHOOK_SECRET is missing. Generate one with: npm run telegram:setup -- --new-secret');
  process.exit(1);
}
const base = (arg('--url') || process.env.NIRDHOOM_PUBLIC_URL || '').replace(/\/+$/, '');
if (!/^https:\/\//.test(base)) {
  console.error('✗ Pass your deployed HTTPS site: npm run telegram:setup -- --url https://your-domain.vercel.app');
  process.exit(1);
}

const webhookUrl = `${base}/api/notify/telegram-webhook`;
await tg('setWebhook', {
  url: webhookUrl,
  secret_token: secret,
  allowed_updates: ['message', 'callback_query'],
  // Preserve queued farmer messages during setup/re-registration.
  drop_pending_updates: false,
});
console.log(`✓ Webhook → ${webhookUrl}`);

await tg('setMyCommands', { commands: COMMANDS.en });
await tg('setMyCommands', { commands: COMMANDS.hi, language_code: 'hi' });
await tg('setMyCommands', { commands: COMMANDS.pa, language_code: 'pa' });
console.log('✓ Commands registered in English, Hindi and Punjabi');

await tg('setMyShortDescription', { short_description: 'Book parali pickup, track the machine and check field proof.' });
await tg('setMyShortDescription', { short_description: 'पराली उठवाने की बुकिंग, मशीन ट्रैकिंग और खेत का सबूत।', language_code: 'hi' });
await tg('setMyShortDescription', { short_description: 'ਪਰਾਲੀ ਚੁਕਵਾਉਣ ਦੀ ਬੁਕਿੰਗ, ਮਸ਼ੀਨ ਟ੍ਰੈਕਿੰਗ ਅਤੇ ਖੇਤ ਦਾ ਸਬੂਤ।', language_code: 'pa' });
console.log('✓ Bot descriptions set');

const miniApp = process.env.TELEGRAM_MINI_APP_URL;
if (miniApp) {
  await tg('setChatMenuButton', { menu_button: { type: 'web_app', text: 'NIRDHOOM', web_app: { url: miniApp } } });
  console.log(`✓ Menu button opens ${miniApp}`);
}

const info = await tg('getWebhookInfo');
console.log(`✓ Telegram reports ${info.pending_update_count} pending update(s)${info.last_error_message ? `, last error: ${info.last_error_message}` : ''}`);
console.log(`\nDone. Open https://t.me/${me.username} and send /start.`);
