# NIRDHOOM Telegram integration

Telegram is the primary conversational farmer channel for the current release. WhatsApp is no longer the primary website communication surface.

## Why Telegram

Telegram bots provide a native chat interface, inline keyboards, deep links and Mini Apps. Mini Apps can open the NIRDHOOM web workflow inside Telegram, so the same field-first UI can be used without maintaining a second farmer application.

Vercel's Chat SDK now has an official Telegram adapter. The first NIRDHOOM implementation uses the direct Telegram Bot API so the integration stays small and transparent; Chat SDK can be introduced later if NIRDHOOM needs one bot logic layer across several messaging platforms.

## Environment

Server-only:
- TELEGRAM_BOT_TOKEN — BotFather token. Never expose it with VITE_.
- TELEGRAM_WEBHOOK_SECRET — random secret used in Telegram's secret-token webhook header.
- TELEGRAM_BOT_USERNAME — bot username without @.
- TELEGRAM_MINI_APP_URL — optional HTTPS URL for the Mini App/website.
- VITE_TELEGRAM_BOT_USERNAME — browser-safe bot username used by the website link.

## Quick setup (5 minutes)

1. In Telegram, message @BotFather, send /newbot and copy the token.
2. In Vercel, set TELEGRAM_BOT_TOKEN, TELEGRAM_BOT_USERNAME, VITE_TELEGRAM_BOT_USERNAME, NIRDHOOM_PUBLIC_URL and TELEGRAM_WEBHOOK_SECRET (generate one with `npm run telegram:setup -- --new-secret`), then redeploy.
3. Run `npm run telegram:setup -- --url https://<your-vercel-domain>`. This sets the webhook with the secret token and registers the command menu in English, Hindi and Punjabi. Use `--check` to see webhook status and `--delete` to remove it.

The bot answers menus, commands and plain-word messages as soon as steps 1 to 3 are done. Account linking and private field status additionally need SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY; until then the bot says those features are unavailable instead of failing.

## Conversation

- Replies follow the farmer's Telegram language, or the script they type in (Gurmukhi → Punjabi, Devanagari → Hindi). /language switches it.
- Farmers can type plain words instead of commands: "machine", "ਮਸ਼ੀਨ ਕਿੱਥੇ ਹੈ", "पराली बुक करनी है", "proof", "market".
- Every answer carries a button that opens the matching NIRDHOOM page (Mini App when TELEGRAM_MINI_APP_URL is set, otherwise NIRDHOOM_PUBLIC_URL).
- Copy lives in api/_lib/telegramCopy.ts so it can be reviewed and translated without touching request handling.

## Webhook

Production endpoint:
https://<your-vercel-domain>/api/notify/telegram-webhook

Configure Telegram with setWebhook using the HTTPS URL and the same TELEGRAM_WEBHOOK_SECRET as the secret_token parameter.

The webhook supports /start, /help, /menu, inline action buttons and photo acknowledgement. It intentionally does not claim a booking, GPS position, verification result or payment without the corresponding authenticated NIRDHOOM record.

## Outbound notifications

POST /api/notify/telegram is restricted to authenticated NIRDHOOM dispatcher/admin users. It accepts a Telegram chat_id and text and sends through the Bot API.

Use it for booking confirmation, operator assignment, machine status, verification result and residue-pool status. Do not send sensitive farmer data to an unlinked chat ID.

## Website handoff

The farmer surface links to https://t.me/<BOT_USERNAME>. The website now has an authenticated one-time Telegram link flow: a signed-in NIRDHOOM user requests `/api/notify/telegram-link`, which creates a 10-minute single-use token stored only as a SHA-256 hash. The bot consumes that token through a server-only Supabase RPC and records the Telegram user/chat against the farmer profile. Knowing a Telegram chat ID alone never grants field access. The Mini App identity endpoint is `/api/notify/telegram-miniapp-auth`. It validates Telegram `initData` using the Bot API WebAppData HMAC scheme, rejects stale data, resolves the verified Telegram user against `telegram_identities`, and only then returns the linked NIRDHOOM profile ID. The same NIRDHOOM frontend can therefore be embedded as the Mini App without trusting a client-supplied user ID.

## Security before pilot

1. Create the bot with BotFather.
2. Store the token only in Vercel server environment variables.
3. Generate a strong random webhook secret.
4. Set the webhook over HTTPS.
5. Verify the webhook secret header.
6. Link Telegram identity to an authenticated NIRDHOOM profile before exposing field data.
7. Store Telegram chat/user IDs as operational identifiers, not public farmer identity.
8. Add consent and notification preferences.
9. Confirm the `telegram_webhook_updates` migration is applied and that duplicate `update_id` values return a harmless duplicate acknowledgement. The current webhook claims an update before sending its reply; after a process crash, a claimed update may not be replayed, so do not use the webhook as a guaranteed delivery queue for critical alerts. For critical alerts, persist an outbound notification job and retry it independently.
10. Test the bot with a linked test farmer: `/start`, link token, expired token, each inline menu, language switching, duplicate Telegram update, disabled notifications, missing Supabase config, and Bot API timeout.
11. Keep payment disabled in this release.

## Setup

After deployment, configure Telegram Bot API setWebhook with the production webhook URL and secret token. Telegram documents webhook HTTPS requirements and recommends the secret-token mechanism for validating webhook requests.
