-- Authentication must issue a session to an active operational member or to
-- an owner/billing manager whose tenant is restricted to the billing portal.
-- Resolving both cases in one database function avoids recovering from a
-- PostgreSQL exception inside the same transaction (which is not possible).

CREATE OR REPLACE FUNCTION app_private.set_authentication_request_context(
  p_auth_user_id uuid,
  p_tenant_selector text DEFAULT NULL
)
RETURNS TABLE(
  profile_id uuid,
  tenant_id uuid,
  membership_id uuid,
  billing_only boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog,public
AS $$
DECLARE
  v_count integer;
  v_profile uuid;
  v_tenant uuid;
  v_membership uuid;
  v_billing_only boolean;
BEGIN
  IF p_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'auth user id is required' USING ERRCODE='22023';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.usuarios u
  JOIN public.membresias_tenant m ON m.perfil_id=u.id
  JOIN public.tenants t ON t.id=m.tenant_id
  WHERE u.auth_user_id=p_auth_user_id
    AND u.activo AND u.eliminado_en IS NULL
    AND m.estado='ACTIVO' AND m.eliminado_en IS NULL
    AND t.eliminado_en IS NULL
    AND (
      t.estado IN ('PRUEBA','ACTIVO','MOROSO')
      OR (
        t.estado IN ('PENDIENTE_PAGO','SUSPENDIDO')
        AND (m.es_propietario OR m.puede_gestionar_facturacion)
        AND NOT EXISTS (
          SELECT 1 FROM public.vendedores v
          WHERE v.tenant_id=m.tenant_id AND v.membresia_id=m.id
            AND v.activo AND v.eliminado_en IS NULL
        )
      )
    )
    AND (
      p_tenant_selector IS NULL OR t.slug=lower(p_tenant_selector)
      OR t.id::text=p_tenant_selector
    );

  IF v_count=0 THEN
    RAISE EXCEPTION 'no authentication membership matches the requested tenant'
      USING ERRCODE='42501';
  END IF;
  IF v_count>1 THEN
    RAISE EXCEPTION 'tenant selection is required for this user'
      USING ERRCODE='22023';
  END IF;

  SELECT u.id,t.id,m.id,
         t.estado NOT IN ('PRUEBA','ACTIVO','MOROSO')
  INTO v_profile,v_tenant,v_membership,v_billing_only
  FROM public.usuarios u
  JOIN public.membresias_tenant m ON m.perfil_id=u.id
  JOIN public.tenants t ON t.id=m.tenant_id
  WHERE u.auth_user_id=p_auth_user_id
    AND u.activo AND u.eliminado_en IS NULL
    AND m.estado='ACTIVO' AND m.eliminado_en IS NULL
    AND t.eliminado_en IS NULL
    AND (
      t.estado IN ('PRUEBA','ACTIVO','MOROSO')
      OR (
        t.estado IN ('PENDIENTE_PAGO','SUSPENDIDO')
        AND (m.es_propietario OR m.puede_gestionar_facturacion)
        AND NOT EXISTS (
          SELECT 1 FROM public.vendedores v
          WHERE v.tenant_id=m.tenant_id AND v.membresia_id=m.id
            AND v.activo AND v.eliminado_en IS NULL
        )
      )
    )
    AND (
      p_tenant_selector IS NULL OR t.slug=lower(p_tenant_selector)
      OR t.id::text=p_tenant_selector
    )
  LIMIT 1;

  IF v_billing_only THEN
    PERFORM app_private.set_billing_request_context(
      p_auth_user_id,v_tenant,v_profile,v_membership
    );
  ELSE
    PERFORM app_private.set_request_context(
      p_auth_user_id,v_tenant,v_profile,v_membership
    );
  END IF;

  RETURN QUERY SELECT v_profile,v_tenant,v_membership,v_billing_only;
END;
$$;

ALTER FUNCTION app_private.set_authentication_request_context(uuid,text)
  OWNER TO postgres;
REVOKE ALL ON FUNCTION app_private.set_authentication_request_context(uuid,text)
  FROM PUBLIC,anon,authenticated,service_role,multilot_billing_worker;
GRANT EXECUTE ON FUNCTION app_private.set_authentication_request_context(uuid,text)
  TO multilot_app;
