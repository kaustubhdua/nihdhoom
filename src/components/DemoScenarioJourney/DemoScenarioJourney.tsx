import { useEffect, useState } from 'react';
import { Activity, ArrowRight, CheckCircle2, ClipboardCheck, Factory, MapPin, RotateCcw, ShieldAlert, Tractor } from 'lucide-react';
import { useAppLanguage } from '../../i18n/LanguageContext';

type ScenarioStage = 'READY' | 'BOOKED' | 'ASSIGNED' | 'DISPATCHED' | 'ARRIVED' | 'EVIDENCE' | 'REVIEW_SUBMITTED' | 'LOT_CREATED' | 'BUYER_LEAD';
type ScenarioEvent = { stage: ScenarioStage; at: string; note: string };

const STORAGE_KEY = 'nirdhoom.demo.journey.v2';
const STEPS: { stage: ScenarioStage; title: string; detail: string; action: string; icon: typeof Activity }[] = [
  { stage: 'BOOKED', title: 'Clearance request', detail: 'A synthetic farmer requests a clearance slot for the scenario field.', action: 'Simulate booking', icon: ClipboardCheck },
  { stage: 'ASSIGNED', title: 'Operator assigned', detail: 'Assign the scenario machine and operator to this request.', action: 'Assign operator', icon: Tractor },
  { stage: 'DISPATCHED', title: 'Dispatch issued', detail: 'Create a simulated dispatch record and move the scenario to en route.', action: 'Dispatch machine', icon: ArrowRight },
  { stage: 'ARRIVED', title: 'Field arrival', detail: 'Record a simulated operator check-in. This is not a GPS-confirmed arrival.', action: 'Check in at field', icon: MapPin },
  { stage: 'EVIDENCE', title: 'Evidence captured', detail: 'Add a synthetic evidence event with a timestamp. No photograph is uploaded.', action: 'Record sample evidence', icon: Activity },
  { stage: 'REVIEW_SUBMITTED', title: 'Review submitted', detail: 'Submit a simulated review for human decision. This does not approve a field or issue a certificate.', action: 'Submit sample review', icon: CheckCircle2 },
  { stage: 'LOT_CREATED', title: 'Residue lot created', detail: 'Create a scenario lot from illustrative weighment data, not a real weighbridge reading.', action: 'Create sample lot', icon: Factory },
  { stage: 'BUYER_LEAD', title: 'Buyer lead matched', detail: 'Record a non-binding lead. No buyer has accepted an offer or signed a contract.', action: 'Match sample buyer lead', icon: Factory },
];

function loadEvents(): ScenarioEvent[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const valid: ScenarioEvent[] = [];
    for (const candidate of parsed) {
      if (!candidate || typeof candidate !== 'object') break;
      const event = candidate as Partial<ScenarioEvent>;
      const expected = STEPS[valid.length];
      if (!expected || event.stage !== expected.stage || typeof event.at !== 'string' || !Number.isFinite(Date.parse(event.at)) || event.note !== expected.detail) break;
      valid.push({ stage: expected.stage, at: event.at, note: expected.detail });
    }
    return valid;
  } catch {
    return [];
  }
}

export function DemoScenarioJourney({ onOpenMap }: { onOpenMap: () => void }) {
  const { t } = useAppLanguage();
  const [events, setEvents] = useState<ScenarioEvent[]>(loadEvents);
  const nextStep = STEPS[events.length];
  const completed = new Set(events.map((event) => event.stage));

  useEffect(() => {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(events)); } catch { /* Demo persistence is optional. */ }
  }, [events]);

  const advance = () => {
    const step = STEPS[events.length];
    if (!step) return;
    setEvents((current) => {
      if (current.length !== events.length || current.length >= STEPS.length) return current;
      const expected = STEPS[current.length];
      if (!expected || expected.stage !== step.stage) return current;
      return [...current, { stage: step.stage, at: new Date().toISOString(), note: step.detail }];
    });
  };

  const reset = () => setEvents([]);

  return (
    <section className="ui-card ui-stack" aria-labelledby="demo-journey-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="ui-eyebrow"><Activity className="h-4 w-4" /> {t('Interactive walkthrough')}</div>
          <h2 id="demo-journey-title" className="text-xl font-bold text-[var(--ink)]">{t('Follow one field from booking to buyer lead')}</h2>
          <p className="ui-card-sub mt-1">{t('Advance one synthetic scenario through the operational lifecycle. Progress is stored in this browser only.')}</p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-amber-500/40 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-950">
          <ShieldAlert className="h-4 w-4" /> {t('SIMULATION ONLY')}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-[var(--line)] p-3">
          <span className="text-xs text-[var(--muted)]">{t('Scenario farmer')}</span>
          <div className="mt-1 font-semibold text-[var(--ink)]">Scenario Farmer A</div>
          <div className="text-sm text-[var(--muted)]">Ubhawal · FIELD-101</div>
        </div>
        <div className="rounded-xl border border-[var(--line)] p-3">
          <span className="text-xs text-[var(--muted)]">{t('Assigned machine')}</span>
          <div className="mt-1 font-semibold text-[var(--ink)]">Scenario Baler 01</div>
          <div className="text-sm text-[var(--muted)]">Operator A · illustrative assignment</div>
        </div>
        <div className="rounded-xl border border-[var(--line)] p-3">
          <span className="text-xs text-[var(--muted)]">{t('Journey progress')}</span>
          <div className="mt-1 text-2xl font-black tabular-nums text-[var(--ink)]">{events.length}/{STEPS.length}</div>
          <div className="text-sm text-[var(--muted)]">{events.length === STEPS.length ? t('Scenario complete') : t('Steps completed')}</div>
        </div>
      </div>

      <ol className="grid gap-2">
        {STEPS.map((step, index) => {
          const done = completed.has(step.stage);
          const active = nextStep?.stage === step.stage;
          const Icon = step.icon;
          const event = events.find((item) => item.stage === step.stage);
          return (
            <li key={step.stage} className={`flex gap-3 rounded-xl border p-3 ${done ? 'border-emerald-500/40 bg-emerald-50/50' : active ? 'border-amber-500/50 bg-amber-50/40' : 'border-[var(--line)] opacity-75'}`}>
              <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${done ? 'bg-emerald-100 text-emerald-800' : 'bg-[var(--surface-soft)] text-[var(--muted)]'}`}>
                {done ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-[var(--muted)]">{String(index + 1).padStart(2, '0')}</span>
                  <h3 className="font-semibold text-[var(--ink)]">{t(step.title)}</h3>
                  {done && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-900">{t('SIMULATED')}</span>}
                </div>
                <p className="mt-1 text-sm text-[var(--muted)]">{t(step.detail)}</p>
                {event && <p className="mt-1 text-xs text-[var(--muted)]">Browser timestamp: {new Date(event.at).toLocaleString()} · not a trusted server timestamp</p>}
              </div>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button type="button" className="ui-btn is-primary" onClick={advance} disabled={!nextStep}>
          {nextStep ? t(nextStep.action) : t('Scenario complete')} {nextStep && <ArrowRight className="h-4 w-4" />}
        </button>
        <button type="button" className="ui-btn is-ghost" onClick={onOpenMap}>
          <MapPin className="h-4 w-4" /> {t('Explore scenario on map')}
        </button>
        <button type="button" className="ui-btn is-ghost" onClick={reset} disabled={events.length === 0}>
          <RotateCcw className="h-4 w-4" /> {t('Reset walkthrough')}
        </button>
      </div>
      <p className="text-xs leading-relaxed text-[var(--muted)]">
        {t('This is a local-only demonstration. It does not create real bookings, dispatches, GPS check-ins, uploaded evidence, approved verification, inventory movement, buyer offers, contracts, notifications or payments. No scenario event is sent to NIRDHOOM servers.')}
      </p>
    </section>
  );
}
