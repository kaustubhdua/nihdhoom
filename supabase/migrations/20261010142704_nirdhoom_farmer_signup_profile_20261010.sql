-- Farmer signup profile bootstrap.
-- Keep this migration in source control: it is present in the live database's migration history
-- and its trigger exists in the live schema, but it was missing from the repository migration folder
-- and generated fresh-project bundle at the time of the 2026-10-11 audit.

create or replace function public.handle_new_farmer_signup()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  preferred_lang text;
begin
  preferred_lang := case
    when new.raw_user_meta_data ->> 'preferred_language' in ('en','hi','pa')
      then new.raw_user_meta_data ->> 'preferred_language'
    else 'hi'
  end;

  insert into public.profiles (
    id,
    full_name,
    phone,
    preferred_language,
    village,
    district,
    role,
    consent_status
  )
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '')), ''),
    new.phone,
    preferred_lang,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'village', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'district', '')), ''),
    'farmer',
    'PENDING'
  )
  on conflict (id) do nothing;

  return new;
end;
$function$;

drop trigger if exists on_auth_user_created_nirdhoom_farmer on auth.users;
create trigger on_auth_user_created_nirdhoom_farmer
after insert on auth.users
for each row execute function public.handle_new_farmer_signup();

-- This function is trigger-only; do not expose direct RPC execution to API roles.
revoke all on function public.handle_new_farmer_signup() from public, anon, authenticated;

comment on function public.handle_new_farmer_signup() is
  'Creates a pending-consent farmer profile after Supabase Auth signup; trigger-only, not a client RPC.';
