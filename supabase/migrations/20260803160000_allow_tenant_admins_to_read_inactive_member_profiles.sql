-- Tenant administrators must be able to inspect and finish removal of an
-- inactive membership. Authentication still requires an ACTIVO membership;
-- this policy only permits tenant-scoped profile reads.
DROP POLICY IF EXISTS profile_read_self_and_tenant_members ON public.usuarios;
CREATE POLICY profile_read_self_and_tenant_members ON public.usuarios
  FOR SELECT TO multilot_app
  USING (
    id = (SELECT app_private.current_profile_id())
    OR auth_user_id = (SELECT app_private.current_auth_user_id())
    OR EXISTS (
      SELECT 1
      FROM public.membresias_tenant membership
      WHERE membership.tenant_id = (SELECT app_private.current_tenant_id())
        AND membership.perfil_id = usuarios.id
    )
    OR (
      auth_user_id IS NULL
      AND NOT activo
      AND eliminado_en IS NULL
      AND app_private.current_can_create_invited_profile(rol_id)
    )
  );

COMMENT ON POLICY profile_read_self_and_tenant_members ON public.usuarios IS
  'Reads the current profile or identities linked to the active tenant, including inactive membership tombstones; never grants cross-tenant visibility.';
