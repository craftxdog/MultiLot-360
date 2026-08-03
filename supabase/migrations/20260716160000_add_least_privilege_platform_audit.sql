-- Persist unauthenticated/platform events without granting the API login direct table access.
CREATE OR REPLACE FUNCTION app_private.record_platform_audit(
  p_user_id uuid,
  p_event text,
  p_payload jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_tenant_id uuid;
  v_membership_id uuid;
  v_event public.auditoria_eventos%ROWTYPE;
  v_actor jsonb;
BEGIN
  IF nullif(btrim(p_event), '') IS NULL THEN
    RAISE EXCEPTION 'audit event name is required' USING ERRCODE = '22023';
  END IF;
  IF p_payload IS NOT NULL AND jsonb_typeof(p_payload) IS NULL THEN
    RAISE EXCEPTION 'audit payload must be valid JSON' USING ERRCODE = '22023';
  END IF;

  IF p_user_id IS NOT NULL THEN
    SELECT m.tenant_id, m.id
      INTO v_tenant_id, v_membership_id
    FROM public.membresias_tenant m
    JOIN public.tenants t ON t.id = m.tenant_id
    WHERE m.perfil_id = p_user_id
      AND m.estado = 'ACTIVO'
      AND m.eliminado_en IS NULL
      AND t.eliminado_en IS NULL
    ORDER BY m.es_propietario DESC, m.creado_en, m.id
    LIMIT 1;
  END IF;

  IF v_tenant_id IS NULL THEN
    SELECT id INTO STRICT v_tenant_id
    FROM public.tenants
    WHERE es_legacy;
    v_membership_id := NULL;
  END IF;

  INSERT INTO public.auditoria_eventos(
    usuario_id, evento, payload, tenant_id, membresia_id
  )
  VALUES (
    p_user_id, btrim(p_event), p_payload, v_tenant_id, v_membership_id
  )
  RETURNING * INTO v_event;

  SELECT jsonb_build_object(
    'id', u.id,
    'username', u.username,
    'name', u.nombre
  ) INTO v_actor
  FROM public.usuarios u
  WHERE u.id = p_user_id;

  RETURN jsonb_build_object(
    'id', v_event.id::text,
    'userId', v_event.usuario_id,
    'event', v_event.evento,
    'payload', v_event.payload,
    'actor', v_actor,
    'createdAt', v_event.creado_en
  );
END;
$$;

ALTER FUNCTION app_private.record_platform_audit(uuid,text,jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION app_private.record_platform_audit(uuid,text,jsonb)
  FROM PUBLIC, anon, authenticated, service_role, multilot_app;
GRANT EXECUTE ON FUNCTION app_private.record_platform_audit(uuid,text,jsonb)
  TO multilot_billing_worker;

COMMENT ON FUNCTION app_private.record_platform_audit(uuid,text,jsonb) IS
  'Appends a platform/public audit event through a tightly scoped SECURITY DEFINER boundary.';
