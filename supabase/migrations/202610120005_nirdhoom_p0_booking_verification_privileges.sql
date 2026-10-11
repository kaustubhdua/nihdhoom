-- NIRDHOOM P0 release hardening: capacity-backed bookings, truthful verification provenance,
-- and least-privilege anonymous access. New migration only; do not edit applied history.

DO $preflight$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.machine_capacity_windows WHERE reserved_acres > 0
  ) THEN
    RAISE EXCEPTION 'P0 booking migration stopped: existing reserved acres lack auditable reservation rows; reconcile capacity manually before applying';
  END IF;
END;
$preflight$;

-- Persist provider observations idempotently and preserve many-to-many field matches.
-- Existing direct field matches are migrated into the explicit match table.
ALTER TABLE public.firms_observations
  ADD COLUMN IF NOT EXISTS provider_observation_key text;

UPDATE public.firms_observations o
SET provider_observation_key = CASE
  WHEN o.acquired_at IS NOT NULL THEN concat_ws('|',
    o.source, o.sensor, o.latitude::text, o.longitude::text,
    to_char(o.acquired_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
  ELSE concat_ws('|',
    o.source, o.sensor, o.latitude::text, o.longitude::text, 'undated',
    COALESCE(o.raw->>'satellite',''), COALESCE(o.frp::text,''), COALESCE(o.confidence,''))
END
WHERE o.provider_observation_key IS NULL;

ALTER TABLE public.firms_observations
  ALTER COLUMN provider_observation_key SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS firms_observations_provider_key_uidx
  ON public.firms_observations(provider_observation_key);

CREATE TABLE IF NOT EXISTS public.firms_observation_field_matches (
  observation_id uuid NOT NULL REFERENCES public.firms_observations(id) ON DELETE CASCADE,
  field_id uuid NOT NULL REFERENCES public.fields(id) ON DELETE CASCADE,
  match_type text NOT NULL CHECK (match_type IN ('point_in_polygon','legacy_existing_field_match')),
  source text NOT NULL DEFAULT 'NASA FIRMS',
  matched_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (observation_id, field_id)
);
CREATE INDEX IF NOT EXISTS firms_observation_field_matches_field_idx
  ON public.firms_observation_field_matches(field_id, matched_at DESC);
ALTER TABLE public.firms_observation_field_matches ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.firms_observation_field_matches FROM PUBLIC, anon, authenticated;
INSERT INTO public.firms_observation_field_matches(observation_id,field_id,match_type,source)
SELECT o.id,o.matched_field_id,'legacy_existing_field_match',o.source
FROM public.firms_observations o
WHERE o.matched_field_id IS NOT NULL
ON CONFLICT (observation_id,field_id) DO NOTHING;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS reservation_state text NOT NULL DEFAULT 'UNCONFIRMED';

CREATE TABLE IF NOT EXISTS public.booking_capacity_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL UNIQUE REFERENCES public.bookings(id) ON DELETE CASCADE,
  capacity_window_id uuid NOT NULL REFERENCES public.machine_capacity_windows(id) ON DELETE RESTRICT,
  reserved_acres numeric(10,2) NOT NULL CHECK (reserved_acres > 0),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','RELEASED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz,
  CHECK ((status = 'ACTIVE' AND released_at IS NULL) OR (status = 'RELEASED' AND released_at IS NOT NULL))
);

ALTER TABLE public.booking_capacity_reservations ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.booking_capacity_reservations FROM PUBLIC, anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE public.booking_capacity_reservations TO service_role;

-- Old records have no capacity-reservation row to prove the guarantee. Preserve the
-- quote and historical status where an operational job already exists, but remove
-- unsupported guarantee/penalty claims. New requests use REQUESTED until capacity commits.
UPDATE public.bookings b
SET guaranteed_by_date = NULL,
    penalty_amount = 0,
    reservation_state = 'UNCONFIRMED',
    status = CASE
      WHEN b.status = 'BOOKED'
       AND NOT EXISTS (SELECT 1 FROM public.jobs j WHERE j.booking_id = b.id)
      THEN 'REQUESTED'
      ELSE b.status
    END,
    quote_metadata = COALESCE(b.quote_metadata, '{}'::jsonb)
      || jsonb_build_object(
        'capacity_reconciled_at', now(),
        'legacy_guarantee_status', 'unverified_no_capacity_reservation',
        'penalty_status', 'disabled_until_contract_approval'
      )
WHERE NOT EXISTS (
  SELECT 1 FROM public.booking_capacity_reservations r
  WHERE r.booking_id = b.id AND r.status = 'ACTIVE'
);

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_reservation_state_check;
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_reservation_state_check
  CHECK (reservation_state IN ('UNCONFIRMED','RESERVED','RELEASED','LEGACY_UNVERIFIED'));
ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_reserved_requires_capacity_check;
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_reserved_requires_capacity_check
  CHECK (
    reservation_state <> 'RESERVED'
    OR (machine_id IS NOT NULL AND guaranteed_by_date IS NOT NULL)
  );
ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_unreserved_no_guarantee_check;
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_unreserved_no_guarantee_check
  CHECK (
    reservation_state = 'RESERVED'
    OR (guaranteed_by_date IS NULL AND penalty_amount = 0)
  );

CREATE INDEX IF NOT EXISTS booking_capacity_reservations_window_status_idx
  ON public.booking_capacity_reservations(capacity_window_id, status);

-- Deferred cross-table assertions make it impossible to commit a guarantee without
-- an active reservation for the same machine/window. Deferral allows the booking
-- and reservation rows to be created in one transaction in either order.
CREATE OR REPLACE FUNCTION public.assert_booking_has_capacity_reservation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
BEGIN
  IF NEW.reservation_state = 'RESERVED' AND NOT EXISTS (
    SELECT 1
    FROM public.booking_capacity_reservations r
    JOIN public.machine_capacity_windows w ON w.id = r.capacity_window_id
    WHERE r.booking_id = NEW.id
      AND r.status = 'ACTIVE'
      AND r.reserved_acres > 0
      AND w.machine_id = NEW.machine_id
      AND w.status IN ('OPEN','FULL')
      AND w.reserved_acres >= r.reserved_acres
  ) THEN
    RAISE EXCEPTION 'A guaranteed booking requires an active matching machine-capacity reservation';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE CONSTRAINT TRIGGER bookings_require_capacity_reservation
AFTER INSERT OR UPDATE ON public.bookings
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.assert_booking_has_capacity_reservation();

CREATE OR REPLACE FUNCTION public.assert_capacity_reservation_has_booking()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
DECLARE
  target_booking_id uuid;
BEGIN
  target_booking_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.booking_id ELSE NEW.booking_id END;
  IF EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.id = target_booking_id AND b.reservation_state = 'RESERVED'
  ) AND NOT EXISTS (
    SELECT 1
    FROM public.booking_capacity_reservations r
    JOIN public.bookings b ON b.id = r.booking_id
    JOIN public.machine_capacity_windows w ON w.id = r.capacity_window_id
    WHERE r.booking_id = target_booking_id
      AND r.status = 'ACTIVE'
      AND r.reserved_acres > 0
      AND b.machine_id = w.machine_id
      AND w.reserved_acres >= r.reserved_acres
  ) THEN
    RAISE EXCEPTION 'An active capacity reservation cannot be removed from a guaranteed booking';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.booking_capacity_reservations r
    JOIN public.machine_capacity_windows w ON w.id = r.capacity_window_id
    JOIN public.booking_capacity_reservations other_r
      ON other_r.status = 'ACTIVE'
     AND other_r.capacity_window_id <> r.capacity_window_id
    JOIN public.machine_capacity_windows other_w ON other_w.id = other_r.capacity_window_id
    WHERE r.booking_id = target_booking_id
      AND r.status = 'ACTIVE'
      AND w.machine_id = other_w.machine_id
      AND w.window_start < other_w.window_end
      AND w.window_end > other_w.window_start
  ) THEN
    RAISE EXCEPTION 'A machine cannot have active reservations in overlapping capacity windows';
  END IF;
  RETURN NULL;
END;
$function$;

CREATE CONSTRAINT TRIGGER capacity_reservation_requires_booking
AFTER INSERT OR UPDATE OR DELETE ON public.booking_capacity_reservations
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.assert_capacity_reservation_has_booking();

CREATE OR REPLACE FUNCTION public.assert_capacity_window_matches_reservations()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
DECLARE
  active_acres numeric;
BEGIN
  SELECT COALESCE(sum(r.reserved_acres), 0) INTO active_acres
  FROM public.booking_capacity_reservations r
  WHERE r.capacity_window_id = NEW.id AND r.status = 'ACTIVE';
  IF NEW.reserved_acres <> active_acres THEN
    RAISE EXCEPTION 'Capacity window reserved_acres must equal active booking reservations';
  END IF;
  IF NEW.status = 'CANCELLED' AND active_acres > 0 THEN
    RAISE EXCEPTION 'A capacity window with active reservations cannot be cancelled';
  END IF;
  RETURN NULL;
END;
$function$;

CREATE CONSTRAINT TRIGGER capacity_window_matches_reservations
AFTER INSERT OR UPDATE ON public.machine_capacity_windows
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.assert_capacity_window_matches_reservations();

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
  actor uuid := auth.uid();
  f public.fields%rowtype;
  b public.bookings%rowtype;
  w public.machine_capacity_windows%rowtype;
  v_days numeric;
  v_urgency numeric;
  v_day_factor numeric;
  v_rate numeric;
  v_amount numeric;
  v_band text;
  v_reservation_state text := 'UNCONFIRMED';
  v_booking_status text := 'REQUESTED';
  v_machine_id uuid := NULL;
  v_guaranteed date := NULL;
  v_updated integer;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF p_field_id IS NULL OR p_requested_date IS NULL THEN
    RAISE EXCEPTION 'Choose a field and pickup date';
  END IF;

  -- Serializes concurrent requests for the same field and makes the active-request
  -- check reliable even when no capacity window exists.
  SELECT * INTO f FROM public.fields WHERE id = p_field_id FOR UPDATE;
  IF NOT FOUND OR f.owner_id <> actor THEN
    RAISE EXCEPTION 'Field is not owned by the current farmer';
  END IF;
  IF f.status = 'VERIFIED_NON_BURN' THEN
    RAISE EXCEPTION 'This field is already verified as cleared and cannot be booked again';
  END IF;
  IF f.status NOT IN ('REGISTERED','CANCELLED') THEN
    RAISE EXCEPTION 'This field already has an active or completed clearance workflow';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.bookings active_booking
    WHERE active_booking.field_id = p_field_id
      AND active_booking.status NOT IN ('CANCELLED','FAILED','VERIFIED','REJECTED')
  ) THEN
    RAISE EXCEPTION 'This field already has an active booking request';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.consents c
    WHERE c.profile_id = actor
      AND c.consent_type = 'farmer_network'
      AND c.revoked_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Active farmer consent is required before booking';
  END IF;
  IF p_requested_date < current_date THEN RAISE EXCEPTION 'Requested date is in the past'; END IF;
  IF p_requested_date > current_date + 90 THEN
    RAISE EXCEPTION 'Choose a pickup date within the next 90 days';
  END IF;
  IF f.acreage IS NULL OR f.acreage <= 0 OR f.acreage > 500 THEN
    RAISE EXCEPTION 'Field acreage is outside the supported booking range';
  END IF;

  v_days := COALESCE(f.expected_harvest_date::date - current_date, 14);
  v_urgency := CASE
    WHEN v_days <= 3 THEN 1.28
    WHEN v_days <= 7 THEN 1.14
    WHEN v_days <= 14 THEN 1.04
    ELSE 0.94
  END;
  v_day_factor := CASE WHEN extract(isodow FROM p_requested_date) = 7 THEN 1.08 ELSE 1 END;
  v_rate := round(greatest(1000, least(3200, 1500 * v_urgency * v_day_factor)) / 10) * 10;
  v_amount := round(v_rate * f.acreage, 2);
  v_band := CASE WHEN v_urgency >= 1.2 THEN 'urgent'
                 WHEN v_urgency >= 1 THEN 'standard'
                 ELSE 'early-booking' END;

  -- Only OPEN windows with an eligible machine and sufficient remaining acres can
  -- create a guarantee. FOR UPDATE SKIP LOCKED prevents two requests consuming the
  -- same final capacity; a concurrent request safely becomes UNCONFIRMED instead.
  SELECT cw.* INTO w
  FROM public.machine_capacity_windows cw
  JOIN public.machines m ON m.id = cw.machine_id
  WHERE cw.status = 'OPEN'
    AND m.status IN ('IDLE','AVAILABLE','ACTIVE')
    AND cw.window_start < ((p_requested_date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata')
    AND cw.window_end > (p_requested_date::timestamp AT TIME ZONE 'Asia/Kolkata')
    AND cw.reserved_acres + f.acreage <= cw.capacity_acres
    AND NOT EXISTS (
      SELECT 1
      FROM public.booking_capacity_reservations active_r
      JOIN public.machine_capacity_windows active_w ON active_w.id = active_r.capacity_window_id
      WHERE active_r.status = 'ACTIVE'
        AND active_w.machine_id = cw.machine_id
        AND active_w.id <> cw.id
        AND active_w.window_start < cw.window_end
        AND active_w.window_end > cw.window_start
    )
  ORDER BY cw.window_start, cw.created_at, cw.id
  LIMIT 1
  FOR UPDATE OF cw, m SKIP LOCKED;

  IF FOUND THEN
    UPDATE public.machine_capacity_windows
    SET reserved_acres = reserved_acres + f.acreage,
        status = CASE WHEN reserved_acres + f.acreage >= capacity_acres THEN 'FULL' ELSE status END
    WHERE id = w.id
      AND status = 'OPEN'
      AND reserved_acres + f.acreage <= capacity_acres;
    GET DIAGNOSTICS v_updated = ROW_COUNT;
    IF v_updated <> 1 THEN RAISE EXCEPTION 'Capacity changed while reserving; retry the request'; END IF;

    v_reservation_state := 'RESERVED';
    v_booking_status := 'MACHINE_ASSIGNED';
    v_machine_id := w.machine_id;
    v_guaranteed := p_requested_date;
  END IF;

  INSERT INTO public.bookings(
    field_id, requested_date, rate_per_acre, quoted_amount, machine_id,
    guaranteed_by_date, penalty_amount, pricing_band, quote_metadata,
    status, accepted_at, reservation_state
  )
  VALUES (
    p_field_id, p_requested_date, v_rate, v_amount, v_machine_id,
    v_guaranteed, 0, v_band,
    jsonb_build_object(
      'engine','nirdhoom-pricing-v1',
      'server_authoritative',true,
      'days_to_harvest',v_days,
      'capacity_state',v_reservation_state,
      'penalty_status','disabled_until_contract_approval',
      'guarantee_note',CASE WHEN v_guaranteed IS NULL
        THEN 'Requested date is indicative only; no machine capacity has been reserved.'
        ELSE 'Date is capacity-reserved; no service penalty is enabled.' END
    ),
    v_booking_status, CASE WHEN v_reservation_state = 'RESERVED' THEN now() ELSE NULL END,
    v_reservation_state
  ) RETURNING * INTO b;

  IF v_reservation_state = 'RESERVED' THEN
    INSERT INTO public.booking_capacity_reservations(booking_id, capacity_window_id, reserved_acres)
    VALUES (b.id, w.id, f.acreage);
    UPDATE public.fields
    SET status = 'MACHINE_ASSIGNED',
        clearance_deadline = (p_requested_date::text || 'T18:00:00+05:30')::timestamptz,
        updated_at = now()
    WHERE id = p_field_id;
  END IF;

  RETURN b;
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'This field already has an active booking request';
END;
$function$;

CREATE OR REPLACE FUNCTION public.cancel_clearance_booking(p_booking_id uuid)
RETURNS public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  actor uuid := auth.uid();
  b public.bookings%rowtype;
  r public.booking_capacity_reservations%rowtype;
  remaining_acres numeric;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  SELECT * INTO b FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.fields f WHERE f.id = b.field_id AND f.owner_id = actor
  ) THEN RAISE EXCEPTION 'Booking is not owned by the current farmer'; END IF;
  IF b.status NOT IN ('REQUESTED','BOOKED','MACHINE_ASSIGNED') THEN
    RAISE EXCEPTION 'Booking cannot be cancelled at this stage';
  END IF;
  IF EXISTS (SELECT 1 FROM public.jobs j WHERE j.booking_id = b.id) THEN
    RAISE EXCEPTION 'A booking with a created job must be resolved by operations, not cancelled by the farmer';
  END IF;

  SELECT * INTO r FROM public.booking_capacity_reservations
  WHERE booking_id = b.id AND status = 'ACTIVE' FOR UPDATE;
  IF FOUND THEN
    UPDATE public.machine_capacity_windows
    SET reserved_acres = greatest(0, reserved_acres - r.reserved_acres),
        status = CASE
          WHEN status = 'FULL' AND greatest(0, reserved_acres - r.reserved_acres) < capacity_acres THEN 'OPEN'
          ELSE status
        END
    WHERE id = r.capacity_window_id;
    UPDATE public.booking_capacity_reservations
    SET status = 'RELEASED', released_at = now()
    WHERE id = r.id;
  END IF;

  UPDATE public.bookings
  SET status = 'CANCELLED',
      reservation_state = CASE WHEN b.reservation_state = 'RESERVED' THEN 'RELEASED' ELSE 'UNCONFIRMED' END,
      guaranteed_by_date = NULL,
      penalty_amount = 0,
      updated_at = now()
  WHERE id = b.id RETURNING * INTO b;

  UPDATE public.fields
  SET status = 'CANCELLED', clearance_deadline = NULL, updated_at = now()
  WHERE id = b.field_id;
  RETURN b;
END;
$function$;

-- Accurate evidence provenance: only observation IDs explicitly supplied by the
-- verifier and confirmed to match this field are recorded as reviewed.
CREATE OR REPLACE FUNCTION public.record_verification_review(
  p_field_id uuid,
  p_result text,
  p_confidence numeric,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS public.verification_events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v public.verification_events%rowtype;
  actor uuid := auth.uid();
  role_name text;
  completed_job uuid;
  completed_at timestamptz;
  evidence_count integer;
  lot_count integer;
  requested_firms_count integer := 0;
  matched_firms_count integer := 0;
  firms_details jsonb := '[]'::jsonb;
  firms_ids uuid[] := ARRAY[]::uuid[];
  evidence_sources jsonb := '[]'::jsonb;
  verification_method text;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  SELECT p.role INTO role_name FROM public.profiles p WHERE p.id = actor;
  IF COALESCE(role_name, '') NOT IN ('verifier','dispatcher','admin') THEN
    RAISE EXCEPTION 'Verifier role required';
  END IF;
  IF p_field_id IS NULL THEN RAISE EXCEPTION 'Field is required'; END IF;
  IF p_result NOT IN ('VERIFIED_NON_BURN','REVIEW_REQUIRED','REJECTED') THEN
    RAISE EXCEPTION 'Invalid verification result';
  END IF;
  IF p_confidence IS NULL OR p_confidence < 0 OR p_confidence > 100 THEN
    RAISE EXCEPTION 'Confidence must be between 0 and 100';
  END IF;
  IF p_metadata IS NOT NULL AND jsonb_typeof(p_metadata) <> 'object' THEN
    RAISE EXCEPTION 'Verification metadata must be an object';
  END IF;
  IF COALESCE(p_metadata, '{}'::jsonb) ? 'firms_observation_ids' THEN
    IF jsonb_typeof(p_metadata->'firms_observation_ids') <> 'array' THEN
      RAISE EXCEPTION 'firms_observation_ids must be an array';
    END IF;
    SELECT count(*) INTO requested_firms_count
    FROM jsonb_array_elements_text(p_metadata->'firms_observation_ids');
    BEGIN
      SELECT COALESCE(array_agg(value::uuid), ARRAY[]::uuid[]) INTO firms_ids
      FROM jsonb_array_elements_text(p_metadata->'firms_observation_ids') AS requested(value);
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'FIRMS observation IDs must be valid UUIDs';
    END;
  END IF;

  SELECT j.id, j.actual_completed_at INTO completed_job, completed_at
  FROM public.jobs j
  JOIN public.bookings b ON b.id = j.booking_id
  WHERE b.field_id = p_field_id AND j.status = 'COMPLETED'
  ORDER BY j.actual_completed_at DESC NULLS LAST
  LIMIT 1;

  SELECT count(*) INTO evidence_count
  FROM public.evidence_assets e
  WHERE e.field_id = p_field_id
    AND (e.booking_id IS NULL OR e.booking_id = (
      SELECT j.booking_id FROM public.jobs j WHERE j.id = completed_job
    ));

  SELECT count(*) INTO lot_count
  FROM public.residue_lots l
  WHERE l.field_id = p_field_id
    AND (completed_job IS NULL OR l.job_id = completed_job
      OR l.booking_id = (SELECT j.booking_id FROM public.jobs j WHERE j.id = completed_job));

  IF requested_firms_count > 0 THEN
    SELECT count(*),
      COALESCE(jsonb_agg(jsonb_build_object(
        'id', o.id,
        'source', o.source,
        'sensor', o.sensor,
        'acquired_at', o.acquired_at,
        'confidence', o.confidence,
        'frp', o.frp,
        'temporal_relation', CASE
          WHEN o.acquired_at IS NULL THEN 'timestamp_missing'
          WHEN completed_at IS NOT NULL AND o.acquired_at > completed_at THEN 'after_job_completion'
          WHEN completed_at IS NOT NULL AND o.acquired_at < completed_at - interval '90 days' THEN 'older_than_90_days_before_completion'
          ELSE 'within_90_days_before_or_at_completion'
        END
      ) ORDER BY o.acquired_at NULLS LAST), '[]'::jsonb)
    INTO matched_firms_count, firms_details
    FROM public.firms_observations o
    WHERE o.id = ANY(firms_ids)
      AND EXISTS (
        SELECT 1 FROM public.firms_observation_field_matches m
        WHERE m.observation_id = o.id AND m.field_id = p_field_id
      );

    IF matched_firms_count <> requested_firms_count THEN
      RAISE EXCEPTION 'Every supplied FIRMS observation must exist and be matched to this field';
    END IF;
  END IF;

  IF p_result = 'VERIFIED_NON_BURN'
     AND (completed_job IS NULL OR evidence_count < 1 OR lot_count < 1) THEN
    RAISE EXCEPTION 'Verification requires completed job, evidence asset and residue lot';
  END IF;

  IF evidence_count > 0 THEN evidence_sources := evidence_sources || jsonb_build_array('field_evidence'); END IF;
  IF matched_firms_count > 0 THEN evidence_sources := evidence_sources || jsonb_build_array('firms_observations'); END IF;
  verification_method := CASE
    WHEN evidence_count > 0 AND matched_firms_count > 0 THEN 'field_evidence_plus_firms'
    WHEN evidence_count > 0 THEN 'field_evidence_only'
    WHEN matched_firms_count > 0 THEN 'firms_observations_only'
    ELSE 'reviewer_assessment_only'
  END;

  INSERT INTO public.verification_events(field_id, method, result, confidence, metadata)
  VALUES (
    p_field_id,
    verification_method,
    p_result,
    p_confidence,
    (COALESCE(p_metadata, '{}'::jsonb) - 'firms_observation_ids')
      || jsonb_build_object(
        'evidence_sources', evidence_sources,
        'firms_observations_reviewed', firms_details,
        'firms_observation_ids', CASE WHEN matched_firms_count > 0
          THEN to_jsonb(firms_ids) ELSE '[]'::jsonb END,
        'server_evidence_count', evidence_count,
        'server_lot_count', lot_count,
        'completed_job_id', completed_job,
        'firms_absence_interpretation',
          'Absence of a matching or selected FIRMS observation is not proof that burning did not occur.'
      )
  ) RETURNING * INTO v;

  IF p_result = 'VERIFIED_NON_BURN' THEN
    UPDATE public.fields SET status = 'VERIFIED_NON_BURN', updated_at = now() WHERE id = p_field_id;
    UPDATE public.bookings b SET status = 'VERIFIED', updated_at = now()
    WHERE b.field_id = p_field_id AND b.status = 'CLEARED_PENDING_AUDIT';
  END IF;
  RETURN v;
END;
$function$;

-- The anon key is a public client identifier, not a reason to grant CRUD on
-- database objects. Production policy inventory showed all row policies target
-- authenticated users; no public anonymous data policy is required for this app.
-- Revoke effective table/view/materialized-view privileges from both anon and
-- PUBLIC, across the entire exposed public schema. This changes grants only; it
-- does not disable RLS or alter authenticated policies/grants.
DO $block$
DECLARE
  object_name text;
BEGIN
  FOR object_name IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r','p','v','m')
  LOOP
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM PUBLIC, anon', object_name);
  END LOOP;
END;
$block$;

REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon;
-- Prevent future objects created by the standard Supabase migration owner from
-- inheriting public/anonymous table and sequence grants again.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM PUBLIC, anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM PUBLIC, anon;

-- Read-only audit found this consent-withdrawal RPC was the sole public-schema
-- function still executable by anon. Consent withdrawal is a signed-in action.
REVOKE ALL ON FUNCTION public.revoke_farmer_network_consent() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_farmer_network_consent() TO authenticated;

REVOKE ALL PRIVILEGES ON TABLE public.firms_observations, public.firms_observation_field_matches FROM PUBLIC, anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE public.firms_observations, public.firms_observation_field_matches TO service_role;

REVOKE ALL ON FUNCTION public.reserve_clearance_booking_v2(uuid,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reserve_clearance_booking_v2(uuid,date) TO authenticated;
REVOKE ALL ON FUNCTION public.cancel_clearance_booking(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_clearance_booking(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.record_verification_review(uuid,text,numeric,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_verification_review(uuid,text,numeric,jsonb) TO authenticated;

COMMENT ON TABLE public.booking_capacity_reservations IS
  'Transactional machine-capacity claims. A date is guaranteed only while an ACTIVE reservation exists.';
COMMENT ON COLUMN public.bookings.reservation_state IS
  'UNCONFIRMED means requested only; RESERVED requires a committed machine-capacity reservation; RELEASED is cancelled capacity.';
COMMENT ON FUNCTION public.record_verification_review(uuid,text,numeric,jsonb) IS
  'Records only field evidence and explicitly supplied, field-matched FIRMS observation IDs; absence of a detection is not proof of no burning.';
