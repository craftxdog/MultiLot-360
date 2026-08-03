-- Bootstrap tenant context from the already verified Supabase Auth subject.
CREATE OR REPLACE FUNCTION app_private.resolve_request_context(
  p_auth_user_id uuid,
  p_tenant_selector text DEFAULT NULL
)
RETURNS TABLE(profile_id uuid, tenant_id uuid, membership_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF p_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'auth user id is required' USING ERRCODE = '22023';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.usuarios u
  JOIN public.membresias_tenant m ON m.perfil_id = u.id
  JOIN public.tenants t ON t.id = m.tenant_id
  WHERE u.auth_user_id = p_auth_user_id
    AND u.activo AND u.eliminado_en IS NULL
    AND m.estado = 'ACTIVO' AND m.eliminado_en IS NULL
    AND t.estado IN ('PRUEBA','ACTIVO','MOROSO') AND t.eliminado_en IS NULL
    AND (
      p_tenant_selector IS NULL
      OR t.slug = lower(p_tenant_selector)
      OR t.id::text = p_tenant_selector
    );

  IF v_count = 0 THEN
    RAISE EXCEPTION 'no active membership matches the requested tenant' USING ERRCODE = '42501';
  END IF;
  IF v_count > 1 THEN
    RAISE EXCEPTION 'tenant selection is required for this user' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT u.id, t.id, m.id
  FROM public.usuarios u
  JOIN public.membresias_tenant m ON m.perfil_id = u.id
  JOIN public.tenants t ON t.id = m.tenant_id
  WHERE u.auth_user_id = p_auth_user_id
    AND u.activo AND u.eliminado_en IS NULL
    AND m.estado = 'ACTIVO' AND m.eliminado_en IS NULL
    AND t.estado IN ('PRUEBA','ACTIVO','MOROSO') AND t.eliminado_en IS NULL
    AND (
      p_tenant_selector IS NULL
      OR t.slug = lower(p_tenant_selector)
      OR t.id::text = p_tenant_selector
    )
  LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION app_private.list_auth_user_tenants(p_auth_user_id uuid)
RETURNS TABLE(
  tenant_id uuid,
  slug text,
  tenant_name text,
  tenant_status public.tenant_estado,
  membership_id uuid,
  membership_status public.membresia_estado,
  role_id uuid,
  role_name text,
  is_owner boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT t.id, t.slug, t.nombre, t.estado, m.id, m.estado,
         r.id, r.nombre, m.es_propietario
  FROM public.usuarios u
  JOIN public.membresias_tenant m ON m.perfil_id = u.id
  JOIN public.tenants t ON t.id = m.tenant_id
  JOIN public.roles r ON r.tenant_id = m.tenant_id AND r.id = m.rol_id
  WHERE u.auth_user_id = p_auth_user_id
    AND u.activo AND u.eliminado_en IS NULL
    AND m.eliminado_en IS NULL AND t.eliminado_en IS NULL
  ORDER BY m.es_propietario DESC, t.nombre, t.id
$$;

ALTER FUNCTION app_private.resolve_request_context(uuid,text) OWNER TO postgres;
ALTER FUNCTION app_private.list_auth_user_tenants(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION app_private.resolve_request_context(uuid,text)
  FROM PUBLIC, anon, authenticated, service_role, multilot_billing_worker;
REVOKE ALL ON FUNCTION app_private.list_auth_user_tenants(uuid)
  FROM PUBLIC, anon, authenticated, service_role, multilot_billing_worker;
GRANT EXECUTE ON FUNCTION app_private.resolve_request_context(uuid,text) TO multilot_app;
GRANT EXECUTE ON FUNCTION app_private.list_auth_user_tenants(uuid) TO multilot_app;
