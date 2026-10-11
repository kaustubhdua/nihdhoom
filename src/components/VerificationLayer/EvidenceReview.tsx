import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, Camera, CheckCircle2, CircleDashed, Flame, ImagePlus, Map as MapIcon,
  MessageSquareWarning, Satellite, ShieldCheck, Trash2, XCircle,
} from 'lucide-react';
import type { BurnEvent, Field } from '../../types';
import { supabase } from '../../lib/supabase';
import { validateEvidenceFile } from '../../lib/evidenceValidation';
import { STAGE_META, fieldStage } from '../../lib/fieldStatus';
import {
  distanceToRingM, formatDistance, m2ToAcres, m2ToHectares, offsetM, pointInRing,
  polygonAreaM2, polygonPerimeterM, projectRing, ringCentroid, validRing,
} from '../../lib/fieldGeometry';

interface Props {
  fields: Field[];
  fireEvents: BurnEvent[];
  demoMode: boolean;
  /** Field requested from elsewhere on the page (e.g. the records table). */
  focusFieldId?: string | null;
  focusNonce?: number;
  reviewingFieldId: string | null;
  onApprove: (field: Field) => void | Promise<void>;
}

type ReviewPhoto = {
  id: string;
  url: string | null;
  name: string;
  takenAt: number | null;
  sizeKb: number | null;
  origin: 'local' | 'uploaded' | 'record';
};

type CheckState = 'pass' | 'warn' | 'fail';
type Check = { id: string; label: string; detail: string; state: CheckState; anchor: string };
type Decision = { action: 'review-submitted' | 'more-evidence' | 'rejected'; note: string; at: number };

const AREA_OK = 0.10;
const AREA_WARN = 0.25;

function analyseField(field: Field, fireEvents: BurnEvent[]) {
  const ring = validRing(field.geometry);
  const areaM2 = polygonAreaM2(ring);
  const mappedAcres = m2ToAcres(areaM2);
  const declared = Number(field.acreage || 0);
  const areaDiff = declared > 0 && mappedAcres > 0 ? (mappedAcres - declared) / declared : null;
  const center = ring.length ? ringCentroid(ring) : field.center;

  const fires = fireEvents
    .filter((event) => Number.isFinite(Number(event.firms_point?.lat)) && Number.isFinite(Number(event.firms_point?.lng)))
    .map((event) => {
      const point = { lat: Number(event.firms_point.lat), lng: Number(event.firms_point.lng) };
      const inside = ring.length >= 3 && pointInRing(point, ring);
      const distance = ring.length >= 3 ? distanceToRingM(point, ring) : Infinity;
      return { event, point, inside, distance };
    })
    .sort((a, b) => a.distance - b.distance);

  return {
    ring,
    center,
    areaM2,
    mappedAcres,
    hectares: m2ToHectares(areaM2),
    perimeter: polygonPerimeterM(ring),
    declared,
    areaDiff,
    fires,
    inside: fires.filter((f) => f.inside).length,
    within1: fires.filter((f) => !f.inside && f.distance <= 1000).length,
    within5: fires.filter((f) => !f.inside && f.distance <= 5000).length,
    nearest: fires[0] ?? null,
  };
}

function buildChecks(field: Field, analysis: ReturnType<typeof analyseField>, photoCount: number, hasObservations: boolean): Check[] {
  const { ring, areaDiff, inside, within1 } = analysis;
  const diffPct = areaDiff === null ? null : Math.round(Math.abs(areaDiff) * 100);
  const stage = fieldStage(field.status);
  return [
    {
      id: 'boundary',
      label: 'Field boundary mapped',
      detail: ring.length >= 3 ? `${ring.length} boundary points recorded` : 'No usable boundary on record',
      state: ring.length >= 3 ? 'pass' : 'fail',
      anchor: 'review-geometry',
    },
    {
      id: 'area',
      label: 'Area matches the declaration',
      detail: diffPct === null ? 'Cannot compare without a boundary and declared acreage' : `Mapped area is ${diffPct}% ${areaDiff! >= 0 ? 'above' : 'below'} the declared acreage`,
      state: diffPct === null ? 'fail' : diffPct <= AREA_OK * 100 ? 'pass' : diffPct <= AREA_WARN * 100 ? 'warn' : 'fail',
      anchor: 'review-geometry',
    },
    {
      id: 'photos',
      label: 'Photo evidence attached',
      detail: photoCount ? `${photoCount} photo${photoCount === 1 ? '' : 's'} attached` : 'No field or bale photo attached yet',
      state: photoCount ? 'pass' : 'fail',
      anchor: 'review-photos',
    },
    {
      id: 'fire',
      label: 'No fire detected inside the field',
      detail: !hasObservations
        ? 'No satellite observations available to screen against'
        : inside
          ? `${inside} fire detection${inside === 1 ? '' : 's'} inside the boundary`
          : within1
            ? `${within1} detection${within1 === 1 ? '' : 's'} within 1 km of the boundary`
            : 'No detection inside or within 1 km',
      state: !hasObservations ? 'warn' : inside ? 'fail' : within1 ? 'warn' : 'pass',
      anchor: 'review-satellite',
    },
    {
      id: 'job',
      label: 'Clearance job completed',
      detail: `Current stage: ${STAGE_META[stage].label}`,
      state: stage === 'cleared' || stage === 'verified' ? 'pass' : 'warn',
      anchor: 'review-decision',
    },
  ];
}

const STATE_ICON = { pass: CheckCircle2, warn: AlertTriangle, fail: XCircle } as const;

export function EvidenceReview({ fields, fireEvents, demoMode, focusFieldId, focusNonce, reviewingFieldId, onApprove }: Props) {
  const [selectedId, setSelectedId] = useState<string>(() => fields.find((f) => f.status === 'CLEARED_PENDING_AUDIT')?.id ?? fields[0]?.id ?? '');
  const [photos, setPhotos] = useState<Record<string, ReviewPhoto[]>>({});
  const [photoMessage, setPhotoMessage] = useState('');
  const [busyPhoto, setBusyPhoto] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [decisions, setDecisions] = useState<Record<string, Decision[]>>({});
  const fileInput = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!focusFieldId) return;
    setSelectedId(focusFieldId);
    rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [focusFieldId, focusNonce]);

  useEffect(() => {
    if (!fields.some((f) => f.id === selectedId) && fields[0]) setSelectedId(fields[0].id);
  }, [fields, selectedId]);

  // Release local preview URLs when the review unmounts.
  const photosRef = useRef(photos);
  useEffect(() => { photosRef.current = photos; }, [photos]);
  useEffect(() => () => {
    Object.values(photosRef.current).flat().forEach((photo) => {
      if (photo.origin === 'local' && photo.url) URL.revokeObjectURL(photo.url);
    });
  }, []);

  const field = fields.find((f) => f.id === selectedId) ?? null;
  const hasObservations = fireEvents.length > 0;
  const analyses = useMemo(() => Object.fromEntries(fields.map((f) => [f.id, analyseField(f, fireEvents)])), [fields, fireEvents]);
  const analysis = field ? analyses[field.id] : null;
  const fieldPhotos = field ? photos[field.id] ?? [] : [];
  const checks = field && analysis ? buildChecks(field, analysis, fieldPhotos.length, hasObservations) : [];
  const blocking = checks.filter((c) => c.state === 'fail');
  const passed = checks.filter((c) => c.state === 'pass').length;
  const alreadyVerified = field?.status === 'VERIFIED_NON_BURN';
  const fieldDecisions = field ? decisions[field.id] ?? [] : [];

  // Live mode: show evidence already recorded for this field.
  useEffect(() => {
    if (demoMode || !supabase || !field) return;
    let active = true;
    const client = supabase as any;
    (async () => {
      const { data, error } = await client
        .from('evidence_assets')
        .select('id,kind,storage_path,captured_at,created_at,metadata')
        .eq('field_id', field.dbId || field.id)
        .in('kind', ['field_photo', 'bale_photo'])
        .order('created_at', { ascending: false })
        .limit(12);
      if (!active || error || !Array.isArray(data)) return;
      const records: ReviewPhoto[] = await Promise.all(data.map(async (row: any) => {
        let url: string | null = null;
        if (row.storage_path) {
          const signed = await client.storage.from('evidence').createSignedUrl(row.storage_path, 600).catch(() => null);
          url = signed?.data?.signedUrl ?? null;
        }
        return {
          id: row.id,
          url,
          name: row.metadata?.file_name || row.kind.replace('_', ' '),
          takenAt: row.captured_at ? Date.parse(row.captured_at) : Date.parse(row.created_at),
          sizeKb: null,
          origin: 'record' as const,
        };
      }));
      if (!active) return;
      setPhotos((current) => {
        const local = (current[field.id] ?? []).filter((p) => p.origin !== 'record');
        return { ...current, [field.id]: [...local, ...records] };
      });
    })();
    return () => { active = false; };
  }, [demoMode, field?.id]);

  async function addPhotos(files: FileList | null) {
    if (!field || !files?.length) return;
    setPhotoMessage('');
    setBusyPhoto(true);
    const added: ReviewPhoto[] = [];
    try {
      for (const file of Array.from(files).slice(0, 6)) {
        const problem = await validateEvidenceFile(file, file.name);
        if (problem) { setPhotoMessage(problem); continue; }

        let origin: ReviewPhoto['origin'] = 'local';
        if (!demoMode && supabase) {
          const client = supabase as any;
          const { data: auth } = await client.auth.getUser();
          const user = auth?.user;
          if (!user) {
            setPhotoMessage('Sign in as a verifier to upload evidence. The photo is shown here as a local preview only.');
          } else {
            const path = `${user.id}/${field.dbId || field.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
            const upload = await client.storage.from('evidence').upload(path, file, { contentType: file.type, upsert: false });
            if (upload.error) {
              setPhotoMessage(`Upload failed: ${upload.error.message}. Kept as a local preview.`);
            } else {
              const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
              const sha256 = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
              const { error } = await client.from('evidence_assets').insert({
                field_id: field.dbId || field.id,
                kind: 'field_photo',
                storage_path: path,
                source: 'verification-review',
                captured_at: new Date(file.lastModified || Date.now()).toISOString(),
                sha256,
                created_by: user.id,
                sync_source: 'online',
                metadata: { file_name: file.name, mime_type: file.type },
              });
              if (error) {
                await client.storage.from('evidence').remove([path]);
                setPhotoMessage(`Evidence record could not be saved: ${error.message}. Kept as a local preview.`);
              } else {
                origin = 'uploaded';
              }
            }
          }
        }

        added.push({
          id: crypto.randomUUID(),
          url: URL.createObjectURL(file),
          name: file.name,
          takenAt: file.lastModified || null,
          sizeKb: Math.round(file.size / 1024),
          origin,
        });
      }
      if (added.length) {
        setPhotos((current) => ({ ...current, [field.id]: [...added, ...(current[field.id] ?? [])] }));
      }
    } finally {
      setBusyPhoto(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  function removePhoto(photo: ReviewPhoto) {
    if (!field || photo.origin !== 'local') return;
    if (photo.url) URL.revokeObjectURL(photo.url);
    setPhotos((current) => ({ ...current, [field.id]: (current[field.id] ?? []).filter((p) => p.id !== photo.id) }));
  }

  async function decide(action: Decision['action']) {
    if (!field) return;
    if (action === 'approved') await onApprove(field);
    setDecisions((current) => ({
      ...current,
      [field.id]: [{ action: action === 'approved' ? 'review-submitted' : action, note: (notes[field.id] || '').trim(), at: Date.now() }, ...(current[field.id] ?? [])],
    }));
    setNotes((current) => ({ ...current, [field.id]: '' }));
  }

  if (!field || !analysis) {
    return (
      <section className="evidence-review ui-card" id="evidence-review">
        <div className="ui-empty">No field records are available to review.</div>
      </section>
    );
  }

  const stage = STAGE_META[fieldStage(field.status)];

  return (
    <section ref={rootRef} className="evidence-review ui-stack" id="evidence-review" aria-labelledby="evidence-review-title">
      <div className="ui-intro">
        <div className="ui-intro-copy">
          <div className="ui-eyebrow"><ShieldCheck className="h-4 w-4" /> Evidence review</div>
          <h2 id="evidence-review-title" className="ui-title">Review one field at a time</h2>
          <p className="ui-lede">Photo evidence, field geometry and satellite context side by side, with a checklist that decides whether the field can be approved.</p>
        </div>
        <span className="ui-chip is-wheat">{demoMode ? 'Demo records · decisions stay in this browser' : 'Live records'}</span>
      </div>

      {/* Field picker */}
      <div className="review-picker" role="tablist" aria-label="Choose a field to review">
        {fields.map((f) => {
          const a = analyses[f.id];
          const c = buildChecks(f, a, (photos[f.id] ?? []).length, hasObservations);
          const ok = c.filter((x) => x.state === 'pass').length;
          const meta = STAGE_META[fieldStage(f.status)];
          return (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={f.id === field.id}
              className={`review-pick ${f.id === field.id ? 'is-on' : ''}`}
              onClick={() => setSelectedId(f.id)}
            >
              <span className={`map-stage-swatch ${meta.dashed ? 'is-dashed' : ''}`} style={{ '--stage': meta.fill } as React.CSSProperties} />
              <span className="min-w-0">
                <strong>{f.khasra_no}</strong>
                <small>{f.village} · {meta.label}</small>
              </span>
              <span className={`review-score ${ok === c.length ? 'is-full' : ''}`}>{ok}/{c.length}</span>
            </button>
          );
        })}
      </div>

      <div className="review-grid">
        {/* Photo evidence */}
        <article className="ui-card review-panel" id="review-photos">
          <div className="ui-card-head">
            <div className="ui-card-title"><Camera /><h3>Photo evidence</h3></div>
            <span className={`ui-chip ${fieldPhotos.length ? 'is-green' : 'is-ember'}`}>{fieldPhotos.length} attached</span>
          </div>
          {fieldPhotos.length === 0 ? (
            <div className="review-photo-empty">
              <Camera className="h-6 w-6" />
              <strong>No photos for {field.khasra_no} yet</strong>
              <p>Add a cleared-field photo and a bale photo. JPEG, PNG or WebP up to 12 MB; the file is checked to be a real image.</p>
            </div>
          ) : (
            <div className="review-photos">
              {fieldPhotos.map((photo) => (
                <figure key={photo.id} className="review-photo">
                  {photo.url ? <img src={photo.url} alt={`Evidence photo ${photo.name}`} loading="lazy" decoding="async" /> : <div className="review-photo-missing"><Camera /></div>}
                  <figcaption>
                    <span>{photo.takenAt ? new Date(photo.takenAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Time not recorded'}</span>
                    <span className="review-photo-origin">{photo.origin === 'local' ? 'Local preview' : photo.origin === 'uploaded' ? 'Uploaded' : 'On record'}</span>
                  </figcaption>
                  {photo.origin === 'local' && (
                    <button type="button" className="review-photo-remove" aria-label={`Remove ${photo.name}`} onClick={() => removePhoto(photo)}><Trash2 className="h-3.5 w-3.5" /></button>
                  )}
                </figure>
              ))}
            </div>
          )}
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            multiple
            className="sr-only"
            onChange={(event) => void addPhotos(event.target.files)}
          />
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="button" className="ui-btn" onClick={() => fileInput.current?.click()} disabled={busyPhoto}>
              <ImagePlus /> {busyPhoto ? 'Checking photo…' : 'Add photo'}
            </button>
            <span className="text-[12px] text-[var(--muted)]">{demoMode ? 'Demo: photos stay on this device and are not uploaded.' : 'Photos are uploaded to private evidence storage and hashed.'}</span>
          </div>
          {photoMessage && <div className="ui-note is-wheat mt-3" role="status">{photoMessage}</div>}
        </article>

        {/* Field geometry */}
        <article className="ui-card review-panel" id="review-geometry">
          <div className="ui-card-head">
            <div className="ui-card-title"><MapIcon /><h3>Field geometry</h3></div>
            {checks[1] && <span className={`ui-chip ${checks[1].state === 'pass' ? 'is-green' : checks[1].state === 'warn' ? 'is-wheat' : 'is-ember'}`}>
              {checks[1].state === 'pass' ? 'Area matches' : checks[1].state === 'warn' ? 'Check boundary' : analysis.ring.length >= 3 ? 'Area mismatch' : 'No boundary'}
            </span>}
          </div>
          <div className="review-geo">
            <GeometrySketch ring={analysis.ring} fill={stage.fill} dashed={Boolean(stage.dashed)} />
            <dl className="review-geo-stats">
              <div><dt>Mapped area</dt><dd>{analysis.ring.length >= 3 ? `${analysis.mappedAcres.toFixed(2)} ac` : 'n/a'}<small>{analysis.ring.length >= 3 ? `${analysis.hectares.toFixed(2)} ha` : ''}</small></dd></div>
              <div><dt>Declared</dt><dd>{analysis.declared ? `${analysis.declared.toFixed(2)} ac` : 'n/a'}<small>farmer declaration</small></dd></div>
              <div><dt>Difference</dt><dd className={checks[1]?.state === 'pass' ? 'is-good' : checks[1]?.state === 'warn' ? 'is-warn' : 'is-bad'}>{analysis.areaDiff === null ? 'n/a' : `${analysis.areaDiff >= 0 ? '+' : ''}${(analysis.areaDiff * 100).toFixed(1)}%`}<small>pass within ±{AREA_OK * 100}%</small></dd></div>
              <div><dt>Perimeter</dt><dd>{analysis.perimeter ? `${Math.round(analysis.perimeter)} m` : 'n/a'}<small>{analysis.ring.length} boundary points</small></dd></div>
            </dl>
          </div>
          <div className="ui-note mt-4">
            <MapIcon />
            <span>Boundary source: <b>{sourceLabel(field.provenance?.geometry ?? (analysis.ring.length >= 3 ? 'FARMER_DECLARATION' : undefined))}</b>. A hand-drawn boundary is not treated as an official land record.</span>
          </div>
        </article>

        {/* Satellite context */}
        <article className="ui-card review-panel" id="review-satellite">
          <div className="ui-card-head">
            <div className="ui-card-title"><Satellite /><h3>Satellite context</h3></div>
            <span className={`ui-chip ${analysis.inside ? 'is-ember' : analysis.within1 ? 'is-wheat' : 'is-green'}`}>
              {!hasObservations ? 'No observations' : analysis.inside ? `${analysis.inside} inside` : analysis.within1 ? 'Fire nearby' : 'Clear within 1 km'}
            </span>
          </div>
          <div className="review-sat">
            <FireRadar center={analysis.center} fires={analysis.fires} fill={stage.fill} />
            <div className="review-sat-stats">
              <div className="review-sat-row"><span>Inside the boundary</span><b className={analysis.inside ? 'is-bad' : 'is-good'}>{analysis.inside}</b></div>
              <div className="review-sat-row"><span>Within 1 km</span><b className={analysis.within1 ? 'is-warn' : ''}>{analysis.within1}</b></div>
              <div className="review-sat-row"><span>Within 5 km</span><b>{analysis.within5}</b></div>
              {analysis.nearest && (
                <div className="review-sat-nearest">
                  <span className="ui-kv-label">Nearest detection</span>
                  <strong>{formatDistance(analysis.nearest.distance)} · {analysis.nearest.event.nearest_village}</strong>
                  <small>{new Date(analysis.nearest.event.detected_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} · {analysis.nearest.event.satellite} · {analysis.nearest.event.confidence}% confidence</small>
                </div>
              )}
            </div>
          </div>
          <div className="ui-note is-sky mt-4">
            <Flame />
            <span>FIRMS / VIIRS detections are supporting evidence only. A missing detection is not proof that no burning happened; cloud cover and pass timing matter.</span>
          </div>
        </article>

        {/* Verification review */}
        <article className="ui-card review-panel review-decision" id="review-decision">
          <div className="ui-card-head">
            <div className="ui-card-title"><ShieldCheck /><h3>Verification review</h3></div>
            <span className={`review-score is-lg ${passed === checks.length ? 'is-full' : ''}`}>{passed}/{checks.length} checks</span>
          </div>
          <ul className="review-checks">
            {checks.map((check) => {
              const Icon = STATE_ICON[check.state];
              return (
                <li key={check.id} className={`is-${check.state}`}>
                  <Icon className="h-[18px] w-[18px] shrink-0" />
                  <a href={`#${check.anchor}`} onClick={(event) => { event.preventDefault(); document.getElementById(check.anchor)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }}>
                    <strong>{check.label}</strong>
                    <small>{check.detail}</small>
                  </a>
                </li>
              );
            })}
          </ul>

          <label className="ui-label mt-5 block" htmlFor="review-note">Reviewer note</label>
          <textarea
            id="review-note"
            className="ui-textarea mt-2 min-h-[84px]"
            placeholder={blocking.length ? 'What is missing or wrong?' : 'Optional note for the record'}
            value={notes[field.id] || ''}
            onChange={(event) => setNotes((current) => ({ ...current, [field.id]: event.target.value }))}
          />

          <div className="review-actions">
            <button
              type="button"
              className="ui-btn is-primary"
              disabled={alreadyVerified || blocking.length > 0 || reviewingFieldId === field.id}
              onClick={() => void decide('approved')}
              title={blocking.length ? 'Resolve the failed checks first' : undefined}
            >
              <CheckCircle2 /> {alreadyVerified ? 'Already verified' : reviewingFieldId === field.id ? 'Recording…' : demoMode ? 'Record demo review note' : 'Submit for manual review'}
            </button>
            <button type="button" className="ui-btn is-wheat" onClick={() => void decide('more-evidence')} disabled={alreadyVerified}>
              <MessageSquareWarning /> Request more evidence
            </button>
            <button type="button" className="ui-btn" onClick={() => void decide('rejected')} disabled={alreadyVerified}>
              <XCircle /> Reject
            </button>
          </div>
          {blocking.length > 0 && !alreadyVerified && (
            <p className="mt-3 text-[12.5px] text-[var(--ember-ink)]">Approval unlocks when no check has failed ({blocking.map((c) => c.label.toLowerCase()).join(', ')}).</p>
          )}

          {fieldDecisions.length > 0 && (
            <ol className="review-log">
              {fieldDecisions.map((d) => (
                <li key={d.at}>
                  <span className={`ui-chip ${d.action === 'rejected' ? 'is-ember' : 'is-wheat'}`}>
                    {d.action === 'review-submitted' ? (demoMode ? 'Demo review note recorded' : 'Review submitted — pending decision') : d.action === 'rejected' ? 'Rejected' : 'More evidence requested'}
                  </span>
                  <span className="text-[12px] text-[var(--muted)]">{new Date(d.at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                  {d.note && <p>{d.note}</p>}
                </li>
              ))}
            </ol>
          )}
        </article>
      </div>
    </section>
  );
}

function sourceLabel(source?: string) {
  switch (source) {
    case 'FARMER_DECLARATION': return 'Farmer declaration';
    case 'CADASTRAL_REFERENCE': return 'Cadastral reference';
    case 'GPS_OPERATOR': return 'Operator GPS walk';
    case 'SYSTEM_DERIVED': return 'System-derived';
    default: return 'Not established';
  }
}

/** Boundary drawn to scale with a scale bar. */
function GeometrySketch({ ring, fill, dashed }: { ring: { lat: number; lng: number }[]; fill: string; dashed: boolean }) {
  const W = 220;
  const H = 180;
  const pad = 22;
  if (ring.length < 3) {
    return <div className="review-geo-sketch is-empty"><CircleDashed className="h-8 w-8" /><span>No boundary</span></div>;
  }
  const pts = projectRing(ring);
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const spanX = Math.max(...xs) - Math.min(...xs) || 1;
  const spanY = Math.max(...ys) - Math.min(...ys) || 1;
  const scale = Math.min((W - pad * 2) / spanX, (H - pad * 2 - 18) / spanY);
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2;
  const cy = (Math.max(...ys) + Math.min(...ys)) / 2;
  const toSvg = (p: { x: number; y: number }) => [W / 2 + (p.x - cx) * scale, (H - 18) / 2 + (cy - p.y) * scale] as const;
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${toSvg(p).map((n) => n.toFixed(1)).join(' ')}`).join(' ') + ' Z';
  // Scale bar: a round length that is ~1/3 of the drawing width.
  const target = (W - pad * 2) / 3 / scale;
  const nice = [10, 20, 25, 50, 100, 200, 250, 500, 1000].find((n) => n >= target) ?? 1000;
  const barPx = nice * scale;
  return (
    <svg className="review-geo-sketch" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Field boundary drawn to scale">
      <defs>
        <pattern id="geo-grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M20 0H0V20" fill="none" stroke="var(--line)" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width={W} height={H} fill="url(#geo-grid)" />
      <path d={path} fill={fill} fillOpacity={dashed ? 0.25 : 0.45} stroke="var(--ink)" strokeWidth="1.8" strokeDasharray={dashed ? '5 4' : undefined} strokeLinejoin="round" />
      {pts.map((p, i) => {
        const [x, y] = toSvg(p);
        return <circle key={i} cx={x} cy={y} r="3.6" fill="var(--surface)" stroke="var(--ink)" strokeWidth="1.6" />;
      })}
      <g transform={`translate(${pad}, ${H - 12})`}>
        <line x1="0" x2={barPx} y1="0" y2="0" stroke="var(--ink)" strokeWidth="2" />
        <line x1="0" x2="0" y1="-4" y2="4" stroke="var(--ink)" strokeWidth="2" />
        <line x1={barPx} x2={barPx} y1="-4" y2="4" stroke="var(--ink)" strokeWidth="2" />
        <text x={barPx + 6} y="4" fontSize="10.5" fontWeight="600" fill="var(--muted)">{nice >= 1000 ? `${nice / 1000} km` : `${nice} m`}</text>
      </g>
      <text x={W - pad} y="16" textAnchor="end" fontSize="11" fontWeight="700" fill="var(--muted)">N ↑</text>
    </svg>
  );
}

/** Fire detections around the field: rings at 1 km and 5 km, north up. */
function FireRadar({ center, fires, fill }: { center: { lat: number; lng: number }; fires: { point: { lat: number; lng: number }; inside: boolean; distance: number; event: BurnEvent }[]; fill: string }) {
  const S = 200;
  const R = 86;
  const c = S / 2;
  const maxM = 5000;
  // Square-root scale so the 1 km ring is readable next to 5 km.
  const radius = (m: number) => Math.sqrt(Math.min(m, maxM) / maxM) * R;
  const shown = fires.filter((f) => f.distance <= 10_000);
  return (
    <svg className="review-radar" viewBox={`0 0 ${S} ${S}`} role="img" aria-label="Fire detections around the field">
      <circle cx={c} cy={c} r={R} fill="var(--surface-2)" stroke="var(--line-strong)" />
      <circle cx={c} cy={c} r={radius(1000)} fill="none" stroke="var(--line-strong)" strokeDasharray="3 3" />
      <line x1={c} x2={c} y1={c - R} y2={c + R} stroke="var(--line)" />
      <line x1={c - R} x2={c + R} y1={c} y2={c} stroke="var(--line)" />
      <text x={c + 4} y={c + radius(1000) - 4} fontSize="9.5" fill="var(--muted)" fontWeight="600">1 km</text>
      <text x={c + 4} y={c + R - 5} fontSize="9.5" fill="var(--muted)" fontWeight="600">5 km</text>
      <text x={c} y={c - R - 4} textAnchor="middle" fontSize="10" fill="var(--muted)" fontWeight="700">N</text>
      <circle cx={c} cy={c} r="7" fill={fill} stroke="var(--ink)" strokeWidth="1.6" />
      {shown.map(({ point, distance, inside, event }) => {
        const off = offsetM(center, point);
        const len = Math.hypot(off.x, off.y) || 1;
        const r = inside ? 0 : radius(distance + 120);
        const beyond = distance > maxM;
        const x = c + (off.x / len) * (beyond ? R : r);
        const y = c - (off.y / len) * (beyond ? R : r);
        return (
          <g key={event.id}>
            <circle cx={x} cy={y} r={beyond ? 3.5 : 5} fill={beyond ? 'var(--surface)' : 'var(--ember)'} stroke="var(--ember)" strokeWidth="1.6" fillOpacity={beyond ? 1 : 0.9} />
            <title>{`${formatDistance(distance)} · ${event.nearest_village} · ${event.confidence}%`}</title>
          </g>
        );
      })}
    </svg>
  );
}
