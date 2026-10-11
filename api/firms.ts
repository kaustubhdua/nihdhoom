declare const process: { env: Record<string, string | undefined> };
import { rateLimit } from './_lib/rateLimit';

type Coordinate = { lat: number; lng: number };
const validPoint = (p: any): p is Coordinate =>
  p && Number.isFinite(Number(p.lat)) && Number(p.lat) >= -90 && Number(p.lat) <= 90 &&
  Number.isFinite(Number(p.lng)) && Number(p.lng) >= -180 && Number(p.lng) <= 180;

function inside(point: Coordinate, poly: Coordinate[]) {
  let result = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    const crosses = (a.lng > point.lng) !== (b.lng > point.lng) &&
      point.lat < ((b.lat - a.lat) * (point.lng - a.lng)) / (b.lng - a.lng) + a.lat;
    if (crosses) result = !result;
  }
  return result;
}

async function verifyUser(req: any) {
  const auth = String(req.headers?.authorization || '');
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token || !((process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) || process.env.VITE_SUPABASE_URL) || !((process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY) || process.env.VITE_SUPABASE_PUBLISHABLE_KEY)) return null;
  try {
    const response = await fetch(`${((process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) || process.env.VITE_SUPABASE_URL)}/auth/v1/user`, {
      headers: { apikey: ((process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY) || process.env.VITE_SUPABASE_PUBLISHABLE_KEY), Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}

export default async function handler(req: any, res: any) {
  if (!rateLimit(req, res, 'api-firms.ts', 30)) return res.status(429).json({ error: 'Too many requests; please retry shortly.' });

  if (req.method !== 'POST') {
    res.setHeader?.('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Always authenticate and resolve the field from the caller's session. Never
  // accept coordinates or a polygon supplied by the browser for a private farm query.
  const user = await verifyUser(req);
  if (!user?.id) return res.status(401).json({ error: 'Authentication required' });

  const key = process.env.FIRMS_MAP_KEY || process.env.NASA_FIRMS_API;
  if (!key) return res.status(503).json({ error: 'FIRMS_MAP_KEY (or legacy NASA_FIRMS_API) is not configured' });
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return res.status(503).json({ error: 'Server-side Supabase persistence is not configured; FIRMS results were not saved.' });

  res.setHeader?.('Cache-Control', 'no-store');
  const body = req.body || {};
  const fieldId = String(body.field_id || '');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(fieldId)) {
    return res.status(400).json({ error: 'field_id must be a valid UUID' });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const authorization = String(req.headers?.authorization || '');
  const fieldResponse = await fetch(
    `${supabaseUrl}/rest/v1/fields?id=eq.${encodeURIComponent(fieldId)}&select=id,center_lat,center_lng,boundary_geojson,geometry`,
    {
      headers: { apikey: publishableKey!, Authorization: authorization },
      signal: AbortSignal.timeout(8000),
    },
  ).catch(() => null);
  if (!fieldResponse) return res.status(502).json({ error: 'Unable to resolve field boundary from Supabase' });
  if (!fieldResponse.ok) return res.status(502).json({ error: 'Unable to resolve field boundary from Supabase' });
  const fieldRows = await fieldResponse.json().catch(() => []);
  const savedField = Array.isArray(fieldRows) ? fieldRows[0] : null;
  if (!savedField) return res.status(404).json({ error: 'Field not found or not accessible to this account' });

  const field = { lat: Number(savedField.center_lat), lng: Number(savedField.center_lng) };
  if (!validPoint(field)) return res.status(409).json({ error: 'Saved field centre is missing or invalid' });

  const rawBoundary = savedField.boundary_geojson;
  const geoObject = typeof rawBoundary === 'string' ? (() => { try { return JSON.parse(rawBoundary); } catch { return null; } })() : rawBoundary;
  const geoGeometry = geoObject?.type === 'Feature' ? geoObject.geometry : geoObject;
  const geoCoordinates = geoGeometry?.type === 'Polygon' ? geoGeometry.coordinates?.[0] : null;
  let polygon: Coordinate[] = Array.isArray(geoCoordinates)
    ? geoCoordinates.map((point: unknown) => Array.isArray(point) ? ({ lng: Number(point[0]), lat: Number(point[1]) }) : null).filter((point: Coordinate | null): point is Coordinate => point !== null && validPoint(point))
    : [];
  if (polygon.length < 3 && Array.isArray(savedField.geometry)) {
    polygon = savedField.geometry.filter(validPoint).map((point: Coordinate) => ({ lat: Number(point.lat), lng: Number(point.lng) }));
  }
  if (polygon.length < 3 || polygon.length > 500 || polygon.some((point) => !validPoint(point))) {
    return res.status(409).json({ error: 'A valid saved field boundary is required for spatial screening' });
  }

  const radius = body?.radius_km === undefined ? 12 : Number(body.radius_km);
  if (!Number.isFinite(radius) || radius < 1 || radius > 50) {
    return res.status(400).json({ error: 'radius_km must be between 1 and 50' });
  }

  const dLat = radius / 111;
  const dLng = radius / (111 * Math.max(0.2, Math.cos(Number(field.lat) * Math.PI / 180)));
  const bbox = `${Number(field.lng) - dLng},${Number(field.lat) - dLat},${Number(field.lng) + dLng},${Number(field.lat) + dLat}`;
  const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${encodeURIComponent(key)}/VIIRS_NOAA21_NRT/${bbox}/1`;

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!response.ok) return res.status(502).json({ error: 'FIRMS request failed' });
    const csv = await response.text();
    const lines = csv.trim().split(/\r?\n/);
    const headers = (lines.shift() || '').split(',');
    const rawObservations = lines.slice(0, 500).map(line => {
      const columns = line.split(',');
      return Object.fromEntries(headers.map((header, index) => [header, columns[index]]));
    });

    const parseAcquiredAt = (item: Record<string, any>): string | null => {
      const date = String(item.acq_date || '');
      const time = String(item.acq_time || '').replace(/\D/g, '').padStart(4, '0');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{4}$/.test(time)) return null;
      const hours = Number(time.slice(0, 2));
      const minutes = Number(time.slice(2, 4));
      if (hours > 23 || minutes > 59) return null;
      const parsedDate = new Date(`${date}T${time.slice(0, 2)}:${time.slice(2, 4)}:00Z`);
      return Number.isNaN(parsedDate.getTime()) ? null : parsedDate.toISOString().replace(/\.\d{3}Z$/, 'Z');
    };

    const source = 'NASA FIRMS';
    const sensor = 'VIIRS_NOAA21_NRT';
    const parsed = rawObservations.map(item => {
      const latitude = Number(item.latitude);
      const longitude = Number(item.longitude);
      const acquiredAt = parseAcquiredAt(item);
      const confidence = item.confidence == null ? null : String(item.confidence);
      const frp = item.frp == null || item.frp === '' ? null : Number(item.frp);
      const satellite = String(item.satellite || '');
      const providerKey = acquiredAt
        ? [source, sensor, String(latitude), String(longitude), acquiredAt].join('|')
        : [source, sensor, String(latitude), String(longitude), 'undated', satellite, frp == null ? '' : String(frp), confidence || ''].join('|');
      return {
        provider_observation_key: providerKey,
        source,
        sensor,
        latitude,
        longitude,
        acquired_at: acquiredAt,
        confidence,
        frp: frp != null && Number.isFinite(frp) ? frp : null,
        matched_field_id: null,
        raw: item,
      };
    }).filter(item => Number.isFinite(item.latitude) && Number.isFinite(item.longitude)
      && item.latitude >= -90 && item.latitude <= 90 && item.longitude >= -180 && item.longitude <= 180);

    // De-duplicate input keys before PostgREST upsert; PostgreSQL rejects a single
    // ON CONFLICT statement that attempts to update the same row twice.
    const uniqueByKey = new Map<string, typeof parsed[number]>();
    for (const item of parsed) uniqueByKey.set(item.provider_observation_key, item);
    const uniqueParsed = [...uniqueByKey.values()];
    const matchedKeys = new Set(
      polygon.length >= 3
        ? uniqueParsed.filter(item => inside({ lat: item.latitude, lng: item.longitude }, polygon))
          .map(item => item.provider_observation_key)
        : [],
    );

    const queriedAt = new Date().toISOString();
    let persisted: Array<{
      id: string; provider_observation_key: string; source: string; sensor: string;
      latitude: number; longitude: number; acquired_at: string | null;
      confidence: string | null; frp: number | null;
    }> = [];

    if (uniqueParsed.length) {
      const persistResponse = await fetch(
        `${supabaseUrl}/rest/v1/firms_observations?on_conflict=provider_observation_key&select=id,provider_observation_key,source,sensor,latitude,longitude,acquired_at,confidence,frp`,
        {
          method: 'POST',
          headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
            'Content-Type': 'application/json',
            Prefer: 'resolution=merge-duplicates,return=representation',
          },
          body: JSON.stringify(uniqueParsed),
          signal: AbortSignal.timeout(10000),
        },
      );
      if (!persistResponse.ok) return res.status(502).json({ error: 'FIRMS observations were fetched but could not be persisted safely; retry later.' });
      persisted = await persistResponse.json().catch(() => []);
      if (!Array.isArray(persisted) || persisted.length !== uniqueParsed.length || persisted.some(row => !row.id || !row.provider_observation_key)) {
        return res.status(502).json({ error: 'FIRMS persistence returned an incomplete record set; retry later.' });
      }
    }

    const matchedRows = persisted.filter(item => matchedKeys.has(item.provider_observation_key));
    if (matchedRows.length) {
      const matchResponse = await fetch(
        `${supabaseUrl}/rest/v1/firms_observation_field_matches?on_conflict=observation_id,field_id`,
        {
          method: 'POST',
          headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
            'Content-Type': 'application/json',
            Prefer: 'resolution=merge-duplicates,return=minimal',
          },
          body: JSON.stringify(matchedRows.map(item => ({
            observation_id: item.id,
            field_id: fieldId,
            match_type: 'point_in_polygon',
            source,
            matched_at: queriedAt,
          }))),
          signal: AbortSignal.timeout(10000),
        },
      );
      if (!matchResponse.ok) return res.status(502).json({ error: 'FIRMS observations were saved but field matching could not be confirmed; retry screening.' });
    }

    return res.status(200).json({
      source,
      sensor,
      count: persisted.length,
      matched_count: matchedRows.length,
      radius_km: radius,
      polygon_checked: polygon.length >= 3,
      verification_status: 'DETECTION_SCREENING_NOT_PROOF_OF_NO_BURNING',
      observations: persisted,
      matched_observations: matchedRows,
      queried_at: queriedAt,
      persistence: 'SAVED_WITH_IDEMPOTENT_PROVIDER_KEYS',
      interpretation: 'No detection or missing observation is not proof that burning did not occur.',
    });
  } catch {
    return res.status(502).json({ error: 'FIRMS is unavailable; retry later' });
  }
}
