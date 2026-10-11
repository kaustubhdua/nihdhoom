\set ON_ERROR_STOP on
-- Unauthorized farmer cannot complete another operator's job.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
do $$
declare rejected boolean := false;
begin
  begin
    perform public.complete_job_with_residue_lot('30000000-0000-0000-0000-000000000001', 2, 12, 10, '{}'::jsonb);
  exception when others then
    if sqlerrm not like '%Assigned operator or dispatcher role required%' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'unauthorized user unexpectedly completed job'; end if;
end $$;

-- Correct operator but missing evidence must be rejected.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
do $$
declare rejected boolean := false;
begin
  begin
    perform public.complete_job_with_residue_lot('30000000-0000-0000-0000-000000000002', 2, 12, 10, '{}'::jsonb);
  exception when others then
    if sqlerrm not like '%evidence is required%' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'job without evidence unexpectedly completed'; end if;
end $$;

-- Invalid measurements must be rejected before mutation.
do $$
declare rejected boolean := false;
begin
  begin
    perform public.complete_job_with_residue_lot('30000000-0000-0000-0000-000000000001', 0, 12, 10, '{}'::jsonb);
  exception when others then
    if sqlerrm not like '%quantity must be greater than 0%' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'zero quantity unexpectedly accepted'; end if;
  rejected := false;
  begin
    perform public.complete_job_with_residue_lot('30000000-0000-0000-0000-000000000001', 2, 101, 10, '{}'::jsonb);
  exception when others then
    if sqlerrm not like '%Moisture must be between 0 and 100%' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'out-of-range moisture unexpectedly accepted'; end if;
  rejected := false;
  begin
    perform public.complete_job_with_residue_lot('30000000-0000-0000-0000-000000000001', 2, 12, 0, '{}'::jsonb);
  exception when others then
    if sqlerrm not like '%Bale count must be a positive integer%' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'zero bales unexpectedly accepted'; end if;
end $$;

-- Force a late failure to prove the lot and job updates roll back together.
create or replace function public.ci_fail_field_update() returns trigger language plpgsql as $$
begin
  if new.id = '10000000-0000-0000-0000-000000000003' then
    raise exception 'forced CI rollback check';
  end if;
  return new;
end $$;
create trigger ci_fail_field_update before update on public.fields
for each row execute function public.ci_fail_field_update();
do $$
declare rejected boolean := false;
begin
  begin
    perform public.complete_job_with_residue_lot('30000000-0000-0000-0000-000000000003', 2, 12, 10, '{}'::jsonb);
  exception when others then
    if sqlerrm not like '%forced CI rollback check%' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'forced update failure did not abort completion'; end if;
  if (select count(*) from public.residue_lots where job_id='30000000-0000-0000-0000-000000000003') <> 0 then
    raise exception 'residue lot persisted despite transaction rollback';
  end if;
  if (select status from public.jobs where id='30000000-0000-0000-0000-000000000003') <> 'PROOF_PENDING' then
    raise exception 'job status changed despite transaction rollback';
  end if;
end $$;
drop trigger ci_fail_field_update on public.fields;
drop function public.ci_fail_field_update();

-- Valid completion creates one lot; repeated completion returns the same lot.
do $$
declare first_result jsonb; retry_result jsonb;
begin
  first_result := public.complete_job_with_residue_lot('30000000-0000-0000-0000-000000000001', 2.5, 12, 10, '{"gps_available":true}'::jsonb);
  if first_result->>'created' <> 'true' or first_result->>'replayed' <> 'false' then
    raise exception 'first completion returned unexpected result: %', first_result;
  end if;
  retry_result := public.complete_job_with_residue_lot('30000000-0000-0000-0000-000000000001', 2.5, 12, 10, '{}'::jsonb);
  if retry_result->>'created' <> 'false' or retry_result->>'replayed' <> 'true' then
    raise exception 'retry returned unexpected result: %', retry_result;
  end if;
  if retry_result->>'lot_id' <> first_result->>'lot_id' then raise exception 'retry returned a different lot'; end if;
  if (select count(*) from public.residue_lots where job_id='30000000-0000-0000-0000-000000000001') <> 1 then
    raise exception 'duplicate residue lots were created';
  end if;
  if (select status from public.jobs where id='30000000-0000-0000-0000-000000000001') <> 'COMPLETED' then
    raise exception 'job was not completed';
  end if;
  if (select status from public.bookings where id='20000000-0000-0000-0000-000000000001') <> 'CLEARED_PENDING_AUDIT' then
    raise exception 'booking status was not updated';
  end if;
  if (select status from public.fields where id='10000000-0000-0000-0000-000000000001') <> 'CLEARED_PENDING_AUDIT' then
    raise exception 'field status was not updated';
  end if;
end $$;

-- Dispatcher can invoke the granted RPC; completed retries remain idempotent.
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false);
set role authenticated;
select public.complete_job_with_residue_lot(
  '30000000-0000-0000-0000-000000000001', 2.5, 12, 10, '{}'::jsonb
);
reset role;
select 'atomic completion integration tests passed' as result;
