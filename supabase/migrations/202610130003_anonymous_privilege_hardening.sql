-- P0-C: the anon role must not have table-level mutation or read grants on
-- operational, identity, audit, evidence, finance, or matching data. RLS is a
-- second boundary, not a reason to leave broad grants in place.
-- Intentionally retain no broad RLS policies; server-only Telegram tables remain
-- service_role-only. Public reference/read-only surfaces must be granted explicitly
-- in a separate reviewed migration if a genuine anonymous use case exists.
REVOKE ALL PRIVILEGES ON TABLE
  public.ai_conversations,
  public.audit_events,
  public.audit_log,
  public.bookings,
  public.buyer_contracts,
  public.buyer_demands,
  public.buyer_offers,
  public.buyers,
  public.consents,
  public.credit_transactions,
  public.credit_wallets,
  public.dispatches,
  public.evidence_assets,
  public.field_events,
  public.fields,
  public.firms_observations,
  public.harvest_forecasts,
  public.jobs,
  public.machine_capacity_windows,
  public.machine_locations,
  public.machines,
  public.notifications,
  public.payments,
  public.profiles,
  public.residue_exceptions,
  public.residue_lot_events,
  public.residue_lots,
  public.residue_matches,
  public.residue_pool_members,
  public.residue_pools,
  public.residue_transport_jobs,
  public.soil_reports,
  public.storage_yards,
  public.verification_events,
  public.weather_snapshots
FROM anon;

-- Remove anonymous RPC execution, including inherited PUBLIC grants, then
-- explicitly restore only the two public-safe RPCs if a documented consumer
-- requires them. At present no anonymous operational RPC is required.
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;
