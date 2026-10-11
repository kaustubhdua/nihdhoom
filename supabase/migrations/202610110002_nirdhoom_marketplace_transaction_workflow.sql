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
