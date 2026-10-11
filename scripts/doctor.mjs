#!/usr/bin/env node
/**
 * NIRDHOOM setup doctor.
 *
 *   npm run doctor                      reads .env.local / .env and the shell
 *   npm run doctor -- --site https://your-site.vercel.app
 *   npm run doctor -- --env-file path/to/.env
 *
 * It only reads. It sends the public (anon / publishable) key, never a secret,
 * and tells you what is missing in plain words. Exit code 1 means a blocker.
 */
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

function parseEnv(text) {
  const out = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    out[key] = value;
  }
  return out;
}

const files = [flag('--env-file'), '.env.local', '.env'].filter(Boolean);
let fileEnv = {};
const loaded = [];
for (const f of files.reverse()) {
  const full = path.resolve(process.cwd(), f);
  if (fs.existsSync(full)) {
    fileEnv = { ...fileEnv, ...parseEnv(fs.readFileSync(full, 'utf8')) };
    loaded.push(f);
  }
}
const env = { ...fileEnv, ...Object.fromEntries(Object.entries(process.env).filter(([, v]) => v)) };

let blockers = 0;
let warnings = 0;
const ok = (msg) => console.log(`  ✔ ${msg}`);
const bad = (msg, fix) => { blockers += 1; console.log(`  ✖ ${msg}`); if (fix) console.log(`      fix: ${fix}`); };
const warn = (msg, fix) => { warnings += 1; console.log(`  ! ${msg}`); if (fix) console.log(`      ${fix}`); };
const head = (msg) => console.log(`\n${msg}`);

function jwtRole(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    return payload.role || null;
  } catch {
    return null;
  }
}

async function http(url, init = {}) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), Number(env.NIRDHOOM_DOCTOR_TIMEOUT_MS || 12000));
  try {
    const res = await fetch(url, { ...init, signal: ctl.signal });
    let body = null;
    const text = await res.text();
    try { body = JSON.parse(text); } catch { body = text; }
    return { status: res.status, body };
  } catch (error) {
    return { status: 0, body: String(error && error.message ? error.message : error) };
  } finally {
    clearTimeout(timer);
  }
}

console.log('NIRDHOOM setup doctor');
console.log(loaded.length ? `Reading ${loaded.join(', ')} plus your shell environment.` : 'No .env.local or .env found; using only your shell environment.');

// 1. Browser-side configuration (baked into the build as VITE_*)
head('1. Browser configuration (VITE_ values, baked in at build time)');
const url = (env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
if (!url) bad('VITE_SUPABASE_URL is not set.', 'Supabase > Project Settings > API > Project URL');
else if (!/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/i.test(url)) warn(`VITE_SUPABASE_URL looks unusual: ${url}`, 'Expected https://<project-ref>.supabase.co');
else ok(`VITE_SUPABASE_URL = ${url}`);

if (!key) bad('VITE_SUPABASE_PUBLISHABLE_KEY is not set.', 'Supabase > Project Settings > API > anon / publishable key');
else if (key.startsWith('sb_secret_') || jwtRole(key) === 'service_role') bad('VITE_SUPABASE_PUBLISHABLE_KEY holds a SERVICE key. Anyone can read it in the browser.', 'Rotate that key in Supabase now, and use the anon / publishable key here.');
else ok('VITE_SUPABASE_PUBLISHABLE_KEY is set and is not a service key.');

if (String(env.VITE_NIRDHOOM_DEMO_MODE).toLowerCase() === 'true') warn('VITE_NIRDHOOM_DEMO_MODE is true: the site shows sample data, not real farmers.', 'Set it to false (or remove it) for the real site.');
else ok('Demo mode is off, so the site uses real records.');

// 2. Supabase reachability and phone sign-in
let reachable = false;
if (url && key) {
  head('2. Supabase project');
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  const settings = await http(`${url}/auth/v1/settings`, { headers });
  if (settings.status === 0) {
    bad(`Could not reach ${url} (${settings.body}).`, 'Check the URL, your internet, and that the project is not paused.');
  } else if (settings.status === 401 || settings.status === 403) {
    bad('Supabase rejected the key.', 'Copy the anon / publishable key again from Project Settings > API.');
  } else if (settings.status !== 200) {
    bad(`Supabase auth settings returned HTTP ${settings.status}.`);
  } else {
    reachable = true;
    ok('Supabase is reachable and accepts the key.');
    const external = settings.body && settings.body.external ? settings.body.external : {};
    if (external.phone === true) ok('Phone sign-in is enabled (farmers can use an SMS OTP).');
    else bad('Phone sign-in is OFF, so farmers cannot create accounts.', 'Supabase > Authentication > Sign In / Providers > Phone > enable, and pick an SMS provider (or add a test number, see docs/GO-LIVE.md).');
    if (settings.body && settings.body.disable_signup === true) warn('New sign-ups are disabled in Supabase.', 'Authentication > Sign In / Providers > turn on "Allow new users to sign up".');
  }

  // 3. Database tables and functions (anon can only tell us they exist)
  if (reachable) {
    head('3. Database set-up (migrations)');
    const tables = ['profiles', 'consents', 'fields', 'machines', 'bookings', 'jobs', 'evidence_assets', 'residue_lots', 'telegram_identities', 'storage_yards'];
    const missingTables = [];
    for (const table of tables) {
      const res = await http(`${url}/rest/v1/${table}?select=*&limit=0`, { headers });
      const code = res.body && typeof res.body === 'object' ? res.body.code : '';
      if (res.status === 404 || code === 'PGRST205' || code === '42P01') missingTables.push(table);
    }
    if (missingTables.length === tables.length) bad('None of the NIRDHOOM tables exist: migrations have not been applied to this project.', 'Run `npm run db:bundle`, paste supabase/all-migrations.sql into Supabase > SQL Editor, and Run. See docs/GO-LIVE.md.');
    else if (missingTables.length) bad(`Some tables are missing: ${missingTables.join(', ')}.`, 'Re-run `npm run db:bundle` and apply the newest migrations from the one that failed.');
    else ok('All core tables exist.');

    // Protected RPCs intentionally grant EXECUTE only to authenticated users.
    // An anon-key probe with empty arguments returns PGRST202 both when a
    // function is absent and when PostgREST hides it from the anon role, so it
    // cannot safely diagnose migration state. Do not report a false blocker.
    warn(
      'Protected booking and verification RPCs cannot be verified with a signed-out public key.',
      'Confirm the RPCs and grants using the Supabase SQL Editor and an authenticated test session; do not grant anon execution just to satisfy this check.',
    );

    // Signed-out visitors cannot read fields by design.
    const fieldsRes = await http(`${url}/rest/v1/fields?select=id&limit=1`, { headers });
    if (fieldsRes.status === 200 && Array.isArray(fieldsRes.body) && fieldsRes.body.length) warn('Signed-out visitors can read field rows.', 'Field records should be private. Check Row Level Security on public.fields.');
    else if (!missingTables.includes('fields')) ok('Field records are private to signed-in users (this is why signed-out visitors see a sign-in notice).');
  }
}

// 4. Server-side values (live in Vercel, so usually not present on your laptop)
head('4. Server values (Vercel only; shown only when present in this shell)');
for (const name of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_WEBHOOK_SECRET', 'NIRDHOOM_PUBLIC_URL']) {
  console.log(`  - ${name}: ${env[name] ? 'set here' : 'not set in this shell'}`);
}
if (env.SUPABASE_URL && url && env.SUPABASE_URL.replace(/\/+$/, '') !== url) {
  bad('SUPABASE_URL (server) and VITE_SUPABASE_URL (browser) point at different projects.', 'Use the same project URL in both.');
}

// 5. The deployed site
const site = (flag('--site') || env.NIRDHOOM_PUBLIC_URL || '').replace(/\/+$/, '');
if (site) {
  head(`5. Deployed site ${site}`);
  const home = await http(`${site}/`);
  if (home.status === 200) ok('The site loads.');
  else bad(`The site returned HTTP ${home.status || 'no response'}.`);
  const hook = await http(`${site}/api/notify/telegram-webhook`);
  if (hook.status === 200 && hook.body && hook.body.ok) {
    ok(`Telegram bot is ready${hook.body.bot_username ? ` (@${hook.body.bot_username})` : ''}.`);
    if (hook.body.account_features) ok('Server has Supabase credentials (account linking works).');
    else warn('Server cannot link accounts: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are missing in Vercel.');
  } else if (hook.status === 503 || (hook.body && hook.body.configured === false)) {
    warn('Telegram bot is not configured on this deployment.', 'Add TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET in Vercel for the environment this site runs in, then redeploy.');
  } else {
    warn(`Telegram health check returned HTTP ${hook.status || 'no response'}.`);
  }
} else {
  head('5. Deployed site');
  console.log('  (skipped: pass --site https://your-site.vercel.app to check the live deployment)');
}

console.log(`\n${blockers ? `${blockers} blocker${blockers > 1 ? 's' : ''}` : 'No blockers'}${warnings ? `, ${warnings} warning${warnings > 1 ? 's' : ''}` : ''}.`);
if (!blockers) console.log('Next: open the site, go to Farmer onboarding, sign in with a phone number, register a field and book a pickup.');
process.exit(blockers ? 1 : 0);
