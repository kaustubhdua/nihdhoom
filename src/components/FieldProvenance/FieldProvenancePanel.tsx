import { CircleHelp, MapPinned, UserCheck } from 'lucide-react';
import { useAppLanguage } from '../../i18n/LanguageContext';
import { Field, FieldProvenance, ProvenanceSource } from '../../types';

interface Props { fields: Field[]; demoMode: boolean; }

const labels: Record<ProvenanceSource, string> = {
  FARMER_DECLARATION: 'Farmer declaration',
  CADASTRAL_REFERENCE: 'Cadastral reference',
  GPS_OPERATOR: 'Operator GPS',
  SYSTEM_DERIVED: 'System-derived',
  UNKNOWN: 'Unknown',
};

const sourceClass = (source: ProvenanceSource) =>
  source === 'UNKNOWN'
    ? 'is-unknown'
    : source === 'SYSTEM_DERIVED'
      ? 'is-sky'
      : source === 'FARMER_DECLARATION'
        ? 'is-wheat'
        : 'is-green';

function resolveProvenance(field: Field): FieldProvenance {
  return field.provenance ?? {
    acreage: 'UNKNOWN',
    geometry: field.geometry?.length ? 'FARMER_DECLARATION' : 'UNKNOWN',
    khasra: field.khasra_no ? 'FARMER_DECLARATION' : 'UNKNOWN',
    crop: field.crop ? 'FARMER_DECLARATION' : 'UNKNOWN',
    harvest_date: field.expected_harvest_date ? 'FARMER_DECLARATION' : 'UNKNOWN',
    status: 'DECLARED',
  };
}

export function FieldProvenancePanel({ fields, demoMode }: Props) {
  const { t } = useAppLanguage();
  const mapped = fields.filter(f => resolveProvenance(f).status !== 'DECLARED').length;
  const verified = fields.filter(f => resolveProvenance(f).status === 'FIELD_VERIFIED').length;
  const unknown = fields.filter(f => Object.values(resolveProvenance(f)).includes('UNKNOWN')).length;

  return (
    <section className="tone-adapt ui-stack provenance-surface">
      <div className="ui-intro">
        <div className="ui-intro-copy">
          <div className="flex items-center gap-3">
            <MapPinned className="h-6 w-6 text-[var(--brand)]" />
            <h2 className="ui-title !mt-0">{t('{t('Field provenance & verification')}')}</h2>
          </div>
          <p className="ui-lede">Every operational field value should have a source before it is treated as authoritative.</p>
        </div>
        <span className="ui-chip is-wheat">{demoMode ? 'Synthetic records' : 'Live records'}</span>
      </div>
      <div className="ui-stats">
        <Metric label="Mapped+" value={mapped} tone="is-sky" />
        <Metric label="Field verified" value={verified} tone="is-green" />
        <Metric label="Needs source" value={unknown} tone="is-wheat" />
      </div>
      <div className="grid gap-3">
        {fields.slice(0, 8).map(field => {
          const p = resolveProvenance(field);
          return (
            <div key={field.id} className="ui-row-card">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="ui-row-title">{field.khasra_no || 'Field'} <span className="font-[family-name:var(--font-body)] text-[15px] font-normal text-[var(--muted)]">• {field.village}</span></div>
                  <div className="ui-row-meta mt-1">State: {p.status.replaceAll('_', ' ')}</div>
                </div>
                <span className="ui-chip is-sky">{p.verification_method || 'Source review pending'}</span>
              </div>
              <div className="provenance-matrix">
                {([
                  ['Acreage', p.acreage], ['Geometry', p.geometry], ['Khasra', p.khasra],
                  ['Crop', p.crop], ['Harvest date', p.harvest_date],
                ] as const).map(([name, source]) => (
                  <div key={name} className={`provenance-cell ${sourceClass(source)}`}>
                    <div className="ui-kv-label">{name}</div>
                    <div className="provenance-source"><i aria-hidden="true" />{labels[source]}</div>
                  </div>
                ))}
              </div>
              {p.verified_by && (
                <div className="mt-3 flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--brand-ink)]">
                  <UserCheck className="w-3 h-3" /> Verified by {p.verified_by}{p.verified_at ? ` • ${new Date(p.verified_at).toLocaleString()}` : ''}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="ui-note is-wheat">
        <CircleHelp />
        Unknown provenance is intentionally visible. It is not converted into a fake “verified” state.
      </div>
    </section>
  );
}

function Metric({ label, value, tone = '' }: { label: string; value: number; tone?: string }) {
  return <div className={`ui-stat ${tone}`}><div className="ui-stat-label">{label}</div><div className="ui-stat-value">{value}</div></div>;
}
