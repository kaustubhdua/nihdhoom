import { useMemo, useState } from 'react';
import { useAppLanguage } from '../../i18n/LanguageContext';
import {
  AlertTriangle, ArrowRight, CheckCircle2, Clock3, Factory, Gauge, MapPinned,
  Route, ShieldAlert, Store, Tractor, Warehouse
} from 'lucide-react';
import type { Buyer, Field, Machine, ResidueLot, StorageYard } from '../../types';
import { buildDemandCoverage, buildResidueSummary, harvestPressure, machineRecommendations, hoursUntil } from '../../lib/residueOperations';

interface Props {
  fields: Field[];
  machines: Machine[];
  buyers: Buyer[];
  storageYards: StorageYard[];
  residueLots?: ResidueLot[];
  demoMode: boolean;
  onSelectField: (field: Field) => void;
  onNavigate: (tab: string) => void;
}

const priorityClass = {
  CRITICAL: 'border-red-200 bg-red-50 text-red-800',
  HIGH: 'border-amber-200 bg-amber-50 text-amber-800',
  WATCH: 'border-blue-200 bg-blue-50 text-blue-800',
  NORMAL: 'border-slate-200 bg-slate-50 text-slate-700',
};

export function ResidueControlTower({
  fields, machines, buyers, storageYards, residueLots = [], demoMode, onSelectField, onNavigate,
}: Props) {
  const { t } = useAppLanguage();
  const [view, setView] = useState<'exceptions' | 'capacity' | 'demand'>('exceptions');
  const summary = useMemo(() => buildResidueSummary(fields, machines, buyers, storageYards, residueLots), [fields, machines, buyers, storageYards, residueLots]);
  const recommendations = useMemo(() => machineRecommendations(fields, machines), [fields, machines]);
  const demand = useMemo(() => buildDemandCoverage(buyers, residueLots), [buyers, residueLots]);
  const pressureFields = fields
    .map((field) => ({ field, pressure: harvestPressure(field) }))
    .filter(({ pressure }) => pressure !== 'NORMAL')
    .sort((a, b) => { const rank: Record<string, number> = { CRITICAL: 0, HIGH: 1, WATCH: 2, NORMAL: 3 }; return rank[a.pressure] - rank[b.pressure]; });

  return (
    <section className="field-page ui-stack" aria-labelledby="residue-control-tower-title">
      <div className="ui-stack">
        <div className="ui-intro">
          <div className="ui-intro-copy">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="ui-eyebrow">Residue operations</span>
              <span className="ui-chip">{demoMode ? 'Demo planning records' : 'Live connected records'}</span>
            </div>
            <h1 id="residue-control-tower-title" className="ui-title">{t('Residue Control Tower')}</h1>
            <p className="ui-lede">
              Coordinate field readiness, machine capacity, residue lots, yards and buyer demand. Planning estimates are labelled; verified weights and counterparties remain authoritative.
            </p>
          </div>
          <button type="button" onClick={() => onNavigate('RESIDUE_POOLS')} className="ui-btn is-primary">
            {t('Open residue network')} <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        <div className="ui-stats">
          {[
            { label: 'Ready / planned residue', value: `${summary.ready_tonnes} t`, icon: Gauge, note: 'planning estimate' },
            { label: 'Verified residue', value: `${summary.verified_tonnes} t`, icon: CheckCircle2, note: 'weighed records' },
            { label: 'Buyer demand', value: `${summary.demand_tonnes} t`, icon: Store, note: 'declared demand' },
            { label: 'Demand covered', value: `${summary.demand_coverage_pct}%`, icon: Route, note: 'verified ÷ demand' },
            { label: 'Fields at risk', value: String(summary.fields_at_risk), icon: ShieldAlert, note: 'next 48h / deadline' },
          ].map(({ label, value, icon: Icon, note }) => (
            <div key={label} className={`ui-stat ${label === 'Fields at risk' ? 'is-ember' : label === 'Buyer demand' || label === 'Demand covered' ? 'is-wheat' : 'is-green'}`}>
              <Icon className="mb-1 h-[18px] w-[18px] text-[var(--muted)]" />
              <div className="ui-stat-value">{value}</div>
              <div className="ui-stat-label !text-[var(--ink-2)]">{label}</div>
              <div className="ui-stat-note">{note}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
        <div className="ui-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="ui-eyebrow">Dispatcher queue</div>
              <h2 className="mt-1 font-[family-name:var(--font-display)] text-[22px] font-bold text-[var(--ink)]">{t('What needs attention now?')}</h2>
            </div>
            <div className="ui-seg">
              {[
                ['exceptions', 'Exceptions'],
                ['capacity', 'Machines'],
                ['demand', 'Demand'],
              ].map(([id, label]) => (
                <button key={id} type="button" onClick={() => setView(id as typeof view)} className={view === id ? 'is-on' : ''}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {view === 'exceptions' && (
            <div className="mt-4 space-y-2">
              {summary.exceptions.length === 0 ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm font-bold text-emerald-900">
                  No operational exceptions detected from the currently available records.
                </div>
              ) : summary.exceptions.map((item) => (
                <div key={item.id} className={`rounded-2xl border p-4 ${priorityClass[item.severity]}`}>
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <strong className="text-sm">{item.title}</strong>
                        <span className="rounded-full border border-current/15 px-2 py-0.5 text-[10px] font-black">{item.severity}</span>
                      </div>
                      <p className="mt-1 text-xs leading-5 opacity-80">{item.detail}</p>
                      <p className="mt-2 text-xs font-black">Next action: {item.action}</p>
                    </div>
                    {item.field_id && (
                      <button type="button" onClick={() => { const field = fields.find((f) => f.id === item.field_id); if (field) onSelectField(field); }} className="shrink-0 rounded-lg border border-current/20 px-3 py-2 text-[11px] font-black">
                        Open field
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {view === 'capacity' && (
            <div className="mt-4 space-y-3">
              {pressureFields.map(({ field, pressure }) => {
                const recommendation = recommendations.find((r) => r.field_id === field.id);
                const deadline = hoursUntil(field.clearance_deadline);
                return (
                  <button type="button" key={field.id} onClick={() => onSelectField(field)} className="block w-full rounded-2xl border border-slate-200 p-4 text-left transition hover:border-emerald-300 hover:bg-emerald-50/40">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2 py-1 text-[10px] font-black ${priorityClass[pressure]}`}>{pressure}</span>
                      <span className="text-xs font-black text-slate-500">{field.id}</span>
                      <span className="ml-auto text-xs font-bold text-slate-500">{deadline !== null ? `${Math.max(0, Math.round(deadline))}h to deadline` : 'deadline unavailable'}</span>
                    </div>
                    <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div><strong className="text-sm text-slate-950">{field.village} · {field.acreage} ac</strong><p className="text-xs text-slate-500">{field.status.replaceAll('_', ' ')}</p></div>
                      <div className="inline-flex items-center gap-2 text-xs font-black text-emerald-800">
                        <Tractor className="h-4 w-4" /> {recommendation ? `Recommend ${recommendation.machine_id}` : 'Capacity gap'}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {view === 'demand' && (
            <div className="mt-4 space-y-3">
              {demand.map((item) => (
                <div key={item.buyer_id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div><strong className="text-sm text-slate-950">{item.buyer_name}</strong><p className="text-xs text-slate-500">{item.required_tonnes.toFixed(0)} t required</p></div>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-800">{item.coverage_pct}% covered</span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-600" style={{ width: `${Math.min(100, item.coverage_pct)}%` }} /></div>
                  <div className="mt-2 flex justify-between text-[11px] text-slate-500"><span>Verified {item.verified_tonnes.toFixed(1)} t</span><span>{item.status}</span></div>
                </div>
              ))}
            </div>
          )}
        </div>

        <aside className="space-y-5">
          <div className="ui-card">
            <div className="ui-card-title"><Warehouse className="!text-[var(--wheat-ink)]" /><h2>{t('Yard capacity')}</h2></div>
            <div className="mt-4 space-y-3">
              {storageYards.map((yard) => {
                const ratio = yard.capacity_tonnes ? ((yard.current_load + Number(yard.incoming_tonnes || 0)) / yard.capacity_tonnes) * 100 : 0;
                return <div key={yard.id} className="rounded-2xl border border-slate-200 p-3">
                  <div className="flex items-center justify-between gap-2"><strong className="text-xs text-slate-800">{yard.name}</strong><span className={`text-[10px] font-black ${ratio >= 100 ? 'text-red-700' : ratio >= 80 ? 'text-amber-700' : 'text-emerald-700'}`}>{Math.round(ratio)}%</span></div>
                  <div className="mt-2 h-2 rounded-full bg-slate-100"><div className={`h-full rounded-full ${ratio >= 100 ? 'bg-red-500' : ratio >= 80 ? 'bg-amber-500' : 'bg-emerald-600'}`} style={{ width: `${Math.min(100, ratio)}%` }} /></div>
                  <div className="mt-2 flex justify-between text-[10px] text-slate-500"><span>{yard.current_load.toFixed(0)} t stored</span><span>{yard.capacity_tonnes.toFixed(0)} t cap</span></div>
                </div>;
              })}
            </div>
          </div>

          <div className="ui-card is-green">
            <div className="ui-card-title"><Factory /><h2>{t('48-hour operating rule')}</h2></div>
            <p className="mt-2 text-sm leading-6 text-emerald-950/75">Prioritize fields with a near deadline, assign compatible available capacity, weigh residue before buyer commitment, and divert incoming loads when a yard approaches 80% capacity.</p>
            <div className="mt-4 flex items-center gap-2 text-xs font-black text-emerald-900"><Clock3 className="h-4 w-4" /> Planning signal — confirm field and machine conditions on site.</div>
          </div>
        </aside>
      </div>
    </section>
  );
}
