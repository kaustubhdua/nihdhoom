# NIRDHOOM V7 — Completion and Pilot Readiness Plan

This document is the consolidated implementation checklist for taking the current repository from a prototype to a controlled field pilot. It is deliberately explicit about the difference between code that exists, integrations that are placeholders, and operational work that requires real partners or credentials.

## Current repository facts

- The active Vite browser entry is `src/main.jsx`, which mounts the modular `src/App.tsx` application.
- The duplicate `src/main.tsx` entrypoint has been removed.
- The repository contains API routes for assistant, quote, dispatch, FIRMS, Telegram and IVR; payment routes are intentionally absent.
- The database contains the sequential core migrations plus V7.1–V7.5 integrity migrations; the later migrations add operational tables, transactional functions and client-write protections.
- Payment is explicitly outside this release. Do not add provider credentials or describe payouts as live.
- The dispatch route has a local heuristic fallback. It is not equivalent to a validated OR-Tools optimizer.
- Demo field, machine and buyer records are not live operational data.
- The service worker is an app-shell/offline foundation, not proof of complete offline transaction synchronization.
- Static source checks do not replace database, provider, device or end-to-end integration tests.

## P0 — Required before a live pilot

### 1. Reproducible build and repository hygiene
- [ ] Regenerate and commit `package-lock.json` from the current `package.json`; use `npm ci` in CI after the lockfile is synchronized.
- [ ] Confirm Node.js version consistency across local development, CI and Vercel.
- [x] CI runs syntax/type checks, static audit, unit tests, production build and dispatch-service checks; browser/device testing remains an external pilot gate.
- [ ] Inspect and resolve all CI failures; retain run links in the release notes.
- [x] The inactive duplicate TSX entrypoint was removed; `src/App.tsx` is the active application mounted by `src/main.jsx`.
- [x] The obsolete monolithic HTML bundle and committed ZIP archive were removed.

### 2. Database and access control
- [x] The current 35-entry repository migration manifest is applied to the dedicated NIRDHOOM Supabase project (`igqgtlmnwssjaoxkkzbm`) according to the observed live ledger; do not run `supabase db push` until the source-to-ledger mapping and clean-install schema diff are reviewed. See `docs/DATABASE-RELEASE-LEDGER.md`.
- [ ] Repeat migration testing against a disposable fresh project/branch before introducing pilot data.
- [ ] Verify every foreign key, trigger, index, constraint and RPC executes as intended.
- [ ] Test row-level security using separate farmer, operator, dispatcher, verifier and admin accounts.
- [ ] Prove a farmer cannot read or modify another farmer's records.
- [ ] Prove operators can access only assigned jobs and permitted evidence.
- [ ] Prove operational state transitions and overrides require authorized roles.
- [ ] Test concurrent booking requests and concurrent buyer-offer acceptance.
- [ ] Document backup, restore, retention and incident recovery procedures.

### 3. Booking, quote and guarantee
- [ ] Validate request shape, field ownership, field status, acreage, date and service area server-side.
- [ ] Calculate amounts on the server; never trust a client-supplied payout or total.
- [ ] Reserve a slot transactionally against real machine capacity.
- [ ] Do not return a guaranteed date until the capacity reservation succeeds.
- [ ] Prevent duplicate active bookings and handle concurrent requests idempotently.
- [ ] Define the guarantee, exclusions, cancellation rules, penalties and dispute process with the pilot operator.
- [ ] Show quote components and clearly label indicative estimates versus confirmed offers.

### 4. Dispatch and machinery
- [ ] Validate all incoming coordinates, machine status, capacity, field acreage and deadlines.
- [ ] Never silently over-assign capacity; return unassigned work and a reason.
- [ ] Add route/assignment explanations and a manual reassignment audit trail.
- [ ] Integrate and test the selected dispatch optimizer; label heuristic fallback accurately.
- [ ] Define machine availability, maintenance, breakdown and operator shift rules.
- [ ] Verify GPS source, freshness and accuracy before displaying a machine as live.

### 5. Evidence and verification
- [x] Enforce booking/field ownership through RLS/RPC boundaries and add client-side evidence size/type/content validation; storage remains private. Server-side byte-level content enforcement should remain a pilot verification gate.
- [x] Validate MIME type and actual image signatures before evidence upload; evidence objects remain private through storage policies.
- [ ] Verify SHA-256 on trusted server-side bytes, not only a browser-provided digest.
- [ ] Record capture time, upload time, GPS accuracy, actor and sync source separately.
- [ ] Keep field geometry, operator evidence, satellite detections and human review as distinct evidence sources.
- [ ] Record verifier identity, decision, reason and any override in an auditable history.
- [ ] Handle absent, delayed, malformed or contradictory satellite data.
- [ ] Never treat absence of a FIRMS detection as proof that no burning occurred.
- [ ] Provide a human review and appeal path for disputed verification.

### 6. Payment — deferred by release scope
- [x] Keep real payment/provider integration out of this release.
- [x] Keep payment UI explicitly labelled as simulation/non-money-moving.
- [ ] If payment is brought into a future release, add provider-specific initiation, signature verification, reconciliation, idempotency and replay protection before enabling it.
- [ ] Implement provider-specific initiation, authentication, amount validation and provider reference storage.
- [ ] Implement provider-specific webhook signature verification over the exact raw request bytes.
- [ ] Validate event types, account/merchant identity, amount, currency and payment reference.
- [ ] Make webhook handling idempotent and protect against replay and out-of-order events.
- [ ] Update payment state only from trusted provider events or an authenticated reconciliation process.
- [ ] Add reconciliation for missing, failed, reversed and delayed payouts.
- [ ] Show estimated, initiated, processing, paid and failed states distinctly.
- [ ] Do not claim live UPI settlement until test and live provider flows have been verified.

### 7. API security and reliability
- [x] Add lightweight rate limits and safe 429 responses to the public assistant, quote, FIRMS and weather endpoints; request-size limits remain a provider/runtime gate.
- [ ] Validate all inputs with shared schemas and reject unexpected values.
- [ ] Apply authorization consistently to every endpoint that reads or changes private data.
- [ ] Add timeouts and bounded retries to external service calls.
- [ ] Avoid returning raw provider errors, secrets or sensitive upstream payloads.
- [ ] Add request IDs and structured logs without logging tokens, phone numbers or sensitive evidence.
- [ ] Add health checks and alerting for failed integrations.

## P1 — Required for a usable pilot

### Farmer application
- [ ] Test on low-end Android devices and slow/unstable mobile networks.
- [ ] Make field registration, booking and status tracking the primary navigation path.
- [ ] Distinguish farmer-declared acreage from geometry-calculated acreage and verified cadastral acreage.
- [ ] Provide loading, empty, error, retry and offline states for every data-backed screen.
- [ ] Provide booking cancellation/date-change rules and a support/escalation route.
- [ ] Provide payment history, transaction references when available and a dispute path.
- [ ] Review Punjabi/Hindi wording with native speakers and test readability in the field.
- [ ] Make live, stale, cached, demo and indicative data visibly distinguishable.

### Operator PWA
- [ ] Test assigned → arrived → baling → evidence → complete on a real Android device.
- [ ] Test denied GPS permission, poor accuracy, backgrounding, refresh and device restart.
- [ ] Persist queued actions safely and show pending/syncing/synced/failed states.
- [ ] Make retries safe and prevent duplicate job completion.
- [x] Add `complete_job_with_residue_lot` RPC and switch the operator UI to the atomic completion path; it validates the measured quantity and returns the existing lot on safe retries. **Still pending:** apply the new migration to staging, run authenticated role/evidence/retry tests, and verify the workflow before production.
- [ ] Provide an operator-reported breakdown/delay path.
- [ ] Test offline evidence capture and later upload with real file sizes.

### Dispatch console
- [ ] Separate unassigned, assigned, delayed and completed jobs.
- [ ] Show machine availability, capacity and last GPS update.
- [ ] Make manual assignment/reassignment auditable.
- [ ] Explain why jobs remain unassigned.
- [ ] Test overloaded, invalid and incomplete routing input.

### PWA and accessibility
- [ ] Verify all manifest icons exist and render at declared sizes.
- [ ] Keep one canonical manifest and remove conflicting/obsolete manifest references.
- [ ] Version and test service-worker cache updates and recovery.
- [ ] Do not cache authenticated API responses or sensitive farmer data indiscriminately.
- [ ] Test install, update, offline launch and reconnection.
- [x] Add keyboard focus, semantic labels, skip navigation, contrast-oriented farmer surfaces and reduced-motion behavior; full device accessibility audit remains a pilot gate.
- [ ] Compress imagery and add useful alt text.

## P2 — Add only after the core loop is proven

- [ ] Buyer contracts with quantity, price, quality/moisture, delivery and settlement terms.
- [ ] Residue lot inventory with weight, location, quality, custody and dispatch history.
- [ ] Buyer offer acceptance and settlement reconciliation.
- [ ] Harvest forecast with source, date, confidence/limitations and fallback behavior.
- [ ] Soil report provenance, test date and reviewed action plan.
- [ ] Credit wallet only when balances are backed by auditable transactions.
- [x] Carbon-accounting methodology gate documented against current VM0042 v2.2; no NIRDHOOM credit is represented as issued or registry-verified.
- [ ] Carbon accounting can only advance after project-specific baseline, eligibility, SOC/other required measurements, QA/QC, independent verification and registry process are established.
- [ ] Analytics that distinguish operational metrics from demo and public research data.
- [ ] AI Sathi only with authenticated, field-scoped access, bounded answers and safe fallback.
- [ ] Notification delivery receipts, retries, consent and preferences.

## Required automated tests

### Unit tests
- [ ] Geometry validation: coordinate ranges, ring shape, duplicate points, self-intersections and invalid polygons.
- [ ] Quote calculation: invalid/edge dates, acreage bounds and pricing boundaries.
- [ ] Dispatch: capacity, unavailable machines, no eligible machine and deadline ordering.
- [ ] Payment: signature validation, event mapping, duplicate events and out-of-order events.
- [ ] Evidence: hash calculation, content validation and metadata completeness.
- [ ] Offline queue: persistence, retry, deduplication and conflict handling.

### Integration tests
- [ ] Booking RPC against a disposable test database.
- [ ] RLS tests for every role and cross-tenant access attempts.
- [ ] State-transition permissions and invalid transition rejection.
- [ ] Evidence upload and database linkage.
- [ ] Concurrent booking and offer acceptance.
- [ ] Payment sandbox initiation, webhook and reconciliation.
- [ ] FIRMS timeout, malformed response, empty response and polygon matching.

### End-to-end tests
- [ ] Farmer registers a field and submits a booking.
- [ ] Dispatcher assigns a machine.
- [ ] Operator arrives, records work and uploads evidence.
- [ ] Verifier reviews evidence and records a decision.
- [x] Payment remains outside this release; no provider sandbox is required for this release candidate.
- [ ] Unauthorized users are blocked from restricted actions.
- [ ] Mobile navigation and offline recovery work.

## Pilot operations and governance
- [ ] Select a pilot block and confirm participating farmers, machinery owners, operators and buyers.
- [ ] Agree on service levels, pricing, penalties, cancellations and dispute handling in writing.
- [ ] Confirm actual residue offtake capacity and quality requirements before accepting volume.
- [ ] Obtain informed consent and publish privacy, terms, retention and grievance information.
- [ ] Establish support ownership, escalation contacts, operator training and field procedures.
- [ ] Define pilot success metrics and baseline; do not report demo records as outcomes.
- [ ] Establish a release checklist, rollback process and incident response owner.

## Exit criteria

A pilot should not be called production-ready until:
1. A clean install, build and all required CI checks pass on the release commit.
2. Migrations run successfully on a dedicated project.
3. RLS and authorization tests pass for all roles.
4. One complete booking-to-verification-to-residue journey passes end to end; payment remains outside this release.
5. Offline operator recovery is tested on a real device.
6. Provider, machine and buyer capacity are confirmed by the responsible partners.
7. Privacy, consent, support, monitoring and rollback procedures are in place.

## Known blockers that cannot be completed from repository code alone

Live payments, real machine GPS, verified cadastral data, real buyer contracts, production messaging, field-device testing and pilot guarantees require provider credentials, partner agreements, actual devices/data and operational decisions. Keep these clearly marked as unconfigured until verified. Never replace missing integration evidence with simulated success.
## Repository review addendum — 2026-09-28

This addendum records additional source-level changes made after the V7 checklist. It is not a claim that the application has passed a complete production audit.

### Changes committed
- The service worker now excludes /api/ requests, requests carrying an Authorization header, POST requests and cross-origin requests from caching. It uses a versioned app-shell cache and network-first behavior for eligible shell/static resources.
- The OR-Tools HTTP service now requires a configured shared bearer token and compares it with a constant-time comparison. The Vercel dispatch adapter forwards the server-only token when configured.
- Payment initiation validates the request object, booking UUID and bounded positive amount, and continues to fail closed rather than claiming a payout was initiated.
- Structural tests were added for the service-worker privacy boundary, optimizer authentication and payment fail-closed behavior.

### Additional issues found that still require correction or verification
- The booking RPC's quote values must be derived from trusted server-side pricing and capacity, not accepted as caller-supplied authority. The UI's quote endpoint currently produces an estimate and does not reserve real machine capacity. Do not present its date as a contractual guarantee.
- The OR-Tools service is now authenticated, but it still needs deployment, secret provisioning, realistic travel-time/shift constraints, robust request validation, and integration tests. The heuristic fallback is not a production scheduling guarantee.
- The webhook adapter still needs provider-specific signature formats, merchant/account validation, amount/currency matching, replay protection, idempotent event storage and out-of-order reconciliation before live payouts.
- The UI and schema contain a broad feature surface, but several capabilities remain data-model/UI foundations rather than complete workflows (including offline synchronization, buyer settlement, satellite ingestion and carbon accounting).
- The canonical browser entry is `src/main.jsx`, which mounts the modular `src/App.tsx` application. Repository audits should continue to reject a second active browser entry.
- The repository includes large generated HTML/ZIP artifacts and duplicate image assets. Confirm which are release deliverables before keeping them in source control.
- SQL migrations have not been executed against a fresh PostgreSQL/Supabase instance in this session. Static checks cannot establish that all policies, grants, triggers and functions execute correctly or enforce the intended access matrix.
- A dedicated NIRDHOOM Supabase project is the intended live integration boundary. Migration/RLS behavior still requires a fresh-schema rehearsal and role-by-role verification before a pilot.

### Verification boundary
The source tree and key active application, API, service, PWA, test, configuration and migration files were inspected through the repository connection. This was not a literal review of every byte in binary assets or generated archives, and no local dependency install, browser session, disposable database, provider sandbox or real Android-device test was run as part of this addendum. Check GitHub Actions on the latest commit before treating the changes as green.

## V7.5 source audit update — 2026-10-02

The latest source audit found and corrected additional trust-boundary issues:

- Authenticated clients can no longer directly insert, update or delete bookings; booking creation is routed through the server-authoritative booking RPC.
- Farmer field updates now have a database trigger preventing changes to protected identity, acreage, status, deadline and geometry attributes through the generic update path.
- The authoritative booking penalty is capped at the quoted amount so small fields cannot produce an internally inconsistent penalty.
- The UI explicitly labels the payout, onboarding and carbon-market surfaces as simulations; no simulated success is presented as a real provider transaction.
- The duplicate non-canonical PWA manifest was removed; `manifest.webmanifest` is the canonical manifest referenced by `index.html`.
- The environment template no longer contains a project-specific Supabase URL.

The dedicated Supabase project is connected and the expected migrations are applied. Remaining pilot gates are role-by-role RLS tests with separate identities, fresh-schema rehearsal, provider/device tests, authoritative cadastral source, real machine telemetry, buyer contracts, privacy/support processes and operational partner sign-off.
