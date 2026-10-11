-- NIRDHOOM: all migrations in release order.
-- Paste into Supabase > SQL Editor and press Run ONCE on a fresh project.
-- If it stops with an error, note the "-- >>> file" line above it, fix the cause,
-- then run only the files from that one onward (see docs/GO-LIVE.md).
-- Generated 2026-10-11 from 32 files.

-- >>> 202609270001_nirdhoom_core.sql
-- NIRDHOOM core schema. Run in Supabase SQL Editor or as a migration.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  preferred_language text not null default 'en' check (preferred_language in ('en','pa','hi')),
  village text,
  district text,
  role text not null default 'farmer' check (role in ('farmer','operator','dispatcher','verifier','buyer','admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fields (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  external_id text unique,
  khasra_no text not null,
  village text not null,
  block text,
  district text not null,
  crop text not null default 'Paddy',
  variety text,
  acreage numeric(8,2) not null check (acreage > 0),
  expected_harvest_date date,
  clearance_deadline timestamptz,
  moisture_pct numeric(5,2),
  status text not null default 'REGISTERED' check (status in ('REGISTERED','SCHEDULED','MACHINE_ASSIGNED','ON_THE_WAY','BALING_IN_PROGRESS','CLEARED_PENDING_AUDIT','VERIFIED_NON_BURN','PAYMENT_PROCESSING','PAID','CANCELLED')),
  center_lat double precision,
  center_lng double precision,
  geometry jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.machines (
  id uuid primary key default gen_random_uuid(),
  external_id text unique not null,
  name text not null,
  machine_type text,
  owner_name text,
  operator_name text,
  operator_phone text,
  status text not null default 'IDLE',
  capacity_acres_day numeric(8,2),
  fuel_pct numeric(5,2),
  current_lat double precision,
  current_lng double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  field_id uuid not null references public.fields(id) on delete cascade,
  requested_date date not null,
  rate_per_acre numeric(10,2) not null,
  quoted_amount numeric(12,2) not null,
  machine_id uuid references public.machines(id),
  status text not null default 'BOOKED',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.field_events (
  id uuid primary key default gen_random_uuid(),
  field_id uuid not null references public.fields(id) on delete cascade,
  event_type text not null,
  note text,
  actor_id uuid references public.profiles(id),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.verification_events (
  id uuid primary key default gen_random_uuid(),
  field_id uuid not null references public.fields(id) on delete cascade,
  method text not null,
  result text not null,
  confidence numeric(5,2),
  evidence_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.residue_lots (
  id uuid primary key default gen_random_uuid(),
  field_id uuid not null references public.fields(id) on delete cascade,
  quantity_tonnes numeric(10,2),
  moisture_pct numeric(5,2),
  quality_notes text,
  status text not null default 'AVAILABLE',
  created_at timestamptz not null default now()
);

create table if not exists public.buyers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  pathway text not null,
  price_per_tonne numeric(10,2),
  moisture_ceiling numeric(5,2),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  field_id uuid references public.fields(id),
  role text not null check (role in ('user','assistant')),
  message text not null,
  created_at timestamptz not null default now()
);

-- Keep exposed data behind RLS.
alter table public.profiles enable row level security;
alter table public.fields enable row level security;
alter table public.machines enable row level security;
alter table public.bookings enable row level security;
alter table public.field_events enable row level security;
alter table public.verification_events enable row level security;
alter table public.residue_lots enable row level security;
alter table public.buyers enable row level security;
alter table public.notifications enable row level security;
alter table public.ai_conversations enable row level security;

create policy "profile owner select" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "profile owner insert" on public.profiles for insert to authenticated with check ((select auth.uid()) = id and role = 'farmer');
create policy "profile owner update" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "farmer reads own fields" on public.fields for select to authenticated using ((select auth.uid()) = owner_id);
create policy "farmer creates own fields" on public.fields for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "farmer updates own fields" on public.fields for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);

create policy "authenticated reads machines" on public.machines for select to authenticated using (true);
create policy "farmer reads own bookings" on public.bookings for select to authenticated using (exists (select 1 from public.fields f where f.id = field_id and f.owner_id = (select auth.uid())));
create policy "farmer creates own bookings" on public.bookings for insert to authenticated with check (exists (select 1 from public.fields f where f.id = field_id and f.owner_id = (select auth.uid())));
create policy "farmer reads own events" on public.field_events for select to authenticated using (exists (select 1 from public.fields f where f.id = field_id and f.owner_id = (select auth.uid())));
create policy "farmer creates own events" on public.field_events for insert to authenticated with check (exists (select 1 from public.fields f where f.id = field_id and f.owner_id = (select auth.uid())));
create policy "farmer reads own verification" on public.verification_events for select to authenticated using (exists (select 1 from public.fields f where f.id = field_id and f.owner_id = (select auth.uid())));
create policy "authenticated reads buyers" on public.buyers for select to authenticated using (active = true);
create policy "farmer reads own lots" on public.residue_lots for select to authenticated using (exists (select 1 from public.fields f where f.id = field_id and f.owner_id = (select auth.uid())));
create policy "farmer reads own notifications" on public.notifications for select to authenticated using ((select auth.uid()) = profile_id);
create policy "farmer updates own notifications" on public.notifications for update to authenticated using ((select auth.uid()) = profile_id) with check ((select auth.uid()) = profile_id);
create policy "farmer reads own ai chats" on public.ai_conversations for select to authenticated using ((select auth.uid()) = profile_id);
create policy "farmer creates own ai chats" on public.ai_conversations for insert to authenticated with check ((select auth.uid()) = profile_id);

-- Data API least-privilege grants. Explicit exposure is now required for new Supabase projects.
grant select on public.machines, public.buyers to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.fields to authenticated;
grant select, insert on public.bookings to authenticated;
grant select, insert on public.field_events to authenticated;
grant select on public.verification_events, public.residue_lots, public.notifications, public.ai_conversations to authenticated;
grant update on public.notifications to authenticated;
grant insert on public.ai_conversations to authenticated;

-- >>> 202609270002_nirdhoom_production.sql
-- NIRDHOOM production-oriented extension.
-- Run after 202609270001_nirdhoom_core.sql.
create extension if not exists pgcrypto;

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('farmer','operator','dispatcher','verifier','buyer','admin'));

alter table public.fields add column if not exists geometry_type text default 'demo';
alter table public.machines add column if not exists operator_user_id uuid references public.profiles(id);
alter table public.bookings add column if not exists assigned_at timestamptz;
alter table public.bookings add column if not exists accepted_at timestamptz;
alter table public.bookings add column if not exists cancelled_at timestamptz;

create table if not exists public.machine_locations (
  id uuid primary key default gen_random_uuid(),
  machine_id uuid not null references public.machines(id) on delete cascade,
  latitude double precision not null,
  longitude double precision not null,
  speed_kmh numeric(7,2),
  fuel_pct numeric(5,2),
  source text not null default 'device',
  recorded_at timestamptz not null default now()
);

create table if not exists public.evidence_assets (
  id uuid primary key default gen_random_uuid(),
  field_id uuid not null references public.fields(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete set null,
  kind text not null check (kind in ('field_photo','bale_photo','weighment','gps','satellite','document')),
  storage_path text,
  source text,
  captured_at timestamptz,
  latitude double precision,
  longitude double precision,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  farmer_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null default 'INR',
  provider text,
  provider_reference text,
  status text not null default 'PENDING' check (status in ('PENDING','PROCESSING','PAID','FAILED','REFUNDED')),
  initiated_at timestamptz,
  settled_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.buyer_offers (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid not null references public.residue_lots(id) on delete cascade,
  buyer_id uuid not null references public.buyers(id) on delete cascade,
  price_per_tonne numeric(10,2) not null check (price_per_tonne >= 0),
  quantity_tonnes numeric(10,2) not null check (quantity_tonnes > 0),
  status text not null default 'OPEN' check (status in ('OPEN','ACCEPTED','REJECTED','EXPIRED','SETTLED')),
  valid_until timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.weather_snapshots (
  id uuid primary key default gen_random_uuid(),
  field_id uuid not null references public.fields(id) on delete cascade,
  provider text not null,
  observed_at timestamptz not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists machine_locations_machine_time_idx on public.machine_locations(machine_id, recorded_at desc);
create index if not exists bookings_field_date_idx on public.bookings(field_id, requested_date);
create index if not exists evidence_field_time_idx on public.evidence_assets(field_id, created_at desc);
create index if not exists payments_farmer_time_idx on public.payments(farmer_id, created_at desc);
create index if not exists offers_lot_status_idx on public.buyer_offers(lot_id, status);

-- Prevent a farmer from self-promoting their role through the profile update endpoint.
create or replace function public.prevent_role_escalation()
returns trigger
language plpgsql
as $$
begin
  if (select auth.uid()) = old.id and new.role is distinct from old.role then
    raise exception 'role changes must be performed by an authorized operator';
  end if;
  return new;
end;
$$;
drop trigger if exists protect_profile_role on public.profiles;
create trigger protect_profile_role before update on public.profiles
for each row execute function public.prevent_role_escalation();

-- Idempotent policies: remove previous versions before recreating them.
do $$ declare p record; begin
  for p in select policyname, tablename from pg_policies where schemaname='public' and tablename in
    ('machine_locations','evidence_assets','payments','buyer_offers','weather_snapshots','audit_log')
  loop execute format('drop policy if exists %I on public.%I', p.policyname, p.tablename); end loop;
end $$;

alter table public.machine_locations enable row level security;
alter table public.evidence_assets enable row level security;
alter table public.payments enable row level security;
alter table public.buyer_offers enable row level security;
alter table public.weather_snapshots enable row level security;
alter table public.audit_log enable row level security;

create policy "authenticated can read machine locations" on public.machine_locations for select to authenticated using (
  exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('operator','dispatcher','admin'))
  or exists (select 1 from public.bookings b join public.fields f on f.id=b.field_id where b.machine_id=public.machine_locations.machine_id and f.owner_id=(select auth.uid()))
);
create policy "operator inserts own machine locations" on public.machine_locations for insert to authenticated with check (
  exists (select 1 from public.machines m where m.id=machine_id and m.operator_user_id=(select auth.uid()))
);

create policy "field owner reads evidence" on public.evidence_assets for select to authenticated using (
  exists (select 1 from public.fields f where f.id=field_id and f.owner_id=(select auth.uid()))
  or exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('dispatcher','verifier','admin'))
);
create policy "operator/verifier inserts evidence" on public.evidence_assets for insert to authenticated with check (
  (select auth.uid())=created_by or exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('operator','verifier','admin'))
);

create policy "farmer reads own payments" on public.payments for select to authenticated using (
  farmer_id=(select auth.uid()) or exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('dispatcher','admin'))
);

create policy "buyers read open offers" on public.buyer_offers for select to authenticated using (
  status='OPEN' or exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('dispatcher','buyer','admin'))
);

drop policy if exists "farmer creates own events" on public.field_events;
create policy "operational roles create field events" on public.field_events for insert to authenticated with check (
  exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('operator','dispatcher','verifier','admin'))
);

create policy "field owner reads weather" on public.weather_snapshots for select to authenticated using (
  exists (select 1 from public.fields f where f.id=field_id and f.owner_id=(select auth.uid()))
  or exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('dispatcher','admin'))
);

create policy "authorized reads audit log" on public.audit_log for select to authenticated using (
  exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('dispatcher','verifier','admin'))
);

-- Expand core role access. Farmers keep ownership; operational roles get controlled visibility.
drop policy if exists "authenticated reads machines" on public.machines;
create policy "authenticated reads machines" on public.machines for select to authenticated using (true);

drop policy if exists "farmer reads own fields" on public.fields;
create policy "field access by role" on public.fields for select to authenticated using (
  owner_id=(select auth.uid())
  or exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('dispatcher','verifier','admin'))
  or exists (select 1 from public.bookings b join public.machines m on m.id=b.machine_id where b.field_id=fields.id and m.operator_user_id=(select auth.uid()))
);

drop policy if exists "farmer reads own bookings" on public.bookings;
create policy "booking access by role" on public.bookings for select to authenticated using (
  exists (select 1 from public.fields f where f.id=field_id and f.owner_id=(select auth.uid()))
  or exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('dispatcher','admin'))
  or exists (select 1 from public.machines m where m.id=machine_id and m.operator_user_id=(select auth.uid()))
);

-- Least privilege for the new tables.
grant select, insert on public.machine_locations to authenticated;
grant insert on public.notifications to authenticated;
grant select, insert on public.evidence_assets to authenticated;
grant select on public.payments to authenticated;
grant select on public.buyer_offers to authenticated;
grant select on public.weather_snapshots to authenticated;
grant select on public.audit_log to authenticated;

-- >>> 202609270003_nirdhoom_v6.sql
-- NIRDHOOM V6 production hardening and PDF feature model.
-- Run after 001 core and 002 production.
-- PostGIS is installed in the dedicated extensions schema per Supabase guidance.
create extension if not exists postgis with schema extensions;

alter table public.profiles add column if not exists consent_status text not null default 'PENDING' check (consent_status in ('PENDING','GRANTED','REVOKED'));
alter table public.profiles add column if not exists farmer_registry_ref text;

alter table public.machines add column if not exists operator_user_id uuid references public.profiles(id);
alter table public.machines add column if not exists service_area jsonb not null default '{}'::jsonb;
alter table public.machines add column if not exists availability_calendar jsonb not null default '{}'::jsonb;

alter table public.fields add column if not exists boundary_geojson jsonb;
alter table public.fields add column if not exists boundary_source text not null default 'manual' check (boundary_source in ('manual','self_drawn','cadastral','farmer_registry','imported'));
alter table public.fields add column if not exists boundary_verified boolean not null default false;
alter table public.fields add column if not exists boundary extensions.geography(Polygon,4326);
create index if not exists fields_boundary_gix on public.fields using gist(boundary);

create or replace function public.sync_field_boundary()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  if new.boundary_geojson is null then
    new.boundary := null;
  else
    new.boundary := extensions.ST_GeomFromGeoJSON(new.boundary_geojson)::extensions.geography;
  end if;
  return new;
end;
$$;
drop trigger if exists sync_field_boundary on public.fields;
create trigger sync_field_boundary before insert or update of boundary_geojson on public.fields for each row execute function public.sync_field_boundary();

alter table public.bookings add column if not exists guaranteed_by_date date;
alter table public.bookings add column if not exists penalty_amount numeric(12,2) not null default 0 check (penalty_amount >= 0);
alter table public.bookings add column if not exists pricing_band text;
alter table public.bookings add column if not exists quote_metadata jsonb not null default '{}'::jsonb;

create table if not exists public.consents (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  consent_type text not null,
  version text not null,
  accepted_at timestamptz not null default now(),
  revoked_at timestamptz,
  source text not null,
  unique(profile_id, consent_type, version)
);

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete cascade,
  machine_id uuid references public.machines(id),
  operator_id uuid references public.profiles(id),
  slot_start timestamptz,
  slot_end timestamptz,
  status text not null default 'ASSIGNED' check (status in ('ASSIGNED','ARRIVED','BALING','PROOF_PENDING','COMPLETED','FAILED','CANCELLED')),
  actual_arrived_at timestamptz,
  actual_completed_at timestamptz,
  route_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.storage_yards (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location extensions.geography(Point,4326),
  capacity_tonnes numeric(12,2) not null check (capacity_tonnes > 0),
  current_load_tonnes numeric(12,2) not null default 0 check (current_load_tonnes >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.residue_lots add column if not exists qr_code text unique;
alter table public.residue_lots add column if not exists storage_yard_id uuid references public.storage_yards(id);
alter table public.residue_lots add column if not exists assigned_buyer_id uuid references public.buyers(id);
alter table public.residue_lots add column if not exists baled_at timestamptz;
alter table public.residue_lots add column if not exists quality_grade text;

create table if not exists public.buyer_contracts (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.buyers(id) on delete cascade,
  contract_ref text unique not null,
  min_tonnes numeric(12,2),
  max_tonnes numeric(12,2),
  price_per_tonne numeric(10,2) not null check (price_per_tonne >= 0),
  moisture_ceiling numeric(5,2),
  valid_from date not null,
  valid_until date,
  status text not null default 'ACTIVE' check (status in ('DRAFT','ACTIVE','PAUSED','EXPIRED','CLOSED')),
  terms jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.dispatches (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid references public.buyers(id),
  lot_ids uuid[] not null default '{}',
  dispatched_at timestamptz,
  invoice_id text,
  status text not null default 'PLANNED' check (status in ('PLANNED','LOADED','IN_TRANSIT','DELIVERED','CANCELLED')),
  route_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.credit_wallets (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  balance numeric(12,2) not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  field_id uuid references public.fields(id),
  amount numeric(12,2) not null,
  reason text not null,
  reference text,
  created_at timestamptz not null default now()
);

create table if not exists public.harvest_forecasts (
  id uuid primary key default gen_random_uuid(),
  field_id uuid references public.fields(id) on delete cascade,
  block text,
  forecast_date date not null,
  predicted_acres numeric(12,2),
  variety text,
  source text not null,
  confidence numeric(5,2),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.firms_observations (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  sensor text not null,
  latitude double precision not null,
  longitude double precision not null,
  acquired_at timestamptz,
  confidence text,
  frp numeric(12,3),
  matched_field_id uuid references public.fields(id) on delete set null,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(source,sensor,latitude,longitude,acquired_at)
);
create index if not exists firms_observations_geo_idx on public.firms_observations using gist((extensions.ST_SetSRID(extensions.ST_MakePoint(longitude,latitude),4326)::extensions.geography));

create table if not exists public.soil_reports (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade,
  field_id uuid references public.fields(id) on delete cascade,
  ph numeric(5,2),
  nitrogen numeric(10,2),
  phosphorus numeric(10,2),
  potassium numeric(10,2),
  organic_carbon numeric(10,2),
  lab_name text,
  tested_at date,
  source text,
  action_plan jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid,
  actor_id uuid references public.profiles(id),
  action text not null,
  before_state jsonb,
  after_state jsonb,
  occurred_at timestamptz not null default now(),
  request_id text
);

-- Storage bucket for evidence. The actual object bytes stay behind Storage RLS.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('evidence','evidence',false,6291456,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;

alter table public.consents enable row level security;
alter table public.jobs enable row level security;
alter table public.storage_yards enable row level security;
alter table public.buyer_contracts enable row level security;
alter table public.dispatches enable row level security;
alter table public.credit_wallets enable row level security;
alter table public.credit_transactions enable row level security;
alter table public.harvest_forecasts enable row level security;
alter table public.firms_observations enable row level security;
alter table public.soil_reports enable row level security;
alter table public.audit_events enable row level security;

create policy "profile owns consent" on public.consents for select to authenticated using(profile_id=(select auth.uid()));
create policy "profile records consent" on public.consents for insert to authenticated with check(profile_id=(select auth.uid()));
create policy "field owner reads jobs" on public.jobs for select to authenticated using(exists(select 1 from public.bookings b join public.fields f on f.id=b.field_id where b.id=booking_id and f.owner_id=(select auth.uid())) or operator_id=(select auth.uid()) or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('dispatcher','admin')));
create policy "operator updates own jobs" on public.jobs for update to authenticated using(operator_id=(select auth.uid()) or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('dispatcher','admin'))) with check(operator_id=(select auth.uid()) or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('dispatcher','admin')));
create policy "authenticated reads yards" on public.storage_yards for select to authenticated using(active=true);
create policy "authenticated reads contracts" on public.buyer_contracts for select to authenticated using(status='ACTIVE' or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('buyer','dispatcher','admin')));
create policy "authorized reads dispatches" on public.dispatches for select to authenticated using(exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('buyer','dispatcher','admin')) or exists(select 1 from public.residue_lots l join public.fields f on f.id=l.field_id where l.id=any(lot_ids) and f.owner_id=(select auth.uid())));
create policy "farmer reads own wallet" on public.credit_wallets for select to authenticated using(profile_id=(select auth.uid()));
create policy "farmer reads own credit tx" on public.credit_transactions for select to authenticated using(profile_id=(select auth.uid()));
create policy "authorized reads forecasts" on public.harvest_forecasts for select to authenticated using(exists(select 1 from public.fields f where f.id=field_id and f.owner_id=(select auth.uid())) or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('dispatcher','admin')));
create policy "authorized reads firms" on public.firms_observations for select to authenticated using(matched_field_id is null or exists(select 1 from public.fields f where f.id=matched_field_id and f.owner_id=(select auth.uid())) or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('verifier','dispatcher','admin')));
create policy "farmer reads soil" on public.soil_reports for select to authenticated using(profile_id=(select auth.uid()) or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('verifier','dispatcher','admin')));
create policy "farmer creates soil" on public.soil_reports for insert to authenticated with check(profile_id=(select auth.uid()));
create policy "authorized reads audit events" on public.audit_events for select to authenticated using(exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('verifier','dispatcher','admin')));

-- Replace the broad evidence insert policy with a field/job-aware policy.
drop policy if exists "operator/verifier inserts evidence" on public.evidence_assets;
create policy "operator/verifier inserts linked evidence" on public.evidence_assets for insert to authenticated with check(
  (created_by=(select auth.uid()) and exists(select 1 from public.bookings b join public.jobs j on j.booking_id=b.id join public.fields f on f.id=b.field_id where b.id=evidence_assets.booking_id and f.id=evidence_assets.field_id and (j.operator_id=(select auth.uid()) or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('verifier','admin')))))
  or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('verifier','admin'))
);

-- Storage policies: authenticated users may only write/read under their own user-id prefix.
drop policy if exists "nirdhoom evidence insert" on storage.objects;
drop policy if exists "nirdhoom evidence read" on storage.objects;
create policy "nirdhoom evidence insert" on storage.objects for insert to authenticated with check(bucket_id='evidence' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "nirdhoom evidence read" on storage.objects for select to authenticated using(bucket_id='evidence' and (storage.foldername(name))[1]=(select auth.uid())::text);

-- Least privilege grants.
grant select, insert on public.consents to authenticated;
grant select, insert, update on public.jobs to authenticated;
grant select on public.storage_yards, public.buyer_contracts, public.dispatches, public.credit_wallets, public.credit_transactions, public.harvest_forecasts, public.firms_observations, public.soil_reports, public.audit_events to authenticated;
grant insert on public.soil_reports to authenticated;

grant usage on schema extensions to authenticated;

-- Make the operator machine mapping available to the role-aware client.
drop policy if exists "operator reads own machine" on public.machines;
create policy "operator reads own machine" on public.machines for select to authenticated using(operator_user_id=(select auth.uid()) or true);

-- >>> 202609270004_nirdhoom_v7.sql
-- NIRDHOOM V7: close the field -> machine -> evidence -> lot -> payment loop.
-- Run after 001, 002 and 003.

create extension if not exists pgcrypto;
create extension if not exists postgis with schema extensions;

alter table public.buyers add column if not exists profile_id uuid references public.profiles(id) on delete set null;
create unique index if not exists buyers_profile_id_unique on public.buyers(profile_id) where profile_id is not null;

-- Make the production geometry authoritative when supplied, while preserving the farmer-declared acreage.
alter table public.fields add column if not exists geometry_area_acres numeric(10,3);
alter table public.fields add column if not exists geometry_verified_at timestamptz;
alter table public.fields add column if not exists geometry_verified_by uuid references public.profiles(id);
alter table public.fields add column if not exists consent_id uuid references public.consents(id);

create or replace function public.refresh_field_geometry_metrics()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  if new.boundary is not null then
    new.geometry_area_acres := round((extensions.ST_Area(new.boundary) / 4046.8564224)::numeric, 3);
  else
    new.geometry_area_acres := null;
  end if;
  return new;
end;
$$;

drop trigger if exists refresh_field_geometry_metrics on public.fields;
create trigger refresh_field_geometry_metrics
before insert or update of boundary on public.fields
for each row execute function public.refresh_field_geometry_metrics();

create index if not exists bookings_active_field_date_idx
on public.bookings(field_id, requested_date)
where status not in ('CANCELLED','FAILED');

create index if not exists jobs_status_slot_idx on public.jobs(status, slot_start, slot_end);
create index if not exists machine_locations_recent_idx on public.machine_locations(machine_id, recorded_at desc);
create index if not exists evidence_booking_time_idx on public.evidence_assets(booking_id, created_at desc);
create index if not exists residue_lots_field_status_idx on public.residue_lots(field_id, status);

alter table public.jobs add column if not exists failure_reason text;
alter table public.jobs add column if not exists last_transition_at timestamptz;
alter table public.evidence_assets add column if not exists sha256 text;
alter table public.evidence_assets add column if not exists gps_accuracy_m numeric(8,2);
alter table public.evidence_assets add column if not exists sync_source text default 'online';
alter table public.residue_lots add column if not exists booking_id uuid references public.bookings(id);
alter table public.residue_lots add column if not exists job_id uuid references public.jobs(id);
alter table public.residue_lots add column if not exists weight_kg numeric(12,2);
alter table public.residue_lots add column if not exists moisture_checked_at timestamptz;
alter table public.residue_lots add column if not exists chain_of_custody jsonb not null default '{}'::jsonb;
alter table public.residue_lots add column if not exists updated_at timestamptz not null default now();
alter table public.payments add column if not exists idempotency_key text;
alter table public.payments add column if not exists webhook_received_at timestamptz;
alter table public.payments add column if not exists failure_reason text;
create unique index if not exists payments_idempotency_key_idx on public.payments(idempotency_key) where idempotency_key is not null;

-- One active booking per field/date prevents duplicate reservations from double-clicks or retries.
create unique index if not exists one_active_booking_per_field_date
on public.bookings(field_id, requested_date)
where status not in ('CANCELLED','FAILED');

-- Transactional booking reservation. The quote is supplied by the server-side quote service and is locked into the booking.
create or replace function public.reserve_clearance_booking(
  p_field_id uuid,
  p_requested_date date,
  p_rate_per_acre numeric,
  p_quoted_amount numeric,
  p_guaranteed_by_date date,
  p_penalty_amount numeric,
  p_pricing_band text,
  p_quote_metadata jsonb
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $booking$
declare
  f public.fields%rowtype;
  b public.bookings%rowtype;
begin
  select * into f from public.fields where id=p_field_id for update;
  if not found or f.owner_id <> auth.uid() then raise exception 'Field is not owned by the current farmer'; end if;
  if coalesce(f.consent_id::text,'') = '' and not exists(select 1 from public.consents c where c.profile_id=auth.uid() and c.consent_type='farmer_network' and c.revoked_at is null) then
    raise exception 'Active farmer consent is required before booking';
  end if;
  if f.boundary is null or not coalesce(f.boundary_verified,false) then
    raise exception 'Field acreage must be verified before booking';
  end if;
  if p_requested_date < current_date then raise exception 'Requested date is in the past'; end if;
  if p_requested_date > current_date + 90 then raise exception 'Requested date is outside the booking window'; end if;
  if p_rate_per_acre is null or p_quoted_amount is null or p_rate_per_acre <= 0 or p_quoted_amount <= 0
     or p_rate_per_acre > 100000 or p_quoted_amount > 100000000 then raise exception 'Invalid quote'; end if;
  if round(p_rate_per_acre * f.acreage, 2) <> round(p_quoted_amount, 2) then
    raise exception 'Quoted amount does not match registered field acreage';
  end if;
  if p_guaranteed_by_date is null or p_guaranteed_by_date < p_requested_date
     or p_guaranteed_by_date > p_requested_date + 30 then raise exception 'Invalid guarantee date'; end if;
  if p_penalty_amount is null or p_penalty_amount < 0 or p_penalty_amount > p_quoted_amount then raise exception 'Invalid penalty amount'; end if;
  if p_pricing_band is null or length(trim(p_pricing_band))=0 or length(p_pricing_band)>80 then raise exception 'Invalid pricing band'; end if;
  if p_quote_metadata is not null and jsonb_typeof(p_quote_metadata)<>'object' then raise exception 'Quote metadata must be an object'; end if;
  insert into public.bookings(field_id,requested_date,rate_per_acre,quoted_amount,guaranteed_by_date,penalty_amount,pricing_band,quote_metadata,status,accepted_at)
  values(p_field_id,p_requested_date,p_rate_per_acre,p_quoted_amount,p_guaranteed_by_date,p_penalty_amount,p_pricing_band,coalesce(p_quote_metadata,'{}'::jsonb),'BOOKED',now())
  returning * into b;
  update public.fields set status='BOOKED',clearance_deadline=(p_guaranteed_by_date::text||'T18:00:00+05:30')::timestamptz,updated_at=now() where id=p_field_id;
  return b;
exception when unique_violation then
  raise exception 'This field already has an active booking for that date';
end; 
$booking$;-- V7 role-specific writes.
drop policy if exists "farmer creates own fields" on public.fields;
create policy "farmer creates own fields with consent" on public.fields for insert to authenticated with check (
  owner_id=auth.uid() and exists(select 1 from public.consents c where c.profile_id=auth.uid() and c.consent_type='farmer_network' and c.revoked_at is null)
);

drop policy if exists "farmer creates own bookings" on public.bookings;
-- Booking creation is intentionally RPC-only after V7.
create policy "farmer updates own booking cancellation" on public.bookings for update to authenticated using(
  exists(select 1 from public.fields f where f.id=field_id and f.owner_id=auth.uid())
) with check(status in ('BOOKED','CANCELLED'));

drop policy if exists "operational roles create field events" on public.field_events;
create policy "operational roles create field events" on public.field_events for insert to authenticated with check(
  exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('operator','dispatcher','verifier','admin'))
);

grant update on public.bookings to authenticated;
grant select, insert on public.verification_events to authenticated;

-- V7 security correction: operational RPCs cross farmer-owned rows, so they run as definer
-- after validating the caller role. Farmers cannot directly mutate booking quote/rate fields.
create or replace function public.cancel_clearance_booking(p_booking_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare b public.bookings%rowtype;
begin
  select * into b from public.bookings where id=p_booking_id for update;
  if not found then raise exception 'Booking not found'; end if;
  if not exists(select 1 from public.fields f where f.id=b.field_id and f.owner_id=auth.uid()) then raise exception 'Booking is not owned by the current farmer'; end if;
  if b.status not in ('BOOKED','MACHINE_ASSIGNED') then raise exception 'Booking cannot be cancelled at this stage'; end if;
  update public.bookings set status='CANCELLED',cancelled_at=now(),updated_at=now() where id=p_booking_id returning * into b;
  update public.fields set status='CANCELLED',updated_at=now() where id=b.field_id;
  return b;
end;
$$;

grant execute on function public.cancel_clearance_booking(uuid) to authenticated;

drop policy if exists "farmer updates own booking cancellation" on public.bookings;
create policy "dispatcher updates booking assignments" on public.bookings for update to authenticated using(
  exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('dispatcher','admin'))
) with check(
  exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('dispatcher','admin'))
);

grant update on public.bookings to authenticated;

-- Recreate the cross-row functions as SECURITY DEFINER after the authorization checks.
create or replace function public.transition_job(
  p_job_id uuid,
  p_next_status text,
  p_metadata jsonb default '{}'::jsonb
)
returns public.jobs
language plpgsql
security definer
set search_path = public
as $$
declare j public.jobs%rowtype; role_name text; allowed boolean := false;
begin
  select * into j from public.jobs where id=p_job_id for update;
  if not found then raise exception 'Job not found'; end if;
  select role into role_name from public.profiles where id=auth.uid();
  if j.operator_id=auth.uid() or role_name in ('dispatcher','admin') then
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
$$;

create or replace function public.record_verification_review(
  p_field_id uuid,
  p_result text,
  p_confidence numeric,
  p_metadata jsonb default '{}'::jsonb
)
returns public.verification_events
language plpgsql
security definer
set search_path = public
as $$
declare v public.verification_events%rowtype; role_name text;
begin
  select role into role_name from public.profiles where id=auth.uid();
  if role_name not in ('verifier','dispatcher','admin') then raise exception 'Verifier role required'; end if;
  if p_result not in ('VERIFIED_NON_BURN','BURN_DETECTED','INCONCLUSIVE','REQUIRES_FIELD_REVIEW') then raise exception 'Unsupported verification result'; end if;
  if p_confidence is null or p_confidence < 0 or p_confidence > 100 then raise exception 'Confidence must be between 0 and 100'; end if;
  if p_metadata is not null and jsonb_typeof(p_metadata)<>'object' then raise exception 'Verification metadata must be an object'; end if;
  if not exists(select 1 from public.fields f where f.id=p_field_id) then raise exception 'Field not found'; end if;
  if p_result='VERIFIED_NON_BURN' and not exists(
    select 1 from public.evidence_assets e
    join public.bookings b on b.id=e.booking_id
    join public.jobs j on j.booking_id=b.id
    where e.field_id=p_field_id and j.status='COMPLETED'
      and e.kind in ('field_photo','bale_photo','weighment')
  ) then raise exception 'Completed-job field evidence is required before verification'; end if;
  insert into public.verification_events(field_id,method,result,confidence,metadata)
  values(p_field_id,'field_evidence_plus_firms',p_result,p_confidence,coalesce(p_metadata,'{}'::jsonb)) returning * into v;
  if p_result='VERIFIED_NON_BURN' then update public.fields set status='VERIFIED_NON_BURN',updated_at=now() where id=p_field_id; end if;
  return v;
end;
$$;

create or replace function public.accept_buyer_offer(p_offer_id uuid)
returns public.buyer_offers
language plpgsql
security definer
set search_path = public
as $$
declare o public.buyer_offers%rowtype; role_name text; updated_lot_id uuid;
begin
  select role into role_name from public.profiles where id=auth.uid();
  if role_name not in ('buyer','dispatcher','admin') then raise exception 'Buyer/dispatcher role required'; end if;
  select * into o from public.buyer_offers where id=p_offer_id and status='OPEN' and (valid_until is null or valid_until > now()) for update;
  if not found then raise exception 'Offer is no longer open or has expired'; end if;
  if role_name='buyer' and not exists(select 1 from public.buyers b where b.id=o.buyer_id and b.profile_id=auth.uid() and b.active) then
    raise exception 'Offer does not belong to the current buyer';
  end if;
  update public.residue_lots set assigned_buyer_id=o.buyer_id,status='ALLOCATED',updated_at=now()
  where id=o.lot_id and status in ('AVAILABLE','OPEN') and (quantity_tonnes is null or quantity_tonnes >= o.quantity_tonnes)
  returning id into updated_lot_id;
  if updated_lot_id is null then raise exception 'Residue lot is no longer available or has insufficient quantity'; end if;
  update public.buyer_offers set status='ACCEPTED' where id=p_offer_id returning * into o;
  return o;
end;
$$;

-- Operational write policies for the connected handoffs.
create policy "dispatcher creates jobs" on public.jobs for insert to authenticated with check(
  exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('dispatcher','admin'))
);
create policy "dispatcher updates jobs" on public.jobs for update to authenticated using(
  exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('dispatcher','admin'))
) with check(
  exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('dispatcher','admin'))
);

grant insert on public.jobs to authenticated;

drop policy if exists "farmer creates own residue lots" on public.residue_lots;
create policy "operator creates linked residue lot" on public.residue_lots for insert to authenticated with check(
  exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='operator')
  and exists(select 1 from public.jobs j join public.bookings b on b.id=j.booking_id join public.fields f on f.id=b.field_id where j.id=public.residue_lots.job_id and j.operator_id=auth.uid() and j.status='COMPLETED' and f.id=public.residue_lots.field_id)
);
grant insert on public.residue_lots to authenticated;

create policy "buyer creates offer" on public.buyer_offers for insert to authenticated with check(
  exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('buyer','dispatcher','admin'))
);
grant insert on public.buyer_offers to authenticated;


-- Explicit execute grants for the single authoritative V7 RPC definitions.
grant execute on function public.reserve_clearance_booking(uuid,date,numeric,numeric,date,numeric,text,jsonb) to authenticated;
grant execute on function public.transition_job(uuid,text,jsonb) to authenticated;
grant execute on function public.record_verification_review(uuid,text,numeric,jsonb) to authenticated;
grant execute on function public.accept_buyer_offer(uuid) to authenticated;

-- Do not leave security-definer RPCs executable by anonymous or PUBLIC roles.
revoke all on function public.cancel_clearance_booking(uuid) from public, anon;
revoke all on function public.reserve_clearance_booking(uuid,date,numeric,numeric,date,numeric,text,jsonb) from public, anon;
revoke all on function public.transition_job(uuid,text,jsonb) from public, anon;
revoke all on function public.record_verification_review(uuid,text,numeric,jsonb) from public, anon;
revoke all on function public.accept_buyer_offer(uuid) from public, anon;
grant execute on function public.cancel_clearance_booking(uuid) to authenticated;
grant execute on function public.reserve_clearance_booking(uuid,date,numeric,numeric,date,numeric,text,jsonb) to authenticated;
grant execute on function public.transition_job(uuid,text,jsonb) to authenticated;
grant execute on function public.record_verification_review(uuid,text,numeric,jsonb) to authenticated;
grant execute on function public.accept_buyer_offer(uuid) to authenticated;

-- >>> 202610010001_field_geometry_verification.sql
-- NIRDHOOM field geometry verification.
-- A farmer-drawn polygon is not authoritative by itself. Only an authorized
-- verifier may promote an imported/cadastral/registry boundary to verified.

create or replace function public.verify_field_geometry(
  p_field_id uuid,
  p_source text,
  p_metadata jsonb default '{}'::jsonb
)
returns public.fields
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  f public.fields%rowtype;
  role_name text;
  area_acres numeric;
  area_delta numeric;
begin
  select role into role_name from public.profiles where id=auth.uid();
  if role_name not in ('verifier','dispatcher','admin') then
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

  if not extensions.ST_IsValid(f.boundary::extensions.geometry) then
    raise exception 'Field boundary is not a valid polygon';
  end if;

  if extensions.ST_IsEmpty(f.boundary::extensions.geometry) then
    raise exception 'Field boundary is empty';
  end if;

  area_acres := round((extensions.ST_Area(f.boundary) / 4046.8564224)::numeric, 3);
  if area_acres <= 0 or area_acres > 10000 then
    raise exception 'Field boundary area is outside the supported range';
  end if;

  if f.acreage <= 0 then raise exception 'Registered acreage must be positive'; end if;
  area_delta := abs(area_acres - f.acreage) / greatest(f.acreage, 0.001);
  if area_delta > 0.20 then
    raise exception 'Boundary area differs from registered acreage by more than 20 percent';
  end if;

  update public.fields
  set boundary_source=p_source,
      boundary_verified=true,
      geometry_verified_at=now(),
      geometry_verified_by=auth.uid(),
      geometry_area_acres=area_acres,
      geometry_type='verified',
      updated_at=now()
  where id=p_field_id
  returning * into f;

  insert into public.audit_events(entity_type,entity_id,actor_id,action,before_state,after_state)
  values(
    'field', f.id, auth.uid(), 'FIELD_GEOMETRY_VERIFIED',
    jsonb_build_object('boundary_verified',false),
    jsonb_build_object(
      'boundary_verified',true,
      'boundary_source',p_source,
      'geometry_area_acres',area_acres,
      'metadata',coalesce(p_metadata,'{}'::jsonb)
    )
  );

  return f;
end;
$$;

revoke all on function public.verify_field_geometry(uuid,text,jsonb) from public, anon;
grant execute on function public.verify_field_geometry(uuid,text,jsonb) to authenticated;

-- >>> 202610010002_verified_area_booking.sql
-- Use verified PostGIS area as the authoritative booking acreage.
create or replace function public.reserve_clearance_booking(
  p_field_id uuid,
  p_requested_date date,
  p_rate_per_acre numeric,
  p_quoted_amount numeric,
  p_guaranteed_by_date date,
  p_penalty_amount numeric,
  p_pricing_band text,
  p_quote_metadata jsonb
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $booking$
declare
  f public.fields%rowtype;
  b public.bookings%rowtype;
  billable_acres numeric;
begin
  select * into f from public.fields where id=p_field_id for update;
  if not found or f.owner_id <> auth.uid() then raise exception 'Field is not owned by the current farmer'; end if;
  if coalesce(f.consent_id::text,'') = '' and not exists(select 1 from public.consents c where c.profile_id=auth.uid() and c.consent_type='farmer_network' and c.revoked_at is null) then
    raise exception 'Active farmer consent is required before booking';
  end if;
  if f.boundary is null or not coalesce(f.boundary_verified,false) or f.geometry_area_acres is null then
    raise exception 'Field acreage must be verified before booking';
  end if;
  billable_acres := f.geometry_area_acres;
  if p_requested_date < current_date then raise exception 'Requested date is in the past'; end if;
  if p_requested_date > current_date + 90 then raise exception 'Requested date is outside the booking window'; end if;
  if p_rate_per_acre is null or p_quoted_amount is null or p_rate_per_acre <= 0 or p_quoted_amount <= 0
     or p_rate_per_acre > 100000 or p_quoted_amount > 100000000 then raise exception 'Invalid quote'; end if;
  if round(p_rate_per_acre * billable_acres, 2) <> round(p_quoted_amount, 2) then
    raise exception 'Quoted amount does not match verified field acreage';
  end if;
  if p_guaranteed_by_date is null or p_guaranteed_by_date < p_requested_date
     or p_guaranteed_by_date > p_requested_date + 30 then raise exception 'Invalid guarantee date'; end if;
  if p_penalty_amount is null or p_penalty_amount < 0 or p_penalty_amount > p_quoted_amount then raise exception 'Invalid penalty amount'; end if;
  if p_pricing_band is null or length(trim(p_pricing_band))=0 or length(p_pricing_band)>80 then raise exception 'Invalid pricing band'; end if;
  if p_quote_metadata is not null and jsonb_typeof(p_quote_metadata)<>'object' then raise exception 'Quote metadata must be an object'; end if;
  insert into public.bookings(field_id,requested_date,rate_per_acre,quoted_amount,guaranteed_by_date,penalty_amount,pricing_band,quote_metadata,status,accepted_at)
  values(p_field_id,p_requested_date,p_rate_per_acre,p_quoted_amount,p_guaranteed_by_date,p_penalty_amount,p_pricing_band,coalesce(p_quote_metadata,'{}'::jsonb),'BOOKED',now())
  returning * into b;
  update public.fields set status='BOOKED',clearance_deadline=(p_guaranteed_by_date::text||'T18:00:00+05:30')::timestamptz,updated_at=now() where id=p_field_id;
  return b;
exception when unique_violation then
  raise exception 'This field already has an active booking for that date';
end;
$booking$;

revoke all on function public.reserve_clearance_booking(uuid,date,numeric,numeric,date,numeric,text,jsonb) from public, anon;
grant execute on function public.reserve_clearance_booking(uuid,date,numeric,numeric,date,numeric,text,jsonb) to authenticated;

-- >>> 202610010005_nirdhoom_booking_integrity.sql
-- NIRDHOOM V7.1: server-owned quote integrity.
-- The browser may preview a quote, but it may not choose the financial terms
-- that become authoritative in a booking.

create or replace function public.reserve_clearance_booking_v2(
  p_field_id uuid,
  p_requested_date date
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
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
$$;

grant execute on function public.reserve_clearance_booking_v2(uuid,date) to authenticated;

-- >>> 202610010006_nirdhoom_verification_and_settlement_integrity.sql
-- NIRDHOOM V7.2: close remaining trust-boundary gaps.
-- Verification requires an operational evidence chain; buyer allocation must
-- actually claim the lot; the legacy client-supplied booking RPC is retired.

revoke execute on function public.reserve_clearance_booking(uuid,date,numeric,numeric,date,numeric,text,jsonb) from authenticated;

create or replace function public.record_verification_review(
  p_field_id uuid,
  p_result text,
  p_confidence numeric,
  p_metadata jsonb default '{}'::jsonb
)
returns public.verification_events
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.verification_events%rowtype;
  role_name text;
  completed_job uuid;
  evidence_count integer;
  lot_count integer;
begin
  select role into role_name from public.profiles where id=auth.uid();
  if role_name not in ('verifier','dispatcher','admin') then
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
$$;

grant execute on function public.record_verification_review(uuid,text,numeric,jsonb) to authenticated;

create or replace function public.accept_buyer_offer(p_offer_id uuid)
returns public.buyer_offers
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.buyer_offers%rowtype;
  role_name text;
  claimed integer;
begin
  select role into role_name from public.profiles where id=auth.uid();
  if role_name not in ('buyer','dispatcher','admin') then
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
$$;

grant execute on function public.accept_buyer_offer(uuid) to authenticated;

create unique index if not exists payments_provider_reference_idx
on public.payments(provider, provider_reference)
where provider is not null and provider_reference is not null;

-- >>> 202610010007_nirdhoom_operational_integrity.sql
-- NIRDHOOM V7.3: operational integrity.
-- Close remaining client-write and cross-tenant trust gaps.

create or replace function public.prevent_self_privileged_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and new.id = auth.uid() and coalesce(new.role,'farmer') <> 'farmer' then
    raise exception 'New self-created profiles must start as farmer';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_insert_role on public.profiles;
create trigger protect_profile_insert_role
before insert on public.profiles
for each row execute function public.prevent_self_privileged_profile();

alter table public.buyers add column if not exists profile_id uuid references public.profiles(id);
create unique index if not exists buyers_profile_unique_idx
on public.buyers(profile_id) where profile_id is not null;

drop policy if exists "buyer creates offer" on public.buyer_offers;
create policy "buyer creates own offer" on public.buyer_offers
for insert to authenticated
with check (
  exists(
    select 1 from public.profiles p
    where p.id=auth.uid() and p.role in ('dispatcher','admin')
  )
  or exists(
    select 1 from public.buyers b
    where b.id=buyer_id and b.profile_id=auth.uid() and b.active=true
  )
);

alter table public.machine_locations
  drop constraint if exists machine_locations_latitude_check;
alter table public.machine_locations
  add constraint machine_locations_latitude_check check (latitude between -90 and 90);
alter table public.machine_locations
  drop constraint if exists machine_locations_longitude_check;
alter table public.machine_locations
  add constraint machine_locations_longitude_check check (longitude between -180 and 180);
alter table public.machine_locations
  drop constraint if exists machine_locations_speed_check;
alter table public.machine_locations
  add constraint machine_locations_speed_check check (speed_kmh is null or speed_kmh between 0 and 250);

create or replace function public.validate_evidence_asset()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare booking_field uuid;
begin
  if new.booking_id is not null then
    select field_id into booking_field from public.bookings where id=new.booking_id;
    if booking_field is null or booking_field <> new.field_id then
      raise exception 'Evidence booking does not belong to the supplied field';
    end if;
  end if;

  if new.created_by is not null and new.storage_path is not null
     and split_part(new.storage_path,'/',1) <> new.created_by::text then
    raise exception 'Evidence storage path must belong to its creator';
  end if;

  if new.latitude is not null and (new.latitude < -90 or new.latitude > 90) then
    raise exception 'Evidence latitude is invalid';
  end if;
  if new.longitude is not null and (new.longitude < -180 or new.longitude > 180) then
    raise exception 'Evidence longitude is invalid';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_evidence_asset on public.evidence_assets;
create trigger validate_evidence_asset
before insert or update on public.evidence_assets
for each row execute function public.validate_evidence_asset();

drop policy if exists "nirdhoom evidence read" on storage.objects;
create policy "nirdhoom evidence read" on storage.objects
for select to authenticated
using(
  bucket_id='evidence'
  and (
    (storage.foldername(name))[1]=(select auth.uid())::text
    or exists(
      select 1 from public.profiles p
      where p.id=(select auth.uid()) and p.role in ('verifier','dispatcher','admin')
    )
  )
);

revoke insert on public.firms_observations from authenticated;

drop policy if exists "operator/verifier inserts evidence" on public.evidence_assets;
drop policy if exists "operator/verifier inserts linked evidence" on public.evidence_assets;
create policy "operator inserts linked evidence" on public.evidence_assets
for insert to authenticated
with check (
  (select p.role from public.profiles p where p.id=auth.uid())='operator'
  and created_by=auth.uid()
  and exists(
    select 1
    from public.jobs j
    join public.bookings b on b.id=j.booking_id
    where j.operator_id=auth.uid()
      and j.status in ('ARRIVED','BALING','PROOF_PENDING','COMPLETED')
      and b.id=evidence_assets.booking_id
      and b.field_id=evidence_assets.field_id
  )
);

grant execute on function public.accept_buyer_offer(uuid) to authenticated;

-- >>> 20261001_nirdhoom_database_hygiene.sql
-- NIRDHOOM post-deploy database hygiene.
set search_path = public, extensions;
create or replace function public.prevent_role_escalation()
returns trigger language plpgsql set search_path = public as $$
begin
  if (select auth.uid()) = old.id and new.role is distinct from old.role then
    raise exception 'role changes must be performed by an authorized operator';
  end if;
  return new;
end; $$;

drop policy if exists "operator reads own machine" on public.machines;

drop policy if exists "operator updates own jobs" on public.jobs;
drop policy if exists "dispatcher updates jobs" on public.jobs;
create policy "authorized updates jobs" on public.jobs for update to authenticated
using(operator_id=(select auth.uid()) or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('dispatcher','admin')))
with check(operator_id=(select auth.uid()) or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('dispatcher','admin')));

drop policy if exists "farmer creates own fields with consent" on public.fields;
create policy "farmer creates own fields with consent" on public.fields for insert to authenticated with check(
  owner_id=(select auth.uid()) and exists(select 1 from public.consents c where c.profile_id=(select auth.uid()) and c.consent_type='farmer_network' and c.revoked_at is null)
);

drop policy if exists "dispatcher updates booking assignments" on public.bookings;
create policy "dispatcher updates booking assignments" on public.bookings for update to authenticated
using(exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('dispatcher','admin')))
with check(exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('dispatcher','admin')));

drop policy if exists "operational roles create field events" on public.field_events;
create policy "operational roles create field events" on public.field_events for insert to authenticated with check(
  exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('operator','dispatcher','verifier','admin'))
);

drop policy if exists "operator creates linked residue lot" on public.residue_lots;
create policy "operator creates linked residue lot" on public.residue_lots for insert to authenticated with check(
  exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='operator')
  and exists(select 1 from public.jobs j join public.bookings b on b.id=j.booking_id join public.fields f on f.id=b.field_id where j.id=public.residue_lots.job_id and j.operator_id=(select auth.uid()) and j.status='COMPLETED' and f.id=public.residue_lots.field_id)
);

drop policy if exists "buyer creates offer" on public.buyer_offers;
create policy "buyer creates offer" on public.buyer_offers for insert to authenticated with check(
  exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('buyer','dispatcher','admin'))
);

create index if not exists ai_conversations_field_id_idx on public.ai_conversations(field_id);
create index if not exists ai_conversations_profile_id_idx on public.ai_conversations(profile_id);
create index if not exists audit_events_actor_id_idx on public.audit_events(actor_id);
create index if not exists audit_log_actor_id_idx on public.audit_log(actor_id);
create index if not exists bookings_machine_id_idx on public.bookings(machine_id);
create index if not exists buyer_contracts_buyer_id_idx on public.buyer_contracts(buyer_id);
create index if not exists buyer_offers_buyer_id_idx on public.buyer_offers(buyer_id);
create index if not exists credit_transactions_field_id_idx on public.credit_transactions(field_id);
create index if not exists credit_transactions_profile_id_idx on public.credit_transactions(profile_id);
create index if not exists dispatches_buyer_id_idx on public.dispatches(buyer_id);
create index if not exists evidence_assets_created_by_idx on public.evidence_assets(created_by);
create index if not exists field_events_actor_id_idx on public.field_events(actor_id);
create index if not exists field_events_field_id_idx on public.field_events(field_id);
create index if not exists fields_consent_id_idx on public.fields(consent_id);
create index if not exists fields_geometry_verified_by_idx on public.fields(geometry_verified_by);
create index if not exists fields_owner_id_idx on public.fields(owner_id);
create index if not exists firms_observations_matched_field_id_idx on public.firms_observations(matched_field_id);
create index if not exists harvest_forecasts_field_id_idx on public.harvest_forecasts(field_id);
create index if not exists jobs_machine_id_idx on public.jobs(machine_id);
create index if not exists jobs_operator_id_idx on public.jobs(operator_id);
create index if not exists machines_operator_user_id_idx on public.machines(operator_user_id);
create index if not exists notifications_profile_id_idx on public.notifications(profile_id);
create index if not exists payments_booking_id_idx on public.payments(booking_id);
create index if not exists residue_lots_assigned_buyer_id_idx on public.residue_lots(assigned_buyer_id);
create index if not exists residue_lots_booking_id_idx on public.residue_lots(booking_id);
create index if not exists residue_lots_job_id_idx on public.residue_lots(job_id);
create index if not exists residue_lots_storage_yard_id_idx on public.residue_lots(storage_yard_id);
create index if not exists soil_reports_field_id_idx on public.soil_reports(field_id);
create index if not exists soil_reports_profile_id_idx on public.soil_reports(profile_id);
create index if not exists verification_events_field_id_idx on public.verification_events(field_id);
create index if not exists weather_snapshots_field_id_idx on public.weather_snapshots(field_id);
drop index if exists public.machine_locations_recent_idx;

-- >>> 20261001_nirdhoom_rls_initplan_fix.sql
-- Remove the last per-row auth() evaluation warning from the dispatcher job insert policy.
drop policy if exists "dispatcher creates jobs" on public.jobs;
create policy "dispatcher creates jobs" on public.jobs for insert to authenticated
with check(
  exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('dispatcher','admin'))
);

-- >>> 202610020008_nirdhoom_client_write_integrity.sql
-- NIRDHOOM V7.5: close direct client-write and demo-truth gaps.
-- Booking authority lives in reserve_clearance_booking_v2; field identity and
-- operational state must not be editable through the generic farmer UPDATE path.

revoke insert, update, delete on public.bookings from authenticated;
drop policy if exists "farmer creates own bookings" on public.bookings;
drop policy if exists "farmer updates own bookings" on public.bookings;

create or replace function public.prevent_farmer_field_tampering()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role text;
begin
  select role into actor_role from public.profiles where id=auth.uid();

  if actor_role='farmer' and TG_OP='INSERT' and new.owner_id=auth.uid() then
    if coalesce(new.status,'REGISTERED') <> 'REGISTERED'
       or new.clearance_deadline is not null
       or new.boundary_verified
       then
      raise exception 'New farmer fields must begin in REGISTERED state with unverified boundaries';
    end if;
  end if;

  if actor_role='farmer' and TG_OP='UPDATE' and old.owner_id=auth.uid() then
    if new.owner_id is distinct from old.owner_id
       or new.khasra_no is distinct from old.khasra_no
       or new.acreage is distinct from old.acreage
       or new.status is distinct from old.status
       or new.clearance_deadline is distinct from old.clearance_deadline
       or new.center_lat is distinct from old.center_lat
       or new.center_lng is distinct from old.center_lng
       or new.geometry is distinct from old.geometry
       or new.boundary_geojson is distinct from old.boundary_geojson
       or new.boundary_source is distinct from old.boundary_source
       or new.boundary_verified is distinct from old.boundary_verified
       or new.boundary is distinct from old.boundary
       then
      raise exception 'Protected field attributes must be changed through an authorized workflow';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_farmer_field_tampering on public.fields;
create trigger prevent_farmer_field_tampering
before insert or update on public.fields
for each row execute function public.prevent_farmer_field_tampering();

-- The authoritative RPC is the only authenticated client path for booking creation.
grant execute on function public.reserve_clearance_booking_v2(uuid,date) to authenticated;

-- Defense in depth: do not leave the legacy server-authoritative function executable to clients.
revoke all on function public.reserve_clearance_booking(uuid,date,numeric,numeric,date,numeric,text,jsonb) from public, anon, authenticated;

-- Keep the estimate endpoint mathematically consistent with the booking invariant.

-- >>> 202610020009_nirdhoom_security_advisor_cleanup.sql
-- NIRDHOOM V7.6: close Supabase security/performance advisor findings.
-- SECURITY DEFINER trigger helpers are not RPC endpoints. Operational RPCs remain
-- callable only by authenticated users and enforce role/ownership internally.

revoke all on function public.prevent_farmer_field_tampering() from public, anon, authenticated;
revoke all on function public.prevent_self_privileged_profile() from public, anon, authenticated;
revoke all on function public.validate_evidence_asset() from public, anon, authenticated;

revoke all on function public.reserve_clearance_booking_v2(uuid,date) from public, anon;
grant execute on function public.reserve_clearance_booking_v2(uuid,date) to authenticated;

revoke all on function public.accept_buyer_offer(uuid) from public, anon;
grant execute on function public.accept_buyer_offer(uuid) to authenticated;

revoke all on function public.cancel_clearance_booking(uuid) from public, anon;
grant execute on function public.cancel_clearance_booking(uuid) to authenticated;

revoke all on function public.record_verification_review(uuid,text,numeric,jsonb) from public, anon;
grant execute on function public.record_verification_review(uuid,text,numeric,jsonb) to authenticated;

revoke all on function public.transition_job(uuid,text,jsonb) from public, anon;
grant execute on function public.transition_job(uuid,text,jsonb) to authenticated;

revoke all on function public.verify_field_geometry(uuid,text,jsonb) from public, anon;
grant execute on function public.verify_field_geometry(uuid,text,jsonb) to authenticated;

drop index if exists public.buyers_profile_unique_idx;

drop policy if exists "buyer creates own offer" on public.buyer_offers;
create policy "buyer creates own offer" on public.buyer_offers
for insert to authenticated
with check (
  exists(
    select 1 from public.profiles p
    where p.id=(select auth.uid()) and p.role in ('dispatcher','admin')
  )
  or exists(
    select 1 from public.buyers b
    where b.id=buyer_id and b.profile_id=(select auth.uid()) and b.active=true
  )
);

drop policy if exists "operator inserts linked evidence" on public.evidence_assets;
create policy "operator inserts linked evidence" on public.evidence_assets
for insert to authenticated
with check (
  (select p.role from public.profiles p where p.id=(select auth.uid()))='operator'
  and created_by=(select auth.uid())
  and exists(
    select 1
    from public.jobs j
    join public.bookings b on b.id=j.booking_id
    where j.operator_id=(select auth.uid())
      and j.status in ('ARRIVED','BALING','PROOF_PENDING','COMPLETED')
      and b.id=evidence_assets.booking_id
      and b.field_id=evidence_assets.field_id
  )
);

-- >>> 202610020010_nirdhoom_residue_pooling_and_research.sql
-- NIRDHOOM residue-first marketplace layer.
-- Pool fragmented supply against buyer demand; impact remains downstream of verified evidence.

create table if not exists public.buyer_demands (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.buyers(id) on delete cascade,
  buyer_name text not null,
  residue_type text not null default 'PADDY_STRAW',
  target_tonnes numeric(12,2) not null check (target_tonnes > 0),
  pickup_deadline date not null,
  radius_km numeric(8,2) not null default 50 check (radius_km > 0),
  max_moisture_pct numeric(5,2),
  status text not null default 'OPEN' check (status in ('OPEN','MATCHED','FULFILLED','CANCELLED','EXPIRED')),
  created_at timestamptz not null default now()
);

create table if not exists public.residue_pools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  buyer_demand_id uuid references public.buyer_demands(id) on delete set null,
  target_tonnes numeric(12,2) not null check (target_tonnes > 0),
  current_tonnes numeric(12,2) not null default 0 check (current_tonnes >= 0),
  status text not null default 'FILLING' check (status in ('FILLING','MATCHED','LOCKED','COLLECTING','COMPLETED','CANCELLED')),
  pickup_deadline date,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.residue_pool_members (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.residue_pools(id) on delete cascade,
  residue_lot_id uuid not null references public.residue_lots(id) on delete restrict,
  farmer_id uuid not null references public.profiles(id) on delete restrict,
  committed_tonnes numeric(12,2) not null check (committed_tonnes > 0),
  status text not null default 'COMMITTED' check (status in ('COMMITTED','WITHDRAWN','FULFILLED')),
  created_at timestamptz not null default now(),
  unique(pool_id, residue_lot_id)
);

create table if not exists public.impact_methodologies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  version text not null,
  source_url text,
  assumptions jsonb not null default '{}'::jsonb,
  active boolean not null default false,
  created_at timestamptz not null default now(),
  unique(name, version)
);

create index if not exists buyer_demands_status_idx on public.buyer_demands(status, pickup_deadline);
create index if not exists residue_pools_status_idx on public.residue_pools(status, created_at desc);
create index if not exists residue_pool_members_pool_idx on public.residue_pool_members(pool_id);
create index if not exists residue_pool_members_lot_idx on public.residue_pool_members(residue_lot_id);

alter table public.buyer_demands enable row level security;
alter table public.residue_pools enable row level security;
alter table public.residue_pool_members enable row level security;
alter table public.impact_methodologies enable row level security;

drop policy if exists "buyers read own demands" on public.buyer_demands;
create policy "buyers read own demands" on public.buyer_demands for select to authenticated using (
  buyer_id=(select auth.uid())
  or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('dispatcher','admin'))
);

drop policy if exists "buyers create own demands" on public.buyer_demands;
create policy "buyers create own demands" on public.buyer_demands for insert to authenticated with check (
  buyer_id=(select auth.uid())
  and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='buyer')
);

drop policy if exists "operational read pools" on public.residue_pools;
create policy "operational read pools" on public.residue_pools for select to authenticated using (
  exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('farmer','buyer','operator','dispatcher','verifier','admin'))
);

drop policy if exists "operational read pool members" on public.residue_pool_members;
create policy "operational read pool members" on public.residue_pool_members for select to authenticated using (
  exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('farmer','buyer','operator','dispatcher','verifier','admin'))
);

drop policy if exists "verified lot owners can commit" on public.residue_pool_members;
create policy "verified lot owners can commit" on public.residue_pool_members for insert to authenticated with check (
  farmer_id=(select auth.uid())
  and exists(
    select 1 from public.residue_lots l
    join public.fields f on f.id=l.field_id
    where l.id=residue_lot_id and f.owner_id=(select auth.uid())
      and l.status in ('AVAILABLE','VERIFIED','VERIFIED_NON_BURN')
  )
);

create or replace function public.join_residue_pool(p_pool_id uuid, p_quantity_tonnes numeric)
returns public.residue_pool_members
language plpgsql
security definer
set search_path = public
as $$
declare
  lot_row public.residue_lots%rowtype;
  member_row public.residue_pool_members%rowtype;
  remaining numeric;
  actor uuid := (select auth.uid());
begin
  if actor is null then raise exception 'authentication required'; end if;
  if p_quantity_tonnes <= 0 then raise exception 'quantity must be positive'; end if;

  select l.* into lot_row
  from public.residue_lots l
  join public.fields f on f.id=l.field_id
  where f.owner_id=actor and l.status in ('AVAILABLE','VERIFIED','VERIFIED_NON_BURN')
  order by l.created_at asc
  for update of l
  limit 1;

  if lot_row.id is null then raise exception 'no eligible residue lot'; end if;

  select greatest(0, p.target_tonnes - p.current_tonnes) into remaining
  from public.residue_pools p where p.id=p_pool_id and p.status='FILLING' for update;

  if remaining is null then raise exception 'pool is not accepting commitments'; end if;
  if p_quantity_tonnes > remaining then raise exception 'commitment exceeds pool remaining capacity'; end if;
  if exists(select 1 from public.residue_pool_members m where m.pool_id=p_pool_id and m.residue_lot_id=lot_row.id and m.status='COMMITTED') then
    raise exception 'residue lot already committed to this pool';
  end if;

  insert into public.residue_pool_members(pool_id,residue_lot_id,farmer_id,committed_tonnes)
  values(p_pool_id,lot_row.id,actor,p_quantity_tonnes)
  returning * into member_row;

  update public.residue_pools set current_tonnes=current_tonnes+p_quantity_tonnes where id=p_pool_id;
  return member_row;
end;
$$;

grant select on public.buyer_demands, public.residue_pools, public.residue_pool_members, public.impact_methodologies to authenticated;
grant execute on function public.join_residue_pool(uuid,numeric) to authenticated;

drop policy if exists "read active methodologies" on public.impact_methodologies;
create policy "read active methodologies" on public.impact_methodologies for select to authenticated using (
  active=true or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('verifier','admin'))
);


create or replace function public.create_residue_pool(
  p_name text,
  p_target_tonnes numeric,
  p_pickup_deadline date,
  p_buyer_demand_id uuid default null
)
returns public.residue_pools
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := (select auth.uid());
  role_name text;
  row_out public.residue_pools%rowtype;
begin
  if actor is null then raise exception 'authentication required'; end if;
  if p_target_tonnes <= 0 then raise exception 'target quantity must be positive'; end if;

  select role into role_name from public.profiles where id=actor;
  if role_name not in ('buyer','dispatcher','admin') then
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
$$;

grant execute on function public.create_residue_pool(text,numeric,date,uuid) to authenticated;

revoke all on function public.join_residue_pool(uuid,numeric) from public;
grant execute on function public.join_residue_pool(uuid,numeric) to authenticated;
revoke all on function public.create_residue_pool(text,numeric,date,uuid) from public;
grant execute on function public.create_residue_pool(text,numeric,date,uuid) to authenticated;

-- >>> 202610020011_nirdhoom_residue_pooling_security_and_indexes.sql
-- Lock residue pooling SECURITY DEFINER RPCs to signed-in users.
revoke execute on function public.join_residue_pool(uuid,numeric) from anon;
revoke execute on function public.join_residue_pool(uuid,numeric) from public;
grant execute on function public.join_residue_pool(uuid,numeric) to authenticated;

revoke execute on function public.create_residue_pool(text,numeric,date,uuid) from anon;
revoke execute on function public.create_residue_pool(text,numeric,date,uuid) from public;
grant execute on function public.create_residue_pool(text,numeric,date,uuid) to authenticated;

create index if not exists buyer_demands_buyer_id_idx on public.buyer_demands(buyer_id);
create index if not exists residue_pools_buyer_demand_id_idx on public.residue_pools(buyer_demand_id);
create index if not exists residue_pools_created_by_idx on public.residue_pools(created_by);
create index if not exists residue_pool_members_farmer_id_idx on public.residue_pool_members(farmer_id);

-- >>> 202610020012_nirdhoom_residue_pool_verification_gate.sql
-- Pool only verified residue; expose open buyer demand to authenticated participants.
drop policy if exists "buyers read own demands" on public.buyer_demands;
create policy "authenticated read open demands" on public.buyer_demands
for select to authenticated using (
  status='OPEN'
  or buyer_id=(select auth.uid())
  or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('dispatcher','admin'))
);

drop policy if exists "verified lot owners can commit" on public.residue_pool_members;
create policy "verified lot owners can commit" on public.residue_pool_members
for insert to authenticated
with check (
  farmer_id=(select auth.uid())
  and exists(
    select 1 from public.residue_lots l
    join public.fields f on f.id=l.field_id
    where l.id=residue_lot_id
      and f.owner_id=(select auth.uid())
      and l.status in ('VERIFIED','VERIFIED_NON_BURN')
  )
);

create or replace function public.join_residue_pool(p_pool_id uuid, p_quantity_tonnes numeric)
returns public.residue_pool_members
language plpgsql
security definer
set search_path = public
as $$
declare
  lot_row public.residue_lots%rowtype;
  member_row public.residue_pool_members%rowtype;
  remaining numeric;
  actor uuid := (select auth.uid());
begin
  if actor is null then raise exception 'authentication required'; end if;
  if p_quantity_tonnes <= 0 then raise exception 'quantity must be positive'; end if;

  select l.* into lot_row
  from public.residue_lots l
  join public.fields f on f.id=l.field_id
  where f.owner_id=actor
    and l.status in ('VERIFIED','VERIFIED_NON_BURN')
  order by l.created_at asc
  for update of l
  limit 1;

  if lot_row.id is null then raise exception 'no verified residue lot'; end if;

  select greatest(0, p.target_tonnes - p.current_tonnes) into remaining
  from public.residue_pools p where p.id=p_pool_id and p.status='FILLING' for update;

  if remaining is null then raise exception 'pool is not accepting commitments'; end if;
  if p_quantity_tonnes > remaining then raise exception 'commitment exceeds pool remaining capacity'; end if;
  if exists(select 1 from public.residue_pool_members m where m.pool_id=p_pool_id and m.residue_lot_id=lot_row.id and m.status='COMMITTED') then
    raise exception 'residue lot already committed to this pool';
  end if;

  insert into public.residue_pool_members(pool_id,residue_lot_id,farmer_id,committed_tonnes)
  values(p_pool_id,lot_row.id,actor,p_quantity_tonnes)
  returning * into member_row;

  update public.residue_pools
  set current_tonnes=current_tonnes+p_quantity_tonnes,
      status=case when current_tonnes+p_quantity_tonnes >= target_tonnes then 'MATCHED' else status end
  where id=p_pool_id;

  return member_row;
end;
$$;

revoke execute on function public.join_residue_pool(uuid,numeric) from anon;
revoke execute on function public.join_residue_pool(uuid,numeric) from public;
grant execute on function public.join_residue_pool(uuid,numeric) to authenticated;

-- >>> 202610040001_machine_privacy_and_pool_member_visibility.sql
-- NIRDHOOM V7.6: tighten machine and residue-pool member privacy.
-- Machines contain operator phone/location telemetry; farmers only need machines
-- assigned to one of their bookings. Pool members expose farmer commitments and
-- are operationally private except to buyers/ops.

drop policy if exists "authenticated reads machines" on public.machines;
create policy "authorized reads machines"
on public.machines
for select
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id=(select auth.uid())
      and p.role in ('dispatcher','admin')
  )
  or operator_user_id=(select auth.uid())
  or exists (
    select 1
    from public.bookings b
    join public.fields f on f.id=b.field_id
    where b.machine_id=public.machines.id
      and f.owner_id=(select auth.uid())
      and b.status not in ('CANCELLED','FAILED')
  )
);

drop policy if exists "operational read pool members" on public.residue_pool_members;
create policy "authorized read pool members"
on public.residue_pool_members
for select
to authenticated
using (
  farmer_id=(select auth.uid())
  or exists (
    select 1 from public.profiles p
    where p.id=(select auth.uid())
      and p.role in ('buyer','operator','dispatcher','verifier','admin')
  )
);

-- >>> 202610040002_revoke_trigger_function_execute.sql
-- NIRDHOOM V7.7: trigger-only functions do not need API EXECUTE privileges.
revoke all on function public.prevent_role_escalation() from public, anon, authenticated;
revoke all on function public.refresh_field_geometry_metrics() from public, anon, authenticated;
revoke all on function public.sync_field_boundary() from public, anon, authenticated;

-- >>> 202610050001_nirdhoom_telegram_identity.sql
-- NIRDHOOM Telegram identity/linking layer.
-- Telegram chat IDs are operational identifiers and must never be treated as proof of farmer identity.

create table if not exists public.telegram_identities (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  telegram_user_id bigint not null unique,
  telegram_chat_id bigint not null unique,
  username text,
  first_name text,
  language_code text,
  linked_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  notification_enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists telegram_identities_profile_idx
  on public.telegram_identities(profile_id);

alter table public.telegram_identities enable row level security;

drop policy if exists "users read own telegram identity" on public.telegram_identities;
create policy "users read own telegram identity"
on public.telegram_identities for select to authenticated
using (profile_id=(select auth.uid()));

drop policy if exists "users update own telegram notification preference" on public.telegram_identities;
create policy "users update own telegram notification preference"
on public.telegram_identities for update to authenticated
using (profile_id=(select auth.uid()))
with check (profile_id=(select auth.uid()));

create table if not exists public.telegram_link_tokens (
  token_hash text primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists telegram_link_tokens_profile_idx
  on public.telegram_link_tokens(profile_id);

alter table public.telegram_link_tokens enable row level security;

-- Link tokens are created/consumed only by server-side API routes.
revoke all on public.telegram_identities from anon, authenticated;
grant select, update on public.telegram_identities to authenticated;
revoke all on public.telegram_link_tokens from public, anon, authenticated;

create or replace function public.consume_telegram_link_token(
  p_token_hash text,
  p_telegram_user_id bigint,
  p_telegram_chat_id bigint,
  p_username text default null,
  p_first_name text default null,
  p_language_code text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  token_row public.telegram_link_tokens%rowtype;
  linked_profile uuid;
begin
  select * into token_row
  from public.telegram_link_tokens
  where token_hash=p_token_hash
    and used_at is null
    and expires_at > now()
  for update;

  if not found then
    raise exception 'Telegram link token is invalid or expired';
  end if;

  insert into public.telegram_identities(
    profile_id, telegram_user_id, telegram_chat_id, username, first_name, language_code
  )
  values (
    token_row.profile_id, p_telegram_user_id, p_telegram_chat_id,
    nullif(left(p_username,255),''), nullif(left(p_first_name,255),''),
    nullif(left(p_language_code,32),'')
  )
  on conflict (telegram_user_id) do update set
    profile_id=excluded.profile_id,
    telegram_chat_id=excluded.telegram_chat_id,
    username=excluded.username,
    first_name=excluded.first_name,
    language_code=excluded.language_code,
    linked_at=now(),
    last_seen_at=now(),
    notification_enabled=true;

  update public.telegram_link_tokens
  set used_at=now()
  where token_hash=p_token_hash;

  select profile_id into linked_profile
  from public.telegram_identities
  where telegram_user_id=p_telegram_user_id;

  return linked_profile;
end;
$$;

revoke all on function public.consume_telegram_link_token(text,bigint,bigint,text,text,text) from public, anon, authenticated;
grant execute on function public.consume_telegram_link_token(text,bigint,bigint,text,text,text) to service_role;

-- >>> 202610050002_nirdhoom_telegram_webhook_idempotency.sql
-- NIRDHOOM Telegram webhook idempotency
create table if not exists public.telegram_webhook_updates (
  update_id bigint primary key,
  received_at timestamptz not null default now()
);

alter table public.telegram_webhook_updates enable row level security;
revoke all on public.telegram_webhook_updates from anon, authenticated, public;

-- >>> 202610050003_nirdhoom_telegram_identity_live_repair.sql
-- Live repair for environments where the Telegram identity migration was not applied.
-- Safe to re-run: all DDL is idempotent.
create table if not exists public.telegram_identities (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  telegram_user_id bigint not null unique,
  telegram_chat_id bigint not null unique,
  username text,
  first_name text,
  language_code text,
  linked_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  notification_enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists telegram_identities_profile_idx
  on public.telegram_identities(profile_id);

alter table public.telegram_identities enable row level security;

drop policy if exists "users read own telegram identity" on public.telegram_identities;
create policy "users read own telegram identity"
on public.telegram_identities for select to authenticated
using (profile_id=(select auth.uid()));

drop policy if exists "users update own telegram notification preference" on public.telegram_identities;
create policy "users update own telegram notification preference"
on public.telegram_identities for update to authenticated
using (profile_id=(select auth.uid()))
with check (profile_id=(select auth.uid()));

create table if not exists public.telegram_link_tokens (
  token_hash text primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists telegram_link_tokens_profile_idx
  on public.telegram_link_tokens(profile_id);

alter table public.telegram_link_tokens enable row level security;
revoke all on public.telegram_identities from anon, authenticated;
grant select, update on public.telegram_identities to authenticated;
revoke all on public.telegram_link_tokens from public, anon, authenticated;

create or replace function public.consume_telegram_link_token(
  p_token_hash text,
  p_telegram_user_id bigint,
  p_telegram_chat_id bigint,
  p_username text default null,
  p_first_name text default null,
  p_language_code text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  token_row public.telegram_link_tokens%rowtype;
  linked_profile uuid;
begin
  select * into token_row
  from public.telegram_link_tokens
  where token_hash=p_token_hash
    and used_at is null
    and expires_at > now()
  for update;

  if not found then
    raise exception 'Telegram link token is invalid or expired';
  end if;

  insert into public.telegram_identities(
    profile_id, telegram_user_id, telegram_chat_id, username, first_name, language_code
  )
  values (
    token_row.profile_id, p_telegram_user_id, p_telegram_chat_id,
    nullif(left(p_username,255),''), nullif(left(p_first_name,255),''),
    nullif(left(p_language_code,32),'')
  )
  on conflict (telegram_user_id) do update set
    profile_id=excluded.profile_id,
    telegram_chat_id=excluded.telegram_chat_id,
    username=excluded.username,
    first_name=excluded.first_name,
    language_code=excluded.language_code,
    linked_at=now(),
    last_seen_at=now(),
    notification_enabled=true;

  update public.telegram_link_tokens set used_at=now()
  where token_hash=p_token_hash;

  select profile_id into linked_profile
  from public.telegram_identities
  where telegram_user_id=p_telegram_user_id;

  return linked_profile;
end;
$$;

revoke all on function public.consume_telegram_link_token(text,bigint,bigint,text,text,text)
from public, anon, authenticated;
grant execute on function public.consume_telegram_link_token(text,bigint,bigint,text,text,text)
to service_role;

-- >>> 20261006_nirdhoom_integrity_hardening.sql
-- NIRDHOOM 2026-10-06 integrity hardening.
-- Pin SECURITY DEFINER search paths and prevent residue-lot over-allocation.

alter function public.accept_buyer_offer(uuid) set search_path = '';
alter function public.cancel_clearance_booking(uuid) set search_path = '';
alter function public.create_residue_pool(text,numeric,date,uuid) set search_path = '';
alter function public.join_residue_pool(uuid,numeric) set search_path = '';
alter function public.record_verification_review(uuid,text,numeric,jsonb) set search_path = '';
alter function public.reserve_clearance_booking_v2(uuid,date) set search_path = '';
alter function public.transition_job(uuid,text,jsonb) set search_path = '';
alter function public.verify_field_geometry(uuid,text,jsonb) set search_path = '';
alter function public.consume_telegram_link_token(text,bigint,bigint,text,text,text) set search_path = '';

create or replace function public.join_residue_pool(p_pool_id uuid, p_quantity_tonnes numeric)
returns public.residue_pool_members
language plpgsql
security definer
set search_path = ''
as $$
declare
  lot_id uuid;
  member_row public.residue_pool_members%rowtype;
  remaining numeric;
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
$$;

revoke execute on function public.join_residue_pool(uuid,numeric) from anon;
revoke execute on function public.join_residue_pool(uuid,numeric) from public;
grant execute on function public.join_residue_pool(uuid,numeric) to authenticated;

-- >>> 20261006_nirdhoom_residue_quantity_invariants.sql
-- NIRDHOOM 2026-10-06 residue quantity invariants.
-- Keep physical inventory and pool accounting valid even if a future client path is added.

alter table public.residue_lots
  alter column quantity_tonnes set not null;

alter table public.residue_lots
  add constraint residue_lots_quantity_positive
  check (quantity_tonnes > 0);

alter table public.residue_lots
  add constraint residue_lots_moisture_pct_range
  check (moisture_pct is null or (moisture_pct >= 0 and moisture_pct <= 100));

alter table public.residue_pools
  add constraint residue_pools_current_not_over_target
  check (current_tonnes <= target_tonnes);

alter table public.residue_pool_members
  add constraint residue_pool_members_commitment_finite
  check (committed_tonnes > 0);

-- >>> 202610070001_nirdhoom_consent_withdrawal.sql
-- NIRDHOOM 2026-10-07 consent withdrawal boundary.
-- Adds the missing self-service withdrawal path without changing prior migrations.

create policy "profile revokes own consent"
on public.consents
for update
to authenticated
using (
  profile_id = (select auth.uid())
  and revoked_at is null
)
with check (
  profile_id = (select auth.uid())
  and revoked_at is not null
);

grant update on public.consents to authenticated;

create or replace function public.revoke_farmer_network_consent()
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.consents
  set revoked_at = coalesce(revoked_at, now())
  where profile_id = (select auth.uid())
    and consent_type = 'farmer_network'
    and revoked_at is null;

  update public.profiles
  set consent_status = 'REVOKED'
  where id = (select auth.uid());

  if not found then
    raise exception 'Authenticated farmer profile was not found';
  end if;
end;
$$;

revoke all on function public.revoke_farmer_network_consent() from public;
grant execute on function public.revoke_farmer_network_consent() to authenticated;

-- >>> 202610070001_nirdhoom_private_realtime_live_operations.sql
-- NIRDHOOM private Realtime authorization for live operational refreshes.
drop policy if exists "nirdhoom live operations realtime read" on realtime.messages;
create policy "nirdhoom live operations realtime read"
on realtime.messages
for select
to authenticated
using (realtime.topic() = 'nirdhoom-live-operations');

-- >>> 202610080001_nirdhoom_residue_lot_provenance.sql
-- Provenance-aware residue lot extensions and chronological evidence events.
-- This migration adds traceability without changing existing residue status semantics.

alter table public.residue_lots
  add column if not exists residue_type text not null default 'PADDY_STRAW',
  add column if not exists verified_quantity_tonnes numeric(10,2),
  add column if not exists ready_from timestamptz,
  add column if not exists pickup_deadline timestamptz,
  add column if not exists verification_source text,
  add column if not exists verified_at timestamptz;

alter table public.residue_lots
  drop constraint if exists residue_lots_verified_quantity_nonnegative;

alter table public.residue_lots
  add constraint residue_lots_verified_quantity_nonnegative
  check (verified_quantity_tonnes is null or verified_quantity_tonnes >= 0);

create table if not exists public.residue_lot_events (
  id uuid primary key default gen_random_uuid(),
  residue_lot_id uuid not null references public.residue_lots(id) on delete cascade,
  event_type text not null check (event_type in (
    'FIELD_REGISTERED',
    'PICKUP_REQUESTED',
    'MACHINE_ASSIGNED',
    'MACHINE_ARRIVED',
    'EVIDENCE_CAPTURED',
    'WEIGHED',
    'VERIFIED',
    'POOLED',
    'BUYER_MATCHED',
    'DELIVERED'
  )),
  occurred_at timestamptz not null default now(),
  source text not null,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists residue_lot_events_lot_time_idx
  on public.residue_lot_events(residue_lot_id, occurred_at desc);

alter table public.residue_lot_events enable row level security;

drop policy if exists "authorized read residue lot events" on public.residue_lot_events;
create policy "authorized read residue lot events"
on public.residue_lot_events
for select
to authenticated
using (
  exists (
    select 1
    from public.residue_lots l
    join public.fields f on f.id=l.field_id
    where l.id=residue_lot_id
      and (
        f.owner_id=(select auth.uid())
        or exists (
          select 1
          from public.profiles p
          where p.id=(select auth.uid())
            and p.role in ('operator','dispatcher','verifier','buyer','admin')
        )
      )
  )
);

revoke insert, update, delete on public.residue_lot_events from anon, authenticated;
grant select on public.residue_lot_events to authenticated;

comment on column public.residue_lots.verification_source is
  'Human/provider source label for the verification decision; never infer authority from UI state alone.';

comment on table public.residue_lot_events is
  'Chronological evidence and custody ledger for residue lots. Inserts are server-authoritative.';

-- >>> 202610080002_nirdhoom_residue_lot_first_class.sql
-- First-class residue object: field -> machine -> evidence -> verification -> market.
-- Existing quantity/status columns remain compatible; new fields make provenance explicit.

alter table public.residue_lots
  add column if not exists farmer_id uuid references public.profiles(id) on delete restrict,
  add column if not exists crop text,
  add column if not exists residue_type text not null default 'PADDY_STRAW',
  add column if not exists estimated_quantity_tonnes numeric(10,2),
  add column if not exists verified_quantity_tonnes numeric(10,2),
  add column if not exists quality_grade text,
  add column if not exists bale_type text,
  add column if not exists harvest_date date,
  add column if not exists ready_from timestamptz,
  add column if not exists pickup_deadline timestamptz,
  add column if not exists machine_id uuid references public.machines(id) on delete set null,
  add column if not exists geometry_provenance jsonb not null default '{}'::jsonb,
  add column if not exists verification_source text,
  add column if not exists verified_at timestamptz;

update public.residue_lots l
set
  farmer_id = coalesce(l.farmer_id, f.owner_id),
  crop = coalesce(l.crop, f.crop),
  estimated_quantity_tonnes = coalesce(l.estimated_quantity_tonnes, l.quantity_tonnes),
  harvest_date = coalesce(l.harvest_date, f.expected_harvest_date),
  ready_from = coalesce(l.ready_from, f.expected_harvest_date::timestamptz),
  pickup_deadline = coalesce(l.pickup_deadline, f.clearance_deadline),
  geometry_provenance = case
    when l.geometry_provenance = '{}'::jsonb and f.geometry is not null
      then jsonb_build_object(
        'source', 'FIELD_RECORD',
        'field_geometry', f.geometry,
        'field_id', f.id
      )
    else l.geometry_provenance
  end
from public.fields f
where f.id = l.field_id;

alter table public.residue_lots
  alter column farmer_id set not null,
  alter column crop set default 'Paddy',
  alter column crop set not null;

alter table public.residue_lots
  drop constraint if exists residue_lots_estimated_quantity_nonnegative,
  drop constraint if exists residue_lots_verified_quantity_nonnegative;

alter table public.residue_lots
  add constraint residue_lots_estimated_quantity_nonnegative
    check (estimated_quantity_tonnes is null or estimated_quantity_tonnes >= 0),
  add constraint residue_lots_verified_quantity_nonnegative
    check (verified_quantity_tonnes is null or verified_quantity_tonnes >= 0);

create index if not exists residue_lots_farmer_status_idx
  on public.residue_lots(farmer_id, status, created_at desc);

create index if not exists residue_lots_ready_window_idx
  on public.residue_lots(ready_from, pickup_deadline)
  where status in ('AVAILABLE','VERIFIED','VERIFIED_NON_BURN');

-- Append-only custody/provenance events. Clients can read their own lot history,
-- but cannot forge custody events.
drop policy if exists "authorized read residue lot events" on public.residue_lot_events;
create policy "authorized read residue lot events"
on public.residue_lot_events
for select
to authenticated
using (
  exists (
    select 1
    from public.residue_lots l
    where l.id = residue_lot_id
      and (
        l.farmer_id = (select auth.uid())
        or exists (
          select 1 from public.profiles p
          where p.id=(select auth.uid())
            and p.role in ('operator','dispatcher','verifier','buyer','admin')
        )
      )
  )
);

revoke insert, update, delete on public.residue_lot_events from anon, authenticated;
grant select on public.residue_lot_events to authenticated;

create or replace function public.record_residue_lot_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_event text;
begin
  if tg_op = 'INSERT' then
    next_event := case
      when coalesce(new.verified_quantity_tonnes, 0) > 0 then 'WEIGHED'
      else 'PICKUP_REQUESTED'
    end;

    insert into public.residue_lot_events(
      residue_lot_id, event_type, occurred_at, source, actor_profile_id, metadata
    )
    values (
      new.id,
      next_event,
      coalesce(new.baled_at, now()),
      coalesce(new.verification_source, 'NIRDHOOM_RESIDUE_RECORD'),
      (select auth.uid()),
      jsonb_build_object(
        'quantity_tonnes', new.quantity_tonnes,
        'estimated_quantity_tonnes', new.estimated_quantity_tonnes,
        'verified_quantity_tonnes', new.verified_quantity_tonnes,
        'residue_type', new.residue_type
      )
    );
    return new;
  end if;

  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    next_event := case new.status
      when 'VERIFIED' then 'VERIFIED'
      when 'VERIFIED_NON_BURN' then 'VERIFIED'
      when 'ALLOCATED' then 'BUYER_MATCHED'
      when 'DELIVERED' then 'DELIVERED'
      else null
    end;

    if next_event is not null then
      insert into public.residue_lot_events(
        residue_lot_id, event_type, occurred_at, source, actor_profile_id, metadata
      )
      values (
        new.id,
        next_event,
        now(),
        coalesce(new.verification_source, 'NIRDHOOM_STATUS_TRANSITION'),
        (select auth.uid()),
        jsonb_build_object('from_status', old.status, 'to_status', new.status)
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists residue_lot_event_ledger on public.residue_lots;
create trigger residue_lot_event_ledger
after insert or update of status on public.residue_lots
for each row execute function public.record_residue_lot_event();

revoke all on function public.record_residue_lot_event() from public, anon, authenticated;

comment on table public.residue_lots is
  'First-class residue object: field origin, quantity/quality, machine/pickup window, provenance, verification and buyer/custody state.';
comment on column public.residue_lots.geometry_provenance is
  'Provenance metadata for the field geometry used by this lot; this does not assert authoritative cadastral ownership.';
comment on column public.residue_lots.verification_source is
  'Source of the verification decision. Remote sensing may support the decision but is not itself proof of no burning.';

create or replace function public.validate_residue_lot_identity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  field_row public.fields%rowtype;
begin
  select * into field_row from public.fields where id=new.field_id;
  if not found then raise exception 'Residue lot field does not exist'; end if;
  if new.farmer_id is distinct from field_row.owner_id then
    raise exception 'Residue lot farmer does not match field owner';
  end if;
  if new.crop is distinct from field_row.crop then
    raise exception 'Residue lot crop does not match field crop';
  end if;
  return new;
end;
$$;

drop trigger if exists residue_lot_identity_guard on public.residue_lots;
create trigger residue_lot_identity_guard
before insert or update of field_id, farmer_id, crop on public.residue_lots
for each row execute function public.validate_residue_lot_identity();

revoke all on function public.validate_residue_lot_identity() from public, anon, authenticated;

-- >>> 202610080003_nirdhoom_machine_capability_provenance.sql
-- Machine capability provenance: do not invent machinery specifications in the product UI.
alter table public.machines
  add column if not exists tractor_hp_required numeric(6,1),
  add column if not exists residue_types text[] not null default array['PADDY_STRAW']::text[],
  add column if not exists operating_conditions text,
  add column if not exists capability_source text,
  add column if not exists capability_source_date date;

create index if not exists machines_capability_source_idx
  on public.machines(capability_source, capability_source_date);

comment on column public.machines.capability_source is
  'External source used for machine capability claims, e.g. ICAR/PAU/official manufacturer documentation.';
comment on column public.machines.capability_source_date is
  'Publication/retrieval date for the capability source, not an inferred machine inspection date.';

-- >>> 202610080004_nirdhoom_residue_control_tower.sql
-- NIRDHOOM residue operations control tower.
-- Adds physical-network objects for machine capacity, yards, transport, demand matching and exceptions.
-- All operational assertions remain provisional until confirmed by the relevant actor/workflow.

create table if not exists public.storage_yards (
  id uuid primary key default gen_random_uuid(),
  external_id text unique,
  name text not null,
  latitude double precision,
  longitude double precision,
  capacity_tonnes numeric(12,2) not null check (capacity_tonnes > 0),
  current_load_tonnes numeric(12,2) not null default 0 check (current_load_tonnes >= 0),
  incoming_tonnes numeric(12,2) not null default 0 check (incoming_tonnes >= 0),
  status text not null default 'AVAILABLE' check (status in ('AVAILABLE','WATCH','FULL')),
  source text not null default 'LIVE_RECORD',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.machine_capacity_windows (
  id uuid primary key default gen_random_uuid(),
  machine_id uuid not null references public.machines(id) on delete cascade,
  window_start timestamptz not null,
  window_end timestamptz not null,
  capacity_acres numeric(10,2) not null check (capacity_acres >= 0),
  reserved_acres numeric(10,2) not null default 0 check (reserved_acres >= 0),
  status text not null default 'OPEN' check (status in ('OPEN','HELD','FULL','CANCELLED')),
  source text not null default 'DISPATCH_PLANNING',
  created_at timestamptz not null default now(),
  check (window_end > window_start),
  check (reserved_acres <= capacity_acres)
);

create table if not exists public.residue_matches (
  id uuid primary key default gen_random_uuid(),
  residue_lot_id uuid not null references public.residue_lots(id) on delete cascade,
  buyer_demand_id uuid not null references public.buyer_demands(id) on delete cascade,
  proposed_tonnes numeric(12,2) not null check (proposed_tonnes > 0),
  accepted_tonnes numeric(12,2) not null default 0 check (accepted_tonnes >= 0),
  status text not null default 'PROPOSED' check (status in ('PROPOSED','ACCEPTED','REJECTED','DELIVERED')),
  match_reason jsonb not null default '{}'::jsonb,
  proposed_at timestamptz not null default now(),
  accepted_at timestamptz
);

create table if not exists public.residue_transport_jobs (
  id uuid primary key default gen_random_uuid(),
  residue_lot_id uuid not null references public.residue_lots(id) on delete restrict,
  origin_type text not null check (origin_type in ('FIELD','YARD')),
  origin_id uuid,
  destination_type text not null check (destination_type in ('YARD','BUYER')),
  destination_id uuid,
  assigned_machine_id uuid references public.machines(id) on delete set null,
  planned_start timestamptz,
  planned_arrival timestamptz,
  actual_departure timestamptz,
  actual_arrival timestamptz,
  status text not null default 'PROPOSED' check (status in ('PROPOSED','ASSIGNED','EN_ROUTE','ARRIVED','DELIVERED','CANCELLED')),
  route_source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.residue_exceptions (
  id uuid primary key default gen_random_uuid(),
  field_id uuid references public.fields(id) on delete cascade,
  residue_lot_id uuid references public.residue_lots(id) on delete cascade,
  machine_id uuid references public.machines(id) on delete set null,
  yard_id uuid references public.storage_yards(id) on delete set null,
  kind text not null check (kind in ('PICKUP_OVERDUE','MACHINE_SHORTFALL','UNWEIGHED_LOT','UNMATCHED_DEMAND','YARD_CAPACITY','STALE_GPS','WEATHER_CAUTION')),
  severity text not null check (severity in ('CRITICAL','HIGH','WATCH')),
  title text not null,
  detail text not null,
  action text not null,
  status text not null default 'OPEN' check (status in ('OPEN','ACKNOWLEDGED','RESOLVED')),
  source text not null default 'CONTROL_TOWER',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists machine_capacity_windows_machine_time_idx on public.machine_capacity_windows(machine_id, window_start, window_end);
create index if not exists residue_matches_demand_idx on public.residue_matches(buyer_demand_id, status);
create index if not exists residue_matches_lot_idx on public.residue_matches(residue_lot_id, status);
create index if not exists residue_transport_status_idx on public.residue_transport_jobs(status, planned_start);
create index if not exists residue_exceptions_open_idx on public.residue_exceptions(status, severity, created_at desc);

alter table public.storage_yards enable row level security;
alter table public.machine_capacity_windows enable row level security;
alter table public.residue_matches enable row level security;
alter table public.residue_transport_jobs enable row level security;
alter table public.residue_exceptions enable row level security;

create policy "operations read storage yards" on public.storage_yards
for select to authenticated using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('farmer','operator','dispatcher','verifier','buyer','admin')));

create policy "operations read capacity windows" on public.machine_capacity_windows
for select to authenticated using (exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('operator','dispatcher','verifier','admin')));

create policy "buyers and operations read residue matches" on public.residue_matches
for select to authenticated using (
  exists(select 1 from public.buyer_demands d where d.id=buyer_demand_id and d.buyer_id=(select auth.uid()))
  or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('operator','dispatcher','verifier','buyer','admin'))
);

create policy "operations read transport jobs" on public.residue_transport_jobs
for select to authenticated using (
  exists(select 1 from public.residue_lots l join public.fields f on f.id=l.field_id where l.id=residue_lot_id and f.owner_id=(select auth.uid()))
  or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('operator','dispatcher','verifier','buyer','admin'))
);

create policy "operations read exceptions" on public.residue_exceptions
for select to authenticated using (
  exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('operator','dispatcher','verifier','buyer','admin'))
  or exists(select 1 from public.fields f where f.id=field_id and f.owner_id=(select auth.uid()))
);

revoke insert, update, delete on public.storage_yards, public.machine_capacity_windows, public.residue_matches, public.residue_transport_jobs, public.residue_exceptions from anon, authenticated;
grant select on public.storage_yards, public.machine_capacity_windows, public.residue_matches, public.residue_transport_jobs, public.residue_exceptions to authenticated;

comment on table public.storage_yards is 'Residue aggregation/storage capacity. Capacity and load are operational records, not inferred map facts.';
comment on table public.machine_capacity_windows is 'Dispatch capacity windows used to match machines to harvest pressure.';
comment on table public.residue_matches is 'Proposed or accepted residue-to-demand matches; proposal is not a transaction.';
comment on table public.residue_transport_jobs is 'Physical movement of a residue lot from field/yard to yard/buyer.';
comment on table public.residue_exceptions is 'Operational exception queue; resolution requires the responsible workflow actor.';

-- >>> 20261010142704_nirdhoom_farmer_signup_profile_20261010.sql
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

-- >>> 202610110001_nirdhoom_security_definer_auth_guards.sql
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
$function$

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
$function$

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
$function$

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
$function$

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
$function$

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
$function$

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
$function$

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
$function$

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

-- >>> 202610110002_nirdhoom_marketplace_transaction_workflow.sql
-- Complete the buyer-offer -> farmer acceptance -> transport/delivery workflow.
-- This migration is intentionally PR-only until its authorization matrix passes against staging.

CREATE OR REPLACE FUNCTION public.matchable_residue_lots()
RETURNS TABLE (
  lot_id uuid,
  residue_type text,
  available_tonnes numeric,
  moisture_pct numeric,
  quality_grade text,
  village text,
  district text,
  ready_from timestamptz,
  pickup_deadline timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE role_name text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  SELECT p.role INTO role_name FROM public.profiles p WHERE p.id = auth.uid();
  IF COALESCE(role_name, '') NOT IN ('buyer','dispatcher','admin') THEN
    RAISE EXCEPTION 'Buyer or operations role required';
  END IF;

  RETURN QUERY
  SELECT l.id,
         l.residue_type,
         LEAST(l.quantity_tonnes, l.verified_quantity_tonnes),
         l.moisture_pct,
         l.quality_grade,
         f.village,
         f.district,
         l.ready_from,
         l.pickup_deadline
  FROM public.residue_lots l
  JOIN public.fields f ON f.id = l.field_id
  WHERE l.status IN ('AVAILABLE','VERIFIED','VERIFIED_NON_BURN')
    AND l.assigned_buyer_id IS NULL
    AND l.verified_quantity_tonnes > 0
    AND (l.pickup_deadline IS NULL OR l.pickup_deadline >= now())
    AND EXISTS (
      SELECT 1 FROM public.buyer_demands d
      WHERE d.buyer_id = auth.uid()
        AND d.status = 'OPEN'
        AND (lower(trim(d.residue_type)) = lower(trim(l.residue_type)) OR lower(trim(d.residue_type)) IN ('any','all'))
        AND (d.max_moisture_pct IS NULL OR l.moisture_pct IS NULL OR l.moisture_pct <= d.max_moisture_pct)
        AND (l.pickup_deadline IS NULL OR l.pickup_deadline::date <= d.pickup_deadline)
    )
  ORDER BY l.pickup_deadline NULLS LAST, l.created_at DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_buyer_offer(
  p_lot_id uuid,
  p_price_per_tonne numeric,
  p_quantity_tonnes numeric,
  p_valid_until timestamptz DEFAULT (now() + interval '7 days')
)
RETURNS public.buyer_offers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  actor uuid := auth.uid();
  role_name text;
  buyer_row public.buyers%rowtype;
  lot_row public.residue_lots%rowtype;
  result_row public.buyer_offers%rowtype;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  SELECT p.role INTO role_name FROM public.profiles p WHERE p.id = actor;
  IF COALESCE(role_name, '') <> 'buyer' THEN RAISE EXCEPTION 'Buyer role required'; END IF;

  SELECT b.* INTO buyer_row FROM public.buyers b
  WHERE b.profile_id = actor AND b.active = true
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active buyer profile is required'; END IF;

  IF p_price_per_tonne IS NULL OR p_price_per_tonne <= 0 OR p_price_per_tonne > 1000000 THEN
    RAISE EXCEPTION 'Price must be positive and within the allowed limit';
  END IF;
  IF p_quantity_tonnes IS NULL OR p_quantity_tonnes <= 0 THEN
    RAISE EXCEPTION 'Offer quantity must be positive';
  END IF;
  IF p_valid_until IS NULL OR p_valid_until <= now() OR p_valid_until > now() + interval '30 days' THEN
    RAISE EXCEPTION 'Offer expiry must be within the next 30 days';
  END IF;

  SELECT l.* INTO lot_row FROM public.residue_lots l
  WHERE l.id = p_lot_id
  FOR UPDATE;
  IF NOT FOUND OR lot_row.status NOT IN ('AVAILABLE','VERIFIED','VERIFIED_NON_BURN')
     OR lot_row.assigned_buyer_id IS NOT NULL
     OR COALESCE(lot_row.verified_quantity_tonnes, 0) <= 0 THEN
    RAISE EXCEPTION 'Only available lots with verified quantity can receive offers';
  END IF;
  IF p_quantity_tonnes > LEAST(lot_row.quantity_tonnes, lot_row.verified_quantity_tonnes) THEN
    RAISE EXCEPTION 'Offer quantity exceeds verified available quantity';
  END IF;
  IF lot_row.pickup_deadline IS NOT NULL AND lot_row.pickup_deadline < now() THEN
    RAISE EXCEPTION 'Lot pickup window has expired';
  END IF;

  INSERT INTO public.buyer_offers(lot_id, buyer_id, price_per_tonne, quantity_tonnes, status, valid_until)
  VALUES (lot_row.id, buyer_row.id, p_price_per_tonne, p_quantity_tonnes, 'OPEN', p_valid_until)
  RETURNING * INTO result_row;
  RETURN result_row;
END;
$function$;

-- Acceptance belongs to the farmer who owns the lot (or an authorized dispatcher/admin),
-- not to the buyer who created the offer.
CREATE OR REPLACE FUNCTION public.accept_buyer_offer(p_offer_id uuid)
RETURNS public.buyer_offers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  actor uuid := auth.uid();
  role_name text;
  offer_row public.buyer_offers%rowtype;
  lot_row public.residue_lots%rowtype;
  buyer_profile uuid;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  SELECT p.role INTO role_name FROM public.profiles p WHERE p.id = actor;
  IF COALESCE(role_name, '') NOT IN ('farmer','dispatcher','admin') THEN
    RAISE EXCEPTION 'Farmer or operations role required';
  END IF;

  SELECT o.* INTO offer_row FROM public.buyer_offers o
  WHERE o.id = p_offer_id AND o.status = 'OPEN'
    AND (o.valid_until IS NULL OR o.valid_until > now())
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Offer is no longer open or has expired'; END IF;

  SELECT l.* INTO lot_row FROM public.residue_lots l WHERE l.id = offer_row.lot_id FOR UPDATE;
  IF NOT FOUND OR lot_row.status NOT IN ('AVAILABLE','VERIFIED','VERIFIED_NON_BURN')
     OR lot_row.assigned_buyer_id IS NOT NULL
     OR COALESCE(lot_row.verified_quantity_tonnes, 0) < offer_row.quantity_tonnes THEN
    RAISE EXCEPTION 'Residue lot is no longer available in the offered quantity';
  END IF;

  IF role_name = 'farmer' AND NOT EXISTS (
    SELECT 1 FROM public.fields f WHERE f.id = lot_row.field_id AND f.owner_id = actor
  ) THEN
    RAISE EXCEPTION 'Only the owning farmer can accept this offer';
  END IF;

  SELECT b.profile_id INTO buyer_profile FROM public.buyers b
  WHERE b.id = offer_row.buyer_id AND b.active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Buyer profile is no longer active'; END IF;

  UPDATE public.residue_lots
  SET assigned_buyer_id = offer_row.buyer_id, status = 'ALLOCATED', updated_at = now()
  WHERE id = lot_row.id;

  UPDATE public.buyer_offers SET status = 'ACCEPTED'
  WHERE id = offer_row.id AND status = 'OPEN'
  RETURNING * INTO offer_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'Offer changed during acceptance'; END IF;

  UPDATE public.buyer_offers SET status = 'REJECTED'
  WHERE lot_id = lot_row.id AND id <> offer_row.id AND status = 'OPEN';

  INSERT INTO public.residue_transport_jobs(
    residue_lot_id, origin_type, origin_id, destination_type, destination_id, status, route_source
  )
  VALUES (
    lot_row.id, 'FIELD', lot_row.field_id, 'BUYER', offer_row.buyer_id, 'PROPOSED', 'accepted_buyer_offer'
  );

  RETURN offer_row;
END;
$function$;

CREATE OR REPLACE FUNCTION public.transition_residue_transport_job(
  p_job_id uuid,
  p_next_status text,
  p_machine_id uuid DEFAULT NULL
)
RETURNS public.residue_transport_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  actor uuid := auth.uid();
  role_name text;
  job_row public.residue_transport_jobs%rowtype;
  allowed boolean := false;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  SELECT p.role INTO role_name FROM public.profiles p WHERE p.id = actor;
  IF COALESCE(role_name, '') NOT IN ('operator','dispatcher','admin') THEN
    RAISE EXCEPTION 'Operator or operations role required';
  END IF;

  SELECT j.* INTO job_row FROM public.residue_transport_jobs j
  WHERE j.id = p_job_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transport job not found'; END IF;

  IF p_next_status = 'ASSIGNED' AND job_row.status = 'PROPOSED' THEN
    IF COALESCE(role_name, '') NOT IN ('dispatcher','admin') OR p_machine_id IS NULL THEN
      RAISE EXCEPTION 'Dispatcher must select a machine for assignment';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.machines m WHERE m.id = p_machine_id) THEN
      RAISE EXCEPTION 'Machine not found';
    END IF;
    allowed := true;
  ELSIF p_next_status = 'EN_ROUTE' AND job_row.status = 'ASSIGNED' THEN
    allowed := COALESCE(role_name, '') IN ('dispatcher','admin')
      OR EXISTS (SELECT 1 FROM public.machines m WHERE m.id = job_row.assigned_machine_id AND m.operator_user_id = actor);
  ELSIF p_next_status = 'ARRIVED' AND job_row.status = 'EN_ROUTE' THEN
    allowed := COALESCE(role_name, '') IN ('dispatcher','admin')
      OR EXISTS (SELECT 1 FROM public.machines m WHERE m.id = job_row.assigned_machine_id AND m.operator_user_id = actor);
  ELSIF p_next_status = 'DELIVERED' AND job_row.status = 'ARRIVED' THEN
    allowed := COALESCE(role_name, '') IN ('dispatcher','admin')
      OR EXISTS (SELECT 1 FROM public.machines m WHERE m.id = job_row.assigned_machine_id AND m.operator_user_id = actor);
  ELSIF p_next_status = 'CANCELLED' AND job_row.status IN ('PROPOSED','ASSIGNED','EN_ROUTE','ARRIVED') THEN
    allowed := COALESCE(role_name, '') IN ('dispatcher','admin');
  END IF;
  IF NOT allowed THEN RAISE EXCEPTION 'Invalid transport transition or insufficient permission'; END IF;

  UPDATE public.residue_transport_jobs
  SET status = p_next_status,
      assigned_machine_id = CASE WHEN p_next_status = 'ASSIGNED' THEN p_machine_id ELSE assigned_machine_id END,
      actual_departure = CASE WHEN p_next_status = 'EN_ROUTE' THEN now() ELSE actual_departure END,
      actual_arrival = CASE WHEN p_next_status = 'ARRIVED' THEN now() ELSE actual_arrival END,
      updated_at = now()
  WHERE id = p_job_id RETURNING * INTO job_row;

  IF p_next_status = 'DELIVERED' THEN
    UPDATE public.residue_lots SET status = 'DELIVERED', updated_at = now()
    WHERE id = job_row.residue_lot_id AND status = 'ALLOCATED';
  END IF;
  RETURN job_row;
END;
$function$;

REVOKE ALL ON FUNCTION public.matchable_residue_lots() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_buyer_offer(uuid,numeric,numeric,timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.accept_buyer_offer(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.transition_residue_transport_job(uuid,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.matchable_residue_lots() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_buyer_offer(uuid,numeric,numeric,timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_buyer_offer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transition_residue_transport_job(uuid,text,uuid) TO authenticated;
