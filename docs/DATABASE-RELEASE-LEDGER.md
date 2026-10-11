# NIRDHOOM database release ledger and production drift

## Important safety status

**Do not run `supabase db push` against the current production project yet.** The live project's migration ledger uses server-assigned 14-digit versions and legacy names, while repository filenames use older date prefixes. The live ledger also contains historical split/combined migration records. A blind CLI push would treat many already-applied schema changes as new migrations.

This document records the observed production history and the approved fresh-install order. It does **not** claim the production CLI baseline has been repaired. Before enabling automated pushes, compare a schema-only dump from production with a clean database created from `supabase/all-migrations.sql`, then map each remote ledger record to its source SQL and use `supabase migration repair` only after reviewing that mapping.

## Observed production migration ledger

Read from Supabase `list_migrations` on 2026-10-11. Versions below are the actual server ledger versions; do not replace them with repository filename prefixes.

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

## Fresh-install ordering

`supabase/migration-order.txt` is the canonical order for building `supabase/all-migrations.sql`. It is explicit because filenames include duplicate date prefixes and simple lexical sorting can put migrations in the wrong order. CI should verify the manifest and generated bundle stay synchronized.

Never reorder or rename historical migrations casually. Add a new, reviewed migration for future changes. The generated bundle is for a clean project only, not a production repair script.

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

- The core operational tables `profiles`, `fields`, `bookings`, `jobs`, `consents`, `evidence_assets`, `telegram_identities`, `residue_lots`, `residue_pools`, and `residue_matches` each had zero rows at the last check.
- `fields.status` allows `SCHEDULED`; booking status remains `BOOKED`. The booking RPC is executable by `authenticated`, not `anon`.
- Evidence bucket policies require authenticated users and restrict reads to the owner's folder or authorized operations roles.
- The production database had `accept_buyer_offer`, but did not have `matchable_residue_lots`, `create_buyer_offer`, or `transition_residue_transport_job` at the last function inventory. Do not describe the full marketplace offer/transport flow as live until the reviewed migration is applied.
