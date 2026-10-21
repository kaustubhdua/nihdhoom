# SATARK release acceptance gates

This runbook separates implementation from validation:

- **Implementation repository:** NIRDHOOM, `kaustubhdua/nihdhoom`.
- **Production/live Supabase project:** NIRDHOOM, ref `igqgtlmnwssjaoxkkzbm`.
- **Testing repository:** Saathi, `kaustubhdua/Saathi`.
- **Isolated test Supabase project:** Saathi, ref `ibvgxgvcqcfnoyrlwywa`.

The owner confirmed this mapping on 2026-10-22. Never link the Saathi test project to the NIRDHOOM live app. Do not reset either project or apply a migration to NIRDHOOM as part of routine validation.

## Current read-only findings — release blocked

Read-only inspection of the live Supabase migration ledgers found:

- NIRDHOOM project: 81 ledger entries.
- Saathi test project: 35 ledger entries.
- NIRDHOOM's ledger includes migrations named `saathi_*` as well as `satark_*`. The live NIRDHOOM public schema also contains `saathi_*` and `satark_*` tables. This may be intentional shared hosting, but it is a scope/isolation risk that must be explicitly explained and verified before changing anything.
- The Saathi test schema contains the SATARK tables, while the queried public schema did not return `saathi_*` tables. This is not proof of full schema equivalence; it is a reason to verify which app/schema is expected in the test project.
- The checked-in migration directories are materially smaller than their live ledgers, and several ledger names/versions do not directly match filenames. A filename/ledger reconciliation must normalize version prefixes and compare the full migration set before classifying a row as missing.

These findings are **not** a reason to delete tables, repair ledger entries, or push migrations automatically. Do not run destructive reset, blind migration repair, or production push. First capture and review the complete normalized ledger/file diff, compare actual DDL and policies, and document whether cross-project migration entries were deliberate.

## GitHub Actions secrets

Configure the following 11 repository Actions secrets in the Saathi test repository. Use dedicated test-only accounts and never reuse production identities. Secret values must be entered in GitHub Settings and must never be committed, printed in CI logs, or pasted into an issue.

- `SATARK_TEST_SUPABASE_URL`
- `SATARK_TEST_SUPABASE_PUBLISHABLE_KEY`
- `SATARK_TEST_USER_A_EMAIL`
- `SATARK_TEST_USER_A_PASSWORD`
- `SATARK_TEST_TENANT_A_ID`
- `SATARK_TEST_USER_B_EMAIL`
- `SATARK_TEST_USER_B_PASSWORD`
- `SATARK_TEST_TENANT_B_ID`
- `SATARK_TEST_VIEWER_EMAIL`
- `SATARK_TEST_VIEWER_PASSWORD`
- `SATARK_TEST_VIEWER_TENANT_ID`

Create two separate tenant memberships and a least-privilege viewer account. Run the authenticated suite and retain redacted evidence for: cross-tenant reads denied; cross-tenant writes denied; viewer write/approval denied; unauthorized approval denied; membership revocation effective on subsequent requests. Missing credentials must fail the job, not skip the tests or report success.

## Required checks on main

Configure a GitHub ruleset or branch-protection rule for `main` in NIRDHOOM and Saathi. Require pull requests and the actual status checks emitted by CI, Web CI, CodeQL, isolated migration validation, and authenticated tenant-isolation tests where those workflows exist. Require branches to be current before merge where practical. Disallow force pushes and deletion; do not add routine bypass actors.

After saving the rule, verify its API/UI representation and perform a disposable negative test: an unqualified direct update or a PR with a deliberately failing required check must be rejected. Do not test by pushing a risky commit to production main.

## Supabase migration reconciliation

1. Confirm project identity using the refs above and verify the live app's Supabase URL is the NIRDHOOM project ref.
2. Capture the complete migration ledger for each project and compare it to every checked-in migration filename/version using normalized version prefixes.
3. Run `supabase migration list --linked` and `supabase db push --dry-run` from a trusted, authenticated CLI environment; capture output with credentials redacted.
4. Inspect every pending migration and compare its DDL, policies, grants, functions, triggers, and storage rules with the live schema. Resolve missing, duplicate, cross-project, and out-of-order ledger entries explicitly.
5. Apply candidate migrations only to the isolated Saathi test project, run authenticated acceptance tests, and record the exact tested commit and migration versions.
6. Production changes require a separately reviewed migration plan, backup/recovery plan, and explicit release approval.

## Response executor acceptance

The server must re-check the authenticated actor, tenant membership, action scope, approval state, approval expiry, and idempotency key immediately before execution. Client-provided tenant/user/approval identifiers are not authority. Persist append-only audit events for request, approval/rejection, execution attempt, provider result, and failure. Secrets and sensitive payloads must be redacted.

Tests must cover approval-required execution, rejected/expired approval, cross-tenant denial, revoked membership, replay/idempotency, provider timeout/error, and durable audit outcomes. Live Microsoft actions must target an authorized test tenant and a harmless, explicitly approved test object; never test against an actual user's account or production asset.

## Wazuh and Microsoft validation

Use an authorized disposable Wazuh lab with real generated lab alerts and authenticated indexer access. Prove event ID/source preservation, ingestion checkpointing, deduplication, evidence digest verification, and failure recovery. For Microsoft, use an authorized test tenant and least-privilege app permissions; prove provider-side action state after approval. Synthetic fixtures are useful unit tests but are not evidence of live integration.

## Offline acceptance

Run in a network-isolated container/VM after all required model assets and packages are provisioned. Disable external network access at the environment boundary, not merely by setting an application flag. Verify local inference (Ollama), speech recognition, speech generation, OCR/document processing, persistence, and core incident workflows. Assert that no outbound connection is attempted and clearly report features that require a live provider.

## Vercel release acceptance

Confirm account/team access to the correct project and production domain. Do not repeatedly trigger deployments while rate-limited. Once quota clearance is confirmed, deploy only the commit SHA whose required checks passed. Independently resolve the production alias and compare its deployment Git SHA to that tested SHA. Run the full production smoke suite, including page/security-header checks, unauthenticated API denials, configured Supabase project identity, deployed-SHA assertion, and analysis POST behavior. A READY deployment alone is not release acceptance.

## Release decision

Any missing secret, skipped authenticated test, migration drift, unexplained cross-project migration, failed required check, unverified alias SHA, or failed smoke test means NO-GO. Record evidence links and exact commit SHAs; never infer completion from a workflow file existing.
