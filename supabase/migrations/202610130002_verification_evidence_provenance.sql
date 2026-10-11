-- P0-B: record the actual evidence used by a verification review.
-- A missing FIRMS observation is not evidence that burning did not occur.
ALTER TABLE public.verification_events
  ADD COLUMN IF NOT EXISTS evidence_asset_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  ADD COLUMN IF NOT EXISTS firms_observation_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  ADD COLUMN IF NOT EXISTS evidence_reviewed_at timestamptz;

UPDATE public.verification_events
SET evidence_reviewed_at = created_at
WHERE evidence_reviewed_at IS NULL;

ALTER TABLE public.verification_events
  ALTER COLUMN evidence_reviewed_at SET DEFAULT now();

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
  role_name text;
  completed_job uuid;
  booking_id_value uuid;
  evidence_count integer := 0;
  lot_count integer := 0;
  evidence_ids uuid[] := '{}'::uuid[];
  firms_ids uuid[] := '{}'::uuid[];
  evidence_manifest jsonb := '[]'::jsonb;
  firms_manifest jsonb := '[]'::jsonb;
  safe_metadata jsonb;
  evidence_method text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;
  SELECT p.role INTO role_name FROM public.profiles p WHERE p.id = auth.uid();
  IF COALESCE(role_name, '') NOT IN ('verifier','dispatcher','admin') THEN
    RAISE EXCEPTION 'Verifier role required';
  END IF;
  IF p_field_id IS NULL OR p_result NOT IN ('VERIFIED_NON_BURN','REVIEW_REQUIRED','REJECTED') THEN
    RAISE EXCEPTION 'Invalid verification request';
  END IF;
  IF p_confidence IS NULL OR p_confidence < 0 OR p_confidence > 100 THEN
    RAISE EXCEPTION 'Confidence must be between 0 and 100';
  END IF;
  IF p_metadata IS NOT NULL AND jsonb_typeof(p_metadata) <> 'object' THEN
    RAISE EXCEPTION 'Verification metadata must be an object';
  END IF;

  SELECT j.id, j.booking_id INTO completed_job, booking_id_value
  FROM public.jobs j
  JOIN public.bookings b ON b.id = j.booking_id
  WHERE b.field_id = p_field_id AND j.status = 'COMPLETED'
  ORDER BY j.actual_completed_at DESC NULLS LAST, j.created_at DESC
  LIMIT 1;

  SELECT count(*)::integer,
         COALESCE(array_agg(e.id ORDER BY e.created_at, e.id), '{}'::uuid[]),
         COALESCE(jsonb_agg(jsonb_build_object(
           'id', e.id, 'kind', e.kind, 'created_at', e.created_at,
           'captured_at', e.captured_at, 'sha256', e.sha256
         ) ORDER BY e.created_at, e.id), '[]'::jsonb)
  INTO evidence_count, evidence_ids, evidence_manifest
  FROM public.evidence_assets e
  WHERE e.field_id = p_field_id
    AND (e.booking_id IS NULL OR e.booking_id = booking_id_value)
    AND e.storage_path IS NOT NULL
    AND length(trim(e.storage_path)) > 0;

  SELECT count(*)::integer
  INTO lot_count
  FROM public.residue_lots l
  WHERE l.field_id = p_field_id
    AND (completed_job IS NULL OR l.job_id = completed_job OR l.booking_id = booking_id_value);

  SELECT COALESCE(array_agg(o.id ORDER BY o.acquired_at NULLS LAST, o.created_at, o.id), '{}'::uuid[]),
         COALESCE(jsonb_agg(jsonb_build_object(
           'id', o.id, 'source', o.source, 'sensor', o.sensor,
           'acquired_at', o.acquired_at, 'created_at', o.created_at,
           'confidence', o.confidence, 'frp', o.frp
         ) ORDER BY o.acquired_at NULLS LAST, o.created_at, o.id), '[]'::jsonb)
  INTO firms_ids, firms_manifest
  FROM public.firms_observations o
  WHERE o.matched_field_id = p_field_id
    AND o.acquired_at IS NOT NULL
    AND o.acquired_at >= now() - interval '30 days';

  IF p_result = 'VERIFIED_NON_BURN' AND (completed_job IS NULL OR evidence_count < 1 OR lot_count < 1) THEN
    RAISE EXCEPTION 'Verification requires completed job, stored field evidence and residue lot';
  END IF;

  evidence_method := CASE
    WHEN cardinality(firms_ids) > 0 THEN 'field_evidence_plus_firms'
    ELSE 'field_evidence_only'
  END;

  -- Never accept client-provided provenance as authoritative. Preserve reviewer
  -- notes, but overwrite reserved keys with server-derived source manifests.
  safe_metadata := COALESCE(p_metadata, '{}'::jsonb)
    - 'server_evidence_count' - 'server_lot_count' - 'completed_job_id'
    - 'evidence_asset_ids' - 'firms_observation_ids' - 'firms_observations'
    - 'evidence_method' - 'remote_sensing_interpretation';

  INSERT INTO public.verification_events(
    field_id, method, result, confidence, metadata,
    evidence_asset_ids, firms_observation_ids, evidence_reviewed_at
  )
  VALUES (
    p_field_id, evidence_method, p_result, p_confidence,
    safe_metadata || jsonb_build_object(
      'server_evidence_count', evidence_count,
      'server_lot_count', lot_count,
      'completed_job_id', completed_job,
      'evidence_asset_manifest', evidence_manifest,
      'firms_observation_manifest', firms_manifest,
      'evidence_method', evidence_method,
      'remote_sensing_interpretation', CASE
        WHEN cardinality(firms_ids) > 0 THEN 'matching observations reviewed; observation is not a definitive ground-truth determination'
        ELSE 'no matching observation recorded in the 30-day query window; this is not evidence of absence of burning'
      END
    ),
    evidence_ids, firms_ids, now()
  )
  RETURNING * INTO v;

  IF p_result = 'VERIFIED_NON_BURN' THEN
    UPDATE public.fields SET status = 'VERIFIED_NON_BURN', updated_at = now() WHERE id = p_field_id;
    UPDATE public.bookings b
    SET status = 'VERIFIED', updated_at = now()
    WHERE b.field_id = p_field_id AND b.status = 'CLEARED_PENDING_AUDIT';
  END IF;
  RETURN v;
END;
$function$;

REVOKE ALL ON FUNCTION public.record_verification_review(uuid,text,numeric,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_verification_review(uuid,text,numeric,jsonb) TO authenticated;
