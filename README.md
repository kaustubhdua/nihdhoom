# NIRDHOOM — Field-First Crop-Residue Network

<p align="center">
  <a href="https://github.com/kaustubhdua/nihdhoom/actions/workflows/ci.yml"><img src="https://github.com/kaustubhdua/nihdhoom/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <img src="https://img.shields.io/badge/React-19-2f7d46?logo=react&logoColor=white" alt="React 19">
  <img src="https://img.shields.io/badge/Vite-8-646cff?logo=vite&logoColor=white" alt="Vite 8">
  <img src="https://img.shields.io/badge/Supabase-Postgres-3ecf8e?logo=supabase&logoColor=white" alt="Supabase">
  <img src="https://img.shields.io/badge/Product-Field--first-2f7d46" alt="Field-first product">
</p>

<p align="center"><b>Field → service → evidence → residue → buyer</b><br>Farmer-first coordination for crop-residue management.</p>

> **Truth boundary:** NIRDHOOM is a prototype / integration foundation. Seeded records and indicative planning values are clearly separated from connected live records; they are never evidence of field-pilot outcomes or confirmed commercial commitments.

## Why this repository is different

NIRDHOOM treats residue management as an operational chain rather than a single dashboard: a field needs consent, a service request needs a verified quote, a machine assignment needs capacity, completed work needs evidence, and residue needs verification before it enters a buyer pathway.

### Product map

| Surface | Purpose | Loading strategy |
|---|---|---|
| **Home / Field view** | Farmer-first starting point and today's work | Initial bundle |
| **My Fields / Booking** | Field records, consent and clearance request | Lazy + interaction prefetch |
| **Track / Operator** | Map, machine workflow and evidence | Lazy; Leaflet deferred |
| **Residue Market** | Verified lots, pooling and buyer demand | Lazy + prefetch |
| **Impact / Research** | Evidence, methodology and context | Lazy + prefetch |
| **Telegram Help** | Farmer communication, secure account linking and status updates | Lazy + interaction prefetch |
| **Buyers / Demand** | Buyer requirements and residue pathways | Lazy + prefetch |

### Performance principles

- Heavy workspaces use React `lazy()` + `Suspense` instead of shipping every screen up front.
- Leaflet is deferred until Tracking is opened; Three.js stays behind the 3D workspaces.
- Primary navigation uses React transitions so the current screen remains responsive while the next workspace loads.
- Frequently reached workspaces begin loading on pointer/focus intent, reducing perceived navigation latency.
- Images use native lazy loading and asynchronous decoding outside the primary hero.
- Mobile removes expensive backdrop blur and respects `prefers-reduced-motion`.
- Production builds use Vite's optimized asset pipeline with CSS code splitting.

## Repository map

```text
src/
├── App.tsx                     # Product shell + workspace routing
├── components/
│   ├── CommandCenter/          # Farmer-first home
│   ├── ClearanceBooking/       # Booking flow
│   ├── FieldJobs/              # Fields + job lifecycle
│   ├── OpsConsole/             # Map + dispatch
│   ├── FieldOperator/          # Operator/PWA workflow
│   ├── ResiduePooling/         # Verified residue + buyer pooling
│   ├── ImpactResearch/         # Research and evidence
│   ├── VerificationLayer/      # Verification evidence
│   └── ThreeD/                 # Deferred 3D experiences
├── lib/                        # Supabase + lightweight app utilities
├── state/                      # Application state/controller
└── styles/                     # Theme and hero styles
api/                            # Server-side Vercel API routes
supabase/migrations/            # Database/RLS/integrity changes
services/dispatch-ortools/      # Python dispatch service foundation
tests/                          # Repository regression tests
docs/                           # Architecture, research and release notes
```

---
<p align="center">
  <a href="README.md"><b>English</b></a> ·
  <a href="README.hi.md">हिन्दी</a> ·
  <a href="README.pa.md">ਪੰਜਾਬੀ</a>
</p>

<p align="center">
  <b>Field → machine → evidence → residue → buyer</b><br>
  A field-first product for coordinating crop-residue clearance and downstream supply.
</p>

<p align="center">
  <img src="public/images/punjab_farm_hero.jpg" alt="Punjab agricultural field context" width="92%">
</p>

NIRDHOOM (also referred to in the project materials as **Parali: The Reframe**) is a field-first web application for coordinating farmers, field records, machinery operators, dispatch, verification, and residue offtake. The V7 direction prioritizes the operational chain over adding more dashboard surfaces.

> **Truth boundary:** this repository is a prototype/integration foundation. Seeded records and indicative planning values are clearly separated from connected live records; they are never evidence of field-pilot outcomes or confirmed commercial commitments.


## Connected backend

The dedicated NIRDHOOM Supabase project and deployed database state are documented in [`docs/CONNECTED-SUPABASE.md`](docs/CONNECTED-SUPABASE.md). Payments remain deliberately non-live in the current release scope.

## Contents

- [What the product is intended to do](#what-the-product-is-intended-to-do)
- [Product release roadmap](docs/PRODUCT-RELEASE-ROADMAP.md)
- [Current implementation](#current-implementation)
- [Operations map](#operations-map)
- [Workflow and architecture](#workflow-and-architecture)
- [Research findings and product implications](#research-findings-and-product-implications)
- [Technology stack](#technology-stack)
- [Run locally](#run-locally)
- [Environment configuration](#environment-configuration)
- [Database setup](#database-setup)
- [Validation and tests](#validation-and-tests)
- [Deployment notes](#deployment-notes)
- [Known limitations and release boundary](#known-limitations-and-release-boundary)
- [Repository guide](#repository-guide)
- [Research and references](#research-and-references)
- [Contributing](#contributing)

## Product

NIRDHOOM is a field-first crop-residue coordination product built around one operational chain:

**Field → Machine → Bale → Pickup → Buyer**

It is designed for the people who actually have to move residue: farmers, machine operators, dispatchers, verifiers and buyers.

### What is deliberately not in the product shell

There is no in-app pitch deck, judge Q&A, competition walkthrough, fake payment confirmation, or presentation-only “demo runner”. The public UI is reserved for product workflows.

### Product principles

- **Evidence before impact** — operational claims need a traceable record.
- **Capacity before promises** — a machine is available only when its current state supports it.
- **Residue is a first-class object** — weight, quality, custody and destination stay connected.
- **Remote sensing is supporting evidence** — a satellite observation is never presented as field-level proof by itself.
- **Commercial state is explicit** — a buyer need is not a contract and a proposed match is not a transaction.
- **Farmer UX stays small** — complexity belongs in operations, not in the farmer's first screen.
- **Truth beats theatre** — unavailable integrations fail clearly instead of simulating success.

### Visual language

The product uses restrained agriculture photography, a warm field palette, compact operational cards, accessible motion and open-source UI primitives rather than generic AI-dashboard decoration.

### Product UI stack

- **Motion for React** for restrained entrance and interaction motion.
- **Lucide** for consistent, lightweight operational icons.
- **React Bits-inspired Spotlight / Stepper / CodeSlots patterns** for focused interaction surfaces.
- **Leaflet + OpenStreetMap** for the field-first operations map.
- **Native browser primitives** for responsive images, focus states and reduced-motion support.

The visual goal is deliberately practical: a calm agricultural operations product, not an AI landing-page template.

## Operations map

The Tracking workspace uses Leaflet and explicitly labelled data layers to help field teams inspect operational context. It is a planning and coordination view—not an authoritative cadastral map or proof of service completion.

### Map controls

| Control | What it does | Important caveat |
|---|---|---|
| **Find a field** | Search visible fields by Khasra reference, village, farmer, or record ID; select a result to focus the map | Search is limited to the fields available to the current session |
| **GIS map layers** | Toggle field boundaries, machines, NASA FIRMS observations, residue lots, buyers, yards, weather planning, and routes | A layer is shown only when matching data and valid coordinates exist |
| **Basemap** | Switch between street tiles, satellite imagery, and NASA GIBS imagery | External tile services require network access and remain subject to provider availability/terms |
| **Field status legend** | Filter fields by lifecycle stage and see counts for each stage | Counts describe loaded records, not all farms in a district |
| **Hotspot shortcuts** | Move the map to selected Punjab reference areas | These are navigation shortcuts, not proof of an active fire or NIRDHOOM coverage |
| **Zoom / show all fields** | Zoom in/out or fit the currently visible field set | The map falls back to a regional Punjab view when no valid field coordinates are available |

### Data and trust rules

- **Live GPS** comes from persisted device-location records with timestamps. Missing or stale readings must be shown as unavailable; the UI must not animate machines along invented routes in live mode.
- **Demo GPS** is labelled as simulated. Never use demo positions to make operational claims.
- **NASA FIRMS detections** are remote-sensing observations. They are not proof that a particular farmer burned a field, and no detection is not proof that no burning occurred.
- **Field boundaries** are operational geometry until a trusted cadastral/Khasra source and provenance are attached.
- **Buyer and yard pins** appear only when explicit valid coordinates exist. A reference listing or demand target is not a contract.
- **Weather and routes** are planning aids; operators must confirm field conditions and actual assignments before dispatch.
- Popup text is escaped before rendering through Leaflet's HTML popup API. Keep this protection in place whenever adding database-sourced labels.

### Map troubleshooting

1. If tiles are blank after opening a lazy-loaded workspace or resizing a drawer, resize the viewport and reload the map; the component observes container-size changes and calls Leaflet's `invalidateSize`.
2. If the basemap is blank but controls work, check connectivity, browser network errors, and the tile provider's availability.
3. If the field finder is empty, confirm the session can read field records and that the current filters are not hiding them.
4. If live machine markers are absent, check authenticated access to location records and the last device timestamp. Do not switch to demo positions to conceal a live-data failure.
5. On a small screen, collapse the field/layer panels and use the status legend's scroll area so map controls do not cover the entire map.

## What the product is intended to do

NIRDHOOM is designed around the practical steps involved in managing crop residue, rather than treating residue management as a single map or dashboard problem.

- **Farmers:** register or select a field, understand available management pathways, request service, and track a booking.
- **Operators:** receive assigned work, report job progress, and attach field evidence.
- **Dispatchers:** review work and machinery capacity, assign jobs, and handle exceptions.
- **Verifiers:** review evidence and record a traceable decision.
- **Residue buyers / network partners:** express demand and coordinate collection or offtake, subject to verified commercial terms.

The intended chain is:

`Field → consent → quote → booking → dispatch → operator GPS/evidence → verified residue lot → buyer demand/pool → offtake → verification/impact`

This is a target workflow, not a claim that every step is currently connected to a live provider or field operation.

## Current implementation

The repository currently contains the following product surfaces and foundations:

| Area | Present in repository | Important qualification |
|---|---|---|
| Farmer experience | Field view, booking flow, timeline, weather/context and residue pathways | Data may be demo or indicative; live service capacity is not established |
| Field mapping | OpenStreetMap basemap and field-boundary drawing prototype | A drawn polygon is not authoritative cadastral/Khasra geometry |
| Operator workflow | Assigned jobs, device GPS telemetry, private evidence upload, SHA-256 hashing and offline evidence queue | Live provider/RLS behavior still requires field-pilot validation |
| Dispatch | Authenticated `/api/dispatch` + vehicle-specific OR-Tools service + local heuristic fallback | Solver output still requires human review before execution |
| Verification | Evidence and remote-sensing audit model | Satellite signals are supporting evidence, not field-level proof by themselves |
| Residue network | Verified-lot deal pools, buyer demand, offers and related schema/UI | Buyer demand is not a contract until commercial terms are executed |
| Sathi assistant | Assistant UI and server route | Provider-backed and authenticated field context depend on configuration |
| Supabase | SQL migrations, roles, RLS policies and RPC foundations | Must be tested on a dedicated NIRDHOOM project before real data is used |
| PWA | Manifest, service worker and app-shell foundation | Not proof of complete offline transaction synchronization |
| Payments | Demo-only payment surface / ledger concepts | **Real payment or payout integration is explicitly out of scope** |

The implementation and pilot gates are tracked separately so that a UI or schema should not be mistaken for an operationally verified capability.

## Workflow and architecture

### Application entry points

- The active browser application is launched from `index.html` and `src/main.jsx`.
- `src/main.jsx` mounts the modular `src/App.tsx`; the duplicate `src/main.tsx` entrypoint has been removed.
- API routes live under `api/`.
- Database migrations live under `supabase/migrations/`.
- The Python dispatch service foundation lives under `services/dispatch-ortools/`.

### High-level request flow

1. The browser renders the Vite/React application.
2. The user interacts with the relevant product surface.
3. Supabase is the intended persistence/authentication layer for configured features.
4. Server routes under `api/` mediate selected external services and privileged operations.
5. Evidence, status changes, and verification should remain attributable to an actor and timestamp.
6. Operational claims should be derived from auditable records—not from static demo cards or public state-level statistics.

### Trust boundaries

- Browser environment variables must contain only browser-safe values.
- Supabase service-role keys, AI keys, and other provider secrets belong only in server-side environment configuration.
- Role assignment must be performed through an authorized process; a user must not be able to grant themselves privileged access.
- Treat external service output as untrusted input and validate it before it changes operational state.
- Keep farmer data, evidence objects, and authenticated API responses private; avoid indiscriminate caching.

## Research findings and product implications

Research is maintained in the repository so that product assumptions can be reviewed against dated public evidence. The figures below are **context only**; they are not NIRDHOOM performance, live inventory, or forecasts.

### Punjab paddy-season fire counts

The CAQM/PIB season-end release reports the following Punjab fire-event counts for the **15 September–30 November** monitoring window:

| Season | Reported fire-event count |
|---|---:|
| 2021 | 71,304 |
| 2022 | 49,922 |
| 2023 | 36,663 |
| 2024 | 10,909 |
| 2025 | 5,114 |

The 2025 release describes the count as 53% lower than 2024. These are protocol-based fire-event counts for a specified season window; they are not tonnes of residue burned, proof of field-level service coverage, or outcomes attributable to NIRDHOOM. See the [CAQM/PIB season-end release](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2197201&lang=1&reg=3).

### Machinery and service capacity

A September 2026 *Indian Express* report described Punjab's plan for approximately **1.25 lakh operational CRM machines** for the season and discussed ageing equipment. This is a reported preparedness plan, not a live inventory and not evidence that a particular machine is available for a booking. The product therefore needs separate machine states such as registered, operational, available, assigned, and unavailable—with timestamps and a source. See the [September 2026 report](https://indianexpress.com/article/cities/chandigarh/record-paddy-area-ageing-crm-fleet-punjab-readies-1-25-lakh-machines-for-stubble-season-10888644/).

### In-situ and ex-situ pathways

Government crop-residue guidance distinguishes in-situ management (retaining, incorporating, mulching, or decomposing residue in the field) from ex-situ management (baling and transporting residue for use elsewhere). The guidance describes a need to match options with locally appropriate solutions and supply-chain infrastructure. This supports keeping in-field operations distinct from collection, storage, transport, and buyer acceptance in the product model. See the [Crop Residue Management Operational Guidelines 2024](https://agrimachinery.nic.in/Files/Guidelines/Guidelines_CRM2024.pdf).

### Remote sensing is one evidence layer

Government reporting describes operational satellite detection of active fire locations and assessment of burn scars under a defined protocol. A satellite observation should therefore be stored with its source, observation time, geometry, and limitations. A missing detection does **not** establish that no burning occurred, and a fire point alone does not establish that a specific field was responsible. See the [PIB parliamentary reply on detection of stubble burning, 5 February 2026](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2223752&lang=2&reg=48).

### What the research means for the product

1. **Availability is a time-bound operational fact.** Do not infer it from total machine counts.
2. **A guaranteed date requires a real capacity reservation.** A displayed estimate is not a service guarantee.
3. **In-situ and ex-situ services have different logistics.** Ex-situ workflows need handling, storage, transport, quality, and buyer acceptance.
4. **Verification must be layered.** Field-boundary provenance, operator evidence, GPS metadata, satellite observations, and human review answer different questions.
5. **Impact metrics need a denominator and period.** Public state-level changes must not be attributed to the product.
6. **Commercial pathways require real counterparties.** A buyer listing is not a contract, and a residue lot is not sold until quantity, quality, price, delivery, and acceptance terms are established.

More detailed source notes, caveats, and refresh guidance are in [docs/PUNJAB-CROP-RESIDUE-RESEARCH.md](docs/PUNJAB-CROP-RESIDUE-RESEARCH.md) and [docs/RESEARCH-DATA.md](docs/RESEARCH-DATA.md).

## Technology stack

| Layer | Technologies |
|---|---|
| Web application | React 19, Vite 8, JavaScript/JSX |
| Secondary app path / type checking | TypeScript |
| Styling | CSS, Tailwind Vite plugin |
| Mapping | Leaflet, OpenStreetMap |
| Backend and authentication | Supabase, PostgreSQL, PostGIS, Row Level Security |
| Server routes | TypeScript / Node-compatible API routes |
| Dispatch service foundation | Python, OR-Tools |
| Assistant integration | Server-side provider adapter |
| Browser testing | Not part of the current release; CI runs type, audit, unit, build and dispatch-service checks |
| Static checks | TypeScript build check and repository audit script |
| PWA | Web app manifest and service worker |

Versions and commands are defined in `package.json`. The repository requires Node.js 24 or later.

## Run locally

### Prerequisites

- Node.js 24+
- npm
- Git

### Install and start

```bash
git clone https://github.com/kaustubhdua/nihdhoom.git
cd nihdhoom
npm install
npm run dev
```

Vite prints the local development URL in the terminal.

### Available scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start the Vite development server |
| `npm run build` | Create the production frontend build |
| `npm run preview` | Preview the built frontend locally |
| `npm run audit` | Run the repository's static validation/audit script |
| `npm run syntaxcheck` | Run the TypeScript project build check |
| `npm test` | Run Node test files matching `tests/*.test.mjs` |
| `npm run release:check` | Run syntax check, audit, tests and production build in sequence |

A command existing in `package.json` does not mean its tests have passed. Run the commands against your current checkout and inspect the results.

## Environment configuration

Start from the example file:

```bash
cp .env.example .env.local
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

Configure only the values needed for the feature you are testing.

| Variable | Where it belongs | Notes |
|---|---|---|
| `VITE_SUPABASE_URL` | Browser build | URL of the dedicated NIRDHOOM Supabase project |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Browser build | Browser-safe publishable/anon key only |
| `OPENAI_API_KEY` | Server only | Optional provider-backed Sathi; never expose to browser |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Privileged server operations only; never expose to browser |
| `FIRMS_MAP_KEY` | Server only | NASA FIRMS integration credential, if enabled |
| `REQUIRE_AUTH_FOR_FIRMS` | Server only | Set to `true` when requiring authenticated access |
| `DISPATCH_SERVICE_URL` | Server only | URL of a separately deployed dispatch service, if configured |
| IVR variables | Server only | Configure only after provider setup and consent flow are verified; Telegram is the primary farmer channel |

See `.env.example` for the repository's current variable names. Never commit `.env.local`, tokens, private keys, or real farmer data.

## Database setup

**Do not point this repository at an unrelated Supabase project.** Create a dedicated NIRDHOOM project and verify its project URL before applying migrations.

Apply migrations in chronological order:

Apply every migration in `supabase/migrations/` in filename order, including the booking/verification/security migrations and the residue-pooling migrations. Do not skip the later security migrations.

Then configure the required authentication and storage settings documented by the migrations. Use `supabase/seed.sql` only for an explicitly identified demo environment.

Before using real records, verify migrations on a fresh project and test RLS with separate accounts for each role. Do not treat successful SQL application alone as proof of correct authorization.

## Validation and tests

Run the repository checks:

```bash
npm install
npm run syntaxcheck
npm run audit
npm test
npm run build
```

The Python dispatch service also has a unit-test suite and should be checked with `python -m unittest test_main.py -v` after installing `services/dispatch-ortools/requirements.txt`.

The current release deliberately does not include a browser E2E harness.

The Python dispatch service also has a syntax check:

```bash
python -m compileall -q services/dispatch-ortools
```

For a release, record the commit SHA and CI run, and verify that all required checks completed successfully. A static audit or successful frontend build does not replace RLS, provider, device, or field-pilot tests.

## Deployment notes

The intended frontend deployment target is Vercel, but deployment should happen only after the production build and release checks pass.

1. Create and verify the dedicated NIRDHOOM Supabase project.
2. Apply and test migrations in order.
3. Configure environment variables separately for preview and production.
4. Deploy the frontend and required server routes.
5. Deploy the dispatch service separately if the application is configured to call it.
6. Test authentication, booking, field-scoped access, evidence handling, and failure states in the deployed environment.
7. Keep demo data disabled or visibly labelled in any public deployment.

Do not assume that a Vercel deployment automatically deploys the Python dispatch service or configures Supabase providers.

## Known limitations and release boundary

The repository is a prototype/integration foundation. The following still require implementation, configuration, or verification before a controlled pilot:

- Real phone OTP onboarding and consent capture are implemented; consent withdrawal is now self-service. Real deployed-provider verification is still required.
- Authoritative cadastral/Khasra boundary source and field-level provenance.
- Production GPS/device validation remains a pilot gate; the operator UI now surfaces stale readings.
- Private evidence upload, server-side content validation, and trusted hashing.
- Dispatch service deployment and validation of returned assignments.
- Real service-area capacity, booking concurrency, cancellation, and escalation rules.
- Buyer identity, binding offers/contracts, lot quality, custody, and acceptance workflow.
- Remote-sensing ingestion and human verification/appeal workflow.
- Reliable offline queue synchronization on real devices.
- API rate limits, request validation, observability, alerting, backups, and retention.
- Live Supabase records are now read by the app when demo mode is disabled; write workflows still require the authenticated RPC/operator paths and must be validated against the deployed project.
- Accessibility and low-end Android field testing.
- Production privacy policy, terms, consent records, and operational support procedures.

### Payment scope

**Real payment/payout integration is intentionally excluded from the current scope.** Payment screens or ledger concepts are demonstration-only. Do not add provider credentials or describe a UI action as settlement. See [docs/NON-PAYMENT-RELEASE-SCOPE.md](docs/NON-PAYMENT-RELEASE-SCOPE.md) and [docs/CONTROLLED-PILOT-RUNBOOK.md](docs/CONTROLLED-PILOT-RUNBOOK.md).

### Pilot readiness

Use [docs/FINAL-PILOT-READINESS.md](docs/FINAL-PILOT-READINESS.md) as the detailed checklist. A checkbox should be marked complete only when supported by a test result, environment verification, or operational sign-off.

## Repository guide

| Path | Description |
|---|---|
| `src/main.jsx` | Active React application entry |
| `src/components/` | Extracted UI components |
| `src/lib/` | Shared domain helpers |
| `api/` | Server-side API routes |
| `services/dispatch-ortools/` | Python dispatch service foundation |
| `supabase/migrations/` | Database schema, policies, and RPC migrations |
| `supabase/seed.sql` | Demo seed data |
| `public/` | Static assets, icons, manifest, and service worker |
| `scripts_validate.mjs` | Repository audit script |
| `docs/PUNJAB-CROP-RESIDUE-RESEARCH.md` | Research notes and product implications |
| `docs/RESEARCH-DATA.md` | Dated public data, source scope, and caveats |
| `docs/FINAL-PILOT-READINESS.md` | Consolidated pilot checklist |
| `docs/IMAGE-LICENSES.md` | Public photography sources and licenses |
| `docs/NON-PAYMENT-RELEASE-SCOPE.md` | Explicit non-payment release boundary |
| `LINE-BY-LINE-AUDIT.md` | Repository audit notes |
| `PDF-FEATURE-MATRIX.md` | Feature mapping to supplied brief |

## Research and references

The research files are the maintained reference for figures and their limitations. Key primary/public sources include:

- [Government of India, Crop Residue Management Operational Guidelines 2024](https://agrimachinery.nic.in/Files/Guidelines/Guidelines_CRM2024.pdf) — in-situ/ex-situ management and scheme framework.
- [PIB / CAQM, 2025 paddy-season fire-count release](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2197201&lang=1&reg=3) — Punjab and Haryana season-end figures and comparison period.
- [PIB, parliamentary reply on satellite detection of stubble burning, 5 February 2026](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2223752&lang=2&reg=48) — monitoring protocol and operational detection context.
- [PIB, 2026 wheat-stubble action-plan direction](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2228743&lang=1&reg=1) — wheat-season preparedness; do not mix with the paddy-season series.
- [CAQM Annual Report 2024–25](https://caqm.nic.in/WriteReadData/LINKS/7bb814e6-844c-48b9-91cc-aa1909f9a7d8.pdf) — historical crop-residue context.
- [Punjab Energy Development Agency — Biomass Power Projects](https://www.peda.gov.in/biomass-power-projects.php) — agency-published biomass context.
- [The Indian Express, September 2026, Punjab CRM fleet preparedness](https://indianexpress.com/article/cities/chandigarh/record-paddy-area-ageing-crm-fleet-punjab-readies-1-25-lakh-machines-for-stubble-season-10888644/) — reported plan and ageing-fleet context; not a live inventory.

**Research limitations:** Public figures may be estimates, plans, or protocol-specific observations. Always preserve geography, measurement period, publication date, and source. Do not infer district-level availability or attribute state-level changes to NIRDHOOM. Recheck time-sensitive figures before using them in a live product.

## Contributing

1. Create a branch for a focused change.
2. Keep demo and live data paths clearly separated.
3. Do not add secrets or identifiable farmer data to commits, screenshots, fixtures, or logs.
4. Update the relevant research or operational documentation when changing a product assumption.
5. Run the applicable checks and report any that could not be run.
6. For schema changes, include migration and authorization tests; do not silently edit an already-applied migration in a deployed environment.

---

**Project principle:** Make the field-to-residue chain traceable, keep claims proportional to evidence, and distinguish a working prototype from a verified service.
