# NIRDHOOM database release ledger and production drift

## Important safety status

**Do not run `supabase db push` against the current production project yet.** The live project's migration ledger uses server-assigned 14-digit versions and legacy names, while repository filenames use older date prefixes. The live ledger also contains historical split/combined migration records. A blind CLI push would treat many already-applied schema changes as new migrations.

This document records the observed production history and the approved fresh-install order. It does **not** claim the production CLI baseline has been repaired. Before enabling automated pushes, compare a schema-only dump from production with a clean database created from `supabase/all-migrations.sql`, then map each remote ledger record to its source SQL and use `supabase migration repair` only after reviewing that mapping.

## Observed production migration ledger

Read from Supabase `list_migrations` on 2026-10-12. Versions below are the actual server ledger versions; do not replace them with repository filename prefixes.

| Production version | Recorded migration name |
|---|---|
| 20261001180352 | 202609270001_nirdhoom_core |
| 20261001180400 | 202609270002_nirdhoom_production |
| 20261001180459 | 202609270003a_nirdhoom_v6_schema |
| 20261001180512 | 202609270003b_nirdhoom_v6_storage_policies |
| 20261001180524 | 202609270004_nirdhoom_v7 |
| 20261001180749 | 20261001_nirdhoom_database_hygiene |
| 20261001180834 | 20261001_nirdhoom_rls_initplan_fix |
| 20261001181442 | field_geometry_verification |
| 20261001181543 | verified_area_booking |
| 20261001190715 | nirdhoom_booking_integrity |
| 20261001190719 | nirdhoom_verification_and_settlement_integrity |
| 20261001190723 | nirdhoom_operational_integrity |
| 20261001190727 | nirdhoom_client_write_integrity |
| 20261001190744 | nirdhoom_security_advisor_cleanup |
| 20261002121027 | nirdhoom_residue_pooling_and_research |
| 20261002121053 | nirdhoom_residue_pooling_security_and_indexes |
| 20261002121140 | nirdhoom_residue_pool_verification_gate |
| 20261004180254 | machine_privacy_and_pool_member_visibility |
| 20261004180352 | revoke_trigger_function_execute |
| 20261005102318 | 20261005_nirdhoom_telegram_identity_live_repair |
| 20261005222444 | 20261006_nirdhoom_integrity_hardening |
| 20261005223250 | 20261006_nirdhoom_residue_quantity_invariants |
| 20261006210947 | nirdhoom_private_realtime_live_operations |
| 20261010140429 | nirdhoom_consent_withdrawal_20261007 |
| 20261010140435 | nirdhoom_residue_lot_provenance_20261008 |
| 20261010140450 | nirdhoom_residue_lot_first_class_20261008 |
| 20261010140456 | nirdhoom_machine_capability_provenance_20261008 |
| 20261010140509 | nirdhoom_residue_control_tower_20261008 |
| 20261010142704 | nirdhoom_farmer_signup_profile_20261010 |
| 20261011085533 | nirdhoom_security_definer_auth_guards_20261011 |
| 20261011091735 | nirdhoom_booking_consent_and_window_20261011 |
| 20261011092000 | nirdhoom_booking_field_status_consistency_20261012 |
| 20261011092039 | nirdhoom_booking_active_field_guard_20261012 |
| 20261011102009 | nirdhoom_fk_indexes_20261012 |
| 20261011102156 | nirdhoom_storage_yard_policy_consolidation_20261012 |
| 20261011210907 | nirdhoom_consent_audit_immutability_20261012 |

## Fresh-install ordering

`supabase/migration-order.txt` is the canonical order for building `supabase/all-migrations.sql`. It is explicit because filenames include duplicate date prefixes and simple lexical sorting can put migrations in the wrong order. CI should verify the manifest and generated bundle stay synchronized.

Never reorder or rename historical migrations casually. Add a new, reviewed migration for future changes. The generated bundle is for a clean project only, not a production repair script.

## Reconciliation findings from the 2026-10-12 read-only audit

The live ledger contains **36 records**. The repository's explicit fresh-install manifest now contains **38 files** because it includes the unapplied atomic job/residue-completion migration and the proposed P0 hardening migration. The count difference is not a repair instruction: the historical records are not a one-to-one filename mapping.

Known source-history mismatches that must be resolved before enabling pushes:

- Production records `202609270003a_nirdhoom_v6_schema` and `202609270003b_nirdhoom_v6_storage_policies`; the current source manifest has a single `202609270003_nirdhoom_v6.sql`. Recover the exact split SQL or verify each effect against the production schema before mapping either ledger entry.
- Production records `nirdhoom_booking_active_field_guard_20261012`, but the manifest has no same-named file. The current booking/status migrations are not sufficient proof that this historical entry's exact SQL has been reconciled.
- The manifest includes `202610050001_nirdhoom_telegram_identity.sql` and `202610050002_nirdhoom_telegram_webhook_idempotency.sql`; production's ledger instead names `20261005_nirdhoom_telegram_identity_live_repair`. Do not assume the live repair is byte-for-byte equivalent to both files without recovering the source that was applied.
- `202610120004_atomic_job_residue_completion.sql` is in the source bundle but is absent from the production ledger, and `public.complete_job_with_residue_lot(uuid,numeric,numeric,integer,jsonb)` was absent from the production function inventory.
- `202610120005_nirdhoom_p0_booking_verification_privileges.sql` is a proposed migration in this PR; it is not applied to production.

The live database had **zero bookings and zero machine-capacity windows** at the time of the read-only check. That makes migration dry-run and synthetic concurrency tests possible, but does not substitute for role-based staging acceptance.

### Safe repair plan

1. Keep production `db push` disabled. Do not change remote ledger versions just to make them resemble repository filenames.
2. Export a schema-only snapshot and a catalog snapshot of functions, constraints, indexes, policies, grants, and default privileges.
3. Build a disposable database from the reviewed bundle; compare its schema with production and classify every difference as expected, missing, extra, or ambiguous.
4. Produce a signed-off mapping table for every remote version: ledger version/name, exact source path and Git commit, SQL digest, schema effects, whether the effect exists in production, and reviewer.
5. Recover split/combined historical SQL from the original applied commit or deployment artifact. If exact source cannot be recovered, treat the entry as **unreconciled**; do not invent a mapping.
6. Test pending migrations in staging and verify grants and RPC behavior using anon, authenticated farmer, operator, dispatcher, verifier, admin, and service-role contexts.
7. Use `supabase migration repair` only for a documented ledger correction after confirming the SQL effects are already present. Never mark a migration applied if its effects are absent, and never rerun an already-applied DDL migration merely because its filename differs.
8. Apply reviewed new migrations only through the approved release process, then re-query the remote ledger and schema before enabling any automated production push.

The P0 migration's proposed grant changes are grounded in the same read-only audit: effective anon table privileges were present across the public schema, while all inspected row policies targeted `authenticated`; the only public-schema function with effective anon EXECUTE was `revoke_farmer_network_consent()`. The proposed migration revokes inherited table/view/sequence privileges from `PUBLIC` and `anon`, preserves authenticated grants and RLS policies, and makes consent withdrawal authenticated-only. This has **not** yet been verified in staging or production.

## Marketplace workflow proposal

`supabase/proposals/202610110002_nirdhoom_marketplace_transaction_workflow.sql` is **not approved for production** yet. Its source explicitly requires a staging authorization matrix. It is excluded from the fresh-install bundle until buyer/dispatcher/farmer authorization, ownership boundaries, and transport transitions pass that matrix. The marketplace UI must treat missing RPCs as an unavailable capability, not as proof that the workflow succeeded.

## Production validation checklist

- [ ] Schema-only diff between production and a clean bundle-created database reviewed.
- [ ] Remote migration versions mapped to exact source SQL (including historical split/combined entries).
- [ ] CLI migration baseline repaired and dry-run confirms no already-applied migrations would rerun.
- [ ] Phone provider and a designated Supabase test phone/OTP configured.
- [ ] Farmer signup, consent, field creation, booking and cancellation pass with the test account.
- [ ] Telegram link and webhook pass without using a real farmer's identity.
- [ ] Evidence upload/read access verified with an authorized test operator and verifier.
- [ ] Verifier and dispatcher role boundaries tested; negative cross-user tests pass.
- [ ] Marketplace proposal passes staging authorization matrix before inclusion in production.
- [ ] Live desktop/mobile map is visually checked on the deployed commit.
- [ ] Deployment commit SHA matches `main`; Vercel status is READY and runtime smoke tests pass.

## Last read-only production observations

- The core operational tables `profiles`, `fields`, `bookings`, `jobs`, `consents`, `evidence_assets`, `telegram_identities`, `residue_lots`, `residue_pools`, and `residue_matches` each had zero rows at the last check; `machine_capacity_windows` also had zero rows and zero reserved acres.
- `fields.status` allows `SCHEDULED`; booking status remains `BOOKED`. The booking RPC is executable by `authenticated`, not `anon`.
- On 2026-10-12, the consent audit privilege migration was applied and verified: `authenticated` no longer has table INSERT/UPDATE or `accepted_at` UPDATE on `public.consents`, but retains column UPDATE for `revoked_at` and EXECUTE on the guarded accept/withdraw RPCs. The atomic job-completion RPC remains absent from production.
- Evidence bucket policies require authenticated users and restrict reads to the owner's folder or authorized operations roles.
- The production database had `accept_buyer_offer`, but did not have `matchable_residue_lots`, `create_buyer_offer`, or `transition_residue_transport_job` at the last function inventory. Do not describe the full marketplace offer/transport flow as live until the reviewed migration is applied.
