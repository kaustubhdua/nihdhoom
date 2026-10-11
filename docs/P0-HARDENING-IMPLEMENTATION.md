# NIRDHOOM P0 hardening implementation

**Status:** proposed migration and tests in review; not applied to production.
**Migration:** `202610120005_nirdhoom_p0_booking_verification_privileges.sql`
**Branch:** `fix/p0-booking-verification-privileges`

## P0-A — Capacity-backed booking state

- `REQUESTED` + `reservation_state=UNCONFIRMED` means a request was saved but no capacity was reserved. Its requested date is indicative only; `guaranteed_by_date` is null and penalty is zero.
- `MACHINE_ASSIGNED` + `reservation_state=RESERVED` is written only in the same transaction that locks an eligible machine-capacity window, increments `reserved_acres`, and creates an active `booking_capacity_reservations` row.
- Capacity selection uses a row lock with `SKIP LOCKED`. A concurrent request that cannot lock sufficient remaining capacity remains unconfirmed rather than consuming the same capacity.
- Deferred constraint triggers check both directions at transaction commit: a reserved booking must have an active reservation on the assigned machine, an active reservation cannot be removed from a still-reserved booking, and each window's `reserved_acres` must equal the sum of its active reservation rows. Machine and window eligibility rows are locked together.
- Cancellation releases reserved acres and the reservation in one transaction. A booking with a created job cannot be cancelled by the farmer; operations must resolve that workflow.
- Service penalties remain disabled pending approved contractual terms.
- Existing booking rows without reservation evidence are downgraded from unsupported guarantees to unconfirmed/non-penalty state. Historical quote values are retained.

## P0-B — Truthful verification provenance

- The method is `field_evidence_only` unless the verifier explicitly supplies FIRMS observation IDs.
- Supplied IDs are validated against `firms_observations.matched_field_id`; unknown or mismatched IDs reject the review.
- The event metadata records observation ID, source, sensor, acquisition timestamp, confidence, FRP, and temporal relation to job completion.
- A missing or late observation is not interpreted as proof that no burning occurred. The human decision, confidence, and review trail remain explicit.

## P0-C — Least-privilege grants

- Production read-only inspection on 2026-10-12 found effective anonymous table privileges across the public schema despite RLS policies targeting authenticated users.
- The migration revokes table/view/materialized-view privileges and sequence privileges from `PUBLIC` and `anon` across `public`, without changing RLS policies or authenticated grants.
- Default table/sequence privileges for the standard `postgres` migration owner are narrowed to prevent grants from silently returning.
- The consent-withdrawal RPC is changed to authenticated-only because the production function inventory showed it was the only public-schema function executable by `anon`.
- Telegram link-token and webhook-update tables remain server-only; no broad policies are added to silence advisor warnings.

## Automated validation

CI creates a disposable PostgreSQL database and applies this migration to a purpose-built fixture, not production. It runs concurrent booking calls with a one-acre capacity window, checks that only one acre is reserved, checks anonymous table/function privileges, exercises both verification provenance branches, and checks cancellation releases capacity.

The repository also runs dependency audit, TypeScript syntax/build checks, existing atomic completion tests, consent-audit tests, and dispatch unit tests. Passing CI proves isolated behavior only; it does not prove the remote production migration ledger is reconciled or that real user/provider/device flows pass.

## Required release sequence

1. Build a disposable Supabase branch from the exact approved migration bundle; confirm organization and branch cost before creating it.
2. Export a schema-only snapshot from production and compare it with the clean bundle-created schema.
3. Map every production migration-ledger version to exact source SQL, including split/combined legacy migrations.
4. Apply the P0 migration to staging only after review; verify grants, constraints, deferred triggers, capacity concurrency, cancellation, and verification audit data.
5. Run farmer/operator/verifier role-matrix and direct REST/RPC negative tests.
6. Confirm the actual Vercel usage quota and reset time in the owning team dashboard; do not upgrade automatically.
7. After an applicable reset, use the normal Git-connected deployment flow for the exact reviewed release SHA.
8. Verify the production alias resolves to that exact SHA and run authenticated smoke tests.
9. Apply the reviewed database migration to production only through the approved release process, with rollback/recovery instructions and a named release owner.

**Hard stop:** do not run `supabase db push`, apply this migration to production, merge it, or promote a deployment until the staging organization/cost is approved, schema and ledger drift are reconciled, and all CI checks are green.

## P1 acceptance still requiring controlled access

- Farmer: OTP/auth, consent acceptance/withdrawal, field registration, request-vs-reservation messaging, cancellation, and session expiry.
- Operator/dispatcher/verifier: role-bound assignments, legal state transitions, evidence uploads, verification provenance, and duplicate/retry behavior.
- Android/offline: real devices, offline capture/reload, persistent upload queue, reconnection, duplicate prevention, GPS permission/staleness, storage quota, and service-worker recovery.
- Telegram: signed webhook, token expiry/single-use, duplicate updates, unlink/withdrawal, provider outages, and durable retry.
- Dispatch: real capacity data, invalid/infeasible routes, solver timeout/outage, fallback disclosure, manual reassignment, and audit trail.
- Observability/recovery: request correlation, alerts, backup/restore drill, incident owner, and rollback practice.

These are not marked complete by static inspection or isolated PostgreSQL tests.

## P2 sequence after core workflow reliability

1. Residue custody/transport/inventory lineage and buyer contract/acceptance terms.
2. FIRMS ingestion and provenance, weather/forecast/soil source lineage, and freshness/quality controls.
3. AI Sathi authorization, timeouts, safe fallback, and source-backed operational analytics.
4. Monitoring/alert ownership, backup retention, restore drills, incident response, and pilot outcome tracking.
5. Carbon-accounting validation and independent methodology review before any credit/impact claim.
6. Revisit the 67 unused-index observations after representative workload exists; do not drop indexes from the current low-volume snapshot alone.
