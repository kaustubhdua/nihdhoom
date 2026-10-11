# NIRDHOOM production and reference-project comparison

**Audit date:** 2026-10-11  
**Scope:** GitHub `main`, connected Supabase project schema/advisors, Vercel project/deployment metadata, and the two supplied SIH reference ZIPs. This is an evidence-based audit, not a claim that an end-to-end browser test has passed.

## Current project status

- GitHub default branch is `main`. The latest Vercel production deployment is READY and points to commit `37eeaa758fc67998afca9c6e57c00e97ba98d90e`, which includes the merge of the farmer signup/setup work from `redesign/ui-overhaul`. The branch itself is not currently listed, which is consistent with a merged/deleted feature branch; the changes are in `main`.
- Supabase project `nihdhoom` is ACTIVE_HEALTHY in `ap-south-1` (Mumbai).
- Live database has 39 public base tables, 58 public RLS policies, an auth.users profile trigger, and 0 auth users at audit time. Zero users means a real signup journey has not yet been demonstrated on this database; it does not prove the signup code is broken.
- Live migration history contains the farmer signup/profile migration, and the live trigger is named `on_auth_user_created_nirdhoom_farmer` invoking `public.handle_new_farmer_signup()`.
- The repository migration folder and generated `supabase/all-migrations.sql` did not contain that live farmer-signup migration at audit time. This creates a fresh-environment reproducibility gap. The accompanying migration file and bundle update record the existing live behavior in source control; they are not instructions to rerun the whole bundle on the live database.
- Vercel production environment variables include the browser Supabase URL/publishable key, demo mode off, and server-side Supabase/Telegram configuration. The browser Supabase variables and service-role key are production-only, consistent with keeping Preview isolated from production data. Do not add the production service-role key to Preview or any `VITE_*` variable.
- Vercel runtime log query for the latest 30 minutes returned no matching error/fatal records. This is not a substitute for a browser smoke test, and older log history was unavailable on the current plan.

## Live Supabase advisor findings

### Security
- **Server-only Telegram tables:** `public.telegram_link_tokens` and `public.telegram_webhook_updates` have RLS enabled and no policies. A read-only privilege query on 2026-10-12 returned no table privileges for `anon`, `authenticated`, or `PUBLIC`; the no-policy advisor findings are therefore consistent with the intended server-only access model. Keep it that way and use trusted server credentials only.
- **SECURITY DEFINER RPCs:** the production advisor flags nine authenticated-callable functions: `accept_buyer_offer`, `cancel_clearance_booking`, `create_residue_pool`, `join_residue_pool`, `record_farmer_network_consent`, `record_verification_review`, `reserve_clearance_booking_v2`, `transition_job`, and `verify_field_geometry`. These are intentional authenticated workflows, not automatically vulnerabilities. The production migration ledger includes `nirdhoom_security_definer_auth_guards_20261011`; read-only function-definition inspection confirmed all nine reject missing `auth.uid()`, pin `search_path` to empty, and use a role or ownership/consent gate appropriate to the operation. Keep the source-level authorization and isolated SQL regression tests in place; do not blanket-revoke authenticated execution.
- **Remaining consent issue:** despite the guarded RPC, production still has legacy direct INSERT/UPDATE grants on `public.consents`. Migration `202610120005_consent_audit_immutability.sql` is merged and its isolated PostgreSQL tests pass, but it has not been applied to production. This remains a release blocker until migration history is reconciled and the privilege fix is applied and verified.
- Use Supabase's security advisor remediation guidance: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable

**Read-only evidence captured 2026-10-12.** The advisor output is a point-in-time signal; rerun it after any migration and after the release pilot.

### Performance
- The advisor reports one duplicate/permissive SELECT-policy finding on `public.storage_yards` and several unused-index notices. Compare policy predicates before consolidation and check real query plans/index statistics before dropping indexes. The database has little/no user workload, so unused-index signals may be expected.

## Reference ZIP comparison

### `SIH_Frontend-main.zip` (ResidueLink/OORVAR)
Useful concepts:
- Farmer/buyer/CHC role-specific workspaces.
- Pre-harvest listing windows and farmer-set harvest-date overrides.
- Buyer demand posting, radius-based matching and offer negotiation.
- Farmer and buyer landed-cost/profitability calculators.
- Clear Hindi/Punjabi UI and operational pickup/delivery tracking.

Do not copy its `supabase_schema.sql`: it uses different `farms`, `bids`, `pool_invitations`, and `contracts` tables, string IDs and broad public read/write RLS policies. NIRDHOOM already models fields, bookings, residue lots, buyer demands, offers, pools, transport jobs and evidence with UUID relationships and private RLS.

### `SIH_Backend-main.zip` (FastAPI + .NET auth + ML artifacts)
Useful concepts:
- A separately testable harvest forecast service.
- Versioned prediction output and retained weather/input snapshots.
- Explicit API contracts for buyer matching, logistics and cost estimates.
- Model evaluation using the supplied historical weather/soil/yield datasets.

Do not deploy/copy the reference authentication code unchanged:
- `backend-python/app/routers/auth.py` contains a hardcoded SMS API-key fallback and includes the generated OTP in the send-OTP response.
- OTP state is process-local memory, so it is not reliable across multiple instances/restarts.
- `backend-python/app/main.py` uses wildcard CORS origins.
- The docs leave MySQL versus Supabase and .NET versus FastAPI identity ownership unresolved.
- The supplied backend `.env` file should never be committed or copied. Rotate the exposed SMS provider credential if it is valid.

NIRDHOOM should keep Supabase Auth as the single identity provider and add a separate prediction API only when it is needed and has a defined authentication, rate-limit, timeout, caching and model-evaluation contract.

## Recommended implementation order

1. **Migration parity:** keep the farmer-signup trigger migration in `supabase/migrations/` and `all-migrations.sql` (included in this change).
2. **Security migration:** add null-safe authentication/role guards to the eight flagged SECURITY DEFINER functions; test authorized and unauthorized roles, including a valid auth user with no profile. Do not simply revoke grants without checking frontend RPC dependencies.
3. **Signup smoke test:** use Supabase's configured test phone/OTP or a real approved SMS provider; verify auth user creation creates exactly one `profiles` row with role `farmer` and consent `PENDING`. Then verify consent acceptance/withdrawal and owner-scoped field creation.
4. **Booking flow:** create a field, reserve/cancel a booking, verify server-calculated pricing, and ensure other farmers cannot read or mutate those records.
5. **Telegram:** validate webhook secret, duplicate-update idempotency, account-link-token expiry/single-use and server-only credential isolation.
6. **Marketplace:** connect the existing `buyer_demands`, `residue_lots`, `residue_matches`, `residue_pools` and `residue_transport_jobs` rather than importing the reference schema. Show proposed matches as proposals until both sides accept.
7. **Harvest forecast:** implement a baseline first (crop calendar + weather features) and evaluate the supplied model before claiming ML accuracy. Store prediction date, model version, inputs/snapshot, confidence or uncertainty, and farmer override separately. Keep manual override available.
8. **Operational truth:** label simulated/sample metrics clearly; do not present estimated biomass, fire prevention, carbon impact, machinery availability or buyer demand as verified live facts unless backed by dated sources or actual records.
9. **Release gate:** run `npm run release:check`, then a Preview smoke test and production checks. The repository scripts exist, but no local build/test result is asserted by this audit.

## Acceptance criteria

- A new farmer can complete OTP signup, consent and field registration without manual database edits.
- A fresh database created from the checked-in migration sequence receives the same farmer-profile trigger as the live database.
- No anonymous/authenticated user can call operational SECURITY DEFINER functions outside the intended role/ownership rules.
- Cross-user field, booking, phone and Telegram identity data remain private.
- A buyer demand can be matched to eligible residue without double allocation; acceptance and transport state changes are auditable.
- Forecasts and impact figures are labeled with source, timestamp, method and uncertainty.
- Type check, audit, tests and production build pass; deployment Preview and production smoke tests are recorded.
