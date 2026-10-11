import React, { useState } from 'react';
import { useAppLanguage } from '../../i18n/LanguageContext';
import { supabase } from '../../lib/supabase';
import { Field, BurnEvent } from '../../types';
import { executeFirmsAudit, generateNonBurnCertificate } from '../../utils/spatialVerification';
import { CarbonCertificate } from './CarbonCertificate';
import { EvidenceReview } from './EvidenceReview';
import { 
  Satellite, 
  ShieldCheck, 
  Flame, 
  CheckCircle2, 
  Award, 
  FileText, 
  Sparkles, 
  AlertCircle,
  ExternalLink,
  Layers
} from 'lucide-react';

interface SatelliteAuditProps {
  fields: Field[];
  demoMode: boolean;
  fireEvents: BurnEvent[];
  onVerified?: (fieldId: string) => void;
}

export const SatelliteAudit: React.FC<SatelliteAuditProps> = ({
  fields,
  demoMode,
  fireEvents,
  onVerified,
}) => {
  const { t } = useAppLanguage();
  const auditReport = executeFirmsAudit(fields, fireEvents);
  const [selectedFieldForCert, setSelectedFieldForCert] = useState<Field | null>(null);
  const [reviewingFieldId, setReviewingFieldId] = useState<string | null>(null);
  const [reviewMessage, setReviewMessage] = useState('');
  const [reviewFocus, setReviewFocus] = useState<{ id: string; nonce: number } | null>(null);

  const handleVerify = async (field: Field) => {
    setReviewingFieldId(field.id);
    setReviewMessage('');
    try {
      if (demoMode) {
        setReviewMessage(`Simulated review note recorded for ${field.khasra_no}. Field status is unchanged; no certificate or payment claim was issued.`);
        return;
      }
      if (!supabase) throw new Error('Live Supabase is not configured.');
      // The UI has no validated confidence model and cannot independently prove
      // non-burning. Persist a review-required event; only a separate authorized
      // evidence workflow may mark the field VERIFIED_NON_BURN.
      const { error } = await supabase.rpc('record_verification_review', {
        p_field_id: field.dbId || field.id,
        p_result: 'REVIEW_REQUIRED',
        p_confidence: 0,
        p_metadata: {
          source: 'nirdhoom-review-console',
          observation_mode: auditReport.dataAvailability,
          decision_basis: 'manual_review_required_no_validated_confidence_model',
          client_reported_confidence: null,
        },
      });
      if (error) throw new Error(error.message);
      setReviewMessage(`Review-required event recorded for ${field.khasra_no}. Field status is unchanged pending an authorized evidence-based decision.`);
    } catch (error) {
      setReviewMessage(error instanceof Error ? error.message : 'Verification review failed.');
    } finally {
      setReviewingFieldId(null);
    }
  };

  const handleOpenRecord = (fieldId: string) => {
    const f = fields.find((item) => item.id === fieldId);
    if (f) {
      setSelectedFieldForCert(f);
    }
  };

  return (
    <div className="tone-adapt farmer-surface farmer-verification ui-stack">
      {/* Top Banner: The Money Shot Pitch Framing */}
      <div className="ui-card is-flush">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5 p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[var(--sky-soft)] text-[var(--sky)]">
              <Satellite className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-[family-name:var(--font-display)] text-[24px] font-bold leading-tight text-[var(--ink)]">
                  {t('Check field proof')}
                </h3>
                <span className="ui-chip is-green">
                  {demoMode ? 'Synthetic observation demo' : auditReport.dataAvailability === 'NO_OBSERVATIONS' ? 'Awaiting observations' : 'Observation review'}
                </span>
              </div>
              <p className="ui-card-sub max-w-2xl !text-[14px]">
                We intersect registered field polygons with available remote-sensing observations and operational evidence. A missing detection is not absolute proof of no burning, and impact or registry claims remain gated by methodology and verification.
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-4 rounded-2xl border border-[var(--brand-line)] bg-[var(--brand-soft)] px-5 py-4">
            <div>
              <span className="ui-kv-label block">{t('Fields in this review')}</span>
              <div className="font-[family-name:var(--font-display)] text-[34px] font-bold leading-none text-[var(--brand-ink)]">
                {auditReport.totalFieldsAudited}
              </div>
            </div>
            <Satellite className="w-8 h-8 text-[var(--brand)]" />
          </div>
        </div>

        {/* Remote-sensing evidence context */}
        <div className="tone-native relative max-h-64 overflow-hidden bg-slate-950">
          <img 
            src="/images/satellite_firms.jpg" 
            alt="Remote-sensing evidence illustration"
            className="w-full h-64 object-cover object-center"
           loading="lazy" decoding="async" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
          <div className="absolute bottom-4 left-5 right-5 flex items-end justify-between gap-4">
            <div>
              <span className="rounded-md border border-white/20 bg-white/10 px-2 py-1 font-mono text-[11px] font-semibold text-amber-200 backdrop-blur">
                {t('FIRMS / VIIRS thermal observations')}
              </span>
              <p className="mt-2 text-[15px] font-semibold text-white">
                {auditReport.dataAvailability === 'NO_OBSERVATIONS' ? 'No remote-sensing observations are currently available for field screening' : `${auditReport.cleanFieldsCount} field(s) have no fire point matched in supplied observations; this is not proof of no burning`}
              </p>
            </div>
            <div className="text-right hidden sm:block">
              <span className="block font-mono text-xs font-bold text-amber-200">{demoMode ? 'Synthetic demo only' : auditReport.dataAvailability === 'NO_OBSERVATIONS' ? 'No observations available' : 'Supporting evidence only'}</span>
              <span className="text-[11px] text-white/70">{t('No registry issuance or retirement')}</span>
            </div>
          </div>
        </div>
      </div>

      <section className="evidence-language" aria-label="Evidence language">
        <div><b>Observed</b><span>{t('What the system actually saw')}</span></div>
        <div><b>Verified</b><span>{t('What an authorized review confirmed')}</span></div>
        <div><b>Calculated</b><span>Derived from recorded inputs</span></div>
        <div><b>Estimated</b><span>Planning value, not a measured outcome</span></div>
      </section>

      {/* 4 Quantitative Proof Cards */}
      <div className="ui-stats">
        <div className="ui-stat is-green">
          <div className="ui-stat-label flex items-center justify-between">
            <span>Fire points in this field</span>
            <ShieldCheck className="w-4 h-4 text-[var(--brand)]" />
          </div>
          <div className="ui-stat-value">
            {auditReport.firesInRegisteredFields}{' '}
            <span className="font-[family-name:var(--font-body)] text-[13px] font-semibold text-[var(--muted)]">fire points</span>
          </div>
          <p className="ui-stat-note">
            No-fire observations do not equal absolute non-burn proof
          </p>
        </div>

        <div className="ui-stat is-ember">
          <div className="ui-stat-label flex items-center justify-between">
            <span>Nearby fire points</span>
            <Flame className="w-4 h-4 text-[var(--ember)]" />
          </div>
          <div className="ui-stat-value">
            {auditReport.firesInSurroundingBuffer}{' '}
            <span className="font-[family-name:var(--font-body)] text-[13px] font-semibold text-[var(--muted)]">fire points</span>
          </div>
          <p className="ui-stat-note">
            {demoMode ? 'Synthetic demo observations' : 'Only provider-returned observations are shown'}
          </p>
        </div>

        <div className="ui-stat is-sky">
          <div className="ui-stat-label flex items-center justify-between">
            <span>Illustrative emissions estimate</span>
            <Sparkles className="w-4 h-4 text-[var(--sky)]" />
          </div>
          <div className="ui-stat-value">
            {auditReport.co2eAvoided}{' '}
            <span className="font-[family-name:var(--font-body)] text-[13px] font-semibold text-[var(--muted)]">t CO₂e</span>
          </div>
          <p className="ui-stat-note">
            + {auditReport.pm25Prevented === 0 ? 'Not calculated' : `${auditReport.pm25Prevented} kg PM2.5 prevented`}
          </p>
        </div>

        <div className="ui-stat is-wheat">
          <div className="ui-stat-label flex items-center justify-between">
            <span>Carbon market</span>
            <Award className="w-4 h-4 text-[var(--wheat)]" />
          </div>
          <div className="ui-stat-value">
            {auditReport.carbonCreditValueInr === 0 ? '—' : `₹${auditReport.carbonCreditValueInr.toLocaleString()}`}
          </div>
          <p className="ui-stat-note">
            Not available in this version
          </p>
        </div>
      </div>

      <EvidenceReview
        fields={fields}
        fireEvents={fireEvents}
        demoMode={demoMode}
        focusFieldId={reviewFocus?.id ?? null}
        focusNonce={reviewFocus?.nonce}
        reviewingFieldId={reviewingFieldId}
        onApprove={handleVerify}
      />

      {/* Spatial Audit Table */}
      <div className="ui-card">
        <div className="ui-card-head">
          <div className="ui-card-title">
            <FileText />
            <h4>
              Field proof records
            </h4>
          </div>
          <span className="ui-chip">
            {demoMode ? 'Synthetic observation stream' : 'Provider observations only when configured'}
          </span>
        </div>

        <div className="ui-table-wrap">
          <table className="ui-table">
            <thead>
              <tr>
                <th className="py-2.5 px-3">Khasra #</th>
                <th className="py-2.5 px-3">Farmer & Village</th>
                <th className="py-2.5 px-3">Acreage</th>
                <th className="py-2.5 px-3">FIRMS Fires In Polygon</th>
                <th className="py-2.5 px-3">Field & satellite proof</th>
                <th className="py-2.5 px-3">What we found</th>
                <th className="py-2.5 px-3 text-right">Record</th>
              </tr>
            </thead>
            <tbody>
              {fields.map((field) => {
                return (
                  <tr key={field.id}>
                    <td className="font-[family-name:var(--font-display)] text-[16px] font-bold !text-[var(--ink)] whitespace-nowrap">
                      {field.khasra_no}
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-semibold text-[var(--ink)]">{field.farmer_name}</div>
                      <div className="text-[12px] text-[var(--muted)]">{field.village}, {field.block}</div>
                    </td>
                    <td className="tabular-nums whitespace-nowrap">
                      {field.acreage} ac
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5 font-semibold text-[var(--brand-ink)] whitespace-nowrap">
                        {auditReport.dataAvailability === 'NO_OBSERVATIONS' ? <AlertCircle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        <span>{auditReport.dataAvailability === 'NO_OBSERVATIONS' ? 'Not assessed' : `${auditReport.auditResults.find((result) => result.fieldId === field.id)?.firesInsideCount ?? 0} fire point(s)`}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-semibold text-[var(--sky-ink)]">{demoMode ? 'Illustrative' : 'Not available'}</span>
                      <span className="block text-[12px] text-[var(--muted)]">{demoMode ? 'Synthetic demo value' : 'Awaiting evidence'}</span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="ui-chip is-wheat">
                        {demoMode ? 'DEMO / ILLUSTRATIVE' : field.status === 'VERIFIED_NON_BURN' ? 'INTERNAL STATUS — REVIEW SOURCE' : 'NOT VERIFIED'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {(field.status === 'CLEARED_PENDING_AUDIT' || demoMode) && field.status !== 'VERIFIED_NON_BURN' && (
                          <button
                            onClick={() => setReviewFocus({ id: field.id, nonce: Date.now() })}
                            disabled={reviewingFieldId === field.id}
                            className="ui-btn is-primary is-sm"
                          >
                            {reviewingFieldId === field.id ? 'Reviewing…' : 'Review field record'}
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenRecord(field.id)}
                          className="ui-btn is-sm"
                        >
                          See record
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {reviewMessage && <div role="status" className="ui-note is-green">{reviewMessage}</div>}

      {/* The 4 Inputs Architecture Diagram for Judges */}
      <div className="flex flex-col gap-4">
        <h4 className="ui-eyebrow">
          <Layers className="w-4 h-4" />
          <span>How we check a field</span>
        </h4>

        <div className="proof-steps">
          <div className="proof-step">
            <div className="proof-step-title">1. Field boundary</div>
            <p>
              We keep the field boundary source and its verification status. A hand-drawn boundary is not treated as official land-record proof.
            </p>
          </div>

          <div className="proof-step">
            <div className="proof-step-title">2. Satellite check</div>
            <p>
              Satellite observations are supporting evidence. They do not by themselves prove that no burning happened.
            </p>
          </div>

          <div className="proof-step">
            <div className="proof-step-title">3. Pickup & weight proof</div>
            <p>
              Photos, pickup records and weight records can be linked when they are available.
            </p>
          </div>

          <div className="proof-step">
            <div className="proof-step-title">4. Payment status</div>
            <p>
              Payment is not connected in this release, so we never show a payment as completed when it is not.
            </p>
          </div>
        </div>
      </div>

      {/* Record Modal */}
      {selectedFieldForCert && (
        <CarbonCertificate
          certificate={generateNonBurnCertificate(selectedFieldForCert)}
          onClose={() => setSelectedFieldForCert(null)}
        />
      )}
    </div>
  );
};
