import { rateLimit } from './_lib/rateLimit.js';
declare const process: { env: Record<string, string | undefined> };

async function authenticated(req: any) {
  const auth = String(req.headers?.authorization || '');
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token || !((process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) || process.env.VITE_SUPABASE_URL) || !((process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY) || process.env.VITE_SUPABASE_PUBLISHABLE_KEY)) return false;
  try {
    const response = await fetch(`${((process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) || process.env.VITE_SUPABASE_URL)}/auth/v1/user`, {
      headers: { apikey: ((process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY) || process.env.VITE_SUPABASE_PUBLISHABLE_KEY), Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export default async function handler(req: any, res: any) {
  if (!rateLimit(req, res, 'api-cadastral.ts', 30)) return res.status(429).json({ error: 'Too many cadastral requests; please retry shortly.' });

  if (req.method !== 'GET') {
    res.setHeader?.('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!(await authenticated(req))) return res.status(401).json({ error: 'Authentication required' });

  const q = (key: string) => {
    const value = req.query?.[key];
    return Array.isArray(value) ? value[0] : String(value || '');
  };
  const district = q('district');
  const tehsil = q('tehsil');
  const village = q('village');
  const khasra = q('khasra');

  if (!district || !village || !khasra) {
    return res.status(400).json({ error: 'district, village and khasra are required' });
  }

  return res.status(200).json({
    provider: 'punjab-bhunaksha',
    status: 'official-source-reference',
    district,
    tehsil: tehsil || null,
    village,
    khasra,
    sources: {
      cadastral_map: 'https://gisbhunaksha.punjab.gov.in/index.jsp',
      land_records: 'https://jamabandi.punjab.gov.in/CadastralMap.aspx',
    },
    automated_geometry: false,
    note: 'Punjab publishes cadastral viewing through BhuNaksha and Punjab Land Records. This adapter does not scrape or fabricate authoritative parcel geometry; automatic geometry ingestion requires an authorized service/export from the land-records authority.',
  });
}
