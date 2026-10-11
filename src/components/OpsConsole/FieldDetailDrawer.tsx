import React from 'react';
import { Field } from '../../types';
import { 
  X, 
  MapPin, 
  User, 
  Calendar, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  QrCode, 
  Zap, 
  Droplet,
  ExternalLink
} from 'lucide-react';

interface FieldDetailDrawerProps {
  demoMode: boolean;
  field: Field | null;
  onClose: () => void;
  onTriggerUpiPayout: (field: Field) => void;
  onViewCertificate: (field: Field) => void;
}

export const FieldDetailDrawer: React.FC<FieldDetailDrawerProps> = ({
  demoMode,
  field,
  onClose,
  onTriggerUpiPayout,
  onViewCertificate,
}) => {
  if (!field) return null;

  const isCleared = field.status === 'CLEARED_PENDING_AUDIT' || field.status === 'VERIFIED_NON_BURN';

  return (
    <div className="tone-adapt ui-card relative fade-in">
      {/* Header with Close */}
      <div className="mb-4 flex items-start justify-between gap-3 border-b border-[var(--line)] pb-4">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--wheat-soft)] text-lg">
            🌾
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="ui-row-title">{field.khasra_no}</h4>
              <span className="ui-chip is-sky">
                {field.status.replace(/_/g, ' ')}
              </span>
            </div>
            <p className="mt-0.5 text-[13px] text-[var(--muted)]">
              {field.village}, Block {field.block}, District {field.district}
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="ui-btn is-sm !px-2"
          aria-label="Close field details"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Main Grid Info */}
      <div className="ui-kv-grid mb-4 grid-cols-2">
        <div className="ui-kv !flex-row items-center !gap-3">
          <img 
            src="/images/farmer_gurpreet.jpg" 
            alt={field.farmer_name} 
            className="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-[var(--brand-line)]"
           loading="lazy" decoding="async" />
          <div className="min-w-0">
            <span className="ui-kv-label block">Farmer / Owner</span>
            <strong className="ui-kv-value">{field.farmer_name}</strong>
            <span className="text-[12px] tabular-nums text-[var(--muted)]">{field.farmer_phone}</span>
          </div>
        </div>

        <div className="ui-kv">
          <span className="ui-kv-label">Acreage & Variety</span>
          <strong className="ui-kv-value">
            {field.acreage} Acres
          </strong>
          <span className="text-[12px] font-semibold text-[var(--wheat-ink)]">{field.paddy_variety}</span>
        </div>

        <div className="ui-kv">
          <span className="ui-kv-label">Clearance Window</span>
          <strong className="ui-kv-value !text-[var(--brand-ink)]">
            {field.clearance_deadline}
          </strong>
          <span className="text-[12px] text-[var(--muted)]">{demoMode ? 'Demo scheduling window' : 'Server-authorized booking window'}</span>
        </div>

        <div className="ui-kv">
          <span className="ui-kv-label">Late Sowing Penalty</span>
          <strong className="ui-kv-value !text-[var(--wheat-ink)]">
            {demoMode ? `₹${Math.max(2500, Math.round(field.acreage * 1250)).toLocaleString()}` : '—'}
          </strong>
          <span className="text-[12px] text-[var(--muted)]">{demoMode ? 'Simulation only' : 'Server-enforced booking terms'}</span>
        </div>
      </div>

      {/* Satellite Audit & QR Lot Status */}
      <div className="ui-note is-sky mb-4 flex-col !items-stretch sm:flex-row sm:!items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--surface)]">
            <ShieldCheck className="h-4 w-4 text-[var(--sky)]" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-1.5 font-semibold text-[var(--ink)]">
              <span>Remote-sensing audit:</span>
              <span className="text-[var(--brand-ink)]">{demoMode ? '0 synthetic fires' : 'Awaiting provider observations'}</span>
            </div>
            <div className="text-[12px] text-[var(--muted)]">
              {demoMode ? 'Illustrative FIRMS / NDVI values shown for the prototype' : 'No remote-sensing conclusion is shown until verified observations are attached'}
            </div>
          </div>
        </div>

        {field.qr_lot_code && (
          <div className="flex shrink-0 items-center gap-2 rounded-lg border border-[var(--sky-line)] bg-[var(--surface)] px-3 py-1.5">
            <QrCode className="h-4 w-4 text-[var(--sky)]" />
            <span className="font-mono text-[12.5px] font-semibold text-[var(--sky-ink)]">{field.qr_lot_code}</span>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-end gap-2.5">
        {demoMode ? (
          <button
            onClick={() => onViewCertificate(field)}
            className="ui-btn"
          >
            <ShieldCheck className="text-[var(--brand)]" />
            <span>View illustrative demo record</span>
          </button>
        ) : (
          <div className="ui-note is-sky !py-2" role="status">
            <ShieldCheck />
            <span>Production verification record unavailable until an authorized review issues one.</span>
          </div>
        )}

        {!isCleared && demoMode ? (
          <button
            onClick={() => onTriggerUpiPayout(field)}
            className="ui-btn is-primary"
          >
            <Zap className="w-4 h-4" />
            <span>Simulate field completion</span>
          </button>
        ) : isCleared && demoMode ? (
          <div className="ui-note is-green !py-2 font-semibold">
            <CheckCircle2 className="w-4 h-4" />
            <span>Demo completion recorded locally • no payment made</span>
          </div>
        ) : (
          <div className="ui-note is-sky !py-2">
            <ShieldCheck />
            <span>Live status changes require the authorized job-transition workflow.</span>
          </div>
        )}
      </div>
    </div>
  );
};
