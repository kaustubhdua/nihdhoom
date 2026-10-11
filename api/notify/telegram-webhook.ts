import { ACTION_VIEW, BOT_LANGS, COPY, detectLang, isLang, routeText, type BotAction, type BotLang } from '../_lib/telegramCopy.js';

declare const process: { env: Record<string, string | undefined> };

const TELEGRAM_API = () => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  return token ? `https://api.telegram.org/bot${encodeURIComponent(token)}` : null;
};

async function telegram(method: string, body: Record<string, unknown>) {
  const api = TELEGRAM_API();
  if (!api) throw new Error('Telegram Bot API is not configured');
  const response = await fetch(`${api}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(9000),
  });
  if (!response.ok) throw new Error(`Telegram Bot API request failed (${response.status})`);
  return true;
}

async function sendMessage(chatId: number, text: string, replyMarkup?: unknown) {
  return telegram('sendMessage', { chat_id: chatId, text, reply_markup: replyMarkup });
}

// Best-effort in-memory dedupe for deployments that have not connected Supabase yet.
// Telegram retries an update until it gets a 2xx, so without this a cold bot could double-reply.
const recentUpdates = new Set<number>();
function claimInMemory(updateId: number) {
  if (recentUpdates.has(updateId)) return 'duplicate' as const;
  recentUpdates.add(updateId);
  if (recentUpdates.size > 500) recentUpdates.delete(recentUpdates.values().next().value as number);
  return 'claimed' as const;
}

async function resolveBotUsername() {
  const configured = String(process.env.TELEGRAM_BOT_USERNAME || '').replace(/^@/, '').trim();
  if (configured) return configured;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;
  try {
    const response = await fetch(`https://api.telegram.org/bot${encodeURIComponent(token)}/getMe`, { signal: AbortSignal.timeout(5000) });
    const payload = await response.json();
    return payload?.ok && typeof payload?.result?.username === 'string' ? payload.result.username : null;
  } catch {
    return null;
  }
}

function persistenceConfigured() {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY && ((process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) || process.env.VITE_SUPABASE_URL));
}

async function claimTelegramUpdate(updateId: number) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = ((process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) || process.env.VITE_SUPABASE_URL);
  if (!serviceKey || !supabaseUrl) return claimInMemory(updateId);
  const response = await fetch(`${supabaseUrl}/rest/v1/telegram_webhook_updates`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ update_id: updateId }),
    signal: AbortSignal.timeout(7000),
  });
  if (response.status === 409) return 'duplicate' as const;
  return response.ok ? 'claimed' as const : 'unavailable' as const;
}

async function releaseTelegramUpdate(updateId: number) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  if (!serviceKey || !supabaseUrl) {
    recentUpdates.delete(updateId);
    return;
  }
  // If handling fails, remove the claim so Telegram's retry can be processed.
  // The unique update_id remains the concurrency guard for successful updates.
  await fetch(`${supabaseUrl}/rest/v1/telegram_webhook_updates?update_id=eq.${updateId}`, {
    method: 'DELETE',
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, Prefer: 'return=minimal' },
    signal: AbortSignal.timeout(5000),
  }).catch(() => {});
}

async function linkTelegramIdentity(token: string, message: any) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = ((process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) || process.env.VITE_SUPABASE_URL);
  if (!serviceKey || !supabaseUrl || !token) return null;
  const tokenHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  const hash = Array.from(new Uint8Array(tokenHash)).map((b) => b.toString(16).padStart(2, '0')).join('');
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/consume_telegram_link_token`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      p_token_hash: hash,
      p_telegram_user_id: Number(message?.from?.id),
      p_telegram_chat_id: Number(message?.chat?.id),
      p_username: message?.from?.username || null,
      p_first_name: message?.from?.first_name || null,
      p_language_code: message?.from?.language_code || null,
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) return null;
  return response.json();
}

async function getLinkedProfile(chatId: number) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = ((process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) || process.env.VITE_SUPABASE_URL);
  if (!serviceKey || !supabaseUrl) return null;
  const response = await fetch(
    `${supabaseUrl}/rest/v1/telegram_identities?telegram_chat_id=eq.${chatId}&select=profile_id,notification_enabled&limit=1`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }, signal: AbortSignal.timeout(7000) },
  );
  if (!response.ok) return null;
  const rows = await response.json();
  return rows?.[0] || null;
}

async function getFarmerStatus(profileId: string) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = ((process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) || process.env.VITE_SUPABASE_URL);
  if (!serviceKey || !supabaseUrl) return null;
  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
  const fieldsResponse = await fetch(
    `${supabaseUrl}/rest/v1/fields?owner_id=eq.${encodeURIComponent(profileId)}&select=id,village,status,external_id&order=updated_at.desc&limit=20`,
    { headers, signal: AbortSignal.timeout(7000) },
  );
  if (!fieldsResponse.ok) return null;
  const fields = await fieldsResponse.json();
  const active = fields.filter((field: any) => ['SCHEDULED', 'MACHINE_ASSIGNED', 'ON_THE_WAY', 'BALING_IN_PROGRESS'].includes(field.status));
  const verified = fields.filter((field: any) => field.status === 'VERIFIED_NON_BURN');
  const latest = fields[0];
  return { fieldCount: fields.length, activeCount: active.length, verifiedCount: verified.length, latest };
}

function miniAppUrl(view?: string) {
  const raw = process.env.TELEGRAM_MINI_APP_URL;
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (view) url.searchParams.set('view', view);
    return url.toString();
  } catch {
    return null;
  }
}

function siteUrl(action: string) {
  const route = ACTION_VIEW[action] || ACTION_VIEW.status;
  const mini = miniAppUrl(route.view);
  if (mini) return { web_app: { url: mini } } as const;
  const raw = process.env.NIRDHOOM_PUBLIC_URL || process.env.TELEGRAM_MINI_APP_URL;
  if (!raw) return null;
  try {
    const url = new URL(raw);
    url.hash = route.hash;
    return { url: url.toString() } as const;
  } catch {
    return null;
  }
}

function actionButton(text: string, action: string) {
  const target = siteUrl(action);
  return target ? [{ text, ...target }] : null;
}

function languageRow(lang: BotLang) {
  const labels: Record<BotLang, string> = { pa: 'ਪੰਜਾਬੀ', hi: 'हिंदी', en: 'English' };
  return BOT_LANGS.map((code) => ({ text: `${code === lang ? '● ' : ''}${labels[code]}`, callback_data: `lang:${code}` }));
}

function menu(lang: BotLang, withOpen = true) {
  const b = COPY[lang].buttons;
  const rows: Array<Array<Record<string, unknown>>> = [
    [{ text: b.fields, callback_data: `fields:${lang}` }, { text: b.book, callback_data: `book:${lang}` }],
    [{ text: b.track, callback_data: `track:${lang}` }, { text: b.verify, callback_data: `verify:${lang}` }],
    [{ text: b.market, callback_data: `market:${lang}` }, { text: b.status, callback_data: `status:${lang}` }],
  ];
  const open = withOpen ? actionButton(b.open, 'status') : null;
  if (open) rows.push(open);
  rows.push(languageRow(lang));
  return { inline_keyboard: rows };
}

/** Reply keyboard for one action: an "open in NIRDHOOM" button when a site URL is configured, then the menu. */
function actionMarkup(lang: BotLang, action: keyof typeof ACTION_VIEW) {
  const base = menu(lang, false);
  const label = COPY[lang].open[action as keyof typeof COPY.en.open];
  const open = label ? actionButton(label, String(action)) : null;
  return open ? { inline_keyboard: [open, ...base.inline_keyboard] } : base;
}

async function handleAction(chatId: number, action: BotAction, lang: BotLang) {
  const t = COPY[lang];
  if (action === 'help') {
    await sendMessage(chatId, t.help, menu(lang));
    return;
  }
  if (action === 'language') {
    await sendMessage(chatId, t.languagePrompt, { inline_keyboard: [languageRow(lang)] });
    return;
  }

  const accountFeatures = persistenceConfigured();
  const identity = accountFeatures ? await getLinkedProfile(chatId).catch(() => null) : null;
  const status = identity?.profile_id ? await getFarmerStatus(identity.profile_id).catch(() => null) : null;
  const latest = status?.latest
    ? `${status.latest.village || status.latest.external_id || 'field'} — ${String(status.latest.status).replaceAll('_', ' ').toLowerCase()}`
    : undefined;

  const text: Record<Exclude<BotAction, 'help' | 'language'>, string> = {
    fields: status ? t.fields({ ...status, latest }) : t.fieldsUnlinked,
    book: t.book(Boolean(identity)),
    track: t.track(Boolean(identity)),
    verify: t.verify,
    market: t.market,
    status: status ? t.status(status) : t.statusUnlinked,
  };
  const needsAccount = ['fields', 'book', 'track', 'status'].includes(action);
  const suffix = needsAccount && !accountFeatures ? `\n\n${t.basicMode}` : needsAccount && !identity ? `\n\n${t.linkFirst}` : '';
  await sendMessage(chatId, text[action as keyof typeof text] + suffix, actionMarkup(lang, action));
}

function parseCallback(data: string, fallback: BotLang): { kind: 'lang' | 'action'; value: string; lang: BotLang } {
  const [head, tail] = String(data || '').split(':');
  if (head === 'lang' && isLang(tail)) return { kind: 'lang', value: tail, lang: tail };
  return { kind: 'action', value: head || 'status', lang: isLang(tail) ? tail : fallback };
}

async function handle(request: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) return Response.json({ error: 'Telegram webhook secret is not configured' }, { status: 503 });
  if (!process.env.TELEGRAM_BOT_TOKEN) return Response.json({ error: 'Telegram bot token is not configured' }, { status: 503 });
  if (request.headers.get('x-telegram-bot-api-secret-token') !== secret) {
    return Response.json({ error: 'Invalid Telegram webhook secret' }, { status: 401 });
  }
  const contentLength = Number(request.headers.get('content-length') || '0');
  if (Number.isFinite(contentLength) && contentLength > 32_768) {
    return Response.json({ error: 'Telegram update too large' }, { status: 413 });
  }

  let update: any;
  try { update = await request.json(); } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const updateId = Number(update?.update_id);
  if (!Number.isSafeInteger(updateId) || updateId < 0) return Response.json({ received: true, ignored: true });
  const claim = await claimTelegramUpdate(updateId);
  if (claim === 'unavailable') return Response.json({ error: 'Telegram webhook persistence is unavailable' }, { status: 503 });
  if (claim === 'duplicate') return Response.json({ ok: true, duplicate: true, update_id: updateId });

  try {
  const message = update?.message;
  const callback = update?.callback_query;
  const chatId = Number(message?.chat?.id ?? callback?.message?.chat?.id);
  if (!Number.isSafeInteger(chatId)) return Response.json({ received: true, ignored: true, update_id: updateId });

  const text = String(message?.text || message?.caption || '').trim();
  const userLang = detectLang(message?.from?.language_code ?? callback?.from?.language_code, text);

  if (callback?.id) {
    const parsed = parseCallback(String(callback.data || ''), userLang);
    await telegram('answerCallbackQuery', { callback_query_id: callback.id, text: 'NIRDHOOM Sathi' });
    if (parsed.kind === 'lang') {
      await sendMessage(chatId, `${COPY[parsed.lang].languageSet}\n\n${COPY[parsed.lang].menuTitle}`, menu(parsed.lang));
      return Response.json({ ok: true, update_id: updateId, lang: parsed.lang });
    }
    const action = (['fields', 'book', 'track', 'verify', 'market', 'status', 'help', 'language'] as const).includes(parsed.value as BotAction)
      ? (parsed.value as BotAction)
      : 'status';
    await handleAction(chatId, action, parsed.lang);
    return Response.json({ ok: true, update_id: updateId, action });
  }

  const firstName = String(message?.from?.first_name || 'farmer');
  const t = COPY[userLang];

  if (/^\/start(?:\s|$)/i.test(text)) {
    const startPayload = text.replace(/^\/start/i, '').trim();
    if (startPayload) {
      const linkedProfile = persistenceConfigured() ? await linkTelegramIdentity(startPayload, message).catch(() => null) : null;
      if (linkedProfile) {
        await sendMessage(chatId, t.linked, menu(userLang));
        return Response.json({ ok: true, update_id: updateId, linked: true });
      }
      await sendMessage(chatId, t.linkInvalid, menu(userLang));
      return Response.json({ ok: true, update_id: updateId, linked: false });
    }
    await sendMessage(chatId, t.welcome(firstName), menu(userLang));
    return Response.json({ ok: true, update_id: updateId });
  }

  if (message?.photo?.length) {
    const identity = persistenceConfigured() ? await getLinkedProfile(chatId).catch(() => null) : null;
    await sendMessage(chatId, t.photo(Boolean(identity)), menu(userLang));
    return Response.json({ ok: true, update_id: updateId, photo: true });
  }

  const action = routeText(text);
  if (action) {
    await handleAction(chatId, action, userLang);
    return Response.json({ ok: true, update_id: updateId, action });
  }

  await sendMessage(chatId, t.unknown, menu(userLang));
  return Response.json({ ok: true, update_id: updateId });
  } catch {
    await releaseTelegramUpdate(updateId);
    return Response.json({ error: 'Telegram update processing failed; retry requested' }, { status: 503 });
  }
}

export default async function handler(req: any, res: any) {
  if (req.method === 'GET') {
    const configured = Boolean(
      process.env.TELEGRAM_BOT_TOKEN
      && process.env.TELEGRAM_WEBHOOK_SECRET
      && ((process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) || process.env.VITE_SUPABASE_URL)
      && process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    // bot_ready: commands, menus and languages work. account_features: linking and private field status.
    const botReady = Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_WEBHOOK_SECRET);
    const botUsername = await resolveBotUsername();
    return res.status(configured ? 200 : 503).json({
      ok: configured,
      configured,
      bot_ready: botReady,
      account_features: persistenceConfigured(),
      bot_username: botUsername,
      service: 'nirdhoom-telegram-webhook',
    });
  }
  if (req.method !== 'POST') {
    res.setHeader?.('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
  const request = new Request('https://nirdhoom.local/api/notify/telegram-webhook', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-telegram-bot-api-secret-token': String(req.headers?.['x-telegram-bot-api-secret-token'] || ''),
    },
    body,
  });
  const response = await handle(request);
  const responseBody = await response.json().catch(() => ({}));
  return res.status(response.status).json(responseBody);
}
