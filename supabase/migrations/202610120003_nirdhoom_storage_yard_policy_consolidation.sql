-- Consolidate equivalent storage-yard SELECT policies without changing effective access.
-- Authenticated users may read active yards; operations roles may also read inactive yards.

DROP POLICY IF EXISTS "operations read storage yards" ON public.storage_yards;
DROP POLICY IF EXISTS "authenticated reads yards" ON public.storage_yards;

CREATE POLICY "authenticated read yards by active status or operations role"
ON public.storage_yards
FOR SELECT
TO authenticated
USING (
  active = true
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = (SELECT auth.uid())
      AND p.role = ANY (ARRAY['operator', 'dispatcher', 'verifier', 'admin'])
  )
);
