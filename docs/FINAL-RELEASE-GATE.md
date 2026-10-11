# NIRDHOOM final release gate

Updated: 2026-10-12

This checklist is the release contract for the next NIRDHOOM field pilot. It deliberately separates repository/CI evidence from proof that a connected external service works. A checked box means someone recorded evidence for the exact environment and commit; code presence, a successful build, or a preview deployment alone is not enough.

## Release status

- Repository automated checks: CI has coverage for TypeScript, repository integrity, unit/source-contract tests, generated migration-bundle consistency, isolated PostgreSQL integration tests, build, and dispatch-service unit tests.
- Real end-to-end browser/device flow: not yet evidenced by this document.
- Supabase production migration reconciliation: open; do not run `supabase db push` blindly.
- Atomic job-completion RPC: the latest read-only production check reported it absent. Recheck before release.
- Vercel production alias/commit: reconcile against the exact production-target deployment; preview READY is not production.
- Real OTP delivery, Telegram delivery, and dispatch service: require environment-specific smoke tests.
- Payments and carbon issuance: intentionally out of scope and must remain non-live.


## Observed external-service state (read-only, 2026-10-12)

These are observations, not release sign-off:

- **Vercel:** the current production-target deployment is READY and aliases `nihdhoom-9qiu.vercel.app`, but it was built from commit `7e8322f00eadc0b50de38ed0882cde5737d841a3`, which predates the latest release-gate and Telegram retry commits. The current GitHub commit has a Vercel check failure pointing to the team's build-rate limit. No deployment promotion or rollback has been performed as part of this audit.
- **Production environment:** the Vercel environment listing reports `VITE_NIRDHOOM_DEMO_MODE=false` and production-target Supabase URL/publishable-key variables. The project configuration explicitly limits those Supabase frontend variables to Production pending isolated Preview Supabase configuration. Do not use Preview to run live-data tests against Production.
- **Supabase:** read-only migration/function inspection found `public.complete_job_with_residue_lot(uuid,numeric,numeric,integer,jsonb)` absent from the production database. The atomic completion SQL has passed isolated PostgreSQL CI tests, but the production migration remains unapplied by design.
- **Consent audit integrity (verified 2026-10-12):** applied production migration `nirdhoom_consent_audit_immutability_20261012` (ledger version `20261011210907`). A read-only post-migration privilege query confirms authenticated users cannot INSERT consent rows, cannot use table-wide UPDATE or change `accepted_at`, and can update only `revoked_at`; authenticated execution of both guarded consent RPCs remains granted. The same permission/RLS behavior and guarded RPC write path pass in isolated PostgreSQL CI run [1235](https://github.com/kaustubhdua/nihdhoom/actions/runs/38174884887).
- **Dependency audit:** CI now runs `npm audit --omit=dev --audit-level=high`; it passed in CI run [1213](https://github.com/kaustubhdua/nihdhoom/actions/runs/38173309875). This does not replace periodic full dependency review.
- **Server-only environment variables (read-only Vercel inspection, 2026-10-12):** the Production entries for `SUPABASE_SERVICE_ROLE_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, and `NIRDHOOM_PUBLIC_URL` exist but are empty. This is a hard blocker for the production Telegram webhook and its persistent Supabase dedupe path; Telegram requests cannot be accepted and answered correctly without the bot token/webhook secret, and server-side operations requiring service-role access cannot work without that key. Set these through Vercel's encrypted environment UI, never in source control or a Vite-prefixed variable. Then configure Telegram's webhook to the exact production endpoint and perform a signed test update with a dedicated test chat. `NASA_FIRMS_API` and server-only Supabase aliases were also empty; confirm each feature's intended key alias before enabling those optional integrations. No secret values were read into this report or changed.
- **Assistant provider configuration (read-only Vercel inspection, 2026-10-12):** the environment contains `GROQ_API`, but the server reads `GROQ_API_KEY`; neither `GROQ_API_KEY` nor `OPENAI_API_KEY` is configured. Provider-backed Sathi answers therefore remain unverified until the correct server-only key is set and tested. `REQUIRE_AUTH_FOR_AI` is also absent; merged code now requires authentication by default whenever live mode is active, and unauthenticated fallback is limited to explicitly enabled demo mode. Set `GROQ_API_KEY` and `REQUIRE_AUTH_FOR_AI=true` in Vercel, then redeploy and test with a signed-in test account.
- **Runtime observations:** the Vercel runtime-error query returned no grouped errors for the selected 24-hour window. This does not establish that user journeys work.
- **Security advisor:** the current read-only report flags two RLS-enabled tables with no policies (`telegram_link_tokens`, `telegram_webhook_updates`), which is consistent with their intended server-only access but should be verified against service-role-only use. It also flags nine authenticated-callable SECURITY DEFINER workflow functions; their explicit actor/role/ownership checks and grants must remain covered by SQL tests. Do not blanket-revoke these workflow RPCs merely to silence the advisor.
- **Provider setup:** repository/Vercel inspection does not prove that Supabase SMS delivery, Telegram webhook registration, Telegram outbound delivery, or the dispatch endpoint work with real provider credentials. These still require controlled smoke tests with dedicated test accounts.

**Release decision as of this observation:** not approved for a production field pilot until the production deployment is reconciled with `main`, Vercel can build the intended commit, the database migration history/schema diff is reviewed and staged, and the real provider/auth/operator smoke tests pass.

## Gate A — Release identity and rollback (P0)

- [ ] Record the intended `main` commit SHA.
- [ ] Inspect Vercel deployment target and verify the production alias points at that commit.
- [ ] Confirm the deployed environment has `VITE_NIRDHOOM_DEMO_MODE=false`.
- [ ] Confirm required browser-safe Supabase URL/publishable key are configured for Production; confirm server-only secrets are configured only server-side.
- [ ] Resolve any Vercel deployment quota block through normal account/plan controls; do not bypass deployment controls.
- [ ] Open the production URL and verify the loaded app/version; smoke-test critical routes and API health.
- [ ] Review recent runtime errors and logs for the exact production deployment.
- [ ] Record a known-good rollback deployment and a rollback owner/procedure.
- [ ] Do not claim release complete until post-deployment smoke tests pass.

## Gate B — Supabase schema and migration integrity (P0)

- [ ] Export a schema-only snapshot from production using the approved secure process.
- [ ] Build a clean disposable database from `supabase/migration-order.txt` / generated bundle.
- [ ] Review the schema-only diff, extensions, indexes, constraints, triggers, RLS policies, grants, storage policies, and functions.
- [ ] Map each remote migration-ledger entry to its exact source migration, including historical split/combined entries.
- [ ] Reconcile the CLI migration baseline only after that mapping is reviewed.
- [ ] Apply the atomic job/residue-lot completion migration to a staging schema first.
- [ ] Verify RPC signature, function owner/search_path, authorization checks, grants, evidence gate, measurements, row locks, rollback behavior, and retry idempotency.
- [ ] Run SQL integration tests on the staging schema, including unauthorized actor, missing evidence, invalid measurements, forced rollback, duplicate retry, and retry after evidence archival.
- [ ] Confirm the marketplace proposal migration remains excluded until its buyer/farmer/dispatcher/transport authorization matrix passes.
- [ ] Only apply reviewed migrations to production in an approved maintenance/release window with rollback/recovery steps.

**Hard stop:** never run `supabase db push` against the current production project until migration history and schema drift are reconciled.

## Gate C — Real farmer authentication and consent (P0)

Use a dedicated test phone/account, not a real farmer's identity.

- [ ] Verify Supabase Phone Auth is enabled for the target environment.
- [ ] Verify SMS provider credentials, sender/header, approved message template, and applicable India DLT/consent requirements.
- [ ] Verify OTP arrives on the designated test phone.
- [ ] Test invalid number, wrong code, expired code, resend cooldown, rate limiting/CAPTCHA, provider outage, network timeout, and duplicate taps.
- [ ] Verify successful OTP creates a session and profile with the authenticated user ID.
- [ ] Verify returning-user flow does not require re-registering existing fields or losing consent state.
- [ ] Verify session survives reload, expires safely, and sign-out clears private state.
- [ ] Verify consent text/version/time are recorded; withdrawal changes server state and future booking actions are blocked until renewed consent.
- [ ] Verify no Aadhaar, selfie, bank, land-registry, payment, or identity verification is presented as live unless a real authorized integration exists.

## Gate D — End-to-end operational journey (P0)

Run in staging with dedicated farmer, operator, dispatcher, verifier, buyer, and admin test accounts.

- [ ] Farmer signs in, grants consent, and registers a field.
- [ ] Field location and boundary provenance are labelled accurately; manual/demo geometry is never called authoritative cadastral data.
- [ ] Farmer requests clearance and sees real state, next action, and a helpful no-capacity reason.
- [ ] Dispatcher assigns a machine/job and sees solver fallback state truthfully.
- [ ] Unassigned operator cannot start or complete the job.
- [ ] Operator records measured quantity, moisture, bale count, timestamp, and required evidence.
- [ ] Missing/invalid measurements and missing evidence block live completion.
- [ ] Completion updates the job/booking/field and creates exactly one residue lot in one transaction.
- [ ] Retrying after lost response returns the same lot and does not duplicate records.
- [ ] Verifier can review provenance/evidence; completion is not automatically described as verified non-burning.
- [ ] Lot shows source field, job/machine lineage, quantity/quality, evidence, verification, custody, and destination state.
- [ ] Pickup/storage/pooling/buyer transitions are authorized and proposal, offer, accepted deal, and transport are distinct states.
- [ ] All failure responses are visible to the user; no false success toast/state.

## Gate E — Role matrix and storage security (P0)

- [ ] Farmer A cannot read/update Farmer B's profile, fields, bookings, evidence, or residue.
- [ ] Operator cannot complete a job assigned to another operator.
- [ ] Operator cannot alter farmer-owned field attributes or self-grant privileged roles.
- [ ] Verifier cannot approve without the required evidence and completed operational record.
- [ ] Buyer sees only authorized demand/matching records and cannot claim the same lot twice.
- [ ] Dispatcher/admin endpoints reject anonymous and lower-privilege callers.
- [ ] Direct REST/table access and direct RPC/API calls are tested, not only hidden UI buttons.
- [ ] Storage paths, object reads, evidence metadata, and signed URL lifetime obey the same role/ownership rules.
- [ ] Secrets never appear in browser bundles, logs, error messages, screenshots, or committed files.
- [ ] Review the current Supabase security advisor findings. The 2026-10-12 read-only check reported nine authenticated-callable SECURITY DEFINER functions; inspect every function's auth-null behavior, role/ownership predicates, pinned search_path, and grants before deciding whether any grant is excessive. Do not blanket-revoke required workflow RPCs.
- [ ] Confirm `telegram_link_tokens` and `telegram_webhook_updates` are intentionally server-only tables with RLS enabled and no client policies; validate service-role access is confined to server endpoints and never exposed to browser code.

## Gate F — Offline evidence and field device reliability (P1)

- [ ] Capture evidence while offline, reload/close the app, reconnect, and verify the queued blob remains available.
- [ ] Test upload-success/response-lost retry, metadata-insert failure, duplicate replay, and storage 409 behavior.
- [ ] Switch accounts and verify queued evidence is not replayed as another user.
- [ ] Test expired session, IndexedDB failure, quota exhaustion, unsupported file type, spoofed MIME/header, oversized/empty image, and corrupt image.
- [ ] UI exposes pending/syncing/synced/failed counts and actionable retry/recovery messaging.
- [ ] Test GPS permission denied, inaccurate/stale GPS, unavailable geolocation, and slow network.
- [ ] Test on a real Android device, narrow viewport, low-end hardware, and throttled/unstable network.

## Gate G — Telegram, dispatch, and external providers (P1)

- [ ] Telegram webhook uses HTTPS and validates the secret-token header.
- [ ] Test signed Mini App initData, invalid HMAC, stale auth_date, unlinked user, expired/single-use link token, and duplicate update_id.
- [ ] Test Hindi, Punjabi, English, missing configuration, Bot API timeout, disabled notification preference, and account unlinking/consent.
- [ ] Critical notifications have durable retry/outbox behavior; webhook acknowledgment is not treated as proof of delivery.
- [ ] Dispatch service health and authenticated solve endpoint work from the deployed gateway.
- [ ] Invalid solver responses, timeouts, unavailable service, and heuristic fallback are visible and safe.
- [ ] FIRMS, weather, IVR, and cadastral adapters are smoke-tested only if enabled; source, timestamps, attribution, provider license, and data limits are visible.
- [ ] No satellite observation alone is represented as field-level proof.
- [ ] No buyer request is represented as a contract or confirmed offtake without evidence.

## Gate H — Browser automation, accessibility, and UX (P1)

- [ ] Add/maintain browser end-to-end tests for the primary farmer and operator flows against a controlled test environment.
- [ ] Run desktop and mobile viewports, keyboard-only navigation, visible focus, labels, contrast, reduced motion, and accessible errors.
- [ ] Test empty, loading, success, partial-data, unauthorized, timeout, and offline states for every critical screen.
- [ ] Test image/map fallback and missing third-party resources.
- [ ] Verify English, Hindi, and Punjabi coverage for labels, validation errors, consent, notifications, and offline status.
- [ ] Ensure critical actions have loading/disabled states and prevent double submission.
- [ ] Test every primary button by clicking it in the deployed environment; source-level checks are not a substitute.

## Gate I — Observability, backup, recovery (P1)

- [ ] Correlate client-visible request IDs with server logs without recording farmer PII, OTPs, tokens, or evidence contents.
- [ ] Monitor OTP failures, booking errors, dispatch failures, evidence replay failures, webhook failures, and RPC exceptions.
- [ ] Configure alert ownership and escalation for critical failures.
- [ ] Document backup retention and recovery point/objectives appropriate to the pilot.
- [ ] Perform a restore/recovery drill and verify data integrity.
- [ ] Document incident response, contact ownership, rollback steps, and customer communication.

## Gate J — Field pilot and outcome evidence (P1)

- [ ] Conduct a supervised pilot with real consent and dedicated support.
- [ ] Record task completion rate/time, support interventions, booking assignment latency, sync success, duplicate/error rate, and user feedback.
- [ ] Validate actual machine capacity and buyer demand before making availability or offtake promises.
- [ ] Verify the lineage of measured tonnes and reconcile physical measurements with digital records.
- [ ] Do not publish impact/carbon claims until a defensible methodology and verified input data support them.
- [ ] Review pilot findings and close all severity-0/1 issues before broader release.

## P2 — Post-pilot product improvements

- [ ] Add exception-focused control tower views for deadlines, capacity conflicts, pickup backlog, and unassigned reasons.
- [ ] Improve geographic demand/capacity matching and route efficiency using validated operational data.
- [ ] Track KPIs: request-to-assignment time, on-time clearance, machine utilization, verified tonnes, tonnes awaiting pickup, evidence completeness, sync success, and exception resolution time.
- [ ] Add AI explanations/suggestions only on authenticated data; AI never dispatches, verifies, or creates commercial commitments autonomously.
- [ ] Revisit the Supabase performance advisor after representative pilot traffic. The 2026-10-12 read-only check reported 67 unused indexes on a largely empty project; do not remove indexes solely from that snapshot, because low usage may reflect the absence of production workload.\n- [ ] Improve performance budgets, image attribution, caching, map fallback, and low-bandwidth behavior.
- [ ] Keep payments/carbon issuance disabled until provider integration, ledger, reconciliation, audit, and compliance controls are real.

## Final decision

- [ ] All P0 gates pass with evidence.
- [ ] All P1 items needed for this pilot pass or are explicitly excluded from pilot scope with a safe fallback.
- [ ] P2 items are recorded as planned, not silently treated as release blockers.
- [ ] A named release owner signs off on the exact commit, database migration set, environment, smoke-test evidence, and rollback target.

**Status rule:** until the gates above have evidence, describe NIRDHOOM as a prototype/integration foundation under release validation—not as production-complete.
