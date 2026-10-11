\set ON_ERROR_STOP on
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
$;

CREATE OR REPLACE FUNCTION public.revoke_farmer_network_consent()
RETURNS void LANGUAGE sql AS 'SELECT';
GRANT EXECUTE ON FUNCTION public.revoke_farmer_network_consent() TO anon;

CREATE TABLE public.profiles (id uuid PRIMARY KEY, role text NOT NULL);
CREATE TABLE public.fields (
  id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES public.profiles(id),
  acreage numeric(8,2) NOT NULL, expected_harvest_date date,
  status text NOT NULL DEFAULT 'REGISTERED'
    CHECK (status IN ('REGISTERED','SCHEDULED','MACHINE_ASSIGNED','ON_THE_WAY','BALING_IN_PROGRESS','CLEARED_PENDING_AUDIT','VERIFIED_NON_BURN','PAYMENT_PROCESSING','PAID','CANCELLED')),
  clearance_deadline timestamptz, crop text DEFAULT 'Paddy', updated_at timestamptz DEFAULT now()
);
CREATE TABLE public.machines (
  id uuid PRIMARY KEY, status text NOT NULL DEFAULT 'IDLE'
);
CREATE TABLE public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id uuid NOT NULL REFERENCES public.fields(id), requested_date date NOT NULL,
  rate_per_acre numeric(10,2) NOT NULL, quoted_amount numeric(12,2) NOT NULL,
  machine_id uuid REFERENCES public.machines(id), status text NOT NULL DEFAULT 'BOOKED',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  guaranteed_by_date date, penalty_amount numeric(12,2) NOT NULL DEFAULT 0,
  pricing_band text, quote_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  accepted_at timestamptz, assigned_at timestamptz, cancelled_at timestamptz
);
CREATE TABLE public.consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), profile_id uuid NOT NULL REFERENCES public.profiles(id),
  consent_type text NOT NULL, revoked_at timestamptz
);
CREATE TABLE public.machine_capacity_windows (
  id uuid PRIMARY KEY, machine_id uuid NOT NULL REFERENCES public.machines(id),
  window_start timestamptz NOT NULL, window_end timestamptz NOT NULL,
  capacity_acres numeric(10,2) NOT NULL CHECK (capacity_acres >= 0),
  reserved_acres numeric(10,2) NOT NULL DEFAULT 0 CHECK (reserved_acres >= 0),
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','HELD','FULL','CANCELLED')),
  source text NOT NULL DEFAULT 'DISPATCH_PLANNING', created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (window_end > window_start), CHECK (reserved_acres <= capacity_acres)
);
CREATE TABLE public.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), booking_id uuid NOT NULL UNIQUE REFERENCES public.bookings(id),
  status text NOT NULL, actual_completed_at timestamptz
);
CREATE TABLE public.evidence_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), field_id uuid NOT NULL REFERENCES public.fields(id),
  booking_id uuid REFERENCES public.bookings(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.residue_lots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), field_id uuid NOT NULL REFERENCES public.fields(id),
  job_id uuid REFERENCES public.jobs(id), booking_id uuid REFERENCES public.bookings(id)
);
CREATE TABLE public.firms_observations (
  id uuid PRIMARY KEY, source text NOT NULL, sensor text NOT NULL,
  acquired_at timestamptz, matched_field_id uuid REFERENCES public.fields(id),
  confidence text, frp numeric(12,3)
);
CREATE TABLE public.verification_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), field_id uuid NOT NULL REFERENCES public.fields(id),
  method text NOT NULL, result text NOT NULL, confidence numeric(5,2),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id uuid, action text,
  entity_type text, entity_id uuid, metadata jsonb DEFAULT '{}'::jsonb, created_at timestamptz DEFAULT now()
);

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO authenticated;

INSERT INTO public.profiles(id,role) VALUES
('00000000-0000-0000-0000-000000000001','farmer'),
('00000000-0000-0000-0000-000000000002','farmer'),
('00000000-0000-0000-0000-000000000003','verifier');
INSERT INTO public.fields(id,owner_id,acreage,expected_harvest_date) VALUES
('00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000001',1.00,CURRENT_DATE+10),
('00000000-0000-0000-0000-000000000202','00000000-0000-0000-0000-000000000002',1.00,CURRENT_DATE+10),
('00000000-0000-0000-0000-000000000203','00000000-0000-0000-0000-000000000001',1.00,CURRENT_DATE+10);
INSERT INTO public.consents(profile_id,consent_type,revoked_at) VALUES
('00000000-0000-0000-0000-000000000001','farmer_network',NULL),
('00000000-0000-0000-0000-000000000002','farmer_network',NULL);
INSERT INTO public.machines(id,status) VALUES ('00000000-0000-0000-0000-000000000100','IDLE');
INSERT INTO public.machine_capacity_windows(id,machine_id,window_start,window_end,capacity_acres,reserved_acres,status)
VALUES ('00000000-0000-0000-0000-000000000300','00000000-0000-0000-0000-000000000100',
  ((CURRENT_DATE+2)::timestamp AT TIME ZONE 'Asia/Kolkata'),
  ((CURRENT_DATE+3)::timestamp AT TIME ZONE 'Asia/Kolkata'),1.00,0,'OPEN');
