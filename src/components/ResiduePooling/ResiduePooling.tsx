import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, Clock3, Layers3, Plus, Users, Leaf as LeafIcon } from 'lucide-react';
import { Field } from '../../types';
import { supabase } from '../../lib/supabase';

type Pool = { id: string; name: string; target_tonnes: number; current_tonnes: number; status: string; buyer_demand_id?: string | null };
type Demand = { id: string; buyer_name: string; target_tonnes: number; pickup_deadline: string; radius_km: number; status: string };
type SupplyLot = {
  id: string;
  field_id: string;
  quantity_tonnes: number | null;
  verified_quantity_tonnes?: number | null;
  moisture_pct: number | null;
  quality_grade?: string | null;
  residue_type?: string | null;
  ready_from?: string | null;
  pickup_deadline?: string | null;
  status: string;
  assigned_buyer_id?: string | null;
};
type BuyerOffer = { id: string; lot_id: string; price_per_tonne: number; quantity_tonnes: number; status: string };

interface Props { fields: Field[]; demoMode: boolean; }

export function ResiduePooling({ fields, demoMode }: Props) {
  const [pools, setPools] = useState<Pool[]>(() => {
    if (!demoMode || typeof window === 'undefined') return [];
    try { const raw = window.localStorage.getItem('nirdhoom.demo.pools.v1'); return raw ? (JSON.parse(raw) as Pool[]) : []; } catch { return []; }
  });
  const [demands, setDemands] = useState<Demand[]>([]);
  const [lots, setLots] = useState<SupplyLot[]>([]);
  const [offers, setOffers] = useState<BuyerOffer[]>([]);
  const [notice, setNotice] = useState('');
  const [poolQuantities, setPoolQuantities] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!demoMode || typeof window === 'undefined') return;
    try { window.localStorage.setItem('nirdhoom.demo.pools.v1', JSON.stringify(pools)); } catch { /* optional demo persistence */ }
  }, [demoMode, pools]);

  const localSupply = useMemo(() => {
    if (!demoMode && lots.length > 0) {
      return lots.map((lot) => {
        const field = fields.find((f) => (f.dbId || f.id) === lot.field_id);
        const lotOffer = offers
          .filter((offer) => offer.lot_id === lot.id && offer.status === 'OPEN')
          .sort((a, b) => b.price_per_tonne - a.price_per_tonne)[0];
        return {
          lotId: lot.id,
          fieldId: lot.field_id,
          farmer: field?.farmer_name || 'Farmer record',
          village: field?.village || 'Location not established',
          tonnes: Number(lot.verified_quantity_tonnes ?? lot.quantity_tonnes ?? 0),
          status: lot.status,
          moisture: lot.moisture_pct,
          quality: lot.quality_grade,
          readyFrom: lot.ready_from,
          pickupDeadline: lot.pickup_deadline,
          price: lotOffer?.price_per_tonne ?? null,
        };
      });
    }
    if (!demoMode) return [];
    return fields
      .map((f) => ({
        lotId: f.residue_lot_id || `planning-${f.id}`,
        fieldId: f.id,
        farmer: f.farmer_name,
        village: f.village,
        tonnes: Number(f.moisture_pct ? Math.max(0.1, f.acreage * 1.8) : Math.max(0.1, f.acreage * 1.8)),
        status: f.status,
        moisture: f.moisture_pct ?? null,
        quality: f.is_verified_non_burn ? 'Verified field' : null,
        readyFrom: f.expected_harvest_date,
        pickupDeadline: f.clearance_deadline,
        price: null,
      }));
  }, [demoMode, fields, lots, offers]);

  async function load() {
    if (demoMode || !supabase) return;
    const db = supabase as any;
    const [p, d, l, o] = await Promise.all([
      db.from('residue_pools').select('id,name,target_tonnes,current_tonnes,status,buyer_demand_id').order('created_at', { ascending: false }),
      db.from('buyer_demands').select('id,buyer_name,target_tonnes,pickup_deadline,radius_km,status').eq('status','OPEN').order('created_at', { ascending: false }),
      db.from('residue_lots').select('id,field_id,quantity_tonnes,verified_quantity_tonnes,moisture_pct,quality_grade,residue_type,ready_from,pickup_deadline,status,assigned_buyer_id').in('status',['AVAILABLE','VERIFIED','VERIFIED_NON_BURN']).order('created_at', { ascending: false }),
      db.from('buyer_offers').select('id,lot_id,price_per_tonne,quantity_tonnes,status').eq('status','OPEN').order('price_per_tonne', { ascending: false }),
    ]);
    if (!p.error) setPools(p.data || []);
    if (!d.error) setDemands(d.data || []);
    if (!l.error) setLots(l.data || []);
    if (!o.error) setOffers(o.data || []);
    const failed = [p, d, l, o].some((result) => Boolean(result.error));
    if (failed) setNotice('Some live marketplace records could not be loaded. Refresh or check database permissions before acting on this information.');
  }

  useEffect(() => { void load(); }, [demoMode]);

  function createDemoPool() {
    const total = localSupply.slice(0, 3).reduce((s, x) => s + x.tonnes, 0);
    setPools(prev => [{ id: `demo-${Date.now()}`, name: 'Demo procurement pool', target_tonnes: Math.max(20, total), current_tonnes: total, status: 'FILLING' }, ...prev]);
    setNotice('Demo pool created. Live mode uses the Supabase pooling workflow.');
  }

  async function createPoolFromDemand(demand: Demand) {
    if (demoMode || !supabase) { setNotice('Demo mode: buyer-demand pool creation is simulated.'); return; }
    const { data, error } = await (supabase as any).rpc('create_residue_pool', {
      p_name: `${demand.buyer_name} · ${demand.target_tonnes}t procurement pool`,
      p_target_tonnes: demand.target_tonnes,
      p_pickup_deadline: demand.pickup_deadline,
      p_buyer_demand_id: demand.id,
    });
    setNotice(error ? error.message : `Pool ${data?.id || ''} created from buyer demand.`);
    if (!error) await load();
  }

  async function joinPool(poolId: string, tonnes: number) {
    const pool = visiblePools.find((candidate) => candidate.id === poolId);
    const remaining = pool ? Math.max(0, pool.target_tonnes - pool.current_tonnes) : 0;
    if (!Number.isFinite(tonnes) || tonnes <= 0 || tonnes > remaining) {
      setNotice('Enter a positive quantity no greater than the pool quantity still needed.');
      return;
    }
    if (demoMode || !supabase) {
      setPools(prev => {
        const base = prev.length === 0 && pool?.id === 'demo-1' ? [pool] : prev;
        return base.map(p => {
          if (p.id !== poolId) return p;
          const current_tonnes = Math.min(p.target_tonnes, p.current_tonnes + tonnes);
          return { ...p, current_tonnes, status: current_tonnes >= p.target_tonnes ? 'READY' : 'FILLING' };
        });
      });
      setNotice(`Demo: committed ${tonnes.toFixed(1)} t to the pool. No sale or payment was executed.`);
      return;
    }
    const { error } = await (supabase as any).rpc('join_residue_pool', { p_pool_id: poolId, p_quantity_tonnes: tonnes });
    setNotice(error ? error.message : 'Residue committed to the pool.');
    if (!error) await load();
  }

  const visiblePools = demoMode && pools.length === 0
    ? [{ id: 'demo-1', name: 'Ludhiana buyer aggregation', target_tonnes: 80, current_tonnes: Math.min(80, localSupply.reduce((s, x) => s + x.tonnes, 0)), status: 'FILLING' }]
    : pools;

  return (
    <div className="farmer-surface farmer-market residue-pooling-surface space-y-5">
      <section className="market-hero-card">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div><div className="market-eyebrow"><Layers3 className="h-4 w-4" /> Residue-first marketplace</div><h1>Pool verified residue for offtake</h1><p>Pool fragmented, verified residue against buyer requirements before discussing impact or carbon value.</p></div>
          {demoMode && <button onClick={createDemoPool} className="market-primary-action"><Plus className="h-3.5 w-3.5" /> Create demo pool</button>}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="market-card">
          <div className="market-card-heading"><div><span className="market-card-kicker">FIELD</span><h2>Field-derived supply</h2></div><span className="market-count">{localSupply.length} lots</span></div>
          <div className="mt-3 space-y-2">
            {localSupply.length === 0 ? <div className="market-empty"><LeafIcon className="market-empty-icon" /><strong>No verified field supply yet</strong><p>Verified residue lots will appear here when they are ready for pooling.</p></div> : localSupply.map(s => (
              <div key={s.lotId} className="market-list-row market-supply-card">
                <div className="min-w-0">
                  <div className="market-row-title">{s.tonnes.toFixed(2)} t {s.quality ? `· ${s.quality}` : ''}</div>
                  <div className="market-row-meta">{s.village} · {s.status.replaceAll('_', ' ')}</div>
                  <div className="market-supply-meta">
                    <span>Moisture: {s.moisture !== null && s.moisture !== undefined ? `${s.moisture}%` : 'not verified'}</span>
                    <span>Pickup: {s.pickupDeadline ? new Date(s.pickupDeadline).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'not set'}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="market-tonnage">{s.price !== null ? `₹${s.price.toLocaleString('en-IN')}/t` : 'Price not established'}</div>
                  <div className="market-row-meta">{s.readyFrom ? `Ready ${new Date(s.readyFrom).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) }` : 'Readiness not established'}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="market-card market-card-demand">
          <div className="market-card-heading"><div><span className="market-card-kicker">BUYER</span><h2>Buyer demand</h2></div><span className="market-count">{demands.length} open</span></div>
          <div className="mt-3 space-y-2">
            {demands.length === 0 ? <div className="market-empty"><Users className="market-empty-icon" /><strong>No buyer demand published yet</strong><p>Open buyer requirements will appear here with quantity, pickup window and radius.</p></div> : demands.map(d => (
              <div key={d.id} className="market-demand-row">
                <div className="flex justify-between"><span className="market-row-title">{d.buyer_name}</span><span className="market-tonnage">{d.target_tonnes} t</span></div>
                <div className="market-row-meta">Pickup by {d.pickup_deadline} · radius {d.radius_km} km</div>
                <button onClick={() => void createPoolFromDemand(d)} className="market-secondary-action"><ArrowRight className="h-3 w-3" /> Create pool</button>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="market-card market-card-pools">
        <div className="market-card-heading"><div><span className="market-card-kicker">POOL</span><h2>Residue Supply & Deal Pools</h2></div><span className="market-count">{visiblePools.length} pools</span></div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {visiblePools.map(p => {
            const pct = Math.min(100, Math.round((p.current_tonnes / Math.max(1, p.target_tonnes)) * 100));
            const remaining = Math.max(0, p.target_tonnes - p.current_tonnes);
            const quantity = poolQuantities[p.id] ?? String(Math.min(1, remaining));
            return <div key={p.id} className="market-pool-card">
              <div className="flex justify-between"><span className="market-row-title">{p.name}</span><span className="market-status">{p.status}</span></div>
              <div className="market-progress"><div style={{ width: `${pct}%` }} /></div>
              <div className="market-progress-meta"><span>{p.current_tonnes.toFixed(1)} t pooled</span><span>{p.target_tonnes.toFixed(1)} t target</span></div>
              <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
                <label className="block text-sm font-medium" htmlFor={`pool-quantity-${p.id}`}>
                  Quantity to commit (tonnes)
                  <input id={`pool-quantity-${p.id}`} className="mt-1 w-full rounded-lg border border-emerald-900/20 bg-white px-3 py-2 text-base text-slate-900" type="number" inputMode="decimal" min="0.1" max={remaining} step="0.1" disabled={remaining <= 0} value={quantity} onChange={(event) => setPoolQuantities((previous) => ({ ...previous, [p.id]: event.target.value }))} />
                </label>
                <button disabled={remaining <= 0} onClick={() => void joinPool(p.id, Number(quantity))} className="market-secondary-action market-full-action disabled:cursor-not-allowed disabled:opacity-50"><CheckCircle2 className="h-3.5 w-3.5" /> {remaining <= 0 ? 'Pool full' : 'Join pool'}</button>
              </div>
            </div>;
          })}
        </div>
      </section>

      {notice && <div className="market-notice">{notice}</div>}
      <div className="market-footnote"><Clock3 className="h-3.5 w-3.5" /> Pooling locks only after quantity, quality, pickup window and buyer match are validated.</div>
    </div>
  );
}
