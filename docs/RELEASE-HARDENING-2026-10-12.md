# NIRDHOOM V7 release hardening — 2026-10-12

## Purpose and release decision

This is the evidence-based execution record for the P0/P1/P2 work. A checkbox is complete only when a linked test, query result, deployment record, or named operational sign-off proves it.

**Status: NO-GO for a live field pilot until all P0 gates pass.** Do not apply an unreviewed migration or promote an unverified commit. Payments/payouts remain out of scope and must fail closed. Demo records must never be presented as live capacity, field evidence, buyer contracts, or outcomes.

## Verified observations on 2026-10-12

- Repository: kaustubhdua/nihdhoom; default branch: main.
- Latest inspected repository commit: 2b74c6aa81d9b5afa81b5ee723d9f81f83620828 ("Record dispatch solver blocker").
- The commit's reported status contains a failed Vercel check pointing to the Hobby build-rate-limit page. This does not establish that GitHub's full CI suite failed; a completed Actions run still needs to be linked to the exact release SHA.
- package-lock.json exists and declares lockfile version 3. Keep npm ci as the reproducibility check.
- CI includes dependency audit, type/syntax check, repository audit, generated migration-bundle check, Node tests, two isolated PostgreSQL integration suites, frontend build, and Python dispatch tests.
- Supabase production project igqgtlmnwssjaoxkkzbm is ACTIVE_HEALTHY in ap-south-1, PostgreSQL 17.
- No Supabase development branches were returned at inspection time.
- Production migration history includes consent audit migration 20261011210907. The repository release ledger says the atomic job/residue completion RPC was absent from production at the last function inventory. Reconfirm before any change.
- Supabase security advisor reports two RLS-enabled tables with no policies: public.telegram_link_tokens and public.telegram_webhook_updates. Confirm grants and server-only access are intentional and test negative access; do not add broad policies just to silence the linter.
- Security advisor flags authenticated EXECUTE on several SECURITY DEFINER functions. A read-only inventory confirms search_path is pinned (mostly empty, one public) for inspected functions and anon cannot execute them. This does not replace per-function authorization review.
- Performance advisor reports 67 unused-index observations. Production tables have little or no observed workload; do not drop indexes based on this signal alone.
- Vercel production deployment dpl_8W4Rs7bvf8SDntv8QoDBe9SFfj9E is READY but serves commit 7e8322f00eadc0b50de38ed0882cde5737d841a3, older than the latest inspected commit. Preview deployments on other branches are not production releases.
- Vercel restriction is identified as build-rate-limit. Check actual quota and reset in Vercel Usage before deciding whether to wait or request an approved plan change.
- A read-only production function-definition audit found a P0 trust-boundary defect in public.reserve_clearance_booking_v2(uuid, date): it writes the requested date into guaranteed_by_date and clearance_deadline, sets status BOOKED, and calculates a penalty, but does not reserve a machine_capacity_windows row or assign actual capacity. See GitHub issue #84. Do not treat these dates or penalties as a real service guarantee until a new migration makes capacity reservation transactional and tests concurrency.
- A read-only production function-definition audit found public.record_verification_review(uuid, text, numeric, jsonb) always stores method='field_evidence_plus_firms' for a review, while the function does not check for a matching FIRMS observation. See issue #86. Evidence provenance must reflect sources actually present/reviewed; absence of a detection is not proof of no burning.
- A read-only grants query showed telegram_link_tokens and telegram_webhook_updates are accessible to service_role but not anon/authenticated, which is consistent with a server-only boundary despite the advisor's no-policy warning. Keep the no-policy design unless a reviewed access requirement proves otherwise. It also showed broad table-level grants to anon on core tables such as consents, jobs, and residue_lots; RLS still applies, but the effective grants should be narrowed in a reviewed migration and verified with role-based negative tests.
- A query of the main operational tables returned zero rows for profiles, fields, bookings, jobs, evidence_assets, telegram_identities, residue_lots, and residue_pools at inspection time. This means production is not evidence of a real-user pilot journey; end-to-end testing needs isolated test accounts and controlled data.
- The current production runtime-error query for the last 24 hours returned no runtime error clusters. A 30-minute runtime-log query returned no logs, and the older window was unavailable under Hobby retention; absence of runtime errors is not proof that real-user journeys work.
- The existing repository release-gate document records that production server-side variables SUPABASE_SERVICE_ROLE_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, and NIRDHOOM_PUBLIC_URL exist but are empty; dispatch variables DISPATCH_SERVICE_URL and DISPATCH_SERVICE_TOKEN are absent; and the AI variable naming is mismatched (GROQ_API exists while server code reads GROQ_API_KEY). Treat Telegram delivery, service-role-backed server operations, optimized dispatch, and provider-backed Sathi as not live until the correct server-only configuration is set through the encrypted Vercel environment UI and verified with test accounts. Do not copy secrets into source control or Vite-prefixed variables. Reconfirm the environment state before release.

## P0 — mandatory release gates

### P0-A: Exact commit and complete CI
- [ ] Record intended main SHA and ensure release branch contains it.
- [ ] Obtain a completed GitHub Actions run for that exact SHA.
- [ ] Pass npm ci --no-audit --no-fund.
- [ ] Pass npm audit --omit=dev --audit-level=high.
- [ ] Pass npm run syntaxcheck, npm run audit, npm test, and npm run build.
- [ ] Pass npm run db:bundle and confirm no generated-bundle diff.
- [ ] Pass isolated PostgreSQL atomic completion tests and consent audit tests.
- [ ] Pass Python compile and python -m unittest test_main.py -v.
- [ ] Save CI URL, SHA, and all job conclusions in the release record.

### P0-B: Database reconciliation — read-only until approved
- [ ] Export production schema without data and create a clean schema from the approved migration order/bundle.
- [ ] Compare tables, columns/types, constraints, FK/index definitions, triggers, functions, function settings, grants, RLS/storage policies, extensions, and realtime configuration.
- [ ] Map every remote 14-digit migration version to exact source SQL, including legacy split/combined records.
- [ ] Reconfirm whether complete_job_with_residue_lot exists in production and whether its migration is absent from the ledger.
- [ ] Reconcile drift with a reviewed migration-history mapping. migration repair changes history only; it is not schema comparison.
- [ ] Produce a dry-run showing no already-applied migration would execute again.
- [ ] Define backup, recovery, owner, maintenance window, and rollback/forward-fix plan.
- [ ] No supabase db push, branch merge, or production DDL until review is signed off.

### P0-C: Isolated staging database
- [ ] Obtain explicit cost approval before creating a billable Supabase branch/project.
- [ ] Create an isolated branch or disposable PostgreSQL/Supabase environment from a known baseline.
- [ ] Run the approved bundle from a clean database; separately apply the pending atomic completion migration.
- [ ] Exercise constraints, triggers, RPC grants, migration behavior, rollback/retry behavior.
- [ ] Test as separate farmer, operator, dispatcher, verifier, buyer, and admin identities.
- [ ] Prove cross-farmer and cross-role reads/writes fail.
- [ ] Test concurrent booking and offer acceptance.
- [ ] Capture staging migration logs, schema diff, and test output.

### P0-D: Security review
- [ ] Review each SECURITY DEFINER RPC for caller role, ownership, state-transition authorization, input validation, safe object resolution, and search_path.
- [ ] Specifically review accept_buyer_offer, cancel_clearance_booking, create_residue_pool, join_residue_pool, record_farmer_network_consent, record_verification_review, reserve_clearance_booking_v2, transition_job, and verify_field_geometry.
- [ ] For telegram_link_tokens and telegram_webhook_updates, confirm direct client grants are absent and intended server-only workflow succeeds.
- [ ] Add automated negative tests for unauthorized execution, token enumeration, replay, cross-tenant access, and role escalation.
- [ ] Re-run Supabase security advisors and triage every remaining warning with rationale.

### P0-E: Deployment and production smoke
- [ ] Check Vercel Usage and exact build/deployment quota. Wait for documented reset if this is a rolling rate limit; request a plan change only if needed and approved.
- [ ] Build the exact release SHA and verify deployment metadata matches it.
- [ ] Verify deployment is READY and production alias points to the approved deployment.
- [ ] Run anonymous app-shell smoke, auth/session smoke, and role-protected route checks.
- [ ] Run test-account field → booking → assignment → operator evidence → verification smoke in a safe environment.
- [ ] Confirm no demo data is represented as live, no payment can move money, and no privileged server secret is exposed.
- [ ] Record deployment ID, URL, SHA, test time, and outcome.

## P1 — pilot usability and integration acceptance

### Farmer and operator mobile
- [ ] Test low-end Android and slow/unstable networks.
- [ ] Validate Punjabi/Hindi copy with native speakers.
- [ ] Check readable typography, contrast, touch targets, keyboard/focus, and reduced motion.
- [ ] Test loading/empty/error/retry states on every live-data screen.
- [ ] Test GPS denied, stale/poor accuracy, backgrounding, refresh, and restart.
- [ ] Test offline app shell, queued actions, evidence persistence, reconnect sync, conflict handling, idempotent retries, and no sensitive authenticated API caching.
- [ ] Verify manifest icons, service-worker version/update/recovery, and installability.
- [ ] Confirm support, cancellation, date-change, and dispute routes are discoverable.

### Telegram
- [ ] Configure a dedicated test bot/webhook and test account; do not use real farmer identity for acceptance.
- [ ] Verify identity linking, expiry, one-time token consumption, wrong-user rejection, inbound authentication, update idempotency, outbound delivery, retry/failure visibility, and consent withdrawal.
- [ ] Prove repeated webhook delivery does not duplicate state changes.
- [ ] Ensure tokens and sensitive payloads are not exposed in logs or client-accessible tables.

### Dispatch
- [ ] Confirm deployed OR-Tools endpoint and secret configuration; a heuristic fallback is not an optimizer guarantee.
- [ ] Test invalid coordinates/acreage/deadline, unavailable machine, capacity overload, no eligible machine, infeasible schedule, timeout, bad response, and service outage.
- [ ] Never silently over-assign; explain every unassigned job.
- [ ] Test manual assignment/reassignment audit trail and idempotency.
- [ ] Verify GPS freshness and real capacity before presenting a machine as available.

### End-to-end field workflow
- [ ] Farmer authentication and consent.
- [ ] Field creation and ownership checks.
- [ ] Server-authoritative quote and booking with real capacity reservation.
- [ ] Dispatcher assignment.
- [ ] Operator job transitions and evidence upload.
- [ ] Trusted server-side evidence hash/content verification.
- [ ] Verifier review and auditable override/appeal.
- [ ] Atomic job completion and residue-lot creation; retries return the same lot.
- [ ] Failure injection for storage/network/database errors.
- [ ] Support/escalation path and operational owner confirmed.

## P2 — only after core-loop evidence

- [ ] Buyer contract terms: quantity, quality/moisture, price, pickup/delivery, acceptance, disputes, and settlement.
- [ ] Lot custody, weight/quality history, transport lifecycle, and buyer acceptance.
- [ ] Keep marketplace proposal excluded until its staging authorization matrix passes.
- [ ] FIRMS ingestion with provenance, observation time, timeout/empty/malformed cases, and human review.
- [ ] Forecast/soil report provenance, dates, confidence, and fallback behavior.
- [ ] AI Sathi field-scoped authorization, provider timeouts, bounded answers, safe fallback, and no cross-farmer leakage.
- [ ] Carbon methodology only after baseline, eligibility, measurements, QA/QC, independent validation, and registry process exist.
- [ ] Operational metrics with clear source, denominator, period, and live/demo labels.
- [ ] Monitoring, alerting, backup/restore drill, retention policy, privacy/terms, grievance handling, and incident owner.
- [ ] Payments remain explicitly deferred; never represent simulated credits/payouts as money movement.

## Go/no-go rule

Release only when all P0 items have evidence of completion and no critical/high security issue remains unexplained. P1 items required by the chosen pilot workflow must pass before onboarding real farmers. P2 is deliberately sequenced after the core operational loop is proven.

## Research references reviewed

- GitHub Actions workflow runs and jobs: https://docs.github.com/en/rest/actions/workflow-runs and https://docs.github.com/en/rest/actions/workflow-jobs
- Supabase migrations, schema diff, and migration repair: https://supabase.com/docs/guides/deployment/database-migrations
- Supabase branching and isolated preview environments: https://supabase.com/docs/guides/deployment/branching and https://supabase.com/docs/guides/deployment/branching/working-with-branches
- Supabase branch migration behavior: https://supabase.com/docs/guides/deployment/branching/github-integration
- Supabase security linter: https://supabase.com/docs/guides/database/database-linter
- Vercel rate limits: https://vercel.com/docs/limits
- Vercel Hobby plan and quota behavior: https://vercel.com/docs/plans/hobby
- Vercel deployment-disabled troubleshooting: https://vercel.com/docs/errors/deployment_disabled

These references inform the workflow; they are not evidence that an external acceptance gate has passed.
