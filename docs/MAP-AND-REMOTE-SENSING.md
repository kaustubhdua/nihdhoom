# NIRDHOOM map and NASA remote-sensing plan

**Reviewed:** 2026-10-11

## What is connected today

- Operational field polygons, machine records, storage yards, buyers, residue and route layers are rendered in Leaflet.
- Live machine markers are sourced from persisted `machine_locations` records in live mode. Old/future/invalid pings are excluded.
- Fire detections are supplied through the server-side `/api/firms` adapter and the secret `FIRMS_MAP_KEY` environment variable. Do not expose that key through a `VITE_*` variable.
- Field weather planning is requested through the authenticated `/api/weather` adapter.
- A NASA GIBS MODIS Terra true-colour basemap is now an optional map layer, separate from the operational fire-detection overlay.

## NASA service choice

1. **FIRMS for fire detections.** Use the FIRMS area API for VIIRS/MODIS detections, retain sensor, acquisition time, confidence and source metadata, and show freshness in the UI. A point is a satellite detection, not a confirmed field fire; no detection is not proof that burning did not occur. Keep field evidence and satellite observations as separate evidence classes.
2. **GIBS for contextual imagery.** The map can request public WMTS imagery from `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/`. The added MODIS Terra true-colour layer uses an imagery date three days in the past to reduce empty tiles from processing latency. This layer is lower-resolution contextual imagery; it is not parcel-level proof and does not require the FIRMS map key.
3. **NASA POWER for retrospective weather context (future enhancement).** POWER provides point-based daily/monthly/hourly analysis-ready weather/solar data. It is useful for historical weather features and model validation, not a replacement for a short-range operational forecast. Store query coordinates, parameters, requested date range, retrieval timestamp and units with each cached response.
4. **Avoid adding more layers by default.** Keep the operational map legible: one basemap, fields, machines, routes, and optional fire/weather/residue/buyer overlays. Let the operator switch layers on demand.

## Map quality priorities

- Display source and observation timestamp for every remote-sensing layer; distinguish acquisition time from retrieval time.
- Provide a clear no-data / stale-data state rather than implying a live observation.
- Cluster dense fire detections at small scales and show individual points only when zoomed in.
- Use field geometry when valid; fall back to a recorded center only with an explicit approximate-location label.
- Make field search and layer controls keyboard accessible and touch-sized; preserve map space on small screens.
- Keep route lines visually distinct from field boundaries and show route status only when backed by a real route/dispatch record.
- Add request throttling/caching server-side for FIRMS; do not make a public browser request with the secret key.
- Treat missing satellite detections as unknown, not a non-burning verification result.

## Credential checklist

- `FIRMS_MAP_KEY`: server-side Vercel variable for NASA FIRMS.
- `REQUIRE_AUTH_FOR_FIRMS=true`: keep field-location queries behind authenticated access.
- Never set `VITE_FIRMS_MAP_KEY`; Vite-prefixed values are exposed to the browser.
- NASA GIBS public tiles do not use the FIRMS key. A generic NASA API key is not automatically a FIRMS MAP_KEY; confirm which NASA service issued the credential.
- Verify the active production/preview environment separately and redeploy after changing environment variables.

## Sources

- NASA GIBS access patterns, WMTS/TMS and time dimensions: https://nasa-gibs.github.io/gibs-api-docs/access-basics/
- NASA GIBS Leaflet / map-library usage: https://nasa-gibs.github.io/gibs-api-docs/map-library-usage/
- NASA FIRMS active fire products and downloads: https://firms.modaps.eosdis.nasa.gov/content/active_fire/
- NASA FIRMS API key and API usage guidance: https://firms2.modaps.eosdis.nasa.gov/content/academy/data_api/firms_api_use.html
- NASA POWER temporal API, including daily/monthly/hourly point series: https://power.larc.nasa.gov/docs/services/api/temporal/
