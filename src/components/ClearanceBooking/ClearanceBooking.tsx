import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAppLanguage } from '../../i18n/LanguageContext';
import { CalendarDays, CheckCircle2, ClipboardCheck, Loader2, MapPin, ShieldCheck, Tractor } from 'lucide-react';
import { Field } from '../../types';
import { supabase } from '../../lib/supabase';
import LatticeLoader from '../LatticeLoader/LatticeLoader';

interface Props {
  fields: Field[];
  demoMode: boolean;
  onBooked: (fieldId: string, amount?: number) => void;
  onBookingChanged?: () => void;
}

type BookingRecord = {
  id: string; field_id: string; requested_date: string; status: string;
  quoted_amount: number; created_at: string; cancelled_at: string | null;
  reservation_state: string; guaranteed_by_date: string | null; machine_id: string | null;
};

function localDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function ClearanceBooking({ fields, demoMode, onBooked, onBookingChanged }: Props) {
  const { t } = useAppLanguage();
  const bookable = useMemo(
    () => fields.filter((f) => demoMode
      ? !['VERIFIED_NON_BURN', 'BOOKED', 'MACHINE_ASSIGNED', 'SCHEDULED', 'ON_THE_WAY', 'BALING_IN_PROGRESS', 'CLEARED_PENDING_AUDIT'].includes(f.status)
      : ['REGISTERED', 'CANCELLED'].includes(f.status)),
    [fields, demoMode],
  );
  const [fieldId, setFieldId] = useState(bookable[0]?.id || '');
  const [date, setDate] = useState(() => { const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); return localDateString(tomorrow); });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [serverQuote, setServerQuote] = useState<number | null>(null);
  const [serverReservationState, setServerReservationState] = useState<'RESERVED' | 'UNCONFIRMED' | null>(null);
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [bookingHistoryError, setBookingHistoryError] = useState('');
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const dbFieldIds = useMemo(() => fields.map((field) => field.dbId || field.id).filter(Boolean), [fields]);
  const maxBookingDate = useMemo(() => { const value = new Date(); value.setDate(value.getDate() + 90); return localDateString(value); }, []);

  useEffect(() => {
    if (!fieldId && bookable[0]?.id) setFieldId(bookable[0].id);
    if (fieldId && !bookable.some((field) => field.id === fieldId)) setFieldId(bookable[0]?.id || '');
  }, [bookable, fieldId]);

  const refreshBookings = useCallback(async () => {
    if (demoMode || !supabase || dbFieldIds.length === 0) {
      setBookings([]);
      setBookingHistoryError('');
      setBookingsLoading(false);
      return;
    }
    setBookingsLoading(true);
    setBookingHistoryError('');
    try {
      const { data, error: queryError } = await supabase.from('bookings')
        .select('id,field_id,requested_date,status,quoted_amount,created_at,cancelled_at,reservation_state,guaranteed_by_date,machine_id')
        .in('field_id', dbFieldIds).order('created_at', { ascending: false }).limit(25);
      if (queryError) {
        setBookingHistoryError('Could not load booking history. Please refresh and try again.');
      } else {
        setBookings((data || []) as BookingRecord[]);
      }
    } catch {
      setBookingHistoryError('Could not load booking history because the server was unreachable. Check your connection and try again.');
    } finally {
      setBookingsLoading(false);
    }
  }, [demoMode, dbFieldIds]);

  useEffect(() => { void refreshBookings(); }, [refreshBookings]);

  async function cancelBooking(bookingId: string) {
    if (!supabase) { setBookingHistoryError('Live Supabase is not configured.'); return; }
    setCancellingId(bookingId); setBookingHistoryError('');
    try {
      const { error: cancelError } = await supabase.rpc('cancel_clearance_booking', { p_booking_id: bookingId });
      if (cancelError) throw new Error(cancelError.message);
      await refreshBookings();
      onBookingChanged?.();
    } catch (cause) {
      setBookingHistoryError(cause instanceof Error ? cause.message : 'Booking could not be cancelled.');
    } finally { setCancellingId(null); }
  }

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
    if (!demoMode && bookings.some((booking) =>
      booking.field_id === (selected.dbId || selected.id)
      && !['CANCELLED','FAILED','VERIFIED','REJECTED'].includes(booking.status)
    )) {
      setError('This field already has an active request. Check Your bookings for its current capacity status.');
      return;
    }
    if (date < localDateString(new Date())) {
      setError('Please choose today or a future date.');
      return;
    }
    if (date > maxBookingDate) {
      setError('Please choose a pickup date within the next 90 days.');
      return;
    }

    setBusy(true);
    try {
      if (demoMode) {
        onBooked(selected.id, estimate);
        setMessage('Example pickup booked. This is demo data only; no real machine was reserved and no payment was made.');
        return;
      }
      if (!supabase) throw new Error('Live Supabase is not configured.');
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) {
        throw new Error('Your session has expired. Please verify your phone again.');
      }

      const { error: consentError } = await supabase.rpc('record_farmer_network_consent');
      if (consentError) throw new Error(consentError.message);
      const { data, error: rpcError } = await supabase.rpc('reserve_clearance_booking_v2', {
        p_field_id: selected.dbId || selected.id,
        p_requested_date: date,
      });
      if (rpcError) throw new Error(rpcError.message);
      const booking = data as {
        quoted_amount?: number; status?: string; reservation_state?: string;
        guaranteed_by_date?: string | null; machine_id?: string | null;
      } | null;
      const quote = Number(booking?.quoted_amount || 0);
      if (!Number.isFinite(quote) || quote <= 0) throw new Error('The server returned no valid quote. Refresh your bookings before retrying.');
      const capacityReserved = booking?.reservation_state === 'RESERVED'
        && Boolean(booking.machine_id)
        && Boolean(booking.guaranteed_by_date);
      setServerQuote(quote);
      setServerReservationState(capacityReserved ? 'RESERVED' : 'UNCONFIRMED');
      if (capacityReserved) onBooked(selected.id, quote, 'RESERVED');
      await refreshBookings();
      onBookingChanged?.();
      setMessage(capacityReserved
        ? 'Machine capacity is reserved for ' + booking!.guaranteed_by_date + '. No service penalty is enabled.'
        : 'Your request was saved, but machine capacity is not available yet. The date is indicative only—not a guarantee—and no penalty applies.');
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

      {(busy || bookingsLoading || Boolean(cancellingId)) && (
        <div className="ui-card flex justify-center border border-amber-200 bg-amber-50 text-amber-950" role="status" aria-live="polite">
          <LatticeLoader label={cancellingId ? 'Cancelling booking' : bookingsLoading ? 'Loading booking history' : 'Confirming pickup'} color="#92400e" cellSize={7} gap={2} fontSize={13} step={80} />
        </div>
      )}
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
          <select value={fieldId} onChange={(e) => { setFieldId(e.target.value); setServerQuote(null); setServerReservationState(null); setError(''); setMessage(''); }} className="ui-select">
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
            <input type="date" value={date} min={localDateString(new Date())} max={maxBookingDate} onChange={(e) => { setDate(e.target.value); setServerQuote(null); setError(''); setMessage(''); }} className="ui-input pl-10" />
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
            <span className="ui-kv-label block">{demoMode ? 'Example estimate' : serverReservationState === 'RESERVED' ? 'Capacity-reserved quote' : serverReservationState === 'UNCONFIRMED' ? 'Indicative quote' : 'Server quote'}</span>
            <strong className="mt-1 block font-[family-name:var(--font-display)] text-[30px] font-bold leading-tight text-[var(--ink)]">{demoMode ? `₹${estimate.toLocaleString()}` : serverQuote !== null ? `₹${serverQuote.toLocaleString('en-IN')}` : 'Shown after booking'}</strong>
            <span className="text-[12px] text-[var(--muted)]">{demoMode ? 'Example only · no payment is made' : serverReservationState === 'RESERVED' ? 'Capacity reserved · no payment or service penalty is enabled' : serverReservationState === 'UNCONFIRMED' ? 'Indicative only · requested date is not guaranteed' : 'Server quote is shown after your request'}</span>
          </div>
        </aside>
      </section>

      {!demoMode && (
        <section className="ui-card mt-4" aria-labelledby="booking-history-title">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="booking-history-title" className="ui-card-title">{t('Your bookings')}</h2>
              <p className="text-sm text-[var(--ink-2)]">Requests show whether machine capacity is reserved. An indicative date is not a guarantee.</p>
            </div>
            <button type="button" className="ui-btn is-secondary" onClick={() => void refreshBookings()} disabled={bookingsLoading}>
              {bookingsLoading ? t('Loading…') : t('Refresh bookings')}
            </button>
          </div>
          {bookingHistoryError && <div role="alert" className="ui-note is-ember mt-3">{bookingHistoryError}</div>}
          {bookingsLoading && bookings.length === 0 && <p className="mt-4 text-sm text-[var(--muted)]">{t('Loading your bookings…')}</p>}
          {!bookingsLoading && bookings.length === 0 && !bookingHistoryError && <p className="mt-4 text-sm text-[var(--muted)]">{t('No booking requests yet. Requests and capacity-reserved pickups will appear here.')}</p>}
          {bookings.length > 0 && <div className="mt-4 space-y-3">
            {bookings.map((booking) => {
              const field = fields.find((item) => (item.dbId || item.id) === booking.field_id);
              const canCancel = ['REQUESTED', 'BOOKED', 'MACHINE_ASSIGNED'].includes(booking.status);
              return (
                <article key={booking.id} className="flex flex-col gap-3 rounded-xl border border-[var(--line)] p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <strong className="block text-sm text-[var(--ink)]">{field ? field.khasra_no + ' · ' + field.village : t('Registered field')}</strong>
                    <p className="mt-1 text-sm text-[var(--ink-2)]">{booking.reservation_state === 'RESERVED' ? 'Capacity-reserved pickup date' : 'Requested date (not guaranteed)'}: {new Date(booking.requested_date + 'T00:00:00').toLocaleDateString('en-IN')}</p>
                    <p className="mt-1 text-sm text-[var(--ink-2)]">Quote: ₹{Number(booking.quoted_amount).toLocaleString('en-IN')} · {booking.status.replace(/_/g, ' ')}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">{booking.reservation_state === 'RESERVED' ? 'Machine capacity is reserved. No service penalty is enabled.' : 'Awaiting capacity. This date is indicative only; no guarantee or penalty applies.'}</p>
                  </div>
                  {canCancel && <button type="button" className="ui-btn is-secondary" onClick={() => void cancelBooking(booking.id)} disabled={cancellingId !== null}>{cancellingId === booking.id ? t('Cancelling…') : t('Cancel booking')}</button>}
                </article>
              );
            })}
          </div>}
        </section>
      )}
    </div>
  );
}
