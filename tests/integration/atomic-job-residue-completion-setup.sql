\set ON_ERROR_STOP on
create role anon nologin;
create role authenticated nologin;
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create table public.profiles (id uuid primary key, role text not null);
create table public.consents (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null,
  consent_type text not null,
  version text not null,
  accepted_at timestamptz not null default now(),
  revoked_at timestamptz,
  source text
);
ALTER TABLE public.consents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ci select own consent" ON public.consents FOR SELECT TO authenticated USING (profile_id = (SELECT auth.uid()));
GRANT SELECT ON TABLE public.consents TO authenticated;
GRANT UPDATE ON TABLE public.consents TO authenticated;
create table public.fields (
  id uuid primary key, owner_id uuid not null, crop text not null default 'Paddy',
  expected_harvest_date date, clearance_deadline timestamptz, boundary_source text,
  status text not null default 'REGISTERED', updated_at timestamptz not null default now()
);
create table public.bookings (
  id uuid primary key, field_id uuid not null, machine_id uuid,
  status text not null default 'BOOKED', updated_at timestamptz not null default now()
);
create table public.jobs (
  id uuid primary key, booking_id uuid not null, machine_id uuid, operator_id uuid,
  status text not null, created_at timestamptz not null default now(),
  actual_completed_at timestamptz, last_transition_at timestamptz,
  route_metadata jsonb not null default '{}'::jsonb, updated_at timestamptz not null default now()
);
create table public.evidence_assets (
  id uuid primary key default gen_random_uuid(), field_id uuid not null, kind text not null,
  storage_path text, created_at timestamptz not null default now()
);
create table public.residue_lots (
  id uuid primary key default gen_random_uuid(), field_id uuid not null, booking_id uuid not null,
  job_id uuid not null, farmer_id uuid not null, crop text not null, residue_type text not null,
  estimated_quantity_tonnes numeric, quantity_tonnes numeric, harvest_date date, ready_from timestamptz,
  pickup_deadline timestamptz, machine_id uuid, geometry_provenance jsonb not null default '{}'::jsonb,
  moisture_pct numeric, quality_notes text, quality_grade text, status text not null default 'AVAILABLE',
  baled_at timestamptz, qr_code text, created_at timestamptz not null default now()
);
insert into public.profiles(id, role) values
 ('00000000-0000-0000-0000-000000000001','operator'),
 ('00000000-0000-0000-0000-000000000002','farmer'),
 ('00000000-0000-0000-0000-000000000003','dispatcher');
insert into public.consents(profile_id, consent_type, version, accepted_at, source) values
 ('00000000-0000-0000-0000-000000000002','farmer_network','ci-v1',now(),'ci');
insert into public.fields(id, owner_id, crop, boundary_source) values
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','Paddy','GPS'),
 ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002','Paddy','GPS'),
 ('10000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000002','Paddy','GPS');
insert into public.bookings(id, field_id, machine_id) values
 ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',null),
 ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002',null),
 ('20000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000003',null);
insert into public.jobs(id, booking_id, operator_id, status, created_at) values
 ('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','PROOF_PENDING',now()-interval '1 hour'),
 ('30000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','PROOF_PENDING',now()-interval '1 hour'),
 ('30000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','PROOF_PENDING',now()-interval '1 hour');
insert into public.evidence_assets(field_id, kind, storage_path) values
 ('10000000-0000-0000-0000-000000000001','weighment','proof/job-1.jpg'),
 ('10000000-0000-0000-0000-000000000003','bale_photo','proof/job-3.jpg');
