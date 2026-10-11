import { useEffect, useMemo, useState } from 'react';
import { useAppLanguage } from '../../i18n/LanguageContext';
import {
  CheckCircle2,
  CircleDot,
  Clock3,
  FileCheck2,
  MapPin,
  PackageCheck,
  Satellite,
  Tractor,
  Weight,
} from 'lucide-react';
import type { Field, Machine } from '../../types';
import { supabase } from '../../lib/supabase';

type Props = {
  field: Field;
  machine?: Machine | null;
  demoMode: boolean;
};

type TimelineItem = {
  id: string;
  at: string;
  title: string;
  detail: string;
  source: string;
  icon: typeof CircleDot;
  tone: 'neutral' | 'active' | 'verified' | 'evidence';
};

function sourceLabel(source?: string | null) {
  if (!source) return 'NIRDHOOM record';
  if (source === 'FARMER_DECLARATION') return 'Farmer declared';
  if (source === 'CADASTRAL_REFERENCE') return 'Cadastral reference';
  if (source === 'GPS_OPERATOR') return 'Operator GPS';
  if (source === 'SYSTEM_DERIVED') return 'System-derived';
  if (source.toLowerCase().includes('firms')) return 'NASA FIRMS · supporting evidence';
  return source.replaceAll('_', ' ').toLowerCase().replace(/(^|\s)\S/g, (m) => m.toUpperCase());
}

function formatAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Time not established';
  return date.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function eventLabel(eventType: string) {
  return eventType.replaceAll('_', ' ').toLowerCase().replace(/(^|\s)\S/g, (m) => m.toUpperCase());
}

export function FieldEvidenceTimeline({ field, machine, demoMode }: Props) {
  const { t } = useAppLanguage();
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (demoMode || !supabase) {
      const now = Date.now();
      const demoItems: TimelineItem[] = [
        {
          id: 'demo-harvest',
          at: field.expected_harvest_date || new Date(now - 3 * 86400000).toISOString(),
          title: 'Harvest recorded',
          detail: `${field.paddy_variety} · ${field.acreage.toFixed(1)} acres`,
          source: sourceLabel(field.provenance?.harvest_date),
          icon: CircleDot,
          tone: 'neutral',
        },
        {
          id: 'demo-field',
          at: new Date(now - 2 * 86400000).toISOString(),
          title: 'Residue location captured',
          detail: `${field.village} · field boundary status: ${sourceLabel(field.provenance?.geometry)}`,
          source: sourceLabel(field.provenance?.geometry),
          icon: MapPin,
          tone: 'evidence',
        },
        {
          id: 'demo-booking',
          at: new Date(now - 86400000).toISOString(),
          title: 'Pickup request',
          detail: field.status === 'REGISTERED' ? 'Pickup has not been booked yet.' : 'Pickup request is part of the NIRDHOOM workflow.',
          source: 'NIRDHOOM booking record',
          icon: Tractor,
          tone: field.status === 'REGISTERED' ? 'neutral' : 'active',
        },
        {
          id: 'demo-machine',
          at: new Date(now - 6 * 3600000).toISOString(),
          title: machine ? 'Machine assigned' : 'Machine assignment pending',
          detail: machine ? `${machine.name} · ${machine.operator_name || 'Operator not listed'}` : 'No machine assignment is established for this field.',
          source: machine ? 'Operational machine record' : 'Not established',
          icon: Tractor,
          tone: machine ? 'active' : 'neutral',
        },
        {
          id: 'demo-evidence',
          at: new Date(now - 2 * 3600000).toISOString(),
          title: 'Field evidence',
          detail: field.is_verified_non_burn ? 'Verification outcome recorded.' : 'Photos and GPS evidence remain part of the verification workflow.',
          source: field.is_verified_non_burn ? 'Verification record' : 'Operator evidence',
          icon: FileCheck2,
          tone: field.is_verified_non_burn ? 'verified' : 'evidence',
        },
        {
          id: 'demo-lot',
          at: new Date(now - 3600000).toISOString(),
          title: field.residue_lot_id ? 'Residue lot created' : 'Residue lot pending',
          detail: field.residue_lot_id ? `Lot ${field.residue_lot_id.slice(0, 8)}…` : 'A first-class residue lot is created after collection/weighment.',
          source: field.residue_lot_id ? 'Residue lot record' : 'Not established',
          icon: PackageCheck,
          tone: field.residue_lot_id ? 'verified' : 'neutral',
        },
      ];
      setItems(demoItems.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime()));
      return;
    }

    const client = supabase;
    let active = true;
    const load = async () => {
      setLoading(true);
      const fieldId = field.dbId || field.id;
      const [fieldEvents, evidence, verification, lots, jobs] = await Promise.all([
        client.from('field_events').select('id,event_type,note,metadata,created_at').eq('field_id', fieldId).order('created_at', { ascending: true }).limit(100),
        client.from('evidence_assets').select('id,kind,source,captured_at,created_at,latitude,longitude,metadata').eq('field_id', fieldId).order('created_at', { ascending: true }).limit(100),
        client.from('verification_events').select('id,method,result,confidence,evidence_url,metadata,created_at').eq('field_id', fieldId).order('created_at', { ascending: true }).limit(50),
        client.from('residue_lots').select('id,quantity_tonnes,verified_quantity_tonnes,status,verification_source,baled_at,created_at').eq('field_id', fieldId).order('created_at', { ascending: true }).limit(20),
        client.from('jobs').select('id,status,slot_start,actual_arrived_at,actual_completed_at,updated_at,booking:bookings!inner(field_id)').eq('booking.field_id', fieldId).order('updated_at', { ascending: true }).limit(20),
      ]);

      if (!active) return;

      const next: TimelineItem[] = [];
      for (const event of fieldEvents.data || []) {
        next.push({
          id: `field-${event.id}`,
          at: event.created_at,
          title: eventLabel(event.event_type),
          detail: event.note || 'Field workflow event recorded.',
          source: 'NIRDHOOM field event',
          icon: CircleDot,
          tone: 'neutral',
        });
      }

      for (const evidenceItem of evidence.data || []) {
        const isGps = evidenceItem.kind === 'gps';
        const isSatellite = evidenceItem.kind === 'satellite';
        next.push({
          id: `evidence-${evidenceItem.id}`,
          at: evidenceItem.captured_at || evidenceItem.created_at,
          title: isGps ? 'GPS evidence captured' : isSatellite ? 'Satellite observation linked' : `${eventLabel(evidenceItem.kind)} captured`,
          detail: isGps
            ? evidenceItem.latitude !== null && evidenceItem.longitude !== null
              ? `${evidenceItem.latitude.toFixed(5)}, ${evidenceItem.longitude.toFixed(5)}`
              : 'Location coordinates are not available.'
            : isSatellite
              ? '{t('Remote sensing')} is supporting evidence only; absence of a detection does not prove no burning.'
              : 'Evidence asset linked to the field record.',
          source: sourceLabel(evidenceItem.source || (isSatellite ? 'NASA_FIRMS' : 'OPERATOR_EVIDENCE')),
          icon: isGps ? MapPin : isSatellite ? Satellite : FileCheck2,
          tone: 'evidence',
        });
      }

      for (const job of jobs.data || []) {
        next.push({
          id: `job-${job.id}`,
          at: job.actual_arrived_at || job.slot_start || job.updated_at,
          title: job.status === 'COMPLETED' ? 'Pickup completed' : job.status === 'ARRIVED' ? 'Baler arrived' : `Machine status: ${eventLabel(job.status)}`,
          detail: job.status === 'COMPLETED'
            ? 'Collection workflow completed; weighment/evidence may follow.'
            : `Operational job state: ${eventLabel(job.status)}.`,
          source: 'Operational job record',
          icon: Tractor,
          tone: job.status === 'COMPLETED' ? 'verified' : 'active',
        });
        if (job.actual_completed_at) {
          next.push({
            id: `job-complete-${job.id}`,
            at: job.actual_completed_at,
            title: 'Machine work completed',
            detail: 'Operator completion timestamp recorded.',
            source: 'Operational job record',
            icon: CheckCircle2,
            tone: 'verified',
          });
        }
      }

      for (const verificationItem of verification.data || []) {
        next.push({
          id: `verification-${verificationItem.id}`,
          at: verificationItem.created_at,
          title: 'Verification recorded',
          detail: `${verificationItem.result}${verificationItem.confidence !== null ? ` · confidence ${verificationItem.confidence}%` : ''}`,
          source: sourceLabel(verificationItem.method),
          icon: CheckCircle2,
          tone: 'verified',
        });
      }

      for (const lot of lots.data || []) {
        next.push({
          id: `lot-${lot.id}`,
          at: lot.baled_at || lot.created_at,
          title: lot.verified_quantity_tonnes ? 'Residue weighed and verified' : 'Residue lot created',
          detail: `${Number(lot.verified_quantity_tonnes ?? lot.quantity_tonnes ?? 0).toFixed(2)} t · status ${eventLabel(lot.status)}`,
          source: sourceLabel(lot.verification_source || 'RESIDUE_LOT_RECORD'),
          icon: Weight,
          tone: lot.status === 'VERIFIED' || lot.status === 'VERIFIED_NON_BURN' ? 'verified' : 'active',
        });
      }

      next.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
      setItems(next);
      setLoading(false);
    };

    void load();
    return () => { active = false; };
  }, [demoMode, field.dbId, field.id, field.expected_harvest_date, field.status, field.residue_lot_id, field.is_verified_non_burn, field.acreage, field.paddy_variety, field.village, field.provenance, machine]);

  const latest = useMemo(() => items[items.length - 1], [items]);

  return (
    <section className="residue-journey-card field-evidence-timeline" aria-labelledby="field-evidence-title">
      <div className="residue-journey-header">
        <div>
          <span className="residue-journey-kicker">FIELD EVIDENCE TIMELINE</span>
          <h2 id="field-evidence-title">{t('One chronological record')}</h2>
          <p>
            Harvest, pickup, machine, evidence and verification stay together. Each item names its source instead of implying certainty that the record does not have.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {loading && <span className="text-[10px] font-bold text-slate-500">Refreshing…</span>}
          <span className="residue-journey-mode">{latest ? formatAt(latest.at) : 'No events'}</span>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="market-empty mt-4">
          <Clock3 className="market-empty-icon" />
          <strong>{t('No field evidence events yet')}</strong>
          <p>Once a booking, operator event or evidence asset is recorded, the timeline will appear here.</p>
        </div>
      ) : (
        <ol className="field-evidence-timeline-list" aria-label="Field evidence events">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.id} className={`field-evidence-event is-${item.tone}`}>
                <div className="field-evidence-line" aria-hidden="true">
                  <span className="field-evidence-dot"><Icon className="h-3.5 w-3.5" /></span>
                </div>
                <div className="field-evidence-content">
                  <div className="field-evidence-top">
                    <strong>{item.title}</strong>
                    <time dateTime={item.at}>{formatAt(item.at)}</time>
                  </div>
                  <p>{item.detail}</p>
                  <span className="field-evidence-source">{item.source}</span>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <div className="field-evidence-trust-strip">
        <div><strong>{t('Field boundary')}</strong><span>{sourceLabel(field.provenance?.geometry)}</span></div>
        <div><strong>Remote sensing</strong><span>{t('Supporting evidence only')}</span></div>
        <div><strong>Residue</strong><span>{field.residue_lot_id ? 'Lot linked' : 'Lot not established'}</span></div>
        <div><strong>Latest</strong><span>{latest ? latest.source : 'No source yet'}</span></div>
      </div>
    </section>
  );
}
