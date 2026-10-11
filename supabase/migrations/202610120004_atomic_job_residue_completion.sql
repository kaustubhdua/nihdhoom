-- Atomically complete an operator job and create its first-class residue lot.
-- A single RPC transaction prevents a completed job being committed without its lot.
create or replace function public.complete_job_with_residue_lot(
  p_job_id uuid,
  p_quantity_tonnes numeric,
  p_moisture_pct numeric,
  p_bales_count integer,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  j public.jobs%rowtype;
  b public.bookings%rowtype;
  f public.fields%rowtype;
  role_name text;
  lot public.residue_lots%rowtype;
  existing_lot public.residue_lots%rowtype;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  if p_quantity_tonnes is null or p_quantity_tonnes <= 0 or p_quantity_tonnes > 10000 then
    raise exception 'Measured residue quantity must be greater than 0 and at most 10000 tonnes';
  end if;
  if p_moisture_pct is null or p_moisture_pct < 0 or p_moisture_pct > 100 then
    raise exception 'Moisture must be between 0 and 100 percent';
  end if;
  if p_bales_count is null or p_bales_count < 1 or p_bales_count > 1000000 then
    raise exception 'Bale count must be a positive integer';
  end if;
  if p_metadata is not null and jsonb_typeof(p_metadata) <> 'object' then
    raise exception 'Transition metadata must be an object';
  end if;

  select * into j from public.jobs where id = p_job_id for update;
  if not found then
    raise exception 'Job not found';
  end if;

  select role into role_name from public.profiles where id = auth.uid();
  if not (
    (role_name = 'operator' and j.operator_id = auth.uid())
    or coalesce(role_name, '') in ('dispatcher', 'admin')
  ) then
    raise exception 'Assigned operator or dispatcher role required';
  end if;

  select * into b from public.bookings where id = j.booking_id for update;
  if not found then
    raise exception 'Booking for this job was not found';
  end if;
  select * into f from public.fields where id = b.field_id for update;
  if not found then
    raise exception 'Field for this job was not found';
  end if;

  if not exists (
    select 1 from public.evidence_assets e
    where e.field_id = b.field_id
      and e.created_at >= j.created_at
      and e.kind in ('field_photo', 'bale_photo', 'weighment')
      and e.storage_path is not null
      and length(trim(e.storage_path)) > 0
  ) then
    raise exception 'Field photo, bale photo, or weighment evidence is required before completion';
  end if;

  -- The job lock serializes retries. Reuse an existing lot rather than creating a duplicate.
  select * into existing_lot
  from public.residue_lots
  where job_id = j.id
  order by created_at asc
  limit 1
  for update;

  if j.status = 'COMPLETED' and found then
    return jsonb_build_object(
      'job_id', j.id,
      'job_status', j.status,
      'lot_id', existing_lot.id,
      'created', false,
      'replayed', true
    );
  end if;

  if j.status not in ('PROOF_PENDING', 'COMPLETED') then
    raise exception 'Job must be in PROOF_PENDING status before completion';
  end if;
  if found and j.status <> 'COMPLETED' then
    raise exception 'A residue lot already exists for this unfinished job; operator review is required';
  end if;

  insert into public.residue_lots (
    field_id, booking_id, job_id, farmer_id, crop, residue_type,
    estimated_quantity_tonnes, quantity_tonnes, harvest_date, ready_from,
    pickup_deadline, machine_id, geometry_provenance, moisture_pct,
    quality_notes, quality_grade, status, baled_at, qr_code
  ) values (
    b.field_id, b.id, j.id, f.owner_id, f.crop, 'PADDY_STRAW',
    p_quantity_tonnes, p_quantity_tonnes, f.expected_harvest_date,
    now(), f.clearance_deadline, coalesce(j.machine_id, b.machine_id),
    jsonb_build_object(
      'source', coalesce(f.boundary_source, 'UNKNOWN'),
      'field_id', f.id,
      'captured_at', now()
    ),
    p_moisture_pct,
    format('Operator-recorded completion; %s bales; GPS %s', p_bales_count,
      case when coalesce(p_metadata->>'gps_available', 'false') = 'true' then 'available' else 'not available' end),
    case when p_moisture_pct <= 16 then 'DRY'
         when p_moisture_pct <= 20 then 'STANDARD'
         else 'HIGH_MOISTURE' end,
    'AVAILABLE', now(), 'NIR-' || upper(substr(j.id::text, 1, 12))
  ) returning * into lot;

  update public.jobs
  set status = 'COMPLETED',
      actual_completed_at = now(),
      last_transition_at = now(),
      route_metadata = coalesce(route_metadata, '{}'::jsonb) || coalesce(p_metadata, '{}'::jsonb)
        || jsonb_build_object('residue_lot_id', lot.id, 'residue_quantity_tonnes', p_quantity_tonnes),
      updated_at = now()
  where id = j.id;

  update public.bookings
  set status = 'CLEARED_PENDING_AUDIT', updated_at = now()
  where id = b.id;

  update public.fields
  set status = 'CLEARED_PENDING_AUDIT', updated_at = now()
  where id = f.id;

  return jsonb_build_object(
    'job_id', j.id,
    'job_status', 'COMPLETED',
    'lot_id', lot.id,
    'created', true,
    'replayed', false
  );
end;
$function$;

revoke all on function public.complete_job_with_residue_lot(uuid, numeric, numeric, integer, jsonb) from public, anon;
grant execute on function public.complete_job_with_residue_lot(uuid, numeric, numeric, integer, jsonb) to authenticated;

comment on function public.complete_job_with_residue_lot(uuid, numeric, numeric, integer, jsonb) is
  'Atomically completes an authorized operator job and creates its residue lot; retries return the existing lot.';
