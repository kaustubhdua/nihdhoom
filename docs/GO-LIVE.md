# Go live: make the site work with real farmers

This is the shortest path from "site loads" to "a farmer can create an account, register a field and book a pickup". Payments are not part of this release.

You need three free accounts: GitHub (you have it), Vercel (hosts the site) and Supabase (database and phone login).

## 0. Check where you are (30 seconds)

On any computer with Node installed, in the project folder:

```bash
npm install
npm run doctor -- --site https://YOUR-SITE.vercel.app
```

It reads `.env.local` (copy `.env.example` to `.env.local` and fill in the two Supabase values) and tells you what is missing, in plain words. Run it again after each step below until it says `No blockers`.

## 1. Create the database (Supabase)

1. supabase.com > New project. Pick a region close to Punjab (Mumbai, `ap-south-1`).
2. **Project Settings > API**: copy the **Project URL** and the **anon / publishable key**. You will also see a **service_role** key. That one is a secret and is only ever used on the server.
3. **SQL Editor > New query**. Open `supabase/all-migrations.sql` from this repo (GitHub: the file page > Copy raw file), paste it all, press **Run** once. This bundle is for a brand-new project only. Do not paste it into production or run `supabase db push` against the existing project until `docs/DATABASE-RELEASE-LEDGER.md` says the CLI baseline is reconciled.
   - It must run on a project where it has not run before. Running it twice stops with "already exists" errors, which is harmless but means it was already done.
   - If it fails, the line starting `-- >>> ` just above the error names the migration. Fix the cause, then run only the files from that one onward from `supabase/migrations/`.
4. Regenerate the file after any approved migration change: `npm run db:bundle`. The explicit order is in `supabase/migration-order.txt`. The buyer-offer/transport workflow is a staging-only proposal and is intentionally excluded until its authorization matrix passes.

## 2. Turn on phone login (Supabase)

**Authentication > Sign In / Providers > Phone** must be enabled, and an SMS provider chosen.

| Option | When to use it |
| --- | --- |
| **Test numbers and OTPs** (set on the Phone provider page) | Demos and judging. You list a few phone numbers with fixed codes. No SMS is sent and nothing is billed. Look for "Test Phone Numbers and OTPs" under the Phone provider settings. |
| **Twilio / Twilio Verify, MessageBird, Vonage** | Real SMS to real farmers. SMS to India needs a registered sender and message template (TRAI DLT), which takes days. |
| **MSG91** | Not wired up. Supabase has no built-in MSG91 option; it would need a "Send SMS" auth hook. The `MSG91_*` values in `.env.example` are unused for now. |

Farmers type 10 digits; the site adds `+91`. So a test number is entered in Supabase as `919876543210`.

## 3. Put the values in Vercel

Vercel > your project > **Settings > Environment Variables**. Select the environment deliberately for each variable. **Do not copy production Supabase credentials into Preview or Development.** Until an isolated staging Supabase project exists, keep all `VITE_SUPABASE_*`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` values scoped to **Production only**. Preview deployments without a staging database are expected not to have live database access.

| Name | Value | Needed for |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Project URL | The website |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | anon / publishable key | The website |
| `VITE_NIRDHOOM_DEMO_MODE` | `false` | The website (omit it for the same effect) |
| `SUPABASE_URL` | Project URL again | Telegram bot and server functions |
| `SUPABASE_PUBLISHABLE_KEY` | anon / publishable key again | Server functions |
| `SUPABASE_SERVICE_ROLE_KEY` | server-only Supabase service-role/secret key | Telegram account linking; production value was empty on 2026-10-12 |
| `TELEGRAM_BOT_TOKEN` | token from @BotFather | Telegram bot replies; production value was empty on 2026-10-12 |
| `TELEGRAM_WEBHOOK_SECRET` | strong random secret | Webhook verification; production value was empty on 2026-10-12 |
| `TELEGRAM_BOT_USERNAME`, `VITE_TELEGRAM_BOT_USERNAME` | bot username without `@` | Telegram link and UI |
| `NIRDHOOM_PUBLIC_URL` | `https://YOUR-SITE.vercel.app` | Buttons in the bot; production value was empty on 2026-10-12 |
| `GROQ_API_KEY` | API key from the Groq console | Sathi AI provider; code reads this exact name, while production currently has a separate `GROQ_API` variable |
| `REQUIRE_AUTH_FOR_AI` | `true` | Explicitly require authentication for the assistant in production |

Never put the service_role key in a name that starts with `VITE_`: everything starting with `VITE_` is published inside the website's code.

**Do not treat the production bot or AI as configured yet.** A read-only Vercel environment inspection on 2026-10-12 found the server-only Telegram/Supabase values above empty and did not find `GROQ_API_KEY`. Fill the variables in Vercel's encrypted UI, keep secrets out of Git and browser-prefixed variables, then redeploy after the daily deployment limit permits it. Run `npm run telegram:setup -- --url https://nihdhoom-9qiu.vercel.app` from a trusted local shell only after the token and secret are configured; the script talks to the live Telegram Bot API.

Then **Deployments > the latest > ... > Redeploy**. Values that start with `VITE_` are baked in while the site is built, so they only take effect on a new deployment.

## 4. Walk through it once

1. Open the site > **Farmer onboarding** (`#/farmer-kyc`). Enter name, village and mobile number, send the OTP, enter the code.
2. Accept consent. Register a field: Khasra number, acres, and press **Use my current location** while standing at the field (or type latitude and longitude).
3. **Book a pickup** (`#/farmer-onboarding`): choose the field and a date. The server decides the price; no payment is taken.
4. **Connect Telegram** (`#/farmer-surface`) to link the same account to the bot.
5. The home page, **My fields** and the map now show that field. Machines, operators and verifiers are added by an admin (set `role` on `public.profiles`).

## 5. What the home-page banner means

| Banner | Meaning | Fix |
| --- | --- | --- |
| "This deployment is not connected to a database" | The two `VITE_SUPABASE_*` values were not present when this deployment was built | Section 3, then redeploy |
| "Sign in to see live fields" | Working as designed. Field and machine records are private to signed-in users | Sign in from Farmer onboarding |
| "Live data unavailable: ... no NIRDHOOM tables" | Migrations were not applied | Section 1 |
| "Live data unavailable: ... key is not accepted" | Wrong or service key in `VITE_SUPABASE_PUBLISHABLE_KEY` | Copy the anon key again |
| "Live data unavailable: ... could not be reached" | Wrong URL or the Supabase project is paused | Check `VITE_SUPABASE_URL`; resume the project |

The grey "Technical detail" line under the banner is the exact message from Supabase.

## 6. Why environment variables seem to disappear after a redeploy

A redeploy does not delete variables. They live on the Vercel project and are picked up by every new build. What looks like "removed" is almost always one of these:

1. **Environment isolation is intentional.** A branch other than `main` creates a **Preview** deployment. Give Preview its own staging Supabase URL/key and separate test Telegram bot/secrets before enabling those integrations there. Do not tick Production service-role keys or the production Telegram webhook secret for Preview just to make the preview work. If no staging project exists yet, database-dependent preview flows should remain unavailable.
2. **A different Vercel project.** If the repo was imported twice, or a new project was created for a fork, each project has its own variables. The live address `nihdhoom-9qiu.vercel.app` belongs to one specific project; add the variables there.
3. **Looking at a different deployment.** Open the deployment that shows the problem and check its label (Production or Preview) and its branch.
4. **Sensitive variables.** If a variable is marked Sensitive, Vercel hides its value after saving. It is still set; the empty box is not a missing value.
5. **A change without a rebuild.** Editing a variable never changes a deployment that already exists. Redeploy after every change.

To confirm quickly: Settings > Environment Variables > search `VITE_SUPABASE_URL` and verify it targets the intended project and environment. Production should point at the production project; Preview should point at a separate staging project. Never enable a service-role key in any `VITE_*` variable.
