import React, { useEffect, useRef, useState } from 'react';
import { useAppLanguage } from '../../i18n/LanguageContext';
import { 
  CheckCircle2, 
  MapPin, 
  Wifi, 
  WifiOff, 
  QrCode, 
  Droplet, 
  Zap, 
  Navigation, 
  Phone, 
  User, 
  Sparkles,
  Layers,
  Clock
} from 'lucide-react';
import { Field, Machine } from '../../types';
import { supabase } from '../../lib/supabase';
import { queuedEvidenceCount, queueEvidence, registerEvidenceQueueReplay } from '../../lib/offlineEvidenceQueue';
import { validateEvidenceFile } from '../../lib/evidenceValidation';

interface BalerPWAProps {
  fields: Field[];
  activeMachine: Machine;
  demoMode: boolean;
  onJobCompleted: (fieldId: string, amount: number) => void;
}

export const BalerPWA: React.FC<BalerPWAProps> = ({
  fields,
  activeMachine,
  demoMode,
  onJobCompleted,
}) => {
  const { t } = useAppLanguage();
  const [selectedFieldId, setSelectedFieldId] = useState<string>(fields[0]?.id || 'FIELD-101');
  const [moistureValue, setMoistureValue] = useState<number>(14.2);
  const [balesCount, setBalesCount] = useState<number>(38);
  const [residueTonnes, setResidueTonnes] = useState<number>(0);
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const [jobBusy, setJobBusy] = useState(false);
  const [jobMessage, setJobMessage] = useState('');
  const [offlineSyncActive, setOfflineSyncActive] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const currentField = fields.find((f) => f.id === selectedFieldId) || fields[0];

  // Network state is independent of GPS permission and demo/live mode.
  useEffect(() => {
    const updateNetworkState = () => setOfflineSyncActive(navigator.onLine);
    updateNetworkState();
    window.addEventListener('online', updateNetworkState);
    window.addEventListener('offline', updateNetworkState);
    return () => {
      window.removeEventListener('online', updateNetworkState);
      window.removeEventListener('offline', updateNetworkState);
    };
  }, []);

  useEffect(() => {
    const client = supabase;
    if (demoMode || !client || typeof navigator === 'undefined' || !navigator.geolocation) return;
    let cancelled = false;

    const syncGps = async (position: GeolocationPosition) => {
      if (cancelled) return;
      const next = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
      };
      setGpsState({ ...next, recordedAt: position.timestamp || Date.now() });
      if (Date.now() - lastGpsWrite.current < 15000) return;
      lastGpsWrite.current = Date.now();

      const { data } = await client.auth.getSession();
      const user = data.session?.user;
      if (!user) return;

      await client.from('machine_locations').insert({
        machine_id: activeMachine.id,
        latitude: next.lat,
        longitude: next.lng,
        speed_kmh: Number.isFinite(position.coords.speed || NaN) ? Math.max(0, Number(position.coords.speed) * 3.6) : null,
        source: 'operator-pwa',
        recorded_at: new Date(position.timestamp).toISOString(),
      });
    };

    const watchId = navigator.geolocation.watchPosition(syncGps, () => setGpsState(null), {
      enableHighAccuracy: true,
      maximumAge: 10000,
      timeout: 15000,
    });
    return () => {
      cancelled = true;
      navigator.geolocation.clearWatch(watchId);
    };
  }, [activeMachine.id, demoMode]);

  useEffect(() => {
    if (demoMode) return;
    let dispose: (() => void) | undefined;
    void registerEvidenceQueueReplay().then((cleanup) => { dispose = cleanup; });
    const refresh = async () => setQueuedEvidence(await queuedEvidenceCount());
    void refresh();
    const timer = window.setInterval(refresh, 5000);
    return () => {
      if (dispose) dispose();
      window.clearInterval(timer);
    };
  }, [demoMode]);

  const handleEvidenceCapture = async (file: File) => {
    setEvidenceMessage('');
    const validationError = await validateEvidenceFile(file, file.name);
    if (validationError) {
      setEvidenceMessage(validationError);
      return;
    }
    const capturedAt = new Date().toISOString();
    const gps = gpsState;
    if (demoMode) {
      setEvidenceMessage('Demo photo captured locally; no evidence record was uploaded.');
      return;
    }

    const client = supabase;
    if (!client) {
      setEvidenceMessage('Live Supabase is not configured. Evidence was not uploaded.');
      return;
    }
    const { data } = await client.auth.getSession();
    const user = data.session?.user;
    if (!user) {
      setEvidenceMessage('Sign in as the assigned operator before uploading evidence.');
      return;
    }

    if (!navigator.onLine) {
      await queueEvidence({
        ownerUserId: user.id,
        fieldId: currentField.dbId || currentField.id,
        fileName: file.name,
        fileType: file.type,
        blob: file,
        capturedAt,
        latitude: gps?.lat ?? null,
        longitude: gps?.lng ?? null,
        accuracyM: gps?.accuracy ?? null,
      });
      setQueuedEvidence(await queuedEvidenceCount());
      setEvidenceMessage('Offline: evidence saved to the device queue and will sync when the connection returns.');
      return;
    }

    const id = crypto.randomUUID();
    const path = `${user.id}/${currentField.dbId || currentField.id}/${id}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const upload = await client.storage.from('evidence').upload(path, file, { contentType: file.type, upsert: false });
    if (upload.error) {
      await queueEvidence({
        ownerUserId: user.id,
        fieldId: currentField.dbId || currentField.id,
        fileName: file.name,
        fileType: file.type,
        blob: file,
        capturedAt,
        latitude: gps?.lat ?? null,
        longitude: gps?.lng ?? null,
        accuracyM: gps?.accuracy ?? null,
      });
      setQueuedEvidence(await queuedEvidenceCount());
      setEvidenceMessage(`Upload unavailable; evidence queued safely for replay. ${upload.error.message}`);
      return;
    }

    const bytes = await file.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const hash = Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
    const { error } = await client.from('evidence_assets').insert({
      field_id: currentField.dbId || currentField.id,
      kind: 'field_photo',
      storage_path: path,
      source: 'operator-pwa',
      captured_at: capturedAt,
      latitude: gps?.lat ?? null,
      longitude: gps?.lng ?? null,
      gps_accuracy_m: gps?.accuracy ?? null,
      sha256: hash,
      created_by: user.id,
      sync_source: 'online',
      metadata: { file_name: file.name, mime_type: file.type },
    });

    if (error) {
      await client.storage.from('evidence').remove([path]);
      setEvidenceMessage(`Evidence metadata could not be recorded: ${error.message}`);
      return;
    }
    setEvidenceMessage('Evidence uploaded, hashed and linked to the field record.');
  };

  const [gpsState, setGpsState] = useState<{ lat: number; lng: number; accuracy: number; recordedAt: number } | null>(null);
  const [evidenceMessage, setEvidenceMessage] = useState('');
  const [queuedEvidence, setQueuedEvidence] = useState(0);
  const lastGpsWrite = useRef(0);
  const [gpsNow, setGpsNow] = useState(() => Date.now());

  useEffect(() => {
    if (!gpsState) return;
    const timer = window.setInterval(() => setGpsNow(Date.now()), 5000);
    return () => window.clearInterval(timer);
  }, [gpsState?.recordedAt]);

  const gpsAgeSeconds = gpsState ? Math.max(0, Math.round((gpsNow - gpsState.recordedAt) / 1000)) : null;
  const gpsStale = gpsAgeSeconds !== null && gpsAgeSeconds > 60;

  useEffect(() => {
    const client = supabase;
    if (demoMode || !client || !currentField) return;
    let cancelled = false;
    const loadJob = async () => {
      const { data, error } = await client.from('jobs').select('id,status,booking_id').eq('field_id', currentField.dbId || currentField.id)
        .in('status', ['ASSIGNED', 'ARRIVED', 'BALING', 'PROOF_PENDING']).order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (!cancelled) setJobStatus(error ? null : String(data?.status || ''));
    };
    void loadJob();
    return () => { cancelled = true; };
  }, [currentField?.dbId, currentField?.id, demoMode]);

  const advanceLiveJob = async () => {
    const client = supabase;
    if (demoMode || !client || !currentField || jobBusy) return;
    const nextByStatus: Record<string, string> = { ASSIGNED: 'ARRIVED', ARRIVED: 'BALING', BALING: 'PROOF_PENDING', PROOF_PENDING: 'COMPLETED' };
    const next = jobStatus ? nextByStatus[jobStatus] : undefined;
    if (!next) { setJobMessage('No active server job is assigned to this field yet.'); return; }
    setJobBusy(true);
    setJobMessage('');
    try {
      const lookup = await client.from('jobs').select('id,status,booking_id,machine_id').eq('field_id', currentField.dbId || currentField.id)
        .eq('status', jobStatus).order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (lookup.error || !lookup.data?.id) throw new Error(lookup.error?.message || 'Active job not found.');
      const { error } = await client.rpc('transition_job', {
        p_job_id: lookup.data.id, p_next_status: next,
        p_metadata: { source: 'operator-pwa', field_id: currentField.dbId || currentField.id },
      });
      if (error) throw new Error(error.message);
      setJobStatus(next);
      if (next === 'COMPLETED') {
        const quantity = Number(residueTonnes);
        const { data: existingLot } = await client
          .from('residue_lots')
          .select('id')
          .eq('job_id', lookup.data.id)
          .maybeSingle();
        if (!existingLot && quantity > 0) {
          const { error: lotError } = await client.from('residue_lots').insert({
            field_id: currentField.dbId || currentField.id,
            booking_id: lookup.data.booking_id,
            job_id: lookup.data.id,
            farmer_id: currentField.farmer_id,
            crop: currentField.crop,
            residue_type: 'PADDY_STRAW',
            estimated_quantity_tonnes: quantity,
            quantity_tonnes: quantity,
            harvest_date: currentField.expected_harvest_date || null,
            ready_from: new Date().toISOString(),
            pickup_deadline: currentField.clearance_deadline || null,
            machine_id: lookup.data.machine_id || currentField.assigned_machine_id || null,
            geometry_provenance: {
              source: currentField.provenance?.geometry || 'UNKNOWN',
              field_id: currentField.dbId || currentField.id,
            },
            moisture_pct: Number(moistureValue),
            quality_notes: `Operator-recorded completion • ${balesCount} bales • GPS ${gpsState ? 'available' : 'not available'}`,
            quality_grade: moistureValue <= 16 ? 'DRY' : moistureValue <= 20 ? 'STANDARD' : 'HIGH_MOISTURE',
            status: 'AVAILABLE',
            baled_at: new Date().toISOString(),
            qr_code: `NIR-${lookup.data.id.slice(0, 12).toUpperCase()}`,
          });
          if (lotError) {
            setJobMessage(`Job completed, but the residue lot could not be recorded: ${lotError.message}`);
          } else {
            setJobMessage('Job completed and the measured residue lot was recorded. Verification and buyer matching remain separate steps.');
          }
        } else if (existingLot) {
          setJobMessage('Job completed. The residue lot for this job already exists.');
        } else {
          setJobMessage('Job completed, but no measured residue quantity was entered; create the lot after weighment.');
        }
        onJobCompleted(currentField.id, Number(currentField.payout_amount || 0));
      } else {
        setJobMessage(`Job moved to ${next.replace(/_/g, ' ')}.`);
      }
    } catch (error) {
      setJobMessage(error instanceof Error ? error.message : 'Job transition failed.');
    } finally { setJobBusy(false); }
  };

  const isJobFinished = currentField?.status === 'CLEARED_PENDING_AUDIT' || currentField?.status === 'VERIFIED_NON_BURN';

  if (!currentField) {
    return (
      <section className="tone-adapt field-empty mx-auto max-w-3xl" aria-live="polite">
        <h2>{t('No field is assigned to this operator session.')}</h2>
        <p>Live operator actions appear only after a field and job are assigned by the connected dispatch workflow.</p>
      </section>
    );
  }

  return (
    <div className="tone-adapt field-operator-surface grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_440px]">
      {/* Operator context */}
      <div className="flex w-full flex-col gap-4 lg:sticky lg:top-24">
        <div className="ui-card is-green">
          <div className="mb-2 flex items-center gap-3">
            <Sparkles className="h-6 w-6 shrink-0 text-[var(--brand)]" />
            <h3 className="ui-title !mt-0">
              {t('Field operator workspace')}
            </h3>
          </div>
          <p className="ui-lede">
            {t('Capture the job state, device location, measured residue and field evidence.')} 
          </p>
          <div className="ui-note mt-4 !bg-[var(--surface)] !text-[var(--ink-2)]">
            <strong>{t('The field workflow should capture GPS, job state, quantity and evidence. Payment remains intentionally disabled in this release.')}</strong>
          </div>
        </div>

        {/* Machine Telemetry Card */}
        <div className="ui-card flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--wheat-soft)] text-xl">🚜</span>
              <div>
                <h4 className="text-[15.5px] font-bold text-[var(--ink)]">{activeMachine.name}</h4>
                <p className="text-[12.5px] text-[var(--muted)]">{activeMachine.home_chc}</p>
              </div>
            </div>
            <span className="ui-chip is-green">
              {activeMachine.status}
            </span>
          </div>

          <div className="ui-kv-grid grid-cols-2">
            <div className="ui-kv">
              <span className="ui-kv-label">{t('Operator')}</span>
              <strong className="ui-kv-value">{activeMachine.operator_name}</strong>
              <span className="text-[12px] text-[var(--muted)]">{activeMachine.operator_phone}</span>
            </div>
            <div className="ui-kv">
              <span className="ui-kv-label">{t('Daily Capacity')}</span>
              <strong className="ui-kv-value !text-[var(--brand-ink)]">{activeMachine.capacity_acres_day} Acres / day</strong>
              <span className="text-[12px] text-[var(--muted)]">{t('CRM programme reference')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right side: Mobile Field Device UI */}
      <div className="flex w-full justify-center">
        <div className="device-frame">
          {/* Status Bar */}
          <div className="device-header">
            <span>{t('Operator session')}</span>
            <div className="device-notch"></div>
            <div className="flex items-center gap-1.5 text-xs">
              <Wifi className="w-3 h-3 text-emerald-400" />
              <span>{demoMode ? t('PWA Simulation') : t('PWA / device sync')}</span>
            </div>
          </div>

          {/* App Header */}
          <div className="bg-slate-900 p-3 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-sm">
                🚜
              </div>
              <div>
                <h4 className="font-bold text-sm text-white">{t('Nirdhoom Field Dispatch')}</h4>
                <span className="text-[10px] text-emerald-400 font-mono">
                  {t('GPS status')}: {gpsState ? t('Location available') : t('Waiting for device location')}
                </span>
              </div>
            </div>

            <div
              role="status"
              aria-live="polite"
              className={`flex items-center gap-1.5 px-2 py-1 rounded-full border text-[10px] font-semibold ${
                offlineSyncActive
                  ? 'bg-emerald-950/80 border-emerald-500/30 text-emerald-300'
                  : 'bg-amber-950/80 border-amber-500/40 text-amber-200'
              }`}
            >
              {offlineSyncActive
                ? <Wifi className="w-3 h-3" aria-hidden="true" />
                : <WifiOff className="w-3 h-3" aria-hidden="true" />}
              <span>{offlineSyncActive ? t('Online') : t('Offline — queued changes will sync later')}</span>
            </div>
          </div>

          {/* Field Job Selection Queue */}
          <div className="p-3 bg-slate-950 flex flex-col gap-3 min-h-[460px]">
            <div className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">
              {t('Assigned Field Queue for Today')}
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {fields.map((f) => {
                const isSelected = f.id === selectedFieldId;
                return (
                  <button
                    key={f.id}
                    onClick={() => setSelectedFieldId(f.id)}
                    className={`px-3 py-2 rounded-xl text-left border text-xs whitespace-nowrap transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-950/80 border-emerald-500 text-white shadow-md'
                        : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="font-bold">{f.khasra_no}</div>
                    <div className="text-[10px] text-slate-400">{f.village} • {f.acreage} ac</div>
                  </button>
                );
              })}
            </div>

            {/* Active Selected Job Card */}
            <div className="glass-panel p-3.5 border-emerald-500/30 flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-base text-white">{currentField.khasra_no}</span>
                    <span className="badge badge-emerald text-[9px]">
                      {currentField.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5">
                    {currentField.village}, Sangrur • {currentField.acreage} Acres
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block">{demoMode ? t('Demo quote') : t('Server quote')}</span>
                  <span className="text-base font-extrabold text-emerald-400 font-mono">
                    {demoMode ? `₹${Number(currentField.payout_amount || 0).toLocaleString()}` : (currentField.payout_amount ? `₹${Number(currentField.payout_amount).toLocaleString()}` : 'Server quote pending')}
                  </span>
                </div>
              </div>

              {/* Visual Machinery & Farmer Strip */}
              <div className="rounded-xl overflow-hidden border border-slate-800 relative bg-slate-900">
                <img 
                  src="/images/baling_fleet.jpg" 
                  alt="Baler working on the selected field" 
                  className="w-full h-24 object-cover object-center"
                 loading="lazy" decoding="async" />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
                <div className="absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <img 
                      src="/images/farmer_gurpreet.jpg" 
                      alt="Field operator / farmer record" 
                      className="w-7 h-7 rounded-full border border-emerald-400 object-cover"
                     loading="lazy" decoding="async" />
                    <span className="text-xs font-bold text-white drop-shadow">
                      {currentField.farmer_name}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/80 text-slate-950 font-extrabold">
                    {demoMode ? t('Demo assignment') : t('Live assignment')}
                  </span>
                </div>
              </div>

              {/* Farmer contact & Navigate buttons */}
              <div className="flex gap-2">
                <a
                  href={`tel:${currentField.farmer_phone}`}
                  className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 border border-slate-700"
                >
                  <Phone className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{t('Call Farmer')}</span>
                </a>
                <button
                  onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${currentField.center.lat},${currentField.center.lng}`, '_blank', 'noopener,noreferrer')}
                  className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  <span>{t('GPS Navigate')}</span>
                </button>
              </div>

              {/* In-field Quality Telemetry Inputs */}
              <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 flex flex-col gap-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Droplet className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{demoMode ? t('Demo moisture control:') : t('Moisture sensor:')}</span>
                  </span>
                  <strong className={`font-mono ${moistureValue > 20 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {moistureValue}% {moistureValue <= 20 ? t('Optimal') : t('High Moisture Alert!')}
                  </strong>
                </div>
                <input
                  type="range"
                  min="10"
                  max="25"
                  step="0.5"
                  value={moistureValue}
                  onChange={(e) => setMoistureValue(Number(e.target.value))}
                  disabled={!demoMode}
                  className="w-full accent-cyan-400 cursor-pointer"
                />

                <div className="flex justify-between items-center pt-1 border-t border-slate-800 text-[11px]">
                  <span className="text-slate-400">{demoMode ? t('Estimated straw yield:') : t('Straw quantity:')}</span>
                  <strong className="text-white font-mono">{balesCount} {t('Bales')} (~{Math.round(currentField.acreage * 2.2 * 10) / 10} Tonnes)</strong>
                </div>

                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <label className="text-slate-400" htmlFor="residue-tonnes">{t('Measured residue')}</label>
                  <div className="flex items-center gap-1">
                    <input
                      id="residue-tonnes"
                      type="number"
                      min="0"
                      step="0.1"
                      value={residueTonnes || ''}
                      onChange={(e) => setResidueTonnes(Number(e.target.value) || 0)}
                      disabled={demoMode}
                      placeholder={demoMode ? 'Demo' : '0.0'}
                      className="w-20 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-right text-xs font-mono text-white"
                      aria-label="Measured residue quantity in tonnes"
                    />
                    <span className="text-slate-500">t</span>
                  </div>
                </div>

                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-400">QR lot:</span>
                  <span className="font-mono text-cyan-300 font-bold flex items-center gap-1">
                    <QrCode className="w-3 h-3" />
                    {demoMode ? (currentField.qr_lot_code || 'DEMO-LOT') : (currentField.qr_lot_code || 'Not assigned')}
                  </span>
                </div>
              </div>

              <div className="rounded-lg border border-cyan-500/20 bg-cyan-950/10 p-3 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-cyan-200">Field evidence</span>
                  <span className={`text-[10px] font-semibold ${offlineSyncActive ? 'text-emerald-300' : 'text-amber-300'}`}>
                    {offlineSyncActive ? 'ONLINE' : 'OFFLINE QUEUE'}
                  </span>
                </div>
                <div className="mt-1 text-slate-400">
                  {gpsState ? `GPS ±${Math.round(gpsState.accuracy)}m • ${gpsStale ? `stale ${gpsAgeSeconds}s ago` : `updated ${gpsAgeSeconds}s ago`}` : demoMode ? 'Demo GPS' : 'Waiting for device GPS permission'}
                  {!demoMode && queuedEvidence > 0 && ` • ${queuedEvidence} queued`}
                </div>
                {!demoMode && gpsStale && (
                  <div role="status" className="mt-2 rounded-lg border border-amber-400/30 bg-amber-500/10 px-2.5 py-2 text-[11px] font-semibold text-amber-200">
                    GPS reading is stale. Keep location enabled and wait for a fresh device reading before treating the position as current.
                  </div>
                )}
                <label className="mt-2 flex cursor-pointer items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 font-bold text-cyan-200 hover:bg-cyan-500/20">
                  Capture field photo
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    capture="environment"
                    className="sr-only"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void handleEvidenceCapture(file);
                      event.currentTarget.value = '';
                    }}
                  />
                </label>
                {evidenceMessage && <p className="mt-2 text-[11px] text-slate-300">{evidenceMessage}</p>}
                {jobMessage && <p role="status" className="mt-2 text-[11px] text-slate-300">{jobMessage}</p>}
              </div>

              {/* Completion action: payment is never triggered from the browser */}
              {!isJobFinished ? (
                <button
                  onClick={() => {
                    void advanceLiveJob();
                  }}
                  disabled={jobBusy || (!demoMode && (!jobStatus || (jobStatus === 'PROOF_PENDING' && residueTonnes <= 0)))}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 text-white font-extrabold text-xs shadow-lg shadow-emerald-600/30 disabled:shadow-none flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
                >
                  <Zap className="w-4 h-4 fill-current text-amber-300" />
                  <span>{jobBusy ? 'Updating job…' : demoMode ? 'Complete demo field record' : jobStatus === 'PROOF_PENDING' && residueTonnes <= 0 ? 'Enter measured tonnes to complete' : jobStatus ? `Advance job: ${jobStatus.replace(/_/g, ' ')} →` : 'No active server job'}</span>
                </button>
              ) : (
                <div className="p-2.5 rounded-xl bg-emerald-950/70 border border-emerald-500/50 text-emerald-300 text-xs font-bold text-center flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>{demoMode ? 'Demo job completed locally • no payment made' : 'Live completion is controlled by the server workflow'}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
