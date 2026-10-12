declare const process: { env: Record<string, string | undefined> };
import { rateLimit } from './_lib/rateLimit.js';

function json(res: any, status: number, body: unknown) {
  res.setHeader?.('Cache-Control', 'no-store');
  return res.status(status).json(body);
}

async function authenticate(req: any) {
  const auth = String(req.headers?.authorization || '');
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token || !(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) || !(process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY)) return null;
  try {
    const response = await fetch(`${(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL)}/auth/v1/user`, {
      headers: {
        apikey: (process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY),
        Authorization: `Bearer ${token}`,
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

function queryValue(req: any, key: string) {
  const value = req.query?.[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function handler(req: any, res: any) {
  if (!rateLimit(req, res, 'api-weather.ts', 30)) return res.status(429).json({ error: 'Too many requests; please retry shortly.' });

  if (req.method !== 'GET') {
    res.setHeader?.('Allow', 'GET');
    return json(res, 405, { error: 'Method not allowed' });
  }

  const user = await authenticate(req);
  if (!user) return json(res, 401, { error: 'Authentication required' });

  const fieldId = String(queryValue(req, 'field_id') || '');
  if (!/^[0-9a-f-]{36}$/i.test(fieldId)) return json(res, 400, { error: 'field_id must be a UUID' });

  const fieldResponse = await fetch(
    `${(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL)}/rest/v1/fields?id=eq.${encodeURIComponent(fieldId)}&select=id,owner_id,center_lat,center_lng,boundary_geojson`,
    {
      headers: {
        apikey: (process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY)!,
        Authorization: `Bearer ${String(req.headers.authorization)}`,
      },
      signal: AbortSignal.timeout(8000),
    },
  );
  if (!fieldResponse.ok) return json(res, 502, { error: 'Unable to read field coordinates' });
  const rows = await fieldResponse.json();
  const field = rows?.[0];
  if (!field) return json(res, 404, { error: 'Field not found or not accessible' });

  const lat = Number(field.center_lat);
  const lng = Number(field.center_lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat === 0 && lng === 0) {
    return json(res, 409, { error: 'Field has no verified coordinates yet' });
  }

  const apiUrl = process.env.OPEN_METEO_API_URL || 'https://api.open-meteo.com/v1/forecast';
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    timezone: 'auto',
    forecast_days: '7',
    hourly: 'temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,wind_speed_10m,wind_gusts_10m,soil_moisture_0_to_1cm',
  });
  if (process.env.OPEN_METEO_API_KEY) params.set('apikey', process.env.OPEN_METEO_API_KEY);

  const weatherResponse = await fetch(`${apiUrl}?${params.toString()}`, {
    signal: AbortSignal.timeout(10000),
    headers: { Accept: 'application/json' },
  });
  if (!weatherResponse.ok) return json(res, 502, { error: 'Weather provider unavailable' });
  const payload = await weatherResponse.json();

  // Forecast availability and snapshot persistence are separate outcomes. Never
  // silently claim persistence when the optional server-side write is unavailable.
  let persistenceStatus: 'saved' | 'failed' | 'not_configured' = 'not_configured';
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const snapshotResponse = await fetch(`${(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL)}/rest/v1/weather_snapshots`, {
        method: 'POST',
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          field_id: field.id,
          provider: 'open-meteo',
          observed_at: new Date().toISOString(),
          payload,
        }),
        signal: AbortSignal.timeout(8000),
      });
      persistenceStatus = snapshotResponse.ok ? 'saved' : 'failed';
    } catch {
      persistenceStatus = 'failed';
    }
  }

  return json(res, 200, {
    provider: 'open-meteo',
    attribution: 'Weather data by Open-Meteo.com',
    field_id: field.id,
    latitude: lat,
    longitude: lng,
    fetched_at: new Date().toISOString(),
    persistence_status: persistenceStatus,
    forecast: payload,
  });
}
