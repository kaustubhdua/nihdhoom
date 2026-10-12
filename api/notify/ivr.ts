import { rateLimit } from '../_lib/rateLimit.js';
declare const process: { env: Record<string, string | undefined> };

async function verifyDispatcher(req: any) {
  const authorization = String(req.headers?.authorization || '');
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!token || !((process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) || process.env.VITE_SUPABASE_URL) || !((process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY) || process.env.VITE_SUPABASE_PUBLISHABLE_KEY)) return false;
  try {
    const userResponse = await fetch(`${((process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) || process.env.VITE_SUPABASE_URL)}/auth/v1/user`, {
      headers: { apikey: ((process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY) || process.env.VITE_SUPABASE_PUBLISHABLE_KEY), Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!userResponse.ok) return false;
    const user = await userResponse.json();
    const profileResponse = await fetch(
      `${((process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) || process.env.VITE_SUPABASE_URL)}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=role`,
      { headers: { apikey: ((process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY) || process.env.VITE_SUPABASE_PUBLISHABLE_KEY), Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) },
    );
    if (!profileResponse.ok) return false;
    const profiles = await profileResponse.json();
    return ['dispatcher', 'admin'].includes(profiles?.[0]?.role);
  } catch { return false; }
}

function validPhone(value: unknown) {
  return typeof value === 'string' && /^\+?[1-9]\d{7,14}$/.test(value);
}

export default async function handler(req: any, res: any) {
  if (!rateLimit(req, res, 'api-ivr.ts', 10)) return res.status(429).json({ error: 'Too many IVR requests; please retry shortly.' });

  if (req.method !== 'POST') {
    res.setHeader?.('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!(await verifyDispatcher(req))) return res.status(401).json({ error: 'Authenticated dispatcher/admin required' });
  const url = process.env.IVR_WEBHOOK_URL;
  const token = process.env.IVR_PROVIDER_TOKEN;
  if (!url || !token) return res.status(503).json({ error: 'IVR provider adapter is not configured' });
  const { to, message, language = 'pa' } = req.body || {};
  if (!validPhone(to) || typeof message !== 'string' || !message.trim() || message.length > 2000 ||
      !['pa', 'hi', 'en'].includes(language)) {
    return res.status(400).json({ error: 'A valid phone, message (1–2000 characters), and supported language (pa/hi/en) are required' });
  }
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ to, message: message.trim(), language }),
      signal: AbortSignal.timeout(10000),
    });
    const data = await response.json().catch(() => ({}));
    return res.status(response.ok ? 200 : 502).json(response.ok
      ? { ok: true, provider_response: data }
      : { error: 'IVR provider rejected request' });
  } catch {
    return res.status(502).json({ error: 'IVR provider unavailable' });
  }
}
