-- NIRDHOOM: keep the field lifecycle status inside its declared constraint.
-- bookings.status remains BOOKED; fields.status uses SCHEDULED while a booking is active.
-- The previous RPC wrote fields.status='BOOKED', violating fields_status_check and
-- rolling back the entire booking transaction.

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
  v_days numeric;
  v_urgency numeric;
  v_day_factor numeric;
  v_rate numeric;
  v_amount numeric;
  v_guaranteed date;
  v_penalty numeric;
  v_band text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF p_field_id IS NULL OR p_requested_date IS NULL THEN RAISE EXCEPTION 'Choose a field and pickup date'; END IF;

  SELECT * INTO f FROM public.fields WHERE id = p_field_id FOR UPDATE;
  IF NOT FOUND OR f.owner_id <> auth.uid() THEN RAISE EXCEPTION 'Field is not owned by the current farmer'; END IF;
  IF f.status = 'VERIFIED_NON_BURN' THEN RAISE EXCEPTION 'This field is already verified as cleared and cannot be booked again'; END IF;
  IF f.status NOT IN ('REGISTERED', 'CANCELLED') THEN RAISE EXCEPTION 'This field already has an active or completed clearance workflow'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.consents c
    WHERE c.profile_id = auth.uid() AND c.consent_type = 'farmer_network' AND c.revoked_at IS NULL
  ) THEN RAISE EXCEPTION 'Active farmer consent is required before booking'; END IF;
  IF p_requested_date < current_date THEN RAISE EXCEPTION 'Requested date is in the past'; END IF;
  IF p_requested_date > current_date + 90 THEN RAISE EXCEPTION 'Choose a pickup date within the next 90 days'; END IF;
  IF f.acreage IS NULL OR f.acreage <= 0 OR f.acreage > 500 THEN RAISE EXCEPTION 'Field acreage is outside the supported booking range'; END IF;

  v_days := COALESCE(f.expected_harvest_date::date - current_date, 14);
  v_urgency := CASE WHEN v_days <= 3 THEN 1.28 WHEN v_days <= 7 THEN 1.14 WHEN v_days <= 14 THEN 1.04 ELSE 0.94 END;
  v_day_factor := CASE WHEN extract(isodow FROM p_requested_date) = 7 THEN 1.08 ELSE 1 END;
  v_rate := round(greatest(1000, least(3200, 1500 * v_urgency * v_day_factor)) / 10) * 10;
  v_amount := round(v_rate * f.acreage, 2);
  v_guaranteed := p_requested_date;
  v_penalty := least(v_amount, greatest(2500, f.acreage * 2500));
  v_band := CASE WHEN v_urgency >= 1.2 THEN 'urgent' WHEN v_urgency >= 1 THEN 'standard' ELSE 'early-booking' END;

  INSERT INTO public.bookings(
    field_id, requested_date, rate_per_acre, quoted_amount, guaranteed_by_date,
    penalty_amount, pricing_band, quote_metadata, status, accepted_at
  )
  VALUES (
    p_field_id, p_requested_date, v_rate, v_amount, v_guaranteed, v_penalty, v_band,
    jsonb_build_object('engine','nirdhoom-pricing-v1','server_authoritative',true,'days_to_harvest',v_days),
    'BOOKED', now()
  )
  RETURNING * INTO b;

  -- 'SCHEDULED' is allowed by fields_status_check; 'BOOKED' belongs to bookings.status.
  UPDATE public.fields
  SET status = 'SCHEDULED',
      clearance_deadline = (v_guaranteed::text || 'T18:00:00+05:30')::timestamptz,
      updated_at = now()
  WHERE id = p_field_id;

  RETURN b;
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'This field already has an active booking for that date';
END;
$function$;

REVOKE ALL ON FUNCTION public.reserve_clearance_booking_v2(uuid,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reserve_clearance_booking_v2(uuid,date) TO authenticated;
