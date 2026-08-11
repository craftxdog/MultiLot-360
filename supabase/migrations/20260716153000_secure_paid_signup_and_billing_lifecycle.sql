-- Secure paid signup and recurring subscription lifecycle.
-- External payment calls happen outside PostgreSQL transactions; these worker
-- functions perform only short, atomic state transitions after provider proof.

ALTER TABLE public.tenant_onboarding_sessions
  ADD COLUMN auth_user_id uuid,
  ADD COLUMN email text;

UPDATE public.tenant_onboarding_sessions s
SET auth_user_id = u.auth_user_id
FROM public.usuarios u
WHERE u.id = s.perfil_id AND s.auth_user_id IS NULL;

CREATE UNIQUE INDEX uq_onboarding_pending_auth_user
  ON public.tenant_onboarding_sessions (auth_user_id)
  WHERE estado = 'PENDIENTE' AND auth_user_id IS NOT NULL;

ALTER TABLE public.auditoria_eventos
  ALTER COLUMN membresia_id SET DEFAULT app_private.current_membership_id();

DROP POLICY IF EXISTS profile_read_tenant_members ON public.usuarios;
CREATE POLICY profile_read_tenant_members ON public.usuarios
  FOR SELECT TO multilot_app
  USING (
    EXISTS (
      SELECT 1
      FROM public.membresias_tenant m
      WHERE m.tenant_id = (SELECT app_private.current_tenant_id())
        AND m.perfil_id = usuarios.id
        AND m.estado = 'ACTIVO'
        AND m.eliminado_en IS NULL
    )
  );

-- Notifications are private to their recipient even inside the same tenant.
DROP POLICY IF EXISTS tenant_isolation ON public.notificaciones;
DROP POLICY IF EXISTS notifications_read_own ON public.notificaciones;
DROP POLICY IF EXISTS notifications_insert_tenant ON public.notificaciones;
DROP POLICY IF EXISTS notifications_update_own ON public.notificaciones;
DROP POLICY IF EXISTS notifications_delete_own ON public.notificaciones;
CREATE POLICY notifications_read_own ON public.notificaciones
  FOR SELECT TO multilot_app
  USING (
    tenant_id = (SELECT app_private.current_tenant_id())
    AND (
      membresia_id = (SELECT app_private.current_membership_id())
      OR usuario_id = (SELECT app_private.current_profile_id())
    )
  );
CREATE POLICY notifications_insert_tenant ON public.notificaciones
  FOR INSERT TO multilot_app
  WITH CHECK (tenant_id = (SELECT app_private.current_tenant_id()));
CREATE POLICY notifications_update_own ON public.notificaciones
  FOR UPDATE TO multilot_app
  USING (
    tenant_id = (SELECT app_private.current_tenant_id())
    AND (
      membresia_id = (SELECT app_private.current_membership_id())
      OR usuario_id = (SELECT app_private.current_profile_id())
    )
  )
  WITH CHECK (
    tenant_id = (SELECT app_private.current_tenant_id())
    AND (
      membresia_id = (SELECT app_private.current_membership_id())
      OR usuario_id = (SELECT app_private.current_profile_id())
    )
  );
CREATE POLICY notifications_delete_own ON public.notificaciones
  FOR DELETE TO multilot_app
  USING (
    tenant_id = (SELECT app_private.current_tenant_id())
    AND (
      membresia_id = (SELECT app_private.current_membership_id())
      OR usuario_id = (SELECT app_private.current_profile_id())
    )
  );

CREATE OR REPLACE FUNCTION app_private.list_signup_prices(p_provider text)
RETURNS TABLE (
  price_id uuid,
  plan_code text,
  plan_name text,
  description text,
  limits jsonb,
  features jsonb,
  provider text,
  provider_price_id text,
  currency char(3),
  amount_minor bigint,
  billing_interval public.intervalo_facturacion
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT bp.id, p.codigo, p.nombre, p.descripcion, p.limites, p.caracteristicas,
         bp.proveedor, bp.proveedor_price_id, bp.moneda, bp.monto_minor, bp.intervalo
  FROM public.billing_prices bp
  JOIN public.billing_plans p ON p.id = bp.plan_id
  WHERE bp.activo AND p.activo
    AND bp.proveedor = upper(btrim(p_provider))
    AND bp.proveedor_price_id IS NOT NULL
  ORDER BY bp.monto_minor, p.codigo
$$;

CREATE OR REPLACE FUNCTION app_private.start_paid_signup(
  p_auth_user_id uuid,
  p_email text,
  p_username text,
  p_name text,
  p_price_id uuid,
  p_provider text,
  p_tenant_slug text,
  p_tenant_name text,
  p_timezone text DEFAULT 'America/Managua',
  p_currency char(3) DEFAULT 'USD',
  p_expires_at timestamptz DEFAULT (now() + interval '30 minutes')
)
RETURNS TABLE(profile_id uuid, onboarding_session_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_role uuid;
  v_profile uuid;
  v_session uuid;
  v_pending_provider_id text := 'pending:' || gen_random_uuid()::text;
BEGIN
  IF p_auth_user_id IS NULL
     OR p_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     OR lower(btrim(p_username)) !~ '^[a-z0-9][a-z0-9._-]{2,49}$'
     OR btrim(p_name) = '' OR length(btrim(p_name)) > 120
     OR lower(btrim(p_tenant_slug)) !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
     OR btrim(p_tenant_name) = '' OR length(btrim(p_tenant_name)) > 160
     OR p_expires_at <= now() THEN
    RAISE EXCEPTION 'invalid paid signup data' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.billing_prices bp
    JOIN public.billing_plans p ON p.id = bp.plan_id
    WHERE bp.id = p_price_id AND bp.activo AND p.activo
      AND bp.proveedor = upper(btrim(p_provider))
      AND bp.proveedor_price_id IS NOT NULL
      AND bp.moneda = upper(p_currency)
  ) THEN
    RAISE EXCEPTION 'active provider price is required' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (SELECT 1 FROM public.tenants WHERE slug = lower(btrim(p_tenant_slug))) THEN
    RAISE EXCEPTION 'tenant slug is already in use' USING ERRCODE = '23505';
  END IF;

  SELECT r.id INTO v_role
  FROM public.roles r
  JOIN public.tenants t ON t.id = r.tenant_id AND t.es_legacy
  ORDER BY (upper(r.nombre) = 'ADMIN') DESC, r.creado_en, r.id
  LIMIT 1;
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'admin role template is missing' USING ERRCODE = '55000';
  END IF;

  INSERT INTO public.usuarios(auth_user_id,username,pass_hash,rol_id,nombre,activo)
  VALUES (
    p_auth_user_id, lower(btrim(p_username)), 'supabase:managed', v_role,
    btrim(p_name), true
  )
  RETURNING id INTO v_profile;

  INSERT INTO public.tenant_onboarding_sessions(
    perfil_id,auth_user_id,email,price_id,proveedor,proveedor_session_id,estado,
    expira_en,tenant_slug,tenant_nombre,zona_horaria,moneda
  ) VALUES (
    v_profile,p_auth_user_id,lower(btrim(p_email)),p_price_id,
    upper(btrim(p_provider)),v_pending_provider_id,'PENDIENTE',p_expires_at,
    lower(btrim(p_tenant_slug)),btrim(p_tenant_name),p_timezone,upper(p_currency)
  )
  RETURNING id INTO v_session;

  RETURN QUERY SELECT v_profile, v_session;
END;
$$;

CREATE OR REPLACE FUNCTION app_private.bind_paid_signup(
  p_onboarding_session_id uuid,
  p_provider_subscription_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF p_provider_subscription_id IS NULL OR btrim(p_provider_subscription_id) = '' THEN
    RAISE EXCEPTION 'provider subscription id is required' USING ERRCODE = '22023';
  END IF;
  UPDATE public.tenant_onboarding_sessions
  SET proveedor_session_id = btrim(p_provider_subscription_id)
  WHERE id = p_onboarding_session_id
    AND estado = 'PENDIENTE'
    AND expira_en > now()
    AND proveedor_session_id LIKE 'pending:%';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'onboarding session cannot be bound' USING ERRCODE = '22023';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION app_private.cancel_paid_signup(p_onboarding_session_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_profile uuid;
BEGIN
  DELETE FROM public.tenant_onboarding_sessions
  WHERE id = p_onboarding_session_id AND estado = 'PENDIENTE' AND tenant_id IS NULL
  RETURNING perfil_id INTO v_profile;
  IF v_profile IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.membresias_tenant WHERE perfil_id = v_profile
  ) THEN
    DELETE FROM public.usuarios WHERE id = v_profile;
  END IF;
  RETURN v_profile;
END;
$$;

CREATE OR REPLACE FUNCTION app_private.process_subscription_event(
  p_provider text,
  p_provider_event_id text,
  p_event_type text,
  p_payload_hash char(64),
  p_payload jsonb,
  p_provider_subscription_id text,
  p_provider_customer_id text,
  p_subscription_status public.suscripcion_estado,
  p_period_starts_at timestamptz,
  p_period_ends_at timestamptz
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_event uuid;
  v_tenant uuid;
  v_onboarding uuid;
  v_existing_hash char(64);
BEGIN
  INSERT INTO public.billing_events(proveedor,proveedor_event_id,tipo,payload_hash,payload)
  VALUES (upper(btrim(p_provider)),p_provider_event_id,p_event_type,p_payload_hash,p_payload)
  ON CONFLICT (proveedor,proveedor_event_id) DO NOTHING
  RETURNING id INTO v_event;

  IF v_event IS NULL THEN
    SELECT id,payload_hash,tenant_id INTO v_event,v_existing_hash,v_tenant
    FROM public.billing_events
    WHERE proveedor=upper(btrim(p_provider)) AND proveedor_event_id=p_provider_event_id;
    IF v_existing_hash <> p_payload_hash THEN
      RAISE EXCEPTION 'provider event id reused with a different payload' USING ERRCODE='23505';
    END IF;
    IF v_tenant IS NOT NULL THEN RETURN v_tenant; END IF;
  END IF;

  SELECT tenant_id INTO v_tenant
  FROM public.tenant_subscriptions
  WHERE proveedor=upper(btrim(p_provider))
    AND proveedor_subscription_id=p_provider_subscription_id
  FOR UPDATE;

  IF v_tenant IS NULL AND p_subscription_status = 'ACTIVA' THEN
    SELECT id INTO v_onboarding
    FROM public.tenant_onboarding_sessions
    WHERE proveedor=upper(btrim(p_provider))
      AND proveedor_session_id=p_provider_subscription_id
      AND estado='PENDIENTE' AND expira_en > now()
    FOR UPDATE;
    IF v_onboarding IS NULL THEN
      RAISE EXCEPTION 'paid onboarding session was not found' USING ERRCODE='22023';
    END IF;
    v_tenant := app_private.activate_paid_tenant(
      v_onboarding,v_event,p_provider_customer_id,p_provider_subscription_id,
      p_period_starts_at,p_period_ends_at
    );
    RETURN v_tenant;
  END IF;

  IF v_tenant IS NULL THEN
    UPDATE public.billing_events SET procesado_en=now(),intentos=intentos+1
    WHERE id=v_event;
    RETURN NULL;
  END IF;

  UPDATE public.tenant_subscriptions
  SET estado=p_subscription_status,
      periodo_inicia_en=COALESCE(p_period_starts_at,periodo_inicia_en),
      periodo_termina_en=COALESCE(p_period_ends_at,periodo_termina_en),
      cancelada_en=CASE WHEN p_subscription_status='CANCELADA' THEN now() ELSE cancelada_en END,
      actualizado_en=now()
  WHERE tenant_id=v_tenant AND proveedor=upper(btrim(p_provider))
    AND proveedor_subscription_id=p_provider_subscription_id;

  UPDATE public.tenants
  SET estado=CASE p_subscription_status
    WHEN 'ACTIVA' THEN 'ACTIVO'::public.tenant_estado
    WHEN 'MOROSA' THEN 'MOROSO'::public.tenant_estado
    WHEN 'CANCELADA' THEN 'SUSPENDIDO'::public.tenant_estado
    WHEN 'PAUSADA' THEN 'SUSPENDIDO'::public.tenant_estado
    ELSE estado END,
    actualizado_en=now()
  WHERE id=v_tenant;
  UPDATE public.billing_events
  SET tenant_id=v_tenant,procesado_en=now(),intentos=intentos+1
  WHERE id=v_event;
  RETURN v_tenant;
END;
$$;

ALTER FUNCTION app_private.list_signup_prices(text) OWNER TO postgres;
ALTER FUNCTION app_private.start_paid_signup(uuid,text,text,text,uuid,text,text,text,text,char,timestamptz) OWNER TO postgres;
ALTER FUNCTION app_private.bind_paid_signup(uuid,text) OWNER TO postgres;
ALTER FUNCTION app_private.cancel_paid_signup(uuid) OWNER TO postgres;
ALTER FUNCTION app_private.process_subscription_event(text,text,text,char,jsonb,text,text,public.suscripcion_estado,timestamptz,timestamptz) OWNER TO postgres;

REVOKE ALL ON FUNCTION app_private.list_signup_prices(text) FROM PUBLIC,anon,authenticated,service_role,multilot_app;
REVOKE ALL ON FUNCTION app_private.start_paid_signup(uuid,text,text,text,uuid,text,text,text,text,char,timestamptz) FROM PUBLIC,anon,authenticated,service_role,multilot_app;
REVOKE ALL ON FUNCTION app_private.bind_paid_signup(uuid,text) FROM PUBLIC,anon,authenticated,service_role,multilot_app;
REVOKE ALL ON FUNCTION app_private.cancel_paid_signup(uuid) FROM PUBLIC,anon,authenticated,service_role,multilot_app;
REVOKE ALL ON FUNCTION app_private.process_subscription_event(text,text,text,char,jsonb,text,text,public.suscripcion_estado,timestamptz,timestamptz) FROM PUBLIC,anon,authenticated,service_role,multilot_app;

GRANT EXECUTE ON FUNCTION app_private.list_signup_prices(text) TO multilot_billing_worker;
GRANT EXECUTE ON FUNCTION app_private.start_paid_signup(uuid,text,text,text,uuid,text,text,text,text,char,timestamptz) TO multilot_billing_worker;
GRANT EXECUTE ON FUNCTION app_private.bind_paid_signup(uuid,text) TO multilot_billing_worker;
GRANT EXECUTE ON FUNCTION app_private.cancel_paid_signup(uuid) TO multilot_billing_worker;
GRANT EXECUTE ON FUNCTION app_private.process_subscription_event(text,text,text,char,jsonb,text,text,public.suscripcion_estado,timestamptz,timestamptz) TO multilot_billing_worker;

COMMENT ON FUNCTION app_private.start_paid_signup(uuid,text,text,text,uuid,text,text,text,text,char,timestamptz) IS
  'Atomically creates a pending global profile and paid tenant onboarding session; callable only by the billing worker.';
COMMENT ON FUNCTION app_private.process_subscription_event(text,text,text,char,jsonb,text,text,public.suscripcion_estado,timestamptz,timestamptz) IS
  'Idempotently records a verified provider event and activates or updates the tenant subscription.';
