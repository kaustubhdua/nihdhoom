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

  -- Verify provenance when no FIRMS IDs were supplied: method must be field-only.
  INSERT INTO public.bookings(id,field_id,requested_date,rate_per_acre,quoted_amount,status,guaranteed_by_date,penalty_amount,quote_metadata,reservation_state)
    VALUES ('00000000-0000-0000-0000-000000000402','00000000-0000-0000-0000-000000000203',CURRENT_DATE+2,1500,1500,'REQUESTED',NULL,0,'{}'::jsonb,'UNCONFIRMED');
  SELECT * INTO b FROM public.bookings WHERE id='00000000-0000-0000-0000-000000000402';
  INSERT INTO public.jobs(id,booking_id,status,actual_completed_at)
    VALUES ('00000000-0000-0000-0000-000000000403',b.id,'COMPLETED',now());
  INSERT INTO public.evidence_assets(field_id,booking_id) VALUES (b.field_id,b.id);
  INSERT INTO public.residue_lots(field_id,job_id,booking_id)
    VALUES (b.field_id,'00000000-0000-0000-0000-000000000403',b.id);
  INSERT INTO public.firms_observations(id,source,sensor,acquired_at,matched_field_id,confidence,frp)
    VALUES ('00000000-0000-0000-0000-000000000501','NASA FIRMS','VIIRS',now()-interval '120 days',b.field_id,'nominal',1.2);

  PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
  event_row := public.record_verification_review(b.field_id,'REVIEW_REQUIRED',55,'{}'::jsonb);
  IF event_row.method <> 'field_evidence_only' THEN
    RAISE EXCEPTION 'Missing explicit FIRMS IDs must not be recorded as FIRMS-reviewed';
  END IF;
  IF event_row.metadata->>'firms_absence_interpretation' IS NULL THEN
    RAISE EXCEPTION 'Verification must explicitly state absence is not proof of no burning';
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
