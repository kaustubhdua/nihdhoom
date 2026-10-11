# Contributing to NIRDHOOM

Thanks for helping improve NIRDHOOM. Changes should make the field-to-residue workflow more reliable, understandable, and auditable.

## Before opening a pull request

1. Create a focused branch from the current `main`.
2. Explain the user problem and intended behavior in the PR description.
3. Keep live records, demo fixtures, and historical reference data explicitly separated.
4. Never commit credentials, service-role keys, personal farmer data, private evidence, or unredacted logs.
5. For database changes, add a new migration rather than rewriting a migration already applied to a shared environment. Include role/authorization tests for affected RPCs and tables.
6. For UI changes, check mobile layouts, keyboard focus, accessible names, and loading, empty, success, and error states. Update English/Hindi labels where relevant.
7. For maps, escape database-sourced popup text, retain tile-provider attribution, label demo GPS, and do not imply remote sensing proves a field-level event.
8. Update README or the relevant document when a workflow, setup requirement, data caveat, or release boundary changes.

## Local setup

Requirements: Node.js 24+, npm, and Git.

```bash
git clone https://github.com/kaustubhdua/nihdhoom.git
cd nihdhoom
npm ci
cp .env.example .env.local
npm run dev
```

Only add environment values required for the feature under test. Browser-exposed `VITE_*` variables must never contain service-role keys or provider secrets.

## Validation

Run the full local release check before requesting review:

```bash
npm run release:check
```

This runs the TypeScript project check, repository audit, Node regression tests, and production build. CI also validates the generated migration bundle and dispatch-service Python checks.

If a check cannot be run, report it clearly in the PR. Do not describe a feature as production-tested based only on a successful build.

## Pull request checklist

- [ ] The problem and expected behavior are explained.
- [ ] Relevant tests were added or updated.
- [ ] `npm run release:check` passes, or skipped checks are explained.
- [ ] Loading, empty, success, and error states were considered.
- [ ] Mobile and keyboard accessibility were considered.
- [ ] No secrets, personal data, or fabricated operational claims were introduced.
- [ ] Documentation and release notes match the implementation.
- [ ] Required external setup (Supabase, SMS, Telegram, Vercel, tile provider) is called out.

## Security and operational truth

Do not report a successful OTP, booking, verification, offer, transport, or payment unless the corresponding provider/database operation succeeded. Never use demo records to represent real field-pilot outcomes. For suspected vulnerabilities, avoid public disclosure of exploit details and contact maintainers privately.
