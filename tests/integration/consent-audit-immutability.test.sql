\set ON_ERROR_STOP on
-- The direct UPDATE grant must be column-scoped after the migration.
DO $$
BEGIN
  IF has_table_privilege('authenticated', 'public.consents', 'UPDATE') THEN
    RAISE EXCEPTION 'authenticated still has table-wide UPDATE on consents';
  END IF;
  IF NOT has_column_privilege('authenticated', 'public.consents', 'revoked_at', 'UPDATE') THEN
    RAISE EXCEPTION 'authenticated cannot revoke consent';
  END IF;
  IF has_column_privilege('authenticated', 'public.consents', 'accepted_at', 'UPDATE')
     OR has_column_privilege('authenticated', 'public.consents', 'consent_type', 'UPDATE')
     OR has_column_privilege('authenticated', 'public.consents', 'version', 'UPDATE')
     OR has_column_privilege('authenticated', 'public.consents', 'source', 'UPDATE')
     OR has_column_privilege('authenticated', 'public.consents', 'profile_id', 'UPDATE') THEN
    RAISE EXCEPTION 'authenticated can mutate consent audit metadata';
  END IF;
END $$;

-- A farmer can revoke their own active consent through the column grant and RLS policy.
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', false);
SET ROLE authenticated;
UPDATE public.consents SET revoked_at = now()
WHERE profile_id = '00000000-0000-0000-0000-000000000002'
  AND consent_type = 'farmer_network'
  AND revoked_at IS NULL;
RESET ROLE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.consents
    WHERE profile_id = '00000000-0000-0000-0000-000000000002'
      AND consent_type = 'farmer_network'
      AND revoked_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'authorized farmer could not revoke their own consent';
  END IF;
END $$;
SELECT 'consent audit integration tests passed' AS result;
