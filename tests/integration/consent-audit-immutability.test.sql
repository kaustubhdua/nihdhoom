\set ON_ERROR_STOP on
-- Check effective privileges after the migration, without dollar-quoted PL/pgSQL.
SELECT
  has_table_privilege('authenticated', 'public.consents', 'INSERT') AS has_insert,
  has_function_privilege('authenticated', 'public.record_farmer_network_consent()', 'EXECUTE') AS can_record_consent,
  has_table_privilege('authenticated', 'public.consents', 'UPDATE') AS has_table_update,
  has_column_privilege('authenticated', 'public.consents', 'revoked_at', 'UPDATE') AS can_revoke,
  (
    has_column_privilege('authenticated', 'public.consents', 'accepted_at', 'UPDATE')
    OR has_column_privilege('authenticated', 'public.consents', 'consent_type', 'UPDATE')
    OR has_column_privilege('authenticated', 'public.consents', 'version', 'UPDATE')
    OR has_column_privilege('authenticated', 'public.consents', 'source', 'UPDATE')
    OR has_column_privilege('authenticated', 'public.consents', 'profile_id', 'UPDATE')
  ) AS can_update_metadata
\gset

\if :can_record_consent
\else
  \echo 'ERROR: authenticated cannot record consent through the guarded RPC'
  \quit 1
\endif
\if :has_insert
  \echo 'ERROR: authenticated still has direct INSERT on consents'
  \quit 1
\endif
\if :has_table_update
  \echo 'ERROR: authenticated still has table-wide UPDATE on consents'
  \quit 1
\endif
\if :can_revoke
\else
  \echo 'ERROR: authenticated cannot revoke consent'
  \quit 1
\endif
\if :can_update_metadata
  \echo 'ERROR: authenticated can mutate consent audit metadata'
  \quit 1
\endif

-- An authenticated farmer can revoke only their own active consent.
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', false);
SET ROLE authenticated;
UPDATE public.consents SET revoked_at = now()
WHERE profile_id = '00000000-0000-0000-0000-000000000002'
  AND consent_type = 'farmer_network'
  AND revoked_at IS NULL;
RESET ROLE;

SELECT EXISTS (
  SELECT 1 FROM public.consents
  WHERE profile_id = '00000000-0000-0000-0000-000000000002'
    AND consent_type = 'farmer_network'
    AND revoked_at IS NOT NULL
) AS revoked
\gset
\if :revoked
  \echo 'consent audit integration tests passed'
\else
  \echo 'ERROR: authorized farmer could not revoke their own consent'
  \quit 1
\endif

-- Direct INSERT is revoked, but the SECURITY DEFINER consent RPC still works.
SET ROLE authenticated;
SELECT public.record_farmer_network_consent();
RESET ROLE;

SELECT EXISTS (
  SELECT 1 FROM public.consents
  WHERE profile_id = '00000000-0000-0000-0000-000000000002'
    AND consent_type = 'farmer_network'
    AND source = 'ci'
    AND revoked_at IS NULL
) AS rpc_recorded
\gset
\if :rpc_recorded
  \echo 'guarded consent RPC remains functional'
\else
  \echo 'ERROR: guarded consent RPC could not write consent'
  \quit 1
\endif
