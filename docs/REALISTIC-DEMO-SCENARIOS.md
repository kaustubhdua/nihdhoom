# Realistic demo scenarios and truth boundaries

This document defines how NIRDHOOM demo mode should feel operationally credible without passing invented records off as real people, telemetry, alerts, commercial offers, or outcomes.

## Scenario rules

- Demo records are synthetic training data. Names, phones, field IDs, Khasra references, coordinates, machine locations, inventory, fire points, quantities, prices and payout rows are not authoritative.
- Real basemap imagery may be displayed under synthetic markers. That does not make the marker, boundary, buyer, machine position or event real.
- Demo mode must be visibly identified on every operational surface, and critical popups must repeat the label where a false claim could affect a decision.
- A map marker or a successful client-side interaction is not proof of a real dispatch, payment, field visit, buyer commitment, verification or environmental outcome.
- Never use demo-only names, coordinates, generated evidence or scenario outputs to report impact, trigger payment, issue a compliance certificate, notify the public about fires, or claim a confirmed buyer contract.
- Real mode must show an honest empty/unavailable state when a provider or authorized record is absent. Do not silently fall back to synthetic data.

## Improvements applied in this branch

0. Added an interactive, resumable overview walkthrough covering booking, operator assignment, dispatch, arrival, sample evidence, review, residue-lot creation and a non-binding buyer lead. It persists only a browser-local scenario log and explicitly states that it does not create backend records or payments.
1. Fire-map popups now distinguish synthetic demo observations from provider-returned NASA FIRMS observations and explicitly say demo fire points are not real alerts.
2. Buyer-map popups in demo mode identify simulated buyers, indicative prices and demand as non-contractual.
3. Yard-map popups identify demo stock and capacity as simulated inventory rather than a live feed.
4. Residue-lot map popups distinguish illustrative demo records from persisted live records.
5. Demo buyer descriptions no longer assert unverified price premiums, payment terms, ESG certifications, carbon-credit eligibility, facility scale or settlement delays as facts.

## Still simulated / requires a real integration or evidence

| Capability | What makes it production-real |
| --- | --- |
| Farmer identity and KYC | A real identity provider and lawful consent; never infer Aadhaar, face or bank verification from a UI step |
| Team roster | Invited, authenticated users with roles, organization membership, contact verification and audit trail |
| Field boundaries | Farmer-confirmed GPS or an authorized cadastral source, recorded provenance and accuracy |
| Machine team / location | Real machine-owner records, assigned operator accounts and fresh device GPS; stale positions must not appear live |
| Fire observations | Configured provider ingestion, observation timestamps, confidence metadata and outage handling |
| Harvest forecasts | Traceable data source, date of issue, block-level methodology, uncertainty and calibration against outcomes |
| Buyer network | Verified legal entity/contact, written demand, quality terms, pickup constraints, quote validity and contract state |
| Inventory and residue lots | Weighment/evidence, source field, moisture/quality, custody events and authorized state transitions |
| Payouts | A regulated payout provider, authenticated webhooks, reconciliation and dispute handling; demo balances are never payable |
| Verification / certificate | Reviewer identity, evidence provenance, reproducible checks and server-side hash verification; no hard-coded confidence |
| Impact / emissions | Documented methodology, defensible coefficients, measured inputs and independently reviewable assumptions |

## Recommended demo dataset shape

Use scenario personas and role names (for example, “Scenario farmer A” and “Scenario operator — Ubhawal CHC”) rather than realistic-looking real-world identities. Use coordinates only to demonstrate map interactions, and label them as illustrative. Keep synthetic status transitions reproducible so a reviewer can follow one coherent example from field registration to booking, operator assignment, evidence review, residue lot and buyer lead. Each stage should show the input, resulting state, timestamp source, and whether the result is simulated or persisted.

## Validation checklist

- [ ] Every page visibly declares demo vs live mode.
- [ ] Fire points, machine pins, buyer pins, yard inventory, payouts, forecasts and certificates disclose their provenance at point of use.
- [ ] Demo actions cannot call payment, compliance, or public-alert providers.
- [ ] Live mode never renders seeded data when authentication, tables, or providers are missing.
- [ ] Team access is tested with farmer, operator, dispatcher, verifier and admin accounts.
- [ ] A full browser test follows one demo journey and one live journey with no seeded-data fallback.
