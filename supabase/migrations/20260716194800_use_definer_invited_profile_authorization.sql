-- RLS policy subqueries are themselves subject to RLS. Centralize this narrow
-- authorization check in a SECURITY DEFINER predicate so the policy can verify
-- the actor and target role without recursive policy visibility effects.

CREATE OR REPLACE FUNCTION app_private.current_can_create_invited_profile(
  p_target_role_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog,public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.roles target_role
    JOIN public.membresias_tenant actor
      ON actor.id=app_private.current_membership_id()
     AND actor.tenant_id=app_private.current_tenant_id()
    JOIN public.permisos_por_rol permission
      ON permission.tenant_id=actor.tenant_id
     AND permission.rol_id=actor.rol_id
    JOIN public.modulos module ON module.id=permission.modulo_id
    WHERE target_role.id=p_target_role_id
      AND target_role.tenant_id=actor.tenant_id
      AND actor.estado='ACTIVO' AND actor.eliminado_en IS NULL
      AND module.codigo='USUARIOS' AND permission.puede_crear
  )
$$;

ALTER FUNCTION app_private.current_can_create_invited_profile(uuid)
  OWNER TO postgres;
REVOKE ALL ON FUNCTION app_private.current_can_create_invited_profile(uuid)
  FROM PUBLIC,anon,authenticated,service_role,multilot_billing_worker;
GRANT EXECUTE ON FUNCTION app_private.current_can_create_invited_profile(uuid)
  TO multilot_app;

DROP POLICY IF EXISTS profile_insert_invited_tenant_member ON public.usuarios;
CREATE POLICY profile_insert_invited_tenant_member ON public.usuarios
  FOR INSERT TO multilot_app
  WITH CHECK (
    auth_user_id IS NULL
    AND NOT activo
    AND eliminado_en IS NULL
    AND app_private.current_can_create_invited_profile(rol_id)
  );
