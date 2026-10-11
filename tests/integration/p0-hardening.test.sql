\set ON_ERROR_STOP on
DO $$
DECLARE
  reserved numeric;
  capacity numeric;
  active_reservations integer;
  reserved_bookings integer;
  unconfirmed_bookings integer;
  b public.bookings%rowtype;
  event_row public.verification_events%rowtype;
BEGIN
  SELECT reserved_acres, capacity_acres INTO reserved, capacity
  FROM public.machine_capacity_windows WHERE id='00000000-0000-0000-0000-000000000300';
  SELECT count(*) INTO active_reservations FROM public.booking_capacity_reservations WHERE status='ACTIVE';
  SELECT count(*) INTO reserved_bookings FROM public.bookings WHERE reservation_state='RESERVED';
  SELECT count(*) INTO unconfirmed_bookings FROM public.bookings WHERE reservation_state='UNCONFIRMED';
  IF reserved > capacity THEN RAISE EXCEPTION 'Overbooking: reserved acres exceed capacity'; END IF;
  IF EXISTS (
    SELECT 1
    FROM public.booking_capacity_reservations r1
    JOIN public.machine_capacity_windows w1 ON w1.id = r1.capacity_window_id
    JOIN public.booking_capacity_reservations r2 ON r2.id > r1.id AND r2.status = 'ACTIVE'
    JOIN public.machine_capacity_windows w2 ON w2.id = r2.capacity_window_id
    WHERE r1.status = 'ACTIVE' AND w1.machine_id = w2.machine_id
      AND w1.id <> w2.id AND w1.window_start < w2.window_end AND w1.window_end > w2.window_start
  ) THEN RAISE EXCEPTION 'Same machine has active reservations in overlapping windows'; END IF;
  IF reserved <> 1 OR active_reservations <> 1 OR reserved_bookings <> 1 OR unconfirmed_bookings <> 1 THEN
    RAISE EXCEPTION 'Concurrent capacity test failed: reserved %, active %, confirmed %, unconfirmed %', reserved, active_reservations, reserved_bookings, unconfirmed_bookings;
  END IF;
  IF has_table_privilege('anon','public.bookings','SELECT')
     OR has_table_privilege('anon','public.jobs','SELECT')
     OR has_table_privilege('anon','public.residue_lots','SELECT')
     OR has_table_privilege('anon','public.consents','SELECT') THEN
    RAISE EXCEPTION 'Anonymous table privileges were not revoked';
  END IF;
  IF NOT has_table_privilege('authenticated','public.bookings','SELECT') THEN
    RAISE EXCEPTION 'Authenticated booking read grant was unexpectedly removed';
  END IF;
  IF has_function_privilege('anon','public.revoke_farmer_network_consent()','EXECUTE') THEN
    RAISE EXCEPTION 'Anonymous consent-withdrawal RPC execution was not revoked';
  END IF;
  IF NOT has_function_privilege('authenticated','public.revoke_farmer_network_consent()','EXECUTE') THEN
    RAISE EXCEPTION 'Authenticated consent-withdrawal RPC execution was unexpectedly removed';
  END IF;

  -- Verify provenance when no FIRMS IDs were supplied: method must be field-only.
  INSERT INTO public.bookings(id,field_id,requested_date,rate_per_acre,quoted_amount,status,guaranteed_by_date,penalty_amount,quote_metadata,reservation_state)
    VALUES ('00000000-0000-0000-0000-000000000402','00000000-0000-0000-0000-000000000203',CURRENT_DATE+2,1500,1500,'REQUESTED',NULL,0,'{}'::jsonb,'UNCONFIRMED');
  SELECT * INTO b FROM public.bookings WHERE id='00000000-0000-0000-0000-000000000402';
  INSERT INTO public.jobs(id,booking_id,status,actual_completed_at)
    VALUES ('00000000-0000-0000-0000-000000000403',b.id,'COMPLETED',now());
  INSERT INTO public.evidence_assets(field_id,booking_id) VALUES (b.field_id,b.id);
  INSERT INTO public.residue_lots(field_id,job_id,booking_id)
    VALUES (b.field_id,'00000000-0000-0000-0000-000000000403',b.id);
  INSERT INTO public.firms_observations(id,source,sensor,acquired_at,matched_field_id,confidence,frp,provider_observation_key)
    VALUES ('00000000-0000-0000-0000-000000000501','NASA FIRMS','VIIRS',now()-interval '120 days',b.field_id,'nominal',1.2,'test|viirs|observation-501');
  INSERT INTO public.firms_observation_field_matches(observation_id,field_id,match_type,source)
    VALUES ('00000000-0000-0000-0000-000000000501',b.field_id,'point_in_polygon','NASA FIRMS');

  PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
  event_row := public.record_verification_review(b.field_id,'REVIEW_REQUIRED',55,'{}'::jsonb);
  IF event_row.method <> 'field_evidence_only' THEN
    RAISE EXCEPTION 'Missing explicit FIRMS IDs must not be recorded as FIRMS-reviewed';
  END IF;
  IF event_row.metadata->>'firms_absence_interpretation' IS NULL THEN
    RAISE EXCEPTION 'Verification must explicitly state absence is not proof of no burning';
  END IF;
  event_row := public.record_verification_review(
    '00000000-0000-0000-0000-000000000202','REVIEW_REQUIRED',20,'{}'::jsonb
  );
  IF event_row.method <> 'reviewer_assessment_only'
     OR jsonb_array_length(event_row.metadata->'evidence_sources') <> 0 THEN
    RAISE EXCEPTION 'No evidence must not be recorded as field evidence';
  END IF;

  event_row := public.record_verification_review(
    b.field_id,'REVIEW_REQUIRED',55,
    jsonb_build_object('firms_observation_ids',jsonb_build_array('00000000-0000-0000-0000-000000000501'))
  );
  IF event_row.method <> 'field_evidence_plus_firms' THEN
    RAISE EXCEPTION 'Explicit matching FIRMS observation should be recorded as reviewed';
  END IF;
  IF jsonb_array_length(event_row.metadata->'firms_observations_reviewed') <> 1 THEN
    RAISE EXCEPTION 'Reviewed FIRMS observation ID/timestamp provenance was not preserved';
  END IF;
  IF event_row.metadata->'firms_observations_reviewed'->0->>'temporal_relation' <> 'older_than_90_days_before_completion'
     OR event_row.metadata->'firms_observations_reviewed'->0->>'acquired_at' IS NULL THEN
    RAISE EXCEPTION 'Stale observation timestamp/limitation was not preserved';
  END IF;

  BEGIN
    PERFORM public.record_verification_review(
      '00000000-0000-0000-0000-000000000202','REVIEW_REQUIRED',55,
      jsonb_build_object('firms_observation_ids',jsonb_build_array('00000000-0000-0000-0000-000000000501'))
    );
    RAISE EXCEPTION 'Expected mismatched-field FIRMS ID to be rejected';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'Expected mismatched-field FIRMS ID to be rejected' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM public.record_verification_review(
      b.field_id,'REVIEW_REQUIRED',55,
      jsonb_build_object('firms_observation_ids',jsonb_build_array('not-a-uuid'))
    );
    RAISE EXCEPTION 'Expected malformed FIRMS ID to be rejected';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'Expected malformed FIRMS ID to be rejected' THEN RAISE; END IF;
    IF SQLERRM NOT LIKE '%FIRMS observation IDs must be valid UUIDs%' THEN RAISE; END IF;
  END;

  -- Cancellation must release capacity and clear the guarantee in the same transaction.
  SELECT * INTO b FROM public.bookings WHERE reservation_state='RESERVED' LIMIT 1;
  PERFORM set_config('request.jwt.claim.sub',
    (SELECT owner_id::text FROM public.fields WHERE id=b.field_id),true);
  b := public.cancel_clearance_booking(b.id);
  IF b.reservation_state <> 'RELEASED' OR b.guaranteed_by_date IS NOT NULL OR b.penalty_amount <> 0 THEN
    RAISE EXCEPTION 'Cancellation did not release guarantee state safely';
  END IF;
  SELECT reserved_acres INTO reserved FROM public.machine_capacity_windows WHERE id='00000000-0000-0000-0000-000000000300';
  IF reserved <> 0 THEN RAISE EXCEPTION 'Cancellation failed to release reserved capacity'; END IF;
END $$;
