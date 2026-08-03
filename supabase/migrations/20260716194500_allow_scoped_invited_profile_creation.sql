-- usuarios is a global identity table, so tenant administrators must never
-- receive a broad INSERT grant through RLS. Permit only inactive, unauthenticated
-- profiles assigned to a role in the current tenant, and only when the current
-- membership has USUARIOS.create.

DROP POLICY IF EXISTS profile_insert_invited_tenant_member ON public.usuarios;
CREATE POLICY profile_insert_invited_tenant_member ON public.usuarios
  FOR INSERT TO multilot_app
  WITH CHECK (
    auth_user_id IS NULL
    AND NOT activo
    AND eliminado_en IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.roles target_role
      WHERE target_role.id=usuarios.rol_id
        AND target_role.tenant_id=(SELECT app_private.current_tenant_id())
    )
    AND EXISTS (
      SELECT 1
      FROM public.membresias_tenant actor
      JOIN public.permisos_por_rol permission
        ON permission.tenant_id=actor.tenant_id
       AND permission.rol_id=actor.rol_id
      JOIN public.modulos module ON module.id=permission.modulo_id
      WHERE actor.id=(SELECT app_private.current_membership_id())
        AND actor.tenant_id=(SELECT app_private.current_tenant_id())
        AND actor.estado='ACTIVO' AND actor.eliminado_en IS NULL
        AND module.codigo='USUARIOS' AND permission.puede_crear
    )
  );
