import { useEffect, useMemo, useState } from 'react';
import { useAppLanguage } from '../../i18n/LanguageContext';
import { CalendarDays, CheckCircle2, ClipboardCheck, Loader2, MapPin, ShieldCheck, Tractor } from 'lucide-react';
import { Field } from '../../types';
import { supabase } from '../../lib/supabase';

interface Props {
  fields: Field[];
  demoMode: boolean;
  onBooked: (fieldId: string, amount?: number) => void;
}

function localDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function ClearanceBooking({ fields, demoMode, onBooked }: Props) {
  const { t } = useAppLanguage();
  const bookable = useMemo(
    () => fields.filter((f) => !['VERIFIED_NON_BURN'].includes(f.status)),
    [fields],
  );
  const [fieldId, setFieldId] = useState(bookable[0]?.id || '');
  const [date, setDate] = useState(() => { const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); return localDateString(tomorrow); });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [consentAccepted, setConsentAccepted] = useState(false);

  useEffect(() => {
    if (!fieldId && bookable[0]?.id) setFieldId(bookable[0].id);
    if (fieldId && !bookable.some((field) => field.id === fieldId)) setFieldId(bookable[0]?.id || '');
  }, [bookable, fieldId]);

  const selected = bookable.find((f) => f.id === fieldId);
  const estimate = selected ? Math.round(Math.max(0, Number(selected.acreage || 0)) * 1500) : 0;
  const bookingStep = !selected ? 1 : !date ? 2 : 3;
  const stepClass = (step: number) => (step < bookingStep ? 'is-done' : step === bookingStep ? 'is-current' : '');

  async function book() {
    setError('');
    setMessage('');
    if (!selected || !date) {
      setError('Please choose your field and pickup date first.');
      return;
    }
    if (!consentAccepted) {
      setError('Please confirm consent before requesting clearance.');
      return;
    }
    if (date < localDateString(new Date())) {
      setError('Please choose today or a future date.');
      return;
    }

    setBusy(true);
    try {
      if (demoMode) {
        onBooked(selected.id, estimate);
        setMessage('Example pickup booked. No real payment was made.');
        return;
      }
      if (!supabase) throw new Error('Live Supabase is not configured.');
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) {
        throw new Error('Your session has expired. Please verify your phone again.');
      }

      // The booking checkbox is explicit consent for this service. Persist it
      // before calling the server RPC, which independently requires active consent.
      const { data: activeConsent, error: consentLookupError } = await supabase
        .from('consents')
        .select('id')
        .eq('profile_id', authData.user.id)
        .eq('consent_type', 'farmer_network')
        .is('revoked_at', null)
        .order('accepted_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (consentLookupError) throw new Error(`Could not verify your consent: ${consentLookupError.message}`);

      if (!activeConsent) {
        const { error: consentInsertError } = await supabase.from('consents').insert({
          profile_id: authData.user.id,
          consent_type: 'farmer_network',
          version: '2026-10-11',
          source: 'WEB_CLEARANCE_BOOKING',
        });
        if (consentInsertError) throw new Error(`Could not record your consent: ${consentInsertError.message}`);

        const { error: profileError } = await supabase
          .from('profiles')
          .update({ consent_status: 'GRANTED' })
          .eq('id', authData.user.id);
        if (profileError) throw new Error(`Consent was recorded but profile status could not be updated: ${profileError.message}`);
      }

      const { data, error: rpcError } = await supabase.rpc('reserve_clearance_booking_v2', {
        p_field_id: selected.dbId || selected.id,
        p_requested_date: date,
      });
      if (rpcError) throw new Error(rpcError.message);
      onBooked(selected.id, Number((data as { quoted_amount?: number } | null)?.quoted_amount || 0));
      setMessage(`${t('Book parali pickup')} confirmed by the server. The authoritative quote is shown in your field record.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Booking could not be created.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="tone-adapt farmer-surface farmer-booking ui-stack">
      <section className="ui-intro">
        <div className="flex items-start gap-4">
          <div className="hidden h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[var(--brand-soft)] text-[var(--brand)] sm:grid">
            <Tractor className="h-5 w-5" />
          </div>
          <div className="ui-intro-copy">
            <div className="ui-eyebrow">
              <ClipboardCheck className="h-3.5 w-3.5" /> {t('Book parali pickup')}
            </div>
            <h1 className="ui-title">{t('Book parali pickup')}</h1>
            <p className="ui-lede">
              {t('Choose your field and the day you want the machine to come. In Live mode, the final quote is decided by the server.')}
            </p>
          </div>
        </div>
      </section>

      <section className="farmer-step-strip" aria-label={t('Booking steps')}>
        <div className={stepClass(1)}><span>1</span><strong>{t('Choose your field')}</strong><small>{t('Select the field where parali needs to be collected')}</small></div>
        <i aria-hidden="true" />
        <div className={stepClass(2)}><span>2</span><strong>{t('Choose a date')}</strong><small>{t('Tell us when you want the machine')}</small></div>
        <i aria-hidden="true" />
        <div className={stepClass(3)}><span>3</span><strong>{t('Confirm')}</strong><small>{t('Check details and book')}</small></div>
      </section>

      <section className="ui-split">
        <div className="ui-card">
          <label className="ui-label mb-2 block">{t('Field')}</label>
          <select value={fieldId} onChange={(e) => setFieldId(e.target.value)} className="ui-select">
            {bookable.length === 0 && <option value="">{t('No bookable fields')}</option>}
            {bookable.map((field) => (
              <option key={field.id} value={field.id}>{field.khasra_no} · {field.village} · {Number(field.acreage).toFixed(2)} ac</option>
            ))}
          </select>

          {selected && (
            <div className="ui-kv-grid mt-3 sm:grid-cols-3">
              <div className="ui-kv">
                <span className="ui-kv-label">{t('Current status')}</span>
                <strong className="ui-kv-value !text-[var(--brand-ink)]">{selected.status.replace(/_/g, ' ')}</strong>
              </div>
              <div className="ui-kv">
                <span className="ui-kv-label">{t('Area')}</span>
                <strong className="ui-kv-value">{Number(selected.acreage).toFixed(2)} acres</strong>
              </div>
              <div className="ui-kv">
                <span className="ui-kv-label">{t('Location')}</span>
                <strong className="ui-kv-value"><MapPin /> {selected.village}</strong>
              </div>
            </div>
          )}

          <label className="ui-label mt-6 mb-2 block">{t('When should the machine come?')}</label>
          <div className="relative">
            <CalendarDays className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--brand)]" />
            <input type="date" value={date} min={localDateString(new Date())} onChange={(e) => setDate(e.target.value)} className="ui-input pl-10" />
          </div>

          <label className="ui-check mt-5">
            <input type="checkbox" checked={consentAccepted} onChange={(e) => setConsentAccepted(e.target.checked)} />
            <span>I consent to NIRDHOOM using this field and booking information to coordinate the requested clearance service.</span>
          </label>

          <button type="button" onClick={() => void book()} disabled={!selected || busy || !consentAccepted} className="ui-btn is-primary is-lg is-block mt-5">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {busy ? 'Confirming booking…' : demoMode ? 'Book example pickup' : 'Book my pickup'}
          </button>

          {error && <div role="alert" className="ui-note is-ember mt-3">{error}</div>}
          {message && <div role="status" className="ui-note is-green mt-3">{message}</div>}
        </div>

        <aside className="ui-card is-wheat lg:sticky lg:top-24">
          <div className="ui-card-title"><ShieldCheck className="!text-[var(--wheat-ink)]" /><strong>Good to know</strong></div>
          <div className="mt-4 space-y-3 text-[13.5px] leading-6 text-[var(--ink-2)]">
            <p>• Your final Live quote comes from NIRDHOOM — you cannot change it from this screen.</p>
            <p>• Live booking needs your consent and a registered field.</p>
            <p>• Demo mode changes example data only.</p>
            <p>• Payment is not connected in this version.</p>
          </div>
          <div className="mt-6 rounded-2xl border border-[var(--wheat-line)] bg-[var(--surface)] p-4 shadow-sm">
            <span className="ui-kv-label block">{demoMode ? 'Example estimate' : 'Server quote'}</span>
            <strong className="mt-1 block font-[family-name:var(--font-display)] text-[30px] font-bold leading-tight text-[var(--ink)]">{demoMode ? `₹${estimate.toLocaleString()}` : 'Shown after booking'}</strong>
            <span className="text-[12px] text-[var(--muted)]">{demoMode ? 'Example only · no payment is made' : 'Authoritative quote comes from the server'}</span>
          </div>
        </aside>
      </section>
    </div>
  );
}
