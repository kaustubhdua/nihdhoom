import { useCallback, useEffect, useState } from 'react';
import { ActiveTab } from '../components/Header';
import { INITIAL_FIELDS, INITIAL_MACHINES, MOCK_FIRMS_FIRE_EVENTS } from '../data/mockData';
import { Field, Machine, BurnEvent, LatLng, ResidueLot, Buyer, StorageYard } from '../types';
import { supabase, supabaseConfigured } from '../lib/supabase';
import { normalizeField } from '../lib/domain';

const DEMO_MODE = import.meta.env.VITE_NIRDHOOM_DEMO_MODE === 'true';
const DEMO_STATE_KEY = 'nirdhoom.demo.state.v3';

type DemoState = { fields: Field[]; machines: Machine[]; fireEvents: BurnEvent[] };

const ROUTABLE_TABS: ActiveTab[] = [
  'OVERVIEW', 'FIELD_JOBS', 'FARMER_ONBOARDING', 'OPS_CONSOLE', 'RESIDUE_POOLS',
  'HARVEST_INTELLIGENCE', 'FIELD_PROVENANCE', 'SATELLITE_AUDIT', 'IMPACT_RESEARCH',
  'BALER_OPERATOR', 'FARMER_SURFACE', 'FARMER_KYC', 'OFFTAKE_AUCTION',
];

const tabToSlug = (tab: ActiveTab) => tab.toLowerCase().replace(/_/g, '-');

function tabFromLocation(): ActiveTab {
  if (typeof window === 'undefined') return 'OVERVIEW';
  const hashSlug = window.location.hash.replace(/^#\/?/, '').toLowerCase();
  const view = new URLSearchParams(window.location.search).get('view')?.toLowerCase() || '';
  const aliases: Record<string, ActiveTab> = {
    fields: 'FIELD_JOBS',
    booking: 'FARMER_ONBOARDING',
    tracking: 'OPS_CONSOLE',
    verification: 'SATELLITE_AUDIT',
    market: 'RESIDUE_POOLS',
    status: 'OVERVIEW',
  };
  if (aliases[view]) return aliases[view];
  return ROUTABLE_TABS.find((tab) => tabToSlug(tab) === hashSlug) ?? 'OVERVIEW';
}

export function useAppController() {
  const [activeTab, setActiveTab] = useState<ActiveTab>(tabFromLocation);

  // Keep the URL in sync so every workspace is linkable and the back button works.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const target = activeTab === 'OVERVIEW' ? '' : `#/${tabToSlug(activeTab)}`;
    const current = window.location.hash;
    if ((current === '' || current === '#' || current === '#/') && target === '') return;
    if (current !== target) {
      window.history.pushState(null, '', target || `${window.location.pathname}${window.location.search}`);
    }
  }, [activeTab]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onPop = () => setActiveTab(tabFromLocation());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const [demoSeed] = useState<DemoState>(() => {
    const fallback = { fields: INITIAL_FIELDS, machines: INITIAL_MACHINES, fireEvents: MOCK_FIRMS_FIRE_EVENTS };
    if (!DEMO_MODE || typeof window === 'undefined') return fallback;
    try {
      const raw = window.localStorage.getItem(DEMO_STATE_KEY);
      if (!raw) return fallback;
      const saved = JSON.parse(raw) as Partial<DemoState>;
      if (Array.isArray(saved.fields) && Array.isArray(saved.machines) && Array.isArray(saved.fireEvents)) {
        return saved as DemoState;
      }
    } catch {
      // Storage is optional; the seeded demo remains usable.
    }
    return fallback;
  });

  const [fields, setFields] = useState<Field[]>(DEMO_MODE ? demoSeed.fields : []);
  const [machines, setMachines] = useState<Machine[]>(DEMO_MODE ? demoSeed.machines : []);
  const [fireEvents, setFireEvents] = useState<BurnEvent[]>(DEMO_MODE ? demoSeed.fireEvents : []);
  const [residueLots, setResidueLots] = useState<ResidueLot[]>([]);
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [storageYards, setStorageYards] = useState<StorageYard[]>([]);
  const [selectedField, setSelectedField] = useState<Field | null>(DEMO_MODE ? demoSeed.fields[0] || null : null);
  const [loadingLiveData, setLoadingLiveData] = useState(!DEMO_MODE && Boolean(supabase));
  const [liveDataError, setLiveDataError] = useState<string | null>(null);
  const [liveSignedOut, setLiveSignedOut] = useState(false);
  const [activeRoutePolyline, setActiveRoutePolyline] = useState<LatLng[]>([]);
  const [certificateField, setCertificateField] = useState<Field | null>(null);

  useEffect(() => {
    if (!DEMO_MODE || typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(DEMO_STATE_KEY, JSON.stringify({ fields, machines, fireEvents }));
    } catch {
      // Some privacy modes disable localStorage; do not block the product.
    }
  }, [fields, machines, fireEvents]);

  const refreshLiveData = useCallback(async () => {
    if (DEMO_MODE || !supabase) {
      setLoadingLiveData(false);
      return;
    }
    setLoadingLiveData(true);
    setLiveDataError(null);
    try {
      const client = supabase;

    // Operational tables are readable only by signed-in users. Say so plainly
    // instead of surfacing a database "permission denied" to every visitor.
    const { data: sessionData } = await client.auth.getSession();
    if (!sessionData.session) {
      setLiveSignedOut(true);
      setFields([]);
      setMachines([]);
      setResidueLots([]);
      setBuyers([]);
      setStorageYards([]);
      setSelectedField(null);
      setLoadingLiveData(false);
      return;
    }
    setLiveSignedOut(false);

    const [{ data: fieldRows, error: fieldError }, { data: machineRows, error: machineError }] =
      await Promise.all([
        client.from('fields').select('id,external_id,owner_id,khasra_no,village,block,district,acreage,crop,variety,expected_harvest_date,clearance_deadline,status,moisture_pct,center_lat,center_lng,geometry,boundary_geojson,boundary_source,boundary_verified,geometry_area_acres'),
        client.from('machines').select('id,external_id,name,machine_type,owner_name,operator_name,operator_phone,status,capacity_acres_day,tractor_hp_required,residue_types,operating_conditions,capability_source,capability_source_date,fuel_pct,current_lat,current_lng,operator_user_id'),
      ]);

    if (fieldError || machineError) {
      setLiveDataError(fieldError?.message || machineError?.message || 'Unable to load live operational data');
      setFields([]);
      setMachines([]);
      setResidueLots([]);
      setBuyers([]);
      setStorageYards([]);
      setLoadingLiveData(false);
      return;
    }

    const [lotsResult, demandsResult, yardsResult] = await Promise.all([
      client.from('residue_lots').select('id,field_id,farmer_id,crop,residue_type,estimated_quantity_tonnes,quantity_tonnes,verified_quantity_tonnes,moisture_pct,quality_grade,quality_notes,bale_type,harvest_date,ready_from,pickup_deadline,machine_id,status,geometry_provenance,verification_source,verified_at,assigned_buyer_id,qr_code,baled_at,created_at'),
      client.from('buyer_demands').select('id,buyer_id,buyer_name,residue_type,target_tonnes,pickup_deadline,status'),
      client.from('storage_yards').select('id,external_id,name,latitude,longitude,capacity_tonnes,current_load_tonnes,incoming_tonnes,status,source'),
    ]);
    const { data: lotRows, error: lotError } = lotsResult;
    const { data: demandRows, error: demandError } = demandsResult;
    const { data: yardRows, error: yardError } = yardsResult;
    const secondaryErrors = [
      lotError && `residue lots: ${lotError.message}`,
      demandError && `buyer demand: ${demandError.message}`,
      yardError && `storage yards: ${yardError.message}`,
    ].filter(Boolean);
    if (secondaryErrors.length) {
      setLiveDataError(`Some live operational records could not be loaded (${secondaryErrors.join('; ')}). Available field and machine records remain visible; missing data is not treated as zero or verified.`);
    }

    const rows = fieldRows || [];
    const normalizedFields: Field[] = rows.map(normalizeField).map((f) => ({
      ...f,
      dbId: f.dbId,
      acreage: f.acres,
      farmer_id: String(rows.find((row) => row.id === f.dbId)?.owner_id || ''),
      farmer_name: '',
      farmer_phone: '',
      khasra_no: f.khasra,
      paddy_variety: (f.variety || 'PR-126') as Field['paddy_variety'],
      expected_harvest_date: f.harvest,
      clearance_deadline: f.deadline,
      status: f.status as Field['status'],
      center: { lat: f.lat, lng: f.lng },
      geometry: f.geometry || [],
      crop: 'Paddy',
    }));
    const normalizedMachines: Machine[] = (machineRows || []).map((m) => ({
      id: String(m.external_id || m.id),
      name: String(m.name || m.external_id || 'Machine'),
      type: String(m.machine_type || 'Round Baler (50 HP)') as Machine['type'],
      owner_type: 'CHC',
      owner_name: String(m.owner_name || ''),
      operator_name: String(m.operator_name || ''),
      operator_phone: String(m.operator_phone || ''),
      capacity_acres_day: Number(m.capacity_acres_day || 0),
      current_location: { lat: Number(m.current_lat || 0), lng: Number(m.current_lng || 0) },
      home_chc: '',
      status: String(m.status || 'IDLE') as Machine['status'],
      assigned_field_ids: [],
      battery_or_fuel_pct: Number(m.fuel_pct || 0),
    }));
    setFields(normalizedFields);
    setMachines(normalizedMachines);
    const normalizedLots: ResidueLot[] = (lotRows || []).map((lot) => ({
      id: String(lot.id),
      field_id: String(lot.field_id),
      farmer_id: String(lot.farmer_id),
      crop: String(lot.crop || 'Paddy'),
      residue_type: String(lot.residue_type || 'PADDY_STRAW'),
      estimated_quantity_tonnes: lot.estimated_quantity_tonnes == null ? null : Number(lot.estimated_quantity_tonnes),
      quantity_tonnes: lot.quantity_tonnes == null ? null : Number(lot.quantity_tonnes),
      verified_quantity_tonnes: lot.verified_quantity_tonnes == null ? null : Number(lot.verified_quantity_tonnes),
      moisture_pct: lot.moisture_pct == null ? null : Number(lot.moisture_pct),
      quality_grade: lot.quality_grade || null,
      quality_notes: lot.quality_notes || null,
      bale_type: lot.bale_type || null,
      harvest_date: lot.harvest_date || null,
      ready_from: lot.ready_from || null,
      pickup_deadline: lot.pickup_deadline || null,
      machine_id: lot.machine_id || null,
      status: String(lot.status || 'AVAILABLE'),
      geometry_provenance: lot.geometry_provenance || {},
      verification_source: lot.verification_source || null,
      verified_at: lot.verified_at || null,
      assigned_buyer_id: lot.assigned_buyer_id || null,
      qr_code: lot.qr_code || null,
      baled_at: lot.baled_at || null,
      created_at: lot.created_at || undefined,
    }));
    const normalizedBuyers: Buyer[] = (demandRows || []).map((d) => ({
      id: String(d.id),
      name: String(d.buyer_name || 'Buyer demand'),
      type: 'CBG',
      location_name: 'Connected buyer',
      price_per_tonne: 0,
      moisture_ceiling: 100,
      silica_tolerance: 'Not established',
      demand_tonnes: Number(d.target_tonnes || 0),
      margin_tier: 'MEDIUM',
      description: `Demand window through ${d.pickup_deadline || 'date not supplied'} • status ${d.status || 'OPEN'}`,
    }));
    const normalizedYards: StorageYard[] = (yardRows || []).map((y) => ({
      id: String(y.external_id || y.id),
      name: String(y.name || 'Storage yard'),
      location: { lat: Number(y.latitude || 0), lng: Number(y.longitude || 0) },
      capacity_tonnes: Number(y.capacity_tonnes || 0),
      current_load: Number(y.current_load_tonnes || 0),
      incoming_tonnes: Number(y.incoming_tonnes || 0),
      moisture_alert: false,
      status: String(y.status || 'AVAILABLE') as StorageYard['status'],
      provenance: 'LIVE_RECORD',
    }));
    setResidueLots(normalizedLots);
    setBuyers(normalizedBuyers);
    setStorageYards(normalizedYards);
    setFireEvents([]);
    setSelectedField((current) => normalizedFields.find((f) => f.id === current?.id) || normalizedFields[0] || null);
    setLoadingLiveData(false);
    } catch {
      setLiveDataError('Live operational data could not be loaded because the server was unreachable. Refresh and try again.');
      setLiveSignedOut(false);
      setFields([]);
      setMachines([]);
      setResidueLots([]);
      setBuyers([]);
      setStorageYards([]);
      setSelectedField(null);
    } finally {
      setLoadingLiveData(false);
    }
  }, []);

  useEffect(() => {
    if (DEMO_MODE || !supabase) {
      setLoadingLiveData(false);
      return;
    }
    let active = true;
    void refreshLiveData().finally(() => { if (!active) return; });
    const client = supabase;
    if (!client) return;
    // Reload records right after someone signs in or out. Deferred so the auth
    // callback itself never awaits another Supabase call.
    const { data: authSub } = client.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        window.setTimeout(() => { if (active) void refreshLiveData(); }, 0);
      }
    });
    const channel = client
      .channel('nirdhoom-live-operations', { config: { private: true } })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fields' }, () => { void refreshLiveData(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'machines' }, () => { void refreshLiveData(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => { void refreshLiveData(); })
      .subscribe();
    return () => {
      active = false;
      authSub.subscription.unsubscribe();
      void client.removeChannel(channel);
    };
  }, [refreshLiveData]);


  const handleUpdateFieldStatus = (
    fieldId: string,
    newStatus: Field['status'],
    payoutAmt?: number,
  ) => {
    setFields((prev) =>
      prev.map((field) =>
        field.id === fieldId
          ? {
              ...field,
              status: newStatus,
              payout_amount: payoutAmt ?? field.payout_amount,
              // Clearance is an operational milestone, not a verification decision.
              // Only the explicit verified state may set this flag.
              is_verified_non_burn: newStatus === 'VERIFIED_NON_BURN',
            }
          : field,
      ),
    );
  };

  return {
    residueLots,
    buyers,
    storageYards,
    demoMode: DEMO_MODE,
    loadingLiveData,
    liveDataError,
    liveSignedOut,
    liveConfigured: supabaseConfigured,
    activeTab,
    setActiveTab,
    fields,
    machines,
    fireEvents,
    selectedField,
    setSelectedField,
    activeRoutePolyline,
    setActiveRoutePolyline,
    certificateField,
    setCertificateField,
    handleUpdateFieldStatus,
    refreshLiveData,
  };
}
