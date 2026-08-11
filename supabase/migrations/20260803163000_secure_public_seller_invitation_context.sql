-- A public invitation confirmation has no JWT from which to resolve a tenant.
-- Validate the one-time credential in a narrow definer boundary, then establish
-- transaction-local RLS context before the application reads or updates rows.
CREATE OR REPLACE FUNCTION app_private.set_seller_invitation_context(
  p_email text,
  p_access_code_hash text,
  p_action_token_hash text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_tenant_id uuid;
  v_profile_id uuid;
  v_membership_id uuid;
BEGIN
  IF p_action_token_hash IS NULL
     AND (nullif(btrim(p_email), '') IS NULL OR p_access_code_hash IS NULL) THEN
    RETURN false;
  END IF;

  SELECT code.tenant_id, code.usuario_id, membership.id
    INTO v_tenant_id, v_profile_id, v_membership_id
  FROM public.codigos_acceso_vendedor code
  JOIN public.membresias_tenant membership
    ON membership.tenant_id = code.tenant_id
   AND membership.perfil_id = code.usuario_id
  JOIN public.vendedores seller
    ON seller.tenant_id = code.tenant_id
   AND seller.id = code.vendedor_id
   AND seller.membresia_id = membership.id
  JOIN public.tenants tenant ON tenant.id = code.tenant_id
  WHERE code.estado = 'PENDIENTE'
    AND code.expira_en > clock_timestamp()
    AND membership.estado = 'INVITADO'
    AND membership.eliminado_en IS NULL
    AND seller.eliminado_en IS NULL
    AND tenant.estado IN ('PRUEBA', 'ACTIVO', 'MOROSO')
    AND tenant.eliminado_en IS NULL
    AND (
      (p_action_token_hash IS NOT NULL
       AND code.enlace_token_hash = p_action_token_hash)
      OR
      (p_action_token_hash IS NULL
       AND lower(code.email) = lower(btrim(p_email))
       AND code.codigo_hash = p_access_code_hash)
    )
  ORDER BY code.creado_en DESC, code.id
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RETURN false;
  END IF;

  PERFORM set_config('app.current_auth_user_id', '', true);
  PERFORM set_config('app.current_tenant_id', v_tenant_id::text, true);
  PERFORM set_config('app.current_profile_id', v_profile_id::text, true);
  PERFORM set_config('app.current_membership_id', v_membership_id::text, true);
  RETURN true;
END;
$$;

ALTER FUNCTION app_private.set_seller_invitation_context(text,text,text)
  OWNER TO postgres;
REVOKE ALL ON FUNCTION app_private.set_seller_invitation_context(text,text,text)
  FROM PUBLIC, anon, authenticated, service_role, multilot_billing_worker;
GRANT EXECUTE ON FUNCTION app_private.set_seller_invitation_context(text,text,text)
  TO multilot_app;

COMMENT ON FUNCTION app_private.set_seller_invitation_context(text,text,text) IS
  'Validates one pending seller invitation and sets transaction-local tenant RLS context; returns false for every invalid credential.';
