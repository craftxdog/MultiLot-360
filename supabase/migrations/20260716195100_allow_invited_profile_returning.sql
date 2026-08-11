-- INSERT ... RETURNING is also checked against SELECT policies. The membership
-- is created in the next statement, so a newly inserted invited profile needs
-- narrowly scoped visibility during that transition.

DROP POLICY IF EXISTS profile_read_self_and_tenant_members ON public.usuarios;
CREATE POLICY profile_read_self_and_tenant_members ON public.usuarios
  FOR SELECT TO multilot_app
  USING (
    id=(SELECT app_private.current_profile_id())
    OR auth_user_id=(SELECT app_private.current_auth_user_id())
    OR EXISTS (
      SELECT 1
      FROM public.membresias_tenant membership
      WHERE membership.tenant_id=(SELECT app_private.current_tenant_id())
        AND membership.perfil_id=usuarios.id
        AND membership.estado IN ('INVITADO','ACTIVO')
        AND membership.eliminado_en IS NULL
    )
    OR (
      auth_user_id IS NULL
      AND NOT activo
      AND eliminado_en IS NULL
      AND app_private.current_can_create_invited_profile(rol_id)
    )
  );
