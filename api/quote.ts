declare const process: { env: Record<string, string | undefined> };
import { rateLimit } from './_lib/rateLimit.js';

async function requireConfiguredAuth(req: any) {
  const auth = String(req.headers?.authorization || '');
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token || !(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) || !(process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY)) return false;
  try {
    const response = await fetch(`${(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL)}/auth/v1/user`, {
      headers: { apikey: (process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY), Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    });
    return response.ok;
  } catch { return false; }
}

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const isIsoDate = (value: unknown): value is string => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

export default async function handler(req: any, res: any) {
  if (!rateLimit(req, res, 'api-quote.ts', 60)) return res.status(429).json({ error: 'Too many requests; please retry shortly.' });

  if (req.method !== 'POST') {
    res.setHeader?.('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!(await requireConfiguredAuth(req))) return res.status(401).json({ error: 'Authentication required' });

  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ error: 'A JSON object is required' });
  }
  const field = body.field;
  if (!field || typeof field !== 'object' || Array.isArray(field)) {
    return res.status(400).json({ error: 'field is required' });
  }

  const acres = Number(field.acres);
  if (!Number.isFinite(acres) || acres <= 0 || acres > 10000) {
    return res.status(400).json({ error: 'field.acres must be between 0 and 10000' });
  }

  const rawDays = body.days_to_harvest;
  const days = rawDays === undefined || rawDays === null || rawDays === ''
    ? 14
    : Number(rawDays);
  if (!Number.isFinite(days) || days < 0 || days > 365) {
    return res.status(400).json({ error: 'days_to_harvest must be between 0 and 365' });
  }

  const requested = body.requested_date ?? '';
  if (requested !== '' && !isIsoDate(requested)) {
    return res.status(400).json({ error: 'requested_date must be a valid YYYY-MM-DD date' });
  }
  if (requested && requested < new Date().toISOString().slice(0, 10)) {
    return res.status(400).json({ error: 'requested_date cannot be in the past' });
  }

  const hasLat = field.lat !== undefined && field.lat !== null && field.lat !== '';
  const hasLng = field.lng !== undefined && field.lng !== null && field.lng !== '';
  const lat = Number(field.lat);
  const lng = Number(field.lng);
  if (hasLat !== hasLng || (hasLat && (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180))) {
    return res.status(400).json({ error: 'field coordinates must be a valid latitude/longitude pair' });
  }

  const harvestUrgency = days <= 3 ? 1.28 : days <= 7 ? 1.14 : days <= 14 ? 1.04 : 0.94;
  const dayPenalty = requested && new Date(`${requested}T00:00:00.000Z`).getUTCDay() === 0 ? 1.08 : 1;
  const distanceFactor = hasLat ? 1 : 1.05;
  const rate = Math.round(clamp(1500 * harvestUrgency * dayPenalty * distanceFactor, 1000, 3200) / 10) * 10;
  const planningDate = requested || new Date(Date.now() + 48 * 3600 * 1000).toISOString().slice(0, 10);
  const quotedAmount = Math.round(rate * acres * 100) / 100;
  // Keep the estimate compatible with the booking RPC's penalty <= quote invariant.
  const penalty = Math.round(Math.min(quotedAmount, Math.max(2500, acres * 2500)) * 100) / 100;

  return res.status(200).json({
    rate_per_acre: rate,
    quoted_amount: quotedAmount,
    guaranteed_by_date: planningDate,
    penalty_amount: 0,
    pricing_band: harvestUrgency >= 1.2 ? 'urgent' : harvestUrgency >= 1 ? 'standard' : 'early-booking',
    reason_codes: ['days_to_harvest', 'target_date', 'machine_capacity_window'],
    engine: 'nirdhoom-pricing-v1',
    quote_status: 'ESTIMATE_NOT_A_BOOKING',
  });
}
