-- NIRDHOOM authorization hardening. Reject missing auth and NULL/missing roles in SECURITY DEFINER RPCs.
-- Operational RPCs remain authenticated-only and retain their existing ownership/business checks.

CREATE OR REPLACE FUNCTION public.accept_buyer_offer(p_offer_id uuid)
 RETURNS buyer_offers
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  o public.buyer_offers%rowtype;
  role_name text;
  claimed integer;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select role into role_name from public.profiles where id=auth.uid();
  if coalesce(role_name, '') not in ('buyer','dispatcher','admin') then
    raise exception 'Buyer/dispatcher role required';
  end if;

  select * into o from public.buyer_offers where id=p_offer_id and status='OPEN' for update;
  if not found then raise exception 'Offer is no longer open'; end if;

  if role_name='buyer' and not exists(
    select 1 from public.buyers b
    where b.id=o.buyer_id and b.profile_id=auth.uid() and b.active=true
  ) then
    raise exception 'Offer does not belong to the authenticated buyer';
  end if;

  update public.residue_lots
  set assigned_buyer_id=o.buyer_id,status='ALLOCATED',updated_at=now()
  where id=o.lot_id and status in ('AVAILABLE','OPEN');
  get diagnostics claimed = row_count;
  if claimed <> 1 then
    raise exception 'Residue lot is no longer available';
  end if;

  update public.buyer_offers
  set status='ACCEPTED'
  where id=p_offer_id and status='OPEN'
  returning * into o;
  if not found then raise exception 'Offer changed during acceptance'; end if;
  return o;
end;
$function$;

CREATE OR REPLACE FUNCTION public.cancel_clearance_booking(p_booking_id uuid)
 RETURNS bookings
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare b public.bookings%rowtype;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select * into b from public.bookings where id=p_booking_id for update;
  if not found then raise exception 'Booking not found'; end if;
  if not exists(select 1 from public.fields f where f.id=b.field_id and f.owner_id=auth.uid()) then raise exception 'Booking is not owned by the current farmer'; end if;
  if b.status not in ('BOOKED','MACHINE_ASSIGNED') then raise exception 'Booking cannot be cancelled at this stage'; end if;
  update public.bookings set status='CANCELLED',cancelled_at=now(),updated_at=now() where id=p_booking_id returning * into b;
  update public.fields set status='CANCELLED',updated_at=now() where id=b.field_id;
  return b;
end;
$function$;

CREATE OR REPLACE FUNCTION public.create_residue_pool(p_name text, p_target_tonnes numeric, p_pickup_deadline date, p_buyer_demand_id uuid DEFAULT NULL::uuid)
 RETURNS residue_pools
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := (select auth.uid());
  role_name text;
  row_out public.residue_pools%rowtype;
begin
  if actor is null then raise exception 'authentication required'; end if;
  if p_target_tonnes <= 0 then raise exception 'target quantity must be positive'; end if;

  select role into role_name from public.profiles where id=actor;
  if coalesce(role_name, '') not in ('buyer','dispatcher','admin') then
    raise exception 'only buyers or operations roles can create pools';
  end if;

  if p_buyer_demand_id is not null and not exists (
    select 1 from public.buyer_demands d
    where d.id=p_buyer_demand_id
      and d.status='OPEN'
      and (
        d.buyer_id=actor
        or role_name in ('dispatcher','admin')
      )
  ) then
    raise exception 'buyer demand is not available to this user';
  end if;

  insert into public.residue_pools(name,buyer_demand_id,target_tonnes,pickup_deadline,created_by)
  values(p_name,p_buyer_demand_id,p_target_tonnes,p_pickup_deadline,actor)
  returning * into row_out;

  return row_out;
end;
$function$;

CREATE OR REPLACE FUNCTION public.join_residue_pool(p_pool_id uuid, p_quantity_tonnes numeric)
 RETURNS residue_pool_members
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  lot_id uuid;
  member_row public.residue_pool_members%rowtype;
  remaining numeric;
  lot_remaining numeric;
  actor uuid := (select auth.uid());
begin
  if actor is null then raise exception 'authentication required'; end if;
  if p_quantity_tonnes <= 0 then raise exception 'quantity must be positive'; end if;

  select greatest(0, p.target_tonnes - p.current_tonnes)
    into remaining
  from public.residue_pools p
  where p.id=p_pool_id and p.status='FILLING'
  for update;

  if remaining is null then raise exception 'pool is not accepting commitments'; end if;
  if p_quantity_tonnes > remaining then raise exception 'commitment exceeds pool remaining capacity'; end if;

  select l.id
    into lot_id
  from public.residue_lots l
  join public.fields f on f.id=l.field_id
  where f.owner_id=actor
    and l.status in ('VERIFIED','VERIFIED_NON_BURN')
    and greatest(
      0,
      l.quantity_tonnes - coalesce((
        select sum(m.committed_tonnes)
        from public.residue_pool_members m
        where m.residue_lot_id=l.id and m.status='COMMITTED'
      ),0)
    ) >= p_quantity_tonnes
  order by l.created_at asc
  for update of l
  limit 1;

  if lot_id is null then raise exception 'no verified residue lot with sufficient uncommitted quantity'; end if;

  insert into public.residue_pool_members(pool_id,residue_lot_id,farmer_id,committed_tonnes)
  values(p_pool_id,lot_id,actor,p_quantity_tonnes)
  returning * into member_row;

  update public.residue_pools
  set current_tonnes=current_tonnes+p_quantity_tonnes,
      status=case when current_tonnes+p_quantity_tonnes >= target_tonnes then 'MATCHED' else status end,
      updated_at=now()
  where id=p_pool_id;

  return member_row;
end;
$function$;

CREATE OR REPLACE FUNCTION public.record_verification_review(p_field_id uuid, p_result text, p_confidence numeric, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS verification_events
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v public.verification_events%rowtype;
  role_name text;
  completed_job uuid;
  evidence_count integer;
  lot_count integer;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select role into role_name from public.profiles where id=auth.uid();
  if coalesce(role_name, '') not in ('verifier','dispatcher','admin') then
    raise exception 'Verifier role required';
  end if;
  if p_result not in ('VERIFIED_NON_BURN','REVIEW_REQUIRED','REJECTED') then
    raise exception 'Invalid verification result';
  end if;
  if p_confidence < 0 or p_confidence > 100 then
    raise exception 'Confidence must be between 0 and 100';
  end if;

  select j.id into completed_job
  from public.jobs j
  join public.bookings b on b.id=j.booking_id
  where b.field_id=p_field_id and j.status='COMPLETED'
  order by j.actual_completed_at desc nulls last
  limit 1;

  select count(*) into evidence_count
  from public.evidence_assets e
  where e.field_id=p_field_id
    and (e.booking_id is null or e.booking_id=(select booking_id from public.jobs where id=completed_job));

  select count(*) into lot_count
  from public.residue_lots l
  where l.field_id=p_field_id
    and (completed_job is null or l.job_id=completed_job or l.booking_id=(select booking_id from public.jobs where id=completed_job));

  if p_result='VERIFIED_NON_BURN' and (completed_job is null or evidence_count < 1 or lot_count < 1) then
    raise exception 'Verification requires completed job, evidence asset and residue lot';
  end if;

  insert into public.verification_events(field_id,method,result,confidence,metadata)
  values(
    p_field_id,
    'field_evidence_plus_firms',
    p_result,
    p_confidence,
    coalesce(p_metadata,'{}'::jsonb)
      || jsonb_build_object(
        'server_evidence_count', evidence_count,
        'server_lot_count', lot_count,
        'completed_job_id', completed_job
      )
  ) returning * into v;

  if p_result='VERIFIED_NON_BURN' then
    update public.fields set status='VERIFIED_NON_BURN',updated_at=now() where id=p_field_id;
    update public.bookings b
      set status='VERIFIED',updated_at=now()
      where b.field_id=p_field_id and b.status='CLEARED_PENDING_AUDIT';
  end if;
  return v;
end;
$function$;

CREATE OR REPLACE FUNCTION public.reserve_clearance_booking_v2(p_field_id uuid, p_requested_date date)
 RETURNS bookings
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
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
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select * into f from public.fields where id=p_field_id for update;
  if not found or f.owner_id <> auth.uid() then
    raise exception 'Field is not owned by the current farmer';
  end if;
  if not exists (
    select 1 from public.consents c
    where c.profile_id=auth.uid()
      and c.consent_type='farmer_network'
      and c.revoked_at is null
  ) then
    raise exception 'Active farmer consent is required before booking';
  end if;
  if p_requested_date < current_date then
    raise exception 'Requested date is in the past';
  end if;
  if f.acreage <= 0 or f.acreage > 500 then
    raise exception 'Field acreage is outside the supported booking range';
  end if;

  v_days := coalesce(f.expected_harvest_date::date-current_date, 14);
  v_urgency := case when v_days <= 3 then 1.28 when v_days <= 7 then 1.14 when v_days <= 14 then 1.04 else 0.94 end;
  v_day_factor := case when extract(isodow from p_requested_date)=7 then 1.08 else 1 end;
  v_rate := round(greatest(1000, least(3200, 1500*v_urgency*v_day_factor))/10)*10;
  v_amount := round(v_rate*f.acreage, 2);
  v_guaranteed := p_requested_date;
  v_penalty := least(v_amount, greatest(2500, f.acreage*2500));
  v_band := case when v_urgency >= 1.2 then 'urgent' when v_urgency >= 1 then 'standard' else 'early-booking' end;

  insert into public.bookings(
    field_id, requested_date, rate_per_acre, quoted_amount,
    guaranteed_by_date, penalty_amount, pricing_band, quote_metadata,
    status, accepted_at
  ) values (
    p_field_id, p_requested_date, v_rate, v_amount,
    v_guaranteed, v_penalty, v_band,
    jsonb_build_object('engine','nirdhoom-pricing-v1','server_authoritative',true,'days_to_harvest',v_days),
    'BOOKED', now()
  ) returning * into b;

  update public.fields
  set status='BOOKED',
      clearance_deadline=(v_guaranteed::text||'T18:00:00+05:30')::timestamptz,
      updated_at=now()
  where id=p_field_id;

  return b;
exception when unique_violation then
  raise exception 'This field already has an active booking for that date';
end;
$function$;

CREATE OR REPLACE FUNCTION public.transition_job(p_job_id uuid, p_next_status text, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS jobs
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare j public.jobs%rowtype; role_name text; allowed boolean := false;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select * into j from public.jobs where id=p_job_id for update;
  if not found then raise exception 'Job not found'; end if;
  select role into role_name from public.profiles where id=auth.uid();
  if (role_name = 'operator' and j.operator_id=auth.uid()) or coalesce(role_name, '') in ('dispatcher','admin') then
    allowed := (j.status='ASSIGNED' and p_next_status='ARRIVED') or (j.status='ARRIVED' and p_next_status='BALING') or (j.status='BALING' and p_next_status='PROOF_PENDING') or (j.status='PROOF_PENDING' and p_next_status='COMPLETED') or (p_next_status in ('FAILED','CANCELLED') and j.status not in ('COMPLETED','FAILED','CANCELLED'));
  end if;
  if not allowed then raise exception 'Invalid job transition'; end if;
  if p_next_status='COMPLETED' and not exists(
    select 1 from public.evidence_assets e
    where e.booking_id=j.booking_id and e.field_id=(select field_id from public.bookings where id=j.booking_id)
      and e.kind in ('field_photo','bale_photo','weighment')
      and e.storage_path is not null and length(trim(e.storage_path))>0
  ) then raise exception 'Field photo, bale photo, or weighment evidence is required before completion'; end if;
  if p_metadata is not null and jsonb_typeof(p_metadata)<>'object' then raise exception 'Transition metadata must be an object'; end if;
  update public.jobs set status=p_next_status,actual_arrived_at=case when p_next_status='ARRIVED' then now() else actual_arrived_at end,actual_completed_at=case when p_next_status='COMPLETED' then now() else actual_completed_at end,last_transition_at=now(),route_metadata=coalesce(route_metadata,'{}'::jsonb)||coalesce(p_metadata,'{}'::jsonb),updated_at=now() where id=p_job_id returning * into j;
  update public.bookings set status=case when p_next_status='COMPLETED' then 'CLEARED_PENDING_AUDIT' when p_next_status='CANCELLED' then 'CANCELLED' else status end,updated_at=now() where id=j.booking_id;
  update public.fields f set status=case when p_next_status='ARRIVED' then 'ON_THE_WAY' when p_next_status='BALING' then 'BALING_IN_PROGRESS' when p_next_status='COMPLETED' then 'CLEARED_PENDING_AUDIT' when p_next_status='CANCELLED' then 'CANCELLED' else f.status end,updated_at=now() where f.id=(select field_id from public.bookings where id=j.booking_id);
  return j;
end;
$function$;

CREATE OR REPLACE FUNCTION public.verify_field_geometry(p_field_id uuid, p_source text, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS fields
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  f public.fields%rowtype;
  role_name text;
  area_acres numeric;
  area_delta numeric;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select role into role_name from public.profiles where id=auth.uid();
  if coalesce(role_name, '') not in ('verifier','dispatcher','admin') then
    raise exception 'Verifier role required';
  end if;
  if p_source not in ('cadastral','farmer_registry','imported') then
    raise exception 'Only authoritative or imported boundary sources can be verified';
  end if;
  if p_metadata is not null and jsonb_typeof(p_metadata) <> 'object' then
    raise exception 'Verification metadata must be an object';
  end if;
  select * into f from public.fields where id=p_field_id for update;
  if not found then raise exception 'Field not found'; end if;
  if f.boundary is null then raise exception 'Field boundary is required'; end if;
  if not extensions.ST_IsValid(f.boundary::extensions.geometry) then raise exception 'Field boundary is not a valid polygon'; end if;
  if extensions.ST_IsEmpty(f.boundary::extensions.geometry) then raise exception 'Field boundary is empty'; end if;
  area_acres := round((extensions.ST_Area(f.boundary) / 4046.8564224)::numeric, 3);
  if area_acres <= 0 or area_acres > 10000 then raise exception 'Field boundary area is outside the supported range'; end if;
  if f.acreage <= 0 then raise exception 'Registered acreage must be positive'; end if;
  area_delta := abs(area_acres - f.acreage) / greatest(f.acreage, 0.001);
  if area_delta > 0.20 then raise exception 'Boundary area differs from registered acreage by more than 20 percent'; end if;
  update public.fields
  set boundary_source=p_source,boundary_verified=true,geometry_verified_at=now(),geometry_verified_by=auth.uid(),geometry_area_acres=area_acres,geometry_type='verified',updated_at=now()
  where id=p_field_id
  returning * into f;
  insert into public.audit_events(entity_type,entity_id,actor_id,action,before_state,after_state)
  values('field',f.id,auth.uid(),'FIELD_GEOMETRY_VERIFIED',
    jsonb_build_object('boundary_verified',false),
    jsonb_build_object('boundary_verified',true,'boundary_source',p_source,'geometry_area_acres',area_acres,'metadata',coalesce(p_metadata,'{}'::jsonb)));
  return f;
end;
$function$;

revoke all on function public.accept_buyer_offer(uuid) from public, anon;
grant execute on function public.accept_buyer_offer(uuid) to authenticated;
revoke all on function public.cancel_clearance_booking(uuid) from public, anon;
grant execute on function public.cancel_clearance_booking(uuid) to authenticated;
revoke all on function public.create_residue_pool(text,numeric,date,uuid) from public, anon;
grant execute on function public.create_residue_pool(text,numeric,date,uuid) to authenticated;
revoke all on function public.join_residue_pool(uuid,numeric) from public, anon;
grant execute on function public.join_residue_pool(uuid,numeric) to authenticated;
revoke all on function public.record_verification_review(uuid,text,numeric,jsonb) from public, anon;
grant execute on function public.record_verification_review(uuid,text,numeric,jsonb) to authenticated;
revoke all on function public.reserve_clearance_booking_v2(uuid,date) from public, anon;
grant execute on function public.reserve_clearance_booking_v2(uuid,date) to authenticated;
revoke all on function public.transition_job(uuid,text,jsonb) from public, anon;
grant execute on function public.transition_job(uuid,text,jsonb) to authenticated;
revoke all on function public.verify_field_geometry(uuid,text,jsonb) from public, anon;
grant execute on function public.verify_field_geometry(uuid,text,jsonb) to authenticated;
