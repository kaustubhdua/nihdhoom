import { useEffect, useMemo, useState } from 'react';
import { useAppLanguage } from '../../i18n/LanguageContext';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileCheck2,
  MapPin,
  PackageCheck,
  Route,
  ShieldCheck,
  Tractor,
  UserRound,
} from 'lucide-react';
import { Field, Machine } from '../../types';
import { supabase } from '../../lib/supabase';

type JobRecord = {
  id: string;
  booking_id: string;
  machine_id: string | null;
  operator_id: string | null;
  status: string;
  slot_start: string | null;
  slot_end: string | null;
  actual_arrived_at: string | null;
  actual_completed_at: string | null;
  failure_reason: string | null;
  last_transition_at: string | null;
  booking?: { field_id: string } | { field_id: string }[] | null;
};

type ProofRecord = {
  id: string;
  field_id: string;
  booking_id: string | null;
  kind: string;
  captured_at: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
};

type LotRecord = {
  id: string;
  field_id: string;
  quantity_tonnes: number | null;
  status: string;
  baled_at: string | null;
  assigned_buyer_id: string | null;
  quality_grade: string | null;
};

interface Props {
  fields: Field[];
  machines: Machine[];
  demoMode: boolean;
  onSelectField: (field: Field) => void;
  onOpenDispatch: () => void;
  onOpenResidue: () => void;
  onOpenImpact: () => void;
}

const stageFor = (field: Field, job?: JobRecord, lot?: LotRecord) => {
  if (field.status === 'VERIFIED_NON_BURN' || lot?.status === 'VERIFIED' || lot?.status === 'VERIFIED_NON_BURN') return 'VERIFIED';
  if (lot || field.residue_lot_id) return 'RESIDUE';
  if (job?.status === 'COMPLETED' || field.status === 'CLEARED_PENDING_AUDIT') return 'EVIDENCE';
  if (job?.status === 'BALING' || field.status === 'BALING_IN_PROGRESS') return 'BALING';
  if (job?.status === 'ARRIVED' || job?.status === 'ASSIGNED' || job?.status === 'DISPATCHED') return 'DISPATCH';
  if (field.status === 'BOOKED' || field.status === 'SCHEDULED') return 'SCHEDULED';
  return 'REGISTERED';
};

const journeyStages = ['REGISTERED', 'SCHEDULED', 'DISPATCH', 'BALING', 'EVIDENCE', 'VERIFIED', 'RESIDUE'] as const;

const stageClasses: Record<string, string> = {
  REGISTERED: '',
  SCHEDULED: 'is-sky',
  DISPATCH: 'is-sky',
  BALING: 'is-wheat',
  EVIDENCE: 'is-wheat',
  RESIDUE: 'is-ember',
  VERIFIED: 'is-green',
};

export function FieldJobBoard({
  fields,
  machines,
  demoMode,
  onSelectField,
  onOpenDispatch,
  onOpenResidue,
  onOpenImpact,
}: Props) {
  const { t } = useAppLanguage();
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [evidence, setProof] = useState<ProofRecord[]>([]);
  const [lots, setLots] = useState<LotRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'ALL' | 'ACTION' | 'READY'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (demoMode || !supabase) {
      setJobs([]);
      setProof([]);
      setLots([]);
      setError(null);
      return;
    }

    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      const db = supabase;
      if (!db) return;

      const [jobsResult, evidenceResult, lotsResult] = await Promise.all([
        db.from('jobs').select('id,booking_id,machine_id,operator_id,status,slot_start,slot_end,actual_arrived_at,actual_completed_at,failure_reason,last_transition_at,booking:bookings(field_id)').order('updated_at', { ascending: false }).limit(250),
        db.from('evidence_assets').select('id,field_id,booking_id,kind,captured_at,latitude,longitude,created_at').order('created_at', { ascending: false }).limit(500),
        db.from('residue_lots').select('id,field_id,quantity_tonnes,status,baled_at,assigned_buyer_id,quality_grade').order('created_at', { ascending: false }).limit(250),
      ]);

      if (!active) return;
      const firstError = jobsResult.error || evidenceResult.error || lotsResult.error;
      if (firstError) {
        setError(firstError.message);
      } else {
        setJobs((jobsResult.data || []) as unknown as JobRecord[]);
        setProof((evidenceResult.data || []) as ProofRecord[]);
        setLots((lotsResult.data || []) as LotRecord[]);
      }
      setLoading(false);
    };

    void load();
    return () => {
      active = false;
    };
  }, [demoMode]);

  const machineById = useMemo(() => new Map(machines.map((m) => [m.id, m])), [machines]);
  const jobByField = useMemo(() => {
    const map = new Map<string, JobRecord>();
    for (const job of jobs) {
      const booking = Array.isArray(job.booking) ? job.booking[0] : job.booking;
      const fieldId = booking?.field_id || fields.find((f) => f.job_id === job.id)?.id;
      if (fieldId && !map.has(fieldId)) map.set(fieldId, job);
    }
    return map;
  }, [fields, jobs]);

  const evidenceByField = useMemo(() => {
    const map = new Map<string, ProofRecord[]>();
    for (const item of evidence) {
      const current = map.get(item.field_id) || [];
      current.push(item);
      map.set(item.field_id, current);
    }
    return map;
  }, [evidence]);

  const lotByField = useMemo(() => {
    const map = new Map<string, LotRecord>();
    for (const lot of lots) {
      if (!map.has(lot.field_id)) map.set(lot.field_id, lot);
    }
    return map;
  }, [lots]);

  const rows = useMemo(() => fields.map((field) => {
    const liveFieldId = field.dbId || field.id;
    const job = jobByField.get(liveFieldId);
    const fieldProof = evidenceByField.get(liveFieldId) || [];
    const lot = lotByField.get(liveFieldId);
    const stage = stageFor(field, job, lot);
    const hasLocationProof = fieldProof.some((e) => e.latitude !== null && e.longitude !== null);
    const hasCompletionProof = fieldProof.some((e) => e.kind === 'field_photo' || e.kind === 'bale_photo' || e.kind === 'weighment');
    const action =
      stage === 'REGISTERED' ||
      (stage === 'SCHEDULED' && !job) ||
      (job?.status === 'FAILED' || job?.status === 'CANCELLED') ||
      (stage === 'EVIDENCE' && !hasCompletionProof) ||
      (stage === 'RESIDUE' && !lot?.assigned_buyer_id);

    const ready = stage === 'VERIFIED' && Boolean(lot?.assigned_buyer_id || field.residue_lot_id);
    const deadlineRisk = Boolean(
      job?.slot_end &&
      !['COMPLETED', 'CANCELLED', 'FAILED'].includes(job.status) &&
      new Date(job.slot_end).getTime() - Date.now() < 24 * 60 * 60 * 1000
    );

    return {
      field,
      job,
      fieldProof,
      lot,
      stage,
      hasLocationProof,
      hasCompletionProof,
      action,
      ready,
      deadlineRisk,
      machine: job?.machine_id ? machineById.get(job.machine_id) : (field.assigned_machine_id ? machineById.get(field.assigned_machine_id) : undefined),
    };
  }), [fields, jobByField, evidenceByField, lotByField, machineById]);

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const visibleRows = rows.filter((row) => {
    const matchesFilter = filter === 'ALL' || (filter === 'ACTION' ? row.action : row.ready);
    if (!matchesFilter) return false;
    if (!normalizedSearch) return true;
    const haystack = [
      row.field.khasra_no,
      row.field.village,
      row.field.id,
      row.machine?.name,
      row.machine?.operator_name,
      row.stage,
    ].filter(Boolean).join(' ').toLowerCase();
    return haystack.includes(normalizedSearch);
  });
  const actionCount = rows.filter((r) => r.action).length;
  const readyCount = rows.filter((r) => r.ready).length;
  const evidenceCount = rows.reduce((sum, r) => sum + r.fieldProof.length, 0);
  const lotCount = rows.filter((r) => r.lot).length;

  return (
    <div className="tone-adapt field-job-board farmer-surface farmer-fields ui-stack">
      <section className="ui-intro">
        <>
          <div className="ui-intro-copy">
            <div className="ui-eyebrow">
              <Activity className="h-4 w-4" /> My fields & pickup status
            </div>
            <h1 className="ui-title">{t('Your fields, pickup and parali status')}</h1>
            <p className="ui-lede">
              See what is happening to each field, what has been done, and what needs to happen next.
              This view surfaces the next operational action instead of only reporting totals.
            </p>
          </div>
          <div className="ui-actions">
            <button onClick={onOpenDispatch} className="ui-btn is-primary">
              <Route className="h-3.5 w-3.5" /> {t('Find machine')}
            </button>
            <button onClick={onOpenResidue} className="ui-btn is-wheat">
              <PackageCheck className="h-3.5 w-3.5" /> Parali
            </button>
            <button onClick={onOpenImpact} className="ui-btn is-ghost">
              <ShieldCheck className="h-3.5 w-3.5" /> {t('Why it matters')}
            </button>
          </div>
        </>
      </section>

      <section className="ui-stats">
        {[
          ['My fields', rows.length, ''],
          ['Needs action', actionCount, 'is-wheat'],
          ['Proof', evidenceCount, 'is-sky'],
          ['Parali lots', lotCount, 'is-ember'],
          ['Ready for buyer', readyCount, 'is-green'],
        ].map(([label, value, tone]) => (
          <div key={String(label)} className={`ui-stat ${tone}`}>
            <div className="ui-stat-label">{label}</div>
            <div className="ui-stat-value">{value}</div>
          </div>
        ))}
      </section>

      <section className="ui-stack">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <label className="ui-search w-full lg:max-w-sm">
            <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="sr-only">Search fields</span>
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search field, village or machine"
              
              type="search"
              autoComplete="off"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="ui-btn is-ghost is-sm"
                aria-label="Clear field search"
              >
                Clear
              </button>
            )}
          </label>
          <div className="flex flex-wrap items-center gap-3 lg:ml-auto">
          <div className="ui-seg" role="group" aria-label="Filter fields">
            {(['ALL', 'ACTION', 'READY'] as const).map((value) => (
              <button
                key={value}
                onClick={() => setFilter(value)}
                className={filter === value ? 'is-on' : ''}
                aria-pressed={filter === value}
              >
                {value === 'ALL' ? 'All fields' : value === 'ACTION' ? 'Needs your attention' : 'Ready for buyer'}
              </button>
            ))}
          </div>
          <div className="ui-chip">
            {loading && <Clock3 className="h-3.5 w-3.5 animate-spin" />}
            {demoMode ? 'Example data' : 'Live records'}
          </div>
          </div>
        </div>

        {error && (
          <div className="ui-note is-wheat">
            Live operational records could not be loaded: {error}
          </div>
        )}

        {visibleRows.length === 0 ? (
          <div className="ui-empty">
            {demoMode ? 'No synthetic fields match this filter.' : 'No authorized live field jobs match this filter.'}
          </div>
        ) : (
          <div className="grid gap-3">
            {visibleRows.map((row) => {
              const machine = row.machine;
              const latestProof = row.fieldProof[0];
              const deadline = row.field.clearance_deadline ? new Date(row.field.clearance_deadline).getTime() : 0;
              const deadlineRisk = deadline > 0 && deadline < Date.now() && row.stage !== 'VERIFIED';
              const stageTone = stageClasses[row.stage] || stageClasses.REGISTERED;

              return (
                <article key={row.field.id} className="ui-row-card">
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <button onClick={() => onSelectField(row.field)} className="ui-row-title">
                          {row.field.khasra_no || row.field.id}
                        </button>
                        <span className={`ui-chip ${stageTone}`}>{row.stage}</span>
                        {deadlineRisk && (
                          <span className="ui-chip is-ember">
                            <AlertTriangle className="h-3 w-3" /> Deadline risk
                          </span>
                        )}
                      </div>
                      <div className="field-journey" aria-label={`Field journey currently at ${row.stage}`}>
                        {journeyStages.map((step, index) => {
                          const currentIndex = journeyStages.indexOf(row.stage as typeof journeyStages[number]);
                          const complete = index <= currentIndex;
                          return <span key={step} className={complete ? 'is-complete' : ''}>
                            <i />
                            <b>{step === 'SCHEDULED' ? 'BOOKED' : step}</b>
                          </span>;
                        })}
                      </div>

                      <div className="ui-row-meta">
                        <span>{row.field.village || 'Village unknown'}</span>
                        <span>{Number(row.field.acreage || 0).toFixed(2)} acres</span>
                        <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {row.field.center.lat.toFixed(4)}, {row.field.center.lng.toFixed(4)}</span>
                      </div>
                    </div>

                    <div className="ui-kv-grid grid-cols-2">
                      <div className="ui-kv">
                        <div className="ui-kv-label">Machine</div>
                        <div className="ui-kv-value">
                          <Tractor /> {machine?.name || 'Unassigned'}
                        </div>
                      </div>
                      <div className="ui-kv">
                        <div className="ui-kv-label">Operator</div>
                        <div className="ui-kv-value">
                          <UserRound /> {machine?.operator_name || row.job?.operator_id || 'Unassigned'}
                        </div>
                      </div>
                      <div className="ui-kv">
                        <div className="ui-kv-label">Proof</div>
                        <div className="ui-kv-value">
                          {row.hasCompletionProof ? <CheckCircle2 /> : <FileCheck2 className="!text-[var(--faint)]" />}
                          {row.fieldProof.length} assets {row.hasLocationProof ? '· GPS' : ''}
                        </div>
                      </div>
                      <div className="ui-kv">
                        <div className="ui-kv-label">Parali</div>
                        <div className="ui-kv-value">
                          {row.lot ? `${Number(row.lot.quantity_tonnes || 0).toFixed(1)} t · ${row.lot.status}` : 'No lot'}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="ui-row-foot">
                    <div>
                      {row.job?.last_transition_at ? `Last transition ${new Date(row.job.last_transition_at).toLocaleString()}` : latestProof?.created_at ? `Proof received ${new Date(latestProof.created_at).toLocaleString()}` : 'No live transition/evidence timestamp available'}
                      {row.job?.failure_reason && <span className="ml-2 text-[var(--ember-ink)]">Failure: {row.job.failure_reason}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      {row.deadlineRisk && <span className="ui-chip is-ember">Deadline risk</span>}
                      {row.action && <span className="ui-chip is-wheat">Next step</span>}
                      {row.ready && <span className="ui-chip is-green"><CheckCircle2 /> Ready for buyer</span>}
                      <button onClick={() => onSelectField(row.field)} className="ui-btn is-sm">
                        {t('See field')}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <div className="ui-note">
        <ShieldCheck />
        Payment is not shown here because payments are not connected. Ready for buyer means operational records are sufficiently linked; settlement remains intentionally disabled.
      </div>
    </div>
  );
}
