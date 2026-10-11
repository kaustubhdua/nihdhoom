# NIRDHOOM Database Release Ledger

## Purpose
This document is the source of truth for the current Supabase migration chain. It replaces older deployment notes that described a previous V6/V7 split.

## Migration order
Migrations are applied in filename order:

1. `202609270001_nirdhoom_core.sql` — core identities, fields, bookings and RLS foundations.
2. `202609270002_nirdhoom_production.sql` — production roles, integrity triggers and operational protections.
3. `202609270003_nirdhoom_v6.sql` — V6 operational schema and RPC layer.
4. `202609270004_nirdhoom_v7.sql` — V7 booking, verification and buyer workflow extensions.
5. `202610010001_field_geometry_verification.sql` — field geometry and verification primitives.
6. `202610010002_verified_area_booking.sql` — booking against verified area.
7. `202610010005_nirdhoom_booking_integrity.sql` — authoritative booking/quote integrity.
8. `202610010006_nirdhoom_verification_and_settlement_integrity.sql` — verification and settlement guardrails.
9. `202610010007_nirdhoom_operational_integrity.sql` — operational transition protections.
10. `20261001_nirdhoom_database_hygiene.sql` — hygiene and consistency fixes.
11. `20261001_nirdhoom_rls_initplan_fix.sql` — RLS policy planning/performance fixes.
12. `202610020008_nirdhoom_client_write_integrity.sql` — client-write restrictions.
13. `202610020009_nirdhoom_security_advisor_cleanup.sql` — security-advisor cleanup.
14. `202610020010_nirdhoom_residue_pooling_and_research.sql` — residue pools, demand and research surfaces.
15. `202610020011_nirdhoom_residue_pooling_security_and_indexes.sql` — pooling security and indexes.
16. `202610020012_nirdhoom_residue_pool_verification_gate.sql` — verified-residue gate for pooling.
17. `202610040001_machine_privacy_and_pool_member_visibility.sql` — machine privacy and pool-member visibility.
18. `202610040002_revoke_trigger_function_execute.sql` — revoke direct execution of trigger-only functions.
19. `202610050001_nirdhoom_telegram_identity.sql` — authenticated Telegram identity linking and short-lived link-token consumption.
20. `202610050002_nirdhoom_telegram_webhook_idempotency.sql` — durable Telegram update de-duplication.
21. `20261006_nirdhoom_integrity_hardening.sql` — SECURITY DEFINER search-path hardening and residue allocation concurrency protections.
22. `20261006_nirdhoom_residue_quantity_invariants.sql` — positive-lot and pool-target quantity invariants.
23. `202610070001_nirdhoom_consent_withdrawal.sql` — self-service farmer consent withdrawal and profile revocation boundary.
24. `202610080001_nirdhoom_residue_lot_provenance.sql` — residue-lot provenance fields and server-authoritative chronological event ledger.
25. `202610080002_nirdhoom_residue_lot_first_class.sql` — first-class residue object fields, custody trigger and provenance contract.
26. `202610080003_nirdhoom_machine_capability_provenance.sql` — machine capability requirements and external-source metadata.
27. `202610080004_nirdhoom_residue_control_tower.sql` — machine capacity windows, storage yards, residue demand matches, transport jobs and operational exceptions.
28. `202610120001_nirdhoom_booking_field_status_consistency.sql` — writes the allowed `SCHEDULED` field status and blocks repeat booking while a field has an active/completed workflow.

## Release rules
- Never reorder or rename an already-applied migration.
- Never edit an applied migration to change production behavior; add a new migration.
- Every RPC that changes business state must derive authoritative values server-side.
- Client-provided status, quote, verification result, confidence, payout or settlement values are untrusted.
- Demo mode must never write to live settlement/payment systems.
- Payment remains intentionally simulated/not integrated for this release.
- Before a production release, record the Supabase migration status and run the RLS/integrity test suite.

## Verification checklist
- [ ] All migrations are present in the repository.
- [ ] Supabase migration history matches this order.
- [ ] RLS is enabled on every tenant/business table.
- [ ] Role escalation is blocked.
- [ ] Arbitrary client booking writes are blocked.
- [ ] Booking writes a valid field status (`SCHEDULED`) and rejects already-active fields.
- [ ] Field ownership/tampering is blocked.
- [ ] Evidence storage and evidence rows enforce operator/job ownership.
- [ ] Verification is restricted to authorized verifiers.
- [ ] Residue pooling requires verified residue.
- [ ] Trigger-only functions cannot be called directly.
- [ ] Payment endpoints remain explicit no-money-movement boundaries.
- [ ] Control-tower capacity, yard, matching, transport and exception tables remain server-authoritative.
- [ ] Residue matching is treated as a proposal until accepted by a real counterparty.
- [ ] Storage capacity and machine availability are checked before dispatch proposals.

## Known external dependencies
Cadastral/Khasra geometry, operator telemetry, evidence storage, weather, dispatch optimization, buyer/offtake integrations and messaging providers may depend on external services. Their availability must never be represented as verified field facts when unavailable.
