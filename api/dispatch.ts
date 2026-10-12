import { rateLimit } from './_lib/rateLimit.js';
declare const process: { env: Record<string, string | undefined> };

type Point = { id: string; lat: number; lng: number; acres?: number; deadline?: string };
type Machine = { id: string; lat: number; lng: number; capacity_acres_day: number; status?: string };

const validCoordinate = (p: any) =>
  p && Number.isFinite(Number(p.lat)) && Number(p.lat) >= -90 && Number(p.lat) <= 90 &&
  Number.isFinite(Number(p.lng)) && Number(p.lng) >= -180 && Number(p.lng) <= 180;

const km = (a: Point | Machine, b: Point | Machine) => {
  const R = 6371;
  const la1 = a.lat * Math.PI / 180, la2 = b.lat * Math.PI / 180;
  const dla = (b.lat - a.lat) * Math.PI / 180, dlo = (b.lng - a.lng) * Math.PI / 180;
  const h = Math.sin(dla / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dlo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(Math.min(1, h)));
};

function fallback(fields: Point[], machines: Machine[]) {
  const active = machines.filter(m => m.status !== 'OFFLINE');
  const routes = active.map(m => ({ machine_id: m.id, stops: [] as string[], total_acres: 0, status: 'PLANNED' }));
  const pending = [...fields].sort((a, b) => String(a.deadline || '').localeCompare(String(b.deadline || '')));
  const assigned = new Set<string>();

  for (const field of pending) {
    const candidates = routes
      .map(route => ({ route, machine: active.find(m => m.id === route.machine_id)! }))
      .filter(x => x.machine && x.route.total_acres + Number(field.acres || 0) <= x.machine.capacity_acres_day)
      .sort((a, b) => {
        const da = km(field, a.machine) + a.route.total_acres * 0.25;
        const db = km(field, b.machine) + b.route.total_acres * 0.25;
        return da - db;
      });
    const pick = candidates[0];
    if (pick) {
      pick.route.stops.push(field.id);
      pick.route.total_acres += Number(field.acres || 0);
      assigned.add(field.id);
    }
  }

  const totalDistance = routes.reduce((sum, route) => {
    const machine = active.find(m => m.id === route.machine_id);
    let previous: Point | Machine | undefined = machine;
    for (const id of route.stops) {
      const field = fields.find(f => f.id === id);
      if (field && previous) {
        sum += km(previous, field);
        previous = field;
      }
    }
    return sum;
  }, 0);

  return {
    engine: 'fallback-heuristic',
    routes,
    total_distance_km: Math.round(totalDistance * 10) / 10,
    unassigned_field_ids: fields.filter(f => !assigned.has(f.id)).map(f => f.id),
    warning: 'Heuristic plan only; verify travel time, deadlines, and machine availability before confirming.',
  };
}

function validSolverPlan(plan: any, fields: Point[], machines: Machine[]) {
  if (!plan || typeof plan !== 'object' || !Array.isArray(plan.routes) ||
      !Array.isArray(plan.unassigned) || plan.routes.length > machines.length) return false;
  const fieldIds = new Set(fields.map(f => f.id));
  const machineIds = new Set(machines.map(m => m.id));
  const seenFields = new Set<string>();
  const seenMachines = new Set<string>();
  for (const route of plan.routes) {
    if (!route || typeof route.machine_id !== 'string' || !machineIds.has(route.machine_id) ||
        seenMachines.has(route.machine_id) || !Array.isArray(route.stops) ||
        !Number.isFinite(Number(route.total_acres)) || Number(route.total_acres) < 0) return false;
    seenMachines.add(route.machine_id);
    let acres = 0;
    for (const id of route.stops) {
      if (typeof id !== 'string' || !fieldIds.has(id) || seenFields.has(id)) return false;
      seenFields.add(id);
      acres += Number(fields.find(f => f.id === id)?.acres || 0);
    }
    const machine = machines.find(m => m.id === route.machine_id)!;
    if (machine.status === 'OFFLINE') return false;
    if (acres > machine.capacity_acres_day || Number(route.total_acres) > machine.capacity_acres_day ||
        Math.abs(acres - Number(route.total_acres)) > 0.05) return false;
  }
  const unassigned = new Set<string>();
  for (const id of plan.unassigned) {
    if (typeof id !== 'string' || !fieldIds.has(id) || seenFields.has(id) || unassigned.has(id)) return false;
    unassigned.add(id);
  }
  return seenFields.size + unassigned.size === fieldIds.size;
}

async function verifyRole(req: any, roles: string[]) {
  const auth = String(req.headers?.authorization || '');
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token || !(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) || !(process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY)) {
    return { ok: false as const, status: 401, error: 'Authentication required' };
  }

  try {
    const userResponse = await fetch(`${(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL)}/auth/v1/user`, {
      headers: { apikey: (process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY), Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!userResponse.ok) return { ok: false as const, status: 401, error: 'Invalid session' };
    const user = await userResponse.json();
    const profileResponse = await fetch(
      `${(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL)}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=role`,
      {
        headers: { apikey: (process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY), Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!profileResponse.ok) return { ok: false as const, status: 503, error: 'Unable to verify operator role' };
    const rows = await profileResponse.json();
    return roles.includes(rows?.[0]?.role)
      ? { ok: true as const, user }
      : { ok: false as const, status: 403, error: 'Dispatcher/admin role required' };
  } catch {
    return { ok: false as const, status: 503, error: 'Authentication service unavailable' };
  }
}

export default async function handler(req: any, res: any) {
  if (!rateLimit(req, res, 'api-dispatch.ts', 20)) return res.status(429).json({ error: 'Too many dispatch requests; please retry shortly.' });

  if (req.method !== 'POST') {
    res.setHeader?.('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const auth = await verifyRole(req, ['dispatcher', 'admin']);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const body = req.body;
  res.setHeader?.('Cache-Control', 'no-store');
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ error: 'A JSON object is required' });
  }
  const { fields, machines } = body;
  if (!Array.isArray(fields) || !Array.isArray(machines) || fields.length > 500 || machines.length > 100) {
    return res.status(400).json({ error: 'fields (max 500) and machines (max 100) arrays are required' });
  }
  const fieldIds = new Set<string>();
  for (const field of fields) {
    if (!field || typeof field.id !== 'string' || !field.id.trim() || fieldIds.has(field.id) ||
      !validCoordinate(field) || !Number.isFinite(Number(field.acres)) || Number(field.acres) <= 0 ||
      Number(field.acres) > 10000) {
      return res.status(400).json({ error: 'Each field needs a unique id, valid coordinates, and acreage between 0 and 10000' });
    }
    fieldIds.add(field.id);
  }
  const machineIds = new Set<string>();
  for (const machine of machines) {
    if (!machine || typeof machine.id !== 'string' || !machine.id.trim() || machineIds.has(machine.id) ||
      !validCoordinate(machine) || !Number.isFinite(Number(machine.capacity_acres_day)) ||
      Number(machine.capacity_acres_day) <= 0 || Number(machine.capacity_acres_day) > 10000) {
      return res.status(400).json({ error: 'Each machine needs a unique id, valid coordinates, and positive daily capacity' });
    }
    machineIds.add(machine.id);
  }

  if (process.env.DISPATCH_SERVICE_URL && process.env.DISPATCH_SERVICE_TOKEN) {
    try {
      const response = await fetch(process.env.DISPATCH_SERVICE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(process.env.DISPATCH_SERVICE_TOKEN ? { Authorization: `Bearer ${process.env.DISPATCH_SERVICE_TOKEN}` } : {}) },
        body: JSON.stringify({ fields, machines }),
        signal: AbortSignal.timeout(15000),
      });
      if (response.ok) {
        const plan = await response.json();
        if (validSolverPlan(plan, fields, machines)) return res.status(200).json(plan);
        // Never expose malformed or internally inconsistent solver assignments.
      }
    } catch {
      // Fall back to the local planner, but clearly label its limitations.
    }
  }
  return res.status(200).json(fallback(fields, machines));
}