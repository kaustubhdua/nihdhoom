import type { Field, Machine } from '../../types';
import { useAppLanguage } from '../../i18n/LanguageContext';

type Props = {
  field: Field;
  machine?: Machine | null;
  demoMode: boolean;
};

type JourneyState = 'done' | 'current' | 'pending';

type Step = {
  label: string;
  detail: string;
  state: JourneyState;
  source: string;
};

function statusState(field: Field, target: Field['status']): JourneyState {
  const order: Field['status'][] = [
    'REGISTERED',
    'BOOKED',
    'MACHINE_ASSIGNED',
    'ON_THE_WAY',
    'SCHEDULED',
    'BALING_IN_PROGRESS',
    'CLEARED_PENDING_AUDIT',
    'VERIFIED_NON_BURN',
  ];
  const current = order.indexOf(field.status);
  const wanted = order.indexOf(target);
  if (current > wanted) return 'done';
  if (current === wanted) return 'current';
  return 'pending';
}

function provenanceLabel(source?: string) {
  switch (source) {
    case 'CADASTRAL_REFERENCE': return 'Cadastral reference';
    case 'GPS_OPERATOR': return 'Operator GPS';
    case 'SYSTEM_DERIVED': return 'System-derived';
    case 'FARMER_DECLARATION': return 'Farmer declared';
    default: return 'Not established';
  }
}

export function ResidueLotJourney({ field, machine, demoMode }: Props) {
  const { t } = useAppLanguage();
  const provenance = field.provenance;
  const steps: Step[] = [
    {
      label: 'Field registered',
      detail: `${field.village || 'Field location'} · ${field.acreage || 0} acres`,
      state: 'done',
      source: provenanceLabel(provenance?.geometry),
    },
    {
      label: 'Pickup request',
      detail: field.status === 'REGISTERED' ? 'No pickup booking yet' : `Status: ${field.status.replaceAll('_', ' ').toLowerCase()}`,
      state: statusState(field, 'BOOKED'),
      source: 'NIRDHOOM workflow',
    },
    {
      label: 'Machine assignment',
      detail: machine ? `${machine.name} · ${machine.status.replaceAll('_', ' ').toLowerCase()}` : 'No machine assigned',
      state: statusState(field, 'MACHINE_ASSIGNED'),
      source: machine ? 'Operational machine record' : 'Not assigned',
    },
    {
      label: 'Field evidence',
      detail: field.is_verified_non_burn ? 'Verification outcome recorded' : 'Photos/GPS remain part of the field evidence workflow',
      state: statusState(field, 'CLEARED_PENDING_AUDIT'),
      source: field.is_verified_non_burn ? 'Verification record' : 'Operator evidence',
    },
    {
      label: 'Verified residue',
      detail: field.residue_lot_id ? `Residue lot ${field.residue_lot_id.slice(0, 8)}…` : 'Residue lot ID not available in this view',
      state: statusState(field, 'VERIFIED_NON_BURN'),
      source: field.residue_lot_id ? 'Residue lot record' : 'Not established',
    },
    {
      label: 'Buyer / offtake',
      detail: 'Buyer matching stays conditional until a real demand and counterparty exist',
      state: 'pending',
      source: 'Commercial workflow',
    },
  ];

  return (
    <section className="residue-journey-card" aria-labelledby="residue-journey-title">
      <div className="residue-journey-header">
        <div>
          <span className="residue-journey-kicker">FIELD → RESIDUE → MARKET</span>
          <h2 id="residue-journey-title">{t('Residue lot journey')}</h2>
          <p>
            One traceable story from the field to a potential buyer. External observations support the record; they do not replace it.
          </p>
        </div>
        <span className="residue-journey-mode">{demoMode ? 'Demo record' : 'Live record'}</span>
      </div>

      <div className="residue-journey-grid">
        {steps.map((step, index) => (
          <div key={step.label} className={`residue-journey-step is-${step.state}`}>
            <div className="residue-journey-marker" aria-hidden="true">
              {index + 1}
            </div>
            <div className="residue-journey-content">
              <div className="residue-journey-step-title">{step.label}</div>
              <div className="residue-journey-detail">{step.detail}</div>
              <span className="residue-journey-source">{step.source}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="residue-journey-trust">
        <div>
          <strong>Field boundary</strong>
          <span>{provenanceLabel(provenance?.geometry)}</span>
        </div>
        <div>
          <strong>Crop</strong>
          <span>{provenanceLabel(provenance?.crop)}</span>
        </div>
        <div>
          <strong>Harvest</strong>
          <span>{provenanceLabel(provenance?.harvest_date)}</span>
        </div>
        <div>
          <strong>Remote sensing</strong>
          <span>Supporting evidence only</span>
        </div>
      </div>
    </section>
  );
}
