# NIRDHOOM map and NASA remote-sensing plan

**Reviewed:** 2026-10-11

## Current data sources

- Live machine markers are sourced from persisted `public.machine_locations` records. Invalid, future and stale pings are excluded.
- NASA FIRMS fire detections are loaded through the server-side `/api/firms` adapter with `FIRMS_MAP_KEY`.
- A NASA GIBS MODIS Terra true-colour basemap is available separately from the operational fire-detection overlay.
- Weather requests use the existing authenticated `/api/weather` adapter.

## Recommended NASA service use

1. **FIRMS for fire detections.** Preserve sensor, acquisition time, confidence and source metadata; show freshness in the UI. A satellite point is a detection, not confirmed parcel-level proof. No detection is not proof of no burning.
2. **GIBS for contextual imagery.** The new optional basemap uses public WMTS imagery from `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/`. The MODIS Terra true-colour layer uses a date three days in the past to reduce empty tiles from processing latency. It is lower-resolution context, not field-boundary proof, and does not require the FIRMS key.
3. **NASA POWER for future historical weather features.** It can supply retrospective weather/solar time series and help build sourced model inputs. It is not a substitute for a short-range operational forecast. Cache coordinate, parameters, dates, retrieval timestamp and units.
4. **Keep the map legible.** Default to one basemap, with optional fire, weather, fields, machine, route, residue and buyer overlays. Avoid enabling every overlay at once.

## Map quality priorities

- Display data source and observation time; distinguish acquisition time from retrieval time.
- Provide explicit stale/no-data states.
- Cluster dense fire detections at low zoom.
- Use valid field geometry where available; label center-point fallback as approximate.
- Make layer controls touch-sized and keyboard accessible.
- Keep route lines distinct from field boundaries and only show operational routes backed by dispatch records.
- Cache/throttle FIRMS server-side. Never expose its secret key in browser code.
- Never treat a missing satellite detection as evidence that burning did not happen.

## Credential checklist

- `FIRMS_MAP_KEY`: server-side Vercel variable for NASA FIRMS.
- `REQUIRE_AUTH_FOR_FIRMS=true`: keep sensitive field-location requests behind authentication.
- Never define `VITE_FIRMS_MAP_KEY`.
- A generic NASA API key is not automatically a FIRMS MAP_KEY; confirm the credential's issuing service.
- GIBS public tiles do not use the FIRMS key.
- Verify preview and production environment variables independently and redeploy after changes.

## Sources

- NASA GIBS access patterns, WMTS/TMS and time dimensions: https://nasa-gibs.github.io/gibs-api-docs/access-basics/
- NASA GIBS map-library usage: https://nasa-gibs.github.io/gibs-api-docs/map-library-usage/
- NASA FIRMS active fire products: https://firms.modaps.eosdis.nasa.gov/content/active_fire/
- NASA FIRMS API usage guidance: https://firms2.modaps.eosdis.nasa.gov/content/academy/data_api/firms_api_use.html
- NASA POWER temporal API: https://power.larc.nasa.gov/docs/services/api/temporal/
