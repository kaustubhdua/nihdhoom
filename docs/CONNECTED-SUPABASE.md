# NIRDHOOM connected Supabase

The dedicated NIRDHOOM Supabase project is connected to the application. This document describes the repository migration chain and production release boundaries.

## Project

- Region: ap-south-1
- Browser configuration uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
- Server code must use server-side Supabase credentials only where required.
- Never commit service-role, provider, AI or webhook secrets.
- Payments remain deliberately non-live for the current release scope.

## Migration source of truth and production safety

The canonical fresh-install order is maintained in `supabase/migration-order.txt` (35 migrations at the 2026-10-12 repository review). `supabase/all-migrations.sql` is a generated bundle and CI validates that it matches the manifest. Do not maintain a second hand-written list here; it became stale as new migrations were added.

**Do not run `supabase db push` against production yet.** The live project's migration ledger uses server-assigned versions and historical split/combined records that do not directly match the repository filenames. The source SQL and production ledger must be reconciled before automated CLI pushes are safe. See `docs/DATABASE-RELEASE-LEDGER.md` for the observed ledger and the required schema-only comparison. The generated bundle is for clean installs only, not a production repair script.

Marketplace transaction workflow SQL under `supabase/proposals/` is deliberately excluded from the approved migration bundle until the staging authorization matrix passes.

## Current integrity boundaries

- RLS and role-escalation protections are part of the production schema.
- Booking creation is server-authoritative; arbitrary client booking writes are revoked.
- Field ownership/tampering is protected by database triggers/policies.
- Evidence storage is private and linked to authorized operational jobs.
- Verification requires operational evidence before residue can pass the verification gate.
- Residue pooling is restricted to verified residue.
- Trigger-only functions have direct execution revoked.
- Payment initiation/webhooks intentionally fail closed with no money movement.

## Application modes

Production/live mode loads operational records from Supabase and starts without seeded demo records.

Demo mode is explicit via `VITE_NIRDHOOM_DEMO_MODE=true` and persists demo state locally. Demo UI must remain visibly labelled as simulated and must not be interpreted as an external registry, settlement or payment record.

## External gates still required for a genuinely live field pilot

These are intentionally not faked by the application:

- Supabase SMS provider and real farmer OTP delivery
- Authoritative cadastral/Khasra source and import workflow
- Real verifier/operator accounts for end-to-end RLS/RPC testing
- Real machine/operator records and device GPS
- Production dispatch/OR-Tools service and operational validation
- FIRMS provider key and scheduled ingestion
- Telegram bot/webhook configuration and delivery validation
- IVR provider credentials and delivery validation
- Real buyer/offtake contracts and allocation validation
- Production deployment configuration
- Field-pilot validation with real operators and farmers

Payments are explicitly outside this release scope.
