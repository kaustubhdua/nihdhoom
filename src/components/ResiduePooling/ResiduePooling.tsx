import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, Clock3, Layers3, Plus, Users, Leaf as LeafIcon } from 'lucide-react';
import { Field } from '../../types';
import { supabase } from '../../lib/supabase';
import { useAppLanguage } from '../../i18n/LanguageContext';

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
type MatchableLot = { lot_id: string; residue_type: string; available_tonnes: number; moisture_pct: number | null; quality_grade: string | null; village: string; district: string; ready_from: string | null; pickup_deadline: string | null };
type TransportJob = { id: string; residue_lot_id: string; origin_type: string; destination_type: string; assigned_machine_id: string | null; status: string; planned_start: string | null; planned_arrival: string | null; actual_departure: string | null; actual_arrival: string | null; updated_at: string };

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
  const { t } = useAppLanguage();
  const [poolQuantities, setPoolQuantities] = useState<Record<string, string>>({});
  const [currentRole, setCurrentRole] = useState('');
  const [matchableLots, setMatchableLots] = useState<MatchableLot[]>([]);
  const [offerDrafts, setOfferDrafts] = useState<Record<string, { price: string; quantity: string }>>({});
  const [transportJobs, setTransportJobs] = useState<TransportJob[]>([]);
  const [dispatchMachines, setDispatchMachines] = useState<Array<{ id: string; name: string }>>([]);

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
          offerId: lotOffer?.id ?? null,
          offerQuantity: lotOffer?.quantity_tonnes ?? null,
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
        offerId: null,
        offerQuantity: null,
      }));
  }, [demoMode, fields, lots, offers]);

  async function load() {
    if (demoMode || !supabase) return;
    const db = supabase as any;
    const { data: userData } = await supabase.auth.getUser();
    const profileId = userData.user?.id;
    let role = '';
    if (profileId) {
      const { data: profile } = await db.from('profiles').select('role').eq('id', profileId).maybeSingle();
      role = String(profile?.role || '');
    }
    setCurrentRole(role);
    if (['buyer', 'dispatcher', 'admin'].includes(role)) {
      const { data: matched, error: matchError } = await db.rpc('matchable_residue_lots');
      if (!matchError) setMatchableLots(matched || []);
      else setNotice('Buyer matching is not available until the marketplace workflow migration is installed.');
    } else {
      setMatchableLots([]);
    }
    if (['dispatcher', 'admin'].includes(role)) {
      const { data: machines } = await db.from('machines').select('id,name').order('name');
      setDispatchMachines(machines || []);
    } else setDispatchMachines([]);

    const [p, d, l, o, j] = await Promise.all([
      db.from('residue_pools').select('id,name,target_tonnes,current_tonnes,status,buyer_demand_id').order('created_at', { ascending: false }),
      db.from('buyer_demands').select('id,buyer_name,target_tonnes,pickup_deadline,radius_km,status').eq('status','OPEN').order('created_at', { ascending: false }),
      db.from('residue_lots').select('id,field_id,quantity_tonnes,verified_quantity_tonnes,moisture_pct,quality_grade,residue_type,ready_from,pickup_deadline,status,assigned_buyer_id').in('status',['AVAILABLE','VERIFIED','VERIFIED_NON_BURN']).order('created_at', { ascending: false }),
      db.from('buyer_offers').select('id,lot_id,price_per_tonne,quantity_tonnes,status').eq('status','OPEN').order('price_per_tonne', { ascending: false }),
      db.from('residue_transport_jobs').select('id,residue_lot_id,origin_type,destination_type,assigned_machine_id,status,planned_start,planned_arrival,actual_departure,actual_arrival,updated_at').order('created_at', { ascending: false }).limit(100),
    ]);
    if (!p.error) setPools(p.data || []);
    if (!d.error) setDemands(d.data || []);
    if (!l.error) setLots(l.data || []);
    if (!o.error) setOffers(o.data || []);
    if (!j.error) setTransportJobs(j.data || []);
    const failed = [p, d, l, o, j].some((result) => Boolean(result.error));
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

  async function createBuyerOffer(lot: MatchableLot) {
    if (!supabase) return;
    const draft = offerDrafts[lot.lot_id] || { price: '', quantity: String(lot.available_tonnes) };
    const price = Number(draft.price);
    const quantity = Number(draft.quantity);
    if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(quantity) || quantity <= 0 || quantity > lot.available_tonnes) {
      setNotice('Enter a positive offer price and a quantity no greater than verified availability.');
      return;
    }
    const { data, error } = await (supabase as any).rpc('create_buyer_offer', {
      p_lot_id: lot.lot_id, p_price_per_tonne: price, p_quantity_tonnes: quantity,
      p_valid_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
    setNotice(error ? error.message : `Offer ${data?.id || ''} submitted. The farmer can review and accept it.`);
    if (!error) await load();
  }

  async function acceptOffer(offerId: string) {
    if (!supabase) return;
    const { error } = await (supabase as any).rpc('accept_buyer_offer', { p_offer_id: offerId });
    setNotice(error ? error.message : 'Offer accepted. A field-to-buyer transport job has been created.');
    if (!error) await load();
  }

  async function transitionTransport(job: TransportJob, nextStatus: string, machineId?: string) {
    if (!supabase) return;
    const { error } = await (supabase as any).rpc('transition_residue_transport_job', {
      p_job_id: job.id, p_next_status: nextStatus, p_machine_id: machineId || null,
    });
    setNotice(error ? error.message : `Transport status updated to ${nextStatus}.`);
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
          <div><div className="market-eyebrow"><Layers3 className="h-4 w-4" /> {t('Residue-first marketplace')}</div><h1>{t('Pool verified residue for offtake')}</h1><p>{t('Pool fragmented, verified residue against buyer requirements before discussing impact or carbon value.')}</p></div>
          {demoMode && <button onClick={createDemoPool} className="market-primary-action"><Plus className="h-3.5 w-3.5" /> {t('Create demo pool')}</button>}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="market-card">
          <div className="market-card-heading"><div><span className="market-card-kicker">FIELD</span><h2>{t('Field-derived supply')}</h2></div><span className="market-count">{localSupply.length} lots</span></div>
          <div className="mt-3 space-y-2">
            {localSupply.length === 0 ? <div className="market-empty"><LeafIcon className="market-empty-icon" /><strong>{t('No verified field supply yet')}</strong><p>{t('Verified residue lots will appear here when they are ready for pooling.')}</p></div> : localSupply.map(s => (
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
                  {currentRole === 'farmer' && s.offerId && <button onClick={() => void acceptOffer(s.offerId!)} className="market-secondary-action mt-2">{t('Accept buyer offer')} · {s.offerQuantity} t</button>}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="market-card market-card-demand">
          <div className="market-card-heading"><div><span className="market-card-kicker">BUYER</span><h2>{t('Buyer demand')}</h2></div><span className="market-count">{demands.length} open</span></div>
          <div className="mt-3 space-y-2">
            {demands.length === 0 ? <div className="market-empty"><Users className="market-empty-icon" /><strong>{t('No buyer demand published yet')}</strong><p>{t('Open buyer requirements will appear here with quantity, pickup window and radius.')}</p></div> : demands.map(d => (
              <div key={d.id} className="market-demand-row">
                <div className="flex justify-between"><span className="market-row-title">{d.buyer_name}</span><span className="market-tonnage">{d.target_tonnes} t</span></div>
                <div className="market-row-meta">Pickup by {d.pickup_deadline} · radius {d.radius_km} km</div>
                <button onClick={() => void createPoolFromDemand(d)} className="market-secondary-action"><ArrowRight className="h-3 w-3" /> {t('Create pool')}</button>
              </div>
            ))}
          </div>
        </section>
      </div>

      {['buyer', 'dispatcher', 'admin'].includes(currentRole) && (
        <section className="market-card">
          <div className="market-card-heading"><div><span className="market-card-kicker">{t('MATCH')}</span><h2>{t('Verified residue lots to match')}</h2></div><span className="market-count">{matchableLots.length}</span></div>
          {matchableLots.length === 0 ? <div className="market-empty">{t('No verified, available lots currently match this workspace.')}</div> : (
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {matchableLots.map((lot) => {
                const draft = offerDrafts[lot.lot_id] || { price: '', quantity: String(lot.available_tonnes) };
                return <div key={lot.lot_id} className="market-demand-row">
                  <div className="market-row-title">{lot.residue_type} · {Number(lot.available_tonnes).toFixed(2)} t</div>
                  <div className="market-row-meta">{lot.village}, {lot.district} · {lot.quality_grade || t('Quality not verified')}</div>
                  <div className="market-row-meta">{t('Moisture')}: {lot.moisture_pct == null ? t('not verified') : `${lot.moisture_pct}%`}</div>
                  {currentRole === 'buyer' ? <>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <label className="text-sm">{t('Offer price (₹/tonne)')}<input className="mt-1 w-full rounded-lg border px-3 py-2 text-base" type="number" min="1" step="1" value={draft.price} onChange={(event) => setOfferDrafts((prev) => ({ ...prev, [lot.lot_id]: { ...draft, price: event.target.value } }))} /></label>
                      <label className="text-sm">{t('Quantity (tonnes)')}<input className="mt-1 w-full rounded-lg border px-3 py-2 text-base" type="number" min="0.1" step="0.1" max={lot.available_tonnes} value={draft.quantity} onChange={(event) => setOfferDrafts((prev) => ({ ...prev, [lot.lot_id]: { ...draft, quantity: event.target.value } }))} /></label>
                    </div>
                    <button onClick={() => void createBuyerOffer(lot)} className="market-secondary-action mt-3">{t('Submit buyer offer')}</button>
                  </> : <div className="market-row-meta mt-3">{t('Operations view — only linked buyers can submit offers.')}</div>}
                </div>;
              })}
            </div>
          )}
        </section>
      )}

      <section className="market-card market-card-pools">
        <div className="market-card-heading"><div><span className="market-card-kicker">POOL</span><h2>{t('Residue Supply & Deal Pools')}</h2></div><span className="market-count">{visiblePools.length} pools</span></div>
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
                  {t('Quantity to commit (tonnes)')}
                  <input id={`pool-quantity-${p.id}`} className="mt-1 w-full rounded-lg border border-emerald-900/20 bg-white px-3 py-2 text-base text-slate-900" type="number" inputMode="decimal" min="0.1" max={remaining} step="0.1" disabled={remaining <= 0} value={quantity} onChange={(event) => setPoolQuantities((previous) => ({ ...previous, [p.id]: event.target.value }))} />
                </label>
                <button disabled={remaining <= 0} onClick={() => void joinPool(p.id, Number(quantity))} className="market-secondary-action market-full-action disabled:cursor-not-allowed disabled:opacity-50"><CheckCircle2 className="h-3.5 w-3.5" /> {remaining <= 0 ? '{t('Pool full')}' : '{t('Join pool')}'}</button>
              </div>
            </div>;
          })}
        </div>
      </section>

      {!demoMode && transportJobs.length > 0 && (
        <section className="market-card">
          <div className="market-card-heading"><div><span className="market-card-kicker">{t('COLLECTION & DELIVERY')}</span><h2>{t('Collection and delivery tracking')}</h2></div><span className="market-count">{transportJobs.length}</span></div>
          <div className="mt-3 space-y-3">
            {transportJobs.map((job) => (
              <div key={job.id} className="market-list-row">
                <div className="min-w-0 flex-1">
                  <div className="market-row-title">{t('Lot')} · {job.residue_lot_id.slice(0, 8)}…</div>
                  <div className="market-row-meta">{t('From field to buyer')} · {t(job.status)} · {job.assigned_machine_id ? `${t('Machine')} ${job.assigned_machine_id.slice(0, 8)}…` : t('Machine not assigned')}</div>
                  <div className="market-row-meta">{job.actual_departure ? `${t('Collected')}: ${new Date(job.actual_departure).toLocaleString('en-IN')}` : t('Awaiting collection')} {job.actual_arrival ? ` · ${t('Arrival')}: ${new Date(job.actual_arrival).toLocaleString('en-IN')}` : ''}</div>
                </div>
                {['dispatcher','admin'].includes(currentRole) && job.status === 'PROPOSED' && <div className="min-w-[180px]"><label className="text-xs">{t('Assign machine')}<select className="mt-1 w-full rounded-lg border px-2 py-2 text-sm" defaultValue="" id={`machine-${job.id}`}><option value="" disabled>{t('Choose machine')}</option>{dispatchMachines.map((machine) => <option key={machine.id} value={machine.id}>{machine.name || machine.id}</option>)}</select></label><button className="market-secondary-action mt-2" onClick={() => { const select = document.getElementById(`machine-${job.id}`) as HTMLSelectElement | null; if (select?.value) void transitionTransport(job, 'ASSIGNED', select.value); }}>{t('Assign')}</button></div>}
                {job.status === 'ASSIGNED' && ['operator','dispatcher','admin'].includes(currentRole) && <button className="market-secondary-action" onClick={() => void transitionTransport(job, 'EN_ROUTE')}>{t('Start collection')}</button>}
                {job.status === 'EN_ROUTE' && ['operator','dispatcher','admin'].includes(currentRole) && <button className="market-secondary-action" onClick={() => void transitionTransport(job, 'ARRIVED')}>{t('Mark arrived')}</button>}
                {job.status === 'ARRIVED' && ['operator','dispatcher','admin'].includes(currentRole) && <button className="market-secondary-action" onClick={() => void transitionTransport(job, 'DELIVERED')}>{t('Confirm delivery')}</button>}
              </div>
            ))}
          </div>
        </section>
      )}

      {notice && <div className="market-notice">{notice}</div>}
      <div className="market-footnote"><Clock3 className="h-3.5 w-3.5" /> {t('Pooling locks only after quantity, quality, pickup window and buyer match are validated.')}</div>
    </div>
  );
}
