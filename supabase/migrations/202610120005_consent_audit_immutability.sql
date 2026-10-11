-- Keep consent history auditable: authenticated farmers may only set revoked_at
-- on their own active consent. Acceptance and consent metadata go through guarded RPCs.
REVOKE INSERT, UPDATE ON TABLE public.consents FROM authenticated;
REVOKE UPDATE (id, profile_id, consent_type, version, accepted_at, revoked_at, source) ON TABLE public.consents FROM authenticated;
GRANT UPDATE (revoked_at) ON TABLE public.consents TO authenticated;

DROP POLICY IF EXISTS "profile revokes own consent" ON public.consents;
CREATE POLICY "profile revokes own consent"
ON public.consents
FOR UPDATE
TO authenticated
USING (
  profile_id = (SELECT auth.uid())
  AND revoked_at IS NULL
)
WITH CHECK (
  profile_id = (SELECT auth.uid())
  AND revoked_at IS NOT NULL
);
