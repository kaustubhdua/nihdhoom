-- Add covering indexes for operational foreign keys flagged by the Supabase advisor.
-- These indexes are additive and do not change data or access policies.

CREATE INDEX IF NOT EXISTS residue_exceptions_field_id_idx
  ON public.residue_exceptions (field_id);
CREATE INDEX IF NOT EXISTS residue_exceptions_machine_id_idx
  ON public.residue_exceptions (machine_id);
CREATE INDEX IF NOT EXISTS residue_exceptions_residue_lot_id_idx
  ON public.residue_exceptions (residue_lot_id);
CREATE INDEX IF NOT EXISTS residue_exceptions_yard_id_idx
  ON public.residue_exceptions (yard_id);
CREATE INDEX IF NOT EXISTS residue_lot_events_actor_profile_id_idx
  ON public.residue_lot_events (actor_profile_id);
CREATE INDEX IF NOT EXISTS residue_lots_machine_id_idx
  ON public.residue_lots (machine_id);
CREATE INDEX IF NOT EXISTS residue_transport_jobs_assigned_machine_id_idx
  ON public.residue_transport_jobs (assigned_machine_id);
CREATE INDEX IF NOT EXISTS residue_transport_jobs_residue_lot_id_idx
  ON public.residue_transport_jobs (residue_lot_id);
