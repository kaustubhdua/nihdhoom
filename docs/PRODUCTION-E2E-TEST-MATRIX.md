# NIRDHOOM production end-to-end test matrix

**Current status: NOT RUN end-to-end.** The live project currently has no farmer profiles, fields, bookings, jobs, consent records, evidence rows, or Telegram identities. Source-level tests and read-only SQL checks are not substitutes for the tests below.

## Safe test setup

1. Prefer a separate staging Supabase project with the approved schema and isolated storage.
2. In Supabase Auth, configure a dedicated test phone number and fixed test OTP, or a verified SMS provider. Never use a real farmer's number as a test fixture.
3. Create dedicated test users for farmer, operator, verifier, dispatcher, and buyer. Assign privileged roles only through an administrator-controlled process; never let the test client update its own role.
4. Use clearly marked test data and test evidence. Do not create fake verified residue, buyer deliveries, payments, or real operational claims in production.
5. Record the tested commit SHA, Supabase migration snapshot, device/browser, and outcome. Remove staging fixtures after the run.

## Functional test matrix

| Flow | Test | Required pass condition | Current status |
|---|---|---|---|
| Phone OTP | Request OTP for the configured test phone; verify correct code; retry with invalid/expired code | Valid code signs in; invalid code is rejected; loading/error UI recovers | Not run — test phone/OTP setup required |
| Farmer profile | Complete onboarding with the test farmer | Auth user gets one farmer profile; repeated onboarding does not create duplicates or elevate role | Not run — authorized test account required |
| Consent | Accept and withdraw farmer-network consent | Consent is auditable; booking refuses missing/revoked consent | Not run — authenticated test required |
| Field registration | Register a test field with valid coordinates and acreage; attempt invalid acreage and out-of-range coordinates | Valid field belongs to signed-in farmer; invalid data rejected; other farmer cannot read or modify it | Not run — authenticated test required |
| Booking | Book a future pickup date on the test farmer's field | Booking row is `BOOKED`; field row becomes `SCHEDULED`; quote comes from server; anonymous and cross-owner attempts fail | Not run — authenticated test required |
| Duplicate booking | Submit the same request twice and try a second active booking for the same field | Exactly one active booking; second request returns a clear error | Not run — authenticated test required |
| Cancellation | Cancel an owned booking; try cancelling another user's booking | Owned booking cancels and field lifecycle returns to an allowed state; cross-owner cancellation fails | Not run — authenticated test required |
| Telegram linking | Link the signed-in test farmer to the test Telegram account; try expired/reused token | Link succeeds once; expired/reused token fails; webhook rejects invalid secret and deduplicates updates | Not run — bot/test identity required |
| Evidence upload | Operator uploads a permitted image to the evidence bucket and creates evidence row; try oversized/wrong MIME file | Upload and row are associated with authorized job/owner; invalid files fail; other farmers cannot read the object | Not run — operator account and test job required |
| Offline evidence replay | Capture evidence offline as operator A, sign out, sign in as operator B, reconnect; then sign back in as A and retry after simulating metadata-write failure | B cannot upload A's queued evidence; A's evidence replays once without duplicate objects or metadata rows | Not run — shared-device test required |
| Verification | Verifier reviews assigned test evidence; farmer/operator tries to submit a verification result | Only authorized verifier can perform allowed review; unauthorized writes fail | Not run — verifier account and evidence required |
| Dispatch | Dispatcher assigns a machine and transitions job; unrelated operator attempts transition | Role, operator-machine linkage, allowed status transitions, and audit trail are enforced | Not run — dispatcher/operator fixtures required |
| Marketplace | Run the buyer/farmer/dispatcher authorization matrix against the proposal on staging | Ownership, tenant boundaries, verified quantities, role checks and transport transitions pass before proposal is approved | Blocked — proposal intentionally not production-enabled |

## Desktop/mobile map verification

Run on the exact deployment commit, not merely the source branch.

- Desktop: 1440×900 and 1280×800; open the operations map, toggle street/satellite/NASA basemaps and each layer, search a field, open field/machine/residue/buyer popups, zoom and fit bounds.
- Mobile: 390×844 and 360×800; repeat layer and basemap changes, search, popup open/close, zoom, and page scrolling. Floating controls must not cover primary actions or trap scrolling.
- Keyboard/accessibility: tab through map controls, verify visible focus, readable labels, and reduced-motion behavior.
- Data truth: with no live records, the map must show an honest empty/setup state rather than fabricated live field or machine positions.
- Capture screenshots and note browser/device plus pass/fail. Check console/network failures for tile, Supabase, CORS, or ResizeObserver errors.

**Current status: not visually verified.** The current production deployment points to an older commit than the merged map/readme changes. The PR preview is available for inspection, but this run did not execute browser interaction tests; do not mark this checklist complete until screenshots and real test-account flows are recorded.
