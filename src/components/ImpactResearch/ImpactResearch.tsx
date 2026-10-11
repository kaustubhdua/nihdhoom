import { BarChart3, BookOpen, CheckCircle2, Database, Leaf, ShieldCheck, MapPin, FlaskConical, Clock } from 'lucide-react';
import { useAppLanguage } from '../../i18n/LanguageContext';
import { Field } from '../../types';

interface Props { fields: Field[]; demoMode: boolean; }

export function ImpactResearch({ fields, demoMode }: Props) {
  const { t } = useAppLanguage();
  const verified = fields.filter(f => f.status === 'VERIFIED_NON_BURN' || f.is_verified_non_burn);
  const acres = verified.reduce((s, f) => s + Number(f.acreage || 0), 0);
  const planningResidue = verified.reduce((s, f) => s + Number(f.acreage || 0) * 1.8, 0);
  const withGeometry = fields.filter(f => f.geometry?.length >= 3).length;
  const withHarvestDate = fields.filter(f => Boolean(f.expected_harvest_date)).length;
  const withMoisture = fields.filter(f => Number.isFinite(Number(f.moisture_pct))).length;
  const evidenceCoverage = fields.length ? Math.round((withGeometry / fields.length) * 100) : 0;

  const metrics = [
    ['Verified field area', (acres * 0.404686).toFixed(1), 'ha'],
    ['Planning residue estimate', planningResidue.toFixed(1), 't'],
    ['Geometry coverage', evidenceCoverage, '%'],
    ['Verified fields', verified.length, 'fields'],
  ];

  return <div className="tone-adapt farmer-surface farmer-impact impact-research-surface ui-stack">
    <section className="ui-intro"><div className="ui-intro-copy">
      <div className="ui-eyebrow"><BarChart3 className="h-4 w-4" /> {t('Impact + Research')}</div>
      <h1 className="ui-title">{t('Evidence-derived impact, not invented impact')}</h1>
      <p className="ui-lede">This workspace traces research-ready metrics back to field records. Planning coefficients remain separate from measured residue, verified outcomes and carbon claims.</p>
    </div></section>

    <section className="ui-stats">
      {metrics.map(([label, value, unit]) => <div key={String(label)} className="ui-stat is-green"><div className="ui-stat-label">{label}</div><div className="ui-stat-value">{value}<span className="ml-1.5 font-[family-name:var(--font-body)] text-[14px] font-semibold text-[var(--muted)]">{unit}</span></div></div>)}
    </section>

    <section className="ui-split">
      <div className="ui-card">
        <div className="ui-card-head">
          <div><div className="ui-card-title"><MapPin /><h2>{t('Field-to-impact ledger')}</h2></div><p className="ui-card-sub">{t('Operational stage and research readiness for each field record.')}</p></div>
          <span className="ui-chip">{fields.length} record(s)</span>
        </div>
        <div className="space-y-2.5">
          {fields.length === 0 ? <div className="ui-empty">{t('No field records are available for traceability.')}</div> : fields.slice(0, 12).map(field => {
            const stageOrder: Field['status'][] = ['REGISTERED','SCHEDULED','BALING_IN_PROGRESS','CLEARED_PENDING_AUDIT','VERIFIED_NON_BURN'];
            const idx = stageOrder.indexOf(field.status);
            const verifiedField = field.status === 'VERIFIED_NON_BURN' || field.is_verified_non_burn;
            const residue = Number(field.acreage || 0) * 1.8;
            return <div key={field.id} className="ui-kv !gap-0 !p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div><div className="text-[14.5px] font-bold text-[var(--ink)]">{field.farmer_name || ('Field ' + field.id.slice(0, 8))}</div><div className="text-[12px] text-[var(--muted)]">{field.village} · {field.khasra_no || 'Khasra not recorded'} · {Number(field.acreage || 0).toFixed(1)} ac</div></div>
                <span className={verifiedField ? 'ui-chip is-green' : 'ui-chip'}>{field.status}</span>
              </div>
              <div className="mt-3 grid grid-cols-5 gap-1.5">
                {stageOrder.map((stage, i) => <div key={stage} className={i <= idx ? 'h-1.5 rounded-full bg-[var(--brand)]' : 'h-1.5 rounded-full bg-[var(--sunken)]'} />)}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[12px]">
                <span className="mr-2 text-[var(--muted)]">Residue planning: <b className="text-[var(--ink)]">{residue.toFixed(1)} t</b></span>
                <span className={field.geometry?.length >= 3 ? 'ui-chip is-green' : 'ui-chip is-wheat'}>{field.geometry?.length >= 3 ? 'Geometry linked' : 'Geometry missing'}</span>
                <span className={field.expected_harvest_date ? 'ui-chip is-green' : 'ui-chip is-wheat'}>{field.expected_harvest_date ? 'Harvest date linked' : 'Harvest date missing'}</span>
                {verifiedField && <span className="ui-chip is-green">Verification state reached</span>}
              </div>
            </div>;
          })}
        </div>
      </div>

      <div className="ui-card lg:sticky lg:top-24">
        <div className="ui-card-title"><FlaskConical className="!text-[var(--sky)]" /><h2>{t('Research readiness')}</h2></div>
        <div className="mt-4 space-y-3">
          {[
            ['Geometry linked', withGeometry, fields.length],
            ['Harvest dates linked', withHarvestDate, fields.length],
            ['Moisture recorded', withMoisture, fields.length],
            ['Verified non-burn', verified.length, fields.length],
          ].map(([label, value, total]) => <div key={String(label)}><div className="flex items-center justify-between text-[13.5px]"><span className="text-[var(--ink-2)]">{label}</span><span className="font-semibold tabular-nums text-[var(--ink)]">{value}/{total}</span></div><div className="ui-progress mt-1.5"><div style={{ width: `${Number(total) ? Math.round((Number(value) / Number(total)) * 100) : 0}%` }} /></div></div>)}
        </div>
        <div className="ui-note is-wheat mt-5">A record can be operationally complete without being research-ready. Missing geometry, evidence, methodology or provenance blocks publication-grade impact claims.</div>
      </div>
    </section>

    <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div className="ui-card">
        <div className="ui-card-title"><Leaf /><h2>{t('Impact chain')}</h2></div>
        <div className="impact-chain mt-5">
          {['Field registered','Residue planning estimate','Machine job completed','Evidence captured','Verification review','Residue offtaken','Impact calculated'].map((x, i) => {
            const available = [fields.length > 0, fields.length > 0, fields.some(f => ['BALING_IN_PROGRESS','CLEARED_PENDING_AUDIT','VERIFIED_NON_BURN'].includes(f.status)), false, verified.length > 0, false, false][i];
            return <div key={x} className={`impact-chain-step ${available ? 'is-on' : ''}`}><span className="impact-chain-num">{i + 1}</span><span className="text-[14px] text-[var(--ink)]">{x}</span>{available ? <CheckCircle2 className="ml-auto h-[18px] w-[18px] text-[var(--brand)]" /> : <span className="ui-chip ml-auto">not established</span>}</div>;
          })}
        </div>
      </div>

      <div className="ui-card is-sky">
        <div className="ui-card-title"><BookOpen className="!text-[var(--sky)]" /><h2>{t('Methodology registry')}</h2></div>
        <div className="mt-5 space-y-3">
          <div className="method-entry"><div className="method-entry-title">Residue planning coefficient</div><p>Current UI planning factor: <span className="font-semibold text-[var(--ink)]">1.8 t/acre</span>. This is a prototype assumption, not a measured recovery factor or carbon accounting methodology.</p></div>
          <div className="method-entry"><div className="method-entry-title">Publication gate</div><p>Require source citation, version, effective date and calculation provenance before turning any coefficient into an institutional impact claim.</p></div>
          <div className="method-entry"><div className="method-entry-title">Data provenance</div><p>Trace metrics to field geometry, evidence assets, verification events, residue lots and buyer/offtake records.</p></div>
        </div>
      </div>
    </section>

    <div className="ui-note is-wheat"><Database /> {demoMode ? 'Demo mode: metrics are illustrative and are not production measurements.' : 'Live mode: metrics are limited to records currently available in Supabase.'} <Clock className="h-4 w-4 shrink-0 ml-auto" /><ShieldCheck className="h-4 w-4 shrink-0" /></div>
  </div>;
}
