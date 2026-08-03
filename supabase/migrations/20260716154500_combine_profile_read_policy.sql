-- One permissive SELECT policy is cheaper than evaluating two OR-combined
-- policies for every profile row.
DROP POLICY IF EXISTS profile_read_self ON public.usuarios;
DROP POLICY IF EXISTS profile_read_tenant_members ON public.usuarios;
DROP POLICY IF EXISTS profile_read_self_and_tenant_members ON public.usuarios;
CREATE POLICY profile_read_self_and_tenant_members ON public.usuarios
  FOR SELECT TO multilot_app
  USING (
    id = (SELECT app_private.current_profile_id())
    OR auth_user_id = (SELECT app_private.current_auth_user_id())
    OR EXISTS (
      SELECT 1
      FROM public.membresias_tenant m
      WHERE m.tenant_id = (SELECT app_private.current_tenant_id())
        AND m.perfil_id = usuarios.id
        AND m.estado = 'ACTIVO'
        AND m.eliminado_en IS NULL
    )
  );
