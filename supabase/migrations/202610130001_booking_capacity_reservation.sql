-- P0-A: a booking is commercially confirmed only after capacity is reserved.
-- A request without capacity stays REQUESTED, carries no guarantee/penalty, and
-- does not move the field into the scheduled lifecycle.
CREATE TABLE IF NOT EXISTS public.booking_capacity_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL UNIQUE REFERENCES public.bookings(id) ON DELETE CASCADE,
  capacity_window_id uuid NOT NULL REFERENCES public.machine_capacity_windows(id),
  reserved_acres numeric NOT NULL CHECK (reserved_acres > 0),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','RELEASED')),
  reserved_at timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz,
  CONSTRAINT booking_capacity_reservations_release_state CHECK (
    (status = 'ACTIVE' AND released_at IS NULL) OR
    (status = 'RELEASED' AND released_at IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS booking_capacity_reservations_active_window_idx
  ON public.booking_capacity_reservations(capacity_window_id)
  WHERE status = 'ACTIVE';

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS capacity_reserved_at timestamptz;

CREATE OR REPLACE FUNCTION public.release_booking_capacity_on_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  reservation public.booking_capacity_reservations%rowtype;
  window_row public.machine_capacity_windows%rowtype;
BEGIN
  IF OLD.status IN ('CANCELLED','FAILED') OR NEW.status NOT IN ('CANCELLED','FAILED') THEN
    RETURN NEW;
  END IF;

  SELECT * INTO reservation
  FROM public.booking_capacity_reservations r
  WHERE r.booking_id = NEW.id AND r.status = 'ACTIVE'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  SELECT * INTO window_row
  FROM public.machine_capacity_windows w
  WHERE w.id = reservation.capacity_window_id
  FOR UPDATE;

  IF FOUND THEN
    UPDATE public.machine_capacity_windows
    SET reserved_acres = greatest(0, reserved_acres - reservation.reserved_acres),
        status = CASE
          WHEN status = 'CANCELLED' THEN 'CANCELLED'
          WHEN greatest(0, reserved_acres - reservation.reserved_acres) < capacity_acres THEN 'OPEN'
          ELSE 'FULL'
        END
    WHERE id = window_row.id;
  END IF;

  UPDATE public.booking_capacity_reservations
  SET status = 'RELEASED', released_at = now()
  WHERE id = reservation.id AND status = 'ACTIVE';

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS bookings_release_capacity_on_cancel ON public.bookings;
CREATE TRIGGER bookings_release_capacity_on_cancel
AFTER UPDATE OF status ON public.bookings
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.release_booking_capacity_on_cancel();

CREATE OR REPLACE FUNCTION public.reserve_clearance_booking_v2(
  p_field_id uuid,
  p_requested_date date
)
RETURNS public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  f public.fields%rowtype;
  b public.bookings%rowtype;
  w public.machine_capacity_windows%rowtype;
  v_days numeric;
  v_urgency numeric;
  v_day_factor numeric;
  v_rate numeric;
  v_amount numeric;
  v_penalty numeric;
  v_band text;
  v_reserved boolean := false;
  v_day_start timestamptz;
  v_day_end timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;
  IF p_field_id IS NULL OR p_requested_date IS NULL THEN
    RAISE EXCEPTION 'Choose a field and pickup date';
  END IF;

  SELECT * INTO f FROM public.fields WHERE id = p_field_id FOR UPDATE;
  IF NOT FOUND OR f.owner_id <> auth.uid() THEN
    RAISE EXCEPTION 'Field is not owned by the current farmer';
  END IF;
  IF f.status = 'VERIFIED_NON_BURN' THEN
    RAISE EXCEPTION 'This field is already verified as cleared and cannot be booked again';
  END IF;
  IF f.status NOT IN ('REGISTERED', 'CANCELLED') THEN
    RAISE EXCEPTION 'This field already has an active or completed clearance workflow';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.consents c
    WHERE c.profile_id = auth.uid()
      AND c.consent_type = 'farmer_network'
      AND c.revoked_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Active farmer consent is required before booking';
  END IF;
  IF p_requested_date < current_date OR p_requested_date > current_date + 90 THEN
    RAISE EXCEPTION 'Choose a pickup date within the next 90 days';
  END IF;
  IF f.acreage IS NULL OR f.acreage <= 0 OR f.acreage > 500 THEN
    RAISE EXCEPTION 'Field acreage is outside the supported booking range';
  END IF;

  v_days := COALESCE(f.expected_harvest_date - current_date, 14);
  v_urgency := CASE WHEN v_days <= 3 THEN 1.28 WHEN v_days <= 7 THEN 1.14 WHEN v_days <= 14 THEN 1.04 ELSE 0.94 END;
  v_day_factor := CASE WHEN extract(isodow FROM p_requested_date) = 7 THEN 1.08 ELSE 1 END;
  v_rate := round(greatest(1000, least(3200, 1500 * v_urgency * v_day_factor)) / 10) * 10;
  v_amount := round(v_rate * f.acreage, 2);
  v_penalty := least(v_amount, greatest(2500, f.acreage * 2500));
  v_band := CASE WHEN v_urgency >= 1.2 THEN 'urgent' WHEN v_urgency >= 1 THEN 'standard' ELSE 'early-booking' END;

  v_day_start := p_requested_date::timestamp AT TIME ZONE 'Asia/Kolkata';
  v_day_end := (p_requested_date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata';

  -- FOR UPDATE serializes capacity accounting. SKIP LOCKED avoids waiting behind
  -- a concurrent checkout; if all eligible capacity is busy, the request remains unconfirmed.
  FOR w IN
    SELECT cw.*
    FROM public.machine_capacity_windows cw
    WHERE cw.status IN ('OPEN','FULL')
      AND cw.window_start < v_day_end
      AND cw.window_end > v_day_start
      AND cw.reserved_acres + f.acreage <= cw.capacity_acres
    ORDER BY cw.window_start, cw.id
    FOR UPDATE OF cw SKIP LOCKED
  LOOP
    UPDATE public.machine_capacity_windows
    SET reserved_acres = reserved_acres + f.acreage,
        status = CASE WHEN reserved_acres + f.acreage >= capacity_acres THEN 'FULL' ELSE 'OPEN' END
    WHERE id = w.id;

    INSERT INTO public.bookings(
      field_id, requested_date, rate_per_acre, quoted_amount,
      guaranteed_by_date, penalty_amount, pricing_band, quote_metadata,
      status, accepted_at, machine_id, capacity_reserved_at
    ) VALUES (
      p_field_id, p_requested_date, v_rate, v_amount,
      p_requested_date, v_penalty, v_band,
      jsonb_build_object('engine','nirdhoom-pricing-v1','server_authoritative',true,
        'days_to_harvest',v_days,'capacity_reserved',true,'capacity_window_id',w.id),
      'BOOKED', now(), w.machine_id, now()
    ) RETURNING * INTO b;

    INSERT INTO public.booking_capacity_reservations(booking_id, capacity_window_id, reserved_acres)
    VALUES (b.id, w.id, f.acreage);
    v_reserved := true;
    EXIT;
  END LOOP;

  IF NOT v_reserved THEN
    INSERT INTO public.bookings(
      field_id, requested_date, rate_per_acre, quoted_amount,
      guaranteed_by_date, penalty_amount, pricing_band, quote_metadata,
      status, accepted_at, capacity_reserved_at
    ) VALUES (
      p_field_id, p_requested_date, v_rate, v_amount,
      NULL, 0, v_band,
      jsonb_build_object('engine','nirdhoom-pricing-v1','server_authoritative',true,
        'days_to_harvest',v_days,'capacity_reserved',false,
        'message','Request received; date is not guaranteed until capacity is assigned'),
      'REQUESTED', NULL, NULL
    ) RETURNING * INTO b;
  ELSE
    UPDATE public.fields
    SET status = 'SCHEDULED',
        clearance_deadline = (p_requested_date::text || 'T18:00:00+05:30')::timestamptz,
        updated_at = now()
    WHERE id = p_field_id;
  END IF;

  RETURN b;
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'This field already has an active booking for that date';
END;
$function$;

REVOKE ALL ON FUNCTION public.reserve_clearance_booking_v2(uuid,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reserve_clearance_booking_v2(uuid,date) TO authenticated;
REVOKE ALL ON FUNCTION public.release_booking_capacity_on_cancel() FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.booking_capacity_reservations IS
  'Transactional machine-window acreage reservations backing confirmed bookings. A BOOKED guarantee requires an ACTIVE row.';
