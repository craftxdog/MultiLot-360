-- Provider-neutral, atomic handoff from checkout/webhook to a fully configured tenant.
ALTER TABLE public.tenant_onboarding_sessions
  ADD COLUMN tenant_slug text NOT NULL,
  ADD COLUMN tenant_nombre text NOT NULL,
  ADD COLUMN zona_horaria text NOT NULL DEFAULT 'America/Managua',
  ADD COLUMN moneda char(3) NOT NULL DEFAULT 'NIO',
  ADD CONSTRAINT ck_onboarding_slug CHECK (tenant_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  ADD CONSTRAINT ck_onboarding_moneda CHECK (moneda ~ '^[A-Z]{3}$');

DO $role$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'multilot_billing_worker') THEN
    CREATE ROLE multilot_billing_worker NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
END
$role$;
GRANT multilot_billing_worker TO postgres;
GRANT USAGE ON SCHEMA app_private, public TO multilot_billing_worker;

CREATE OR REPLACE FUNCTION app_private.create_onboarding_session(
  p_profile_id uuid,
  p_price_id uuid,
  p_provider text,
  p_provider_session_id text,
  p_tenant_slug text,
  p_tenant_name text,
  p_timezone text DEFAULT 'America/Managua',
  p_currency char(3) DEFAULT 'NIO',
  p_expires_at timestamptz DEFAULT (now() + interval '30 minutes')
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE id = p_profile_id AND activo AND eliminado_en IS NULL
  ) THEN
    RAISE EXCEPTION 'active profile is required' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.billing_prices bp
    JOIN public.billing_plans pl ON pl.id = bp.plan_id
    WHERE bp.id = p_price_id AND bp.activo AND pl.activo AND bp.proveedor = p_provider
  ) THEN
    RAISE EXCEPTION 'active provider price is required' USING ERRCODE = '22023';
  END IF;
  IF p_expires_at <= now() OR p_tenant_name IS NULL OR btrim(p_tenant_name) = '' THEN
    RAISE EXCEPTION 'invalid onboarding data' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.tenant_onboarding_sessions(
    perfil_id, price_id, proveedor, proveedor_session_id, estado, expira_en,
    tenant_slug, tenant_nombre, zona_horaria, moneda
  ) VALUES (
    p_profile_id, p_price_id, p_provider, p_provider_session_id, 'PENDIENTE', p_expires_at,
    lower(p_tenant_slug), btrim(p_tenant_name), p_timezone, upper(p_currency)
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION app_private.record_billing_event(
  p_provider text,
  p_provider_event_id text,
  p_event_type text,
  p_payload_hash char(64),
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_id uuid;
  v_existing_hash char(64);
BEGIN
  IF p_payload_hash !~ '^[0-9a-f]{64}$' OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'invalid billing event payload' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.billing_events(proveedor, proveedor_event_id, tipo, payload_hash, payload)
  VALUES (p_provider, p_provider_event_id, p_event_type, p_payload_hash, p_payload)
  ON CONFLICT (proveedor, proveedor_event_id) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    SELECT id, payload_hash INTO v_id, v_existing_hash
    FROM public.billing_events
    WHERE proveedor = p_provider AND proveedor_event_id = p_provider_event_id;
    IF v_existing_hash <> p_payload_hash THEN
      RAISE EXCEPTION 'provider event id reused with a different payload' USING ERRCODE = '23505';
    END IF;
  END IF;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION app_private.activate_paid_tenant(
  p_onboarding_session_id uuid,
  p_billing_event_id uuid,
  p_provider_customer_id text,
  p_provider_subscription_id text,
  p_period_starts_at timestamptz,
  p_period_ends_at timestamptz
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_session public.tenant_onboarding_sessions%ROWTYPE;
  v_event public.billing_events%ROWTYPE;
  v_tenant uuid;
  v_account uuid;
  v_admin_role uuid;
  v_username text;
BEGIN
  SELECT * INTO v_session FROM public.tenant_onboarding_sessions
  WHERE id = p_onboarding_session_id FOR UPDATE;
  IF NOT FOUND OR v_session.estado <> 'PENDIENTE' OR v_session.expira_en <= now() THEN
    RAISE EXCEPTION 'onboarding session is not payable' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_event FROM public.billing_events WHERE id = p_billing_event_id FOR UPDATE;
  IF NOT FOUND OR v_event.procesado_en IS NOT NULL OR v_event.proveedor <> v_session.proveedor THEN
    RAISE EXCEPTION 'unprocessed provider event is required' USING ERRCODE = '22023';
  END IF;
  IF p_provider_customer_id IS NULL OR p_provider_subscription_id IS NULL
     OR p_period_starts_at IS NULL OR p_period_ends_at <= p_period_starts_at THEN
    RAISE EXCEPTION 'invalid subscription data' USING ERRCODE = '22023';
  END IF;

  SELECT username INTO v_username FROM public.usuarios
  WHERE id = v_session.perfil_id AND activo AND eliminado_en IS NULL;
  IF v_username IS NULL THEN
    RAISE EXCEPTION 'onboarding profile is inactive' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.tenants(slug,nombre,estado,zona_horaria,moneda)
  VALUES (v_session.tenant_slug,v_session.tenant_nombre,'ACTIVO',v_session.zona_horaria,v_session.moneda)
  RETURNING id INTO v_tenant;

  INSERT INTO public.roles(tenant_id,nombre)
  SELECT v_tenant, r.nombre FROM public.roles r
  JOIN public.tenants t ON t.id = r.tenant_id
  WHERE t.es_legacy;

  INSERT INTO public.permisos_por_rol(
    tenant_id, rol_id, modulo_id, puede_leer, puede_crear, puede_actualizar, puede_borrar
  )
  SELECT v_tenant, target.id, p.modulo_id,
         p.puede_leer, p.puede_crear, p.puede_actualizar, p.puede_borrar
  FROM public.permisos_por_rol p
  JOIN public.roles source ON source.id = p.rol_id
  JOIN public.tenants legacy ON legacy.id = source.tenant_id AND legacy.es_legacy
  JOIN public.roles target ON target.tenant_id = v_tenant AND target.nombre = source.nombre;

  SELECT id INTO v_admin_role FROM public.roles
  WHERE tenant_id = v_tenant
  ORDER BY (upper(nombre) = 'ADMIN') DESC, creado_en, id LIMIT 1;
  IF v_admin_role IS NULL THEN
    RAISE EXCEPTION 'no role template is available' USING ERRCODE = '55000';
  END IF;

  INSERT INTO public.membresias_tenant(
    tenant_id, perfil_id, rol_id, username, estado, es_propietario
  ) VALUES (v_tenant,v_session.perfil_id,v_admin_role,v_username,'ACTIVO',true);

  INSERT INTO public.tenant_billing_accounts(tenant_id,proveedor,proveedor_customer_id)
  VALUES (v_tenant,v_session.proveedor,p_provider_customer_id) RETURNING id INTO v_account;

  INSERT INTO public.tenant_subscriptions(
    tenant_id,billing_account_id,price_id,proveedor,proveedor_subscription_id,
    estado,periodo_inicia_en,periodo_termina_en
  ) VALUES (
    v_tenant,v_account,v_session.price_id,v_session.proveedor,p_provider_subscription_id,
    'ACTIVA',p_period_starts_at,p_period_ends_at
  );

  UPDATE public.tenant_onboarding_sessions
  SET tenant_id = v_tenant, estado = 'COMPLETADA', completada_en = now()
  WHERE id = v_session.id;
  UPDATE public.billing_events
  SET tenant_id = v_tenant, procesado_en = now(), intentos = intentos + 1
  WHERE id = v_event.id;
  INSERT INTO public.outbox_events(tenant_id,aggregate_type,aggregate_id,event_type,payload)
  VALUES (
    v_tenant,'tenant',v_tenant,'tenant.activated',
    jsonb_build_object('tenant_id',v_tenant,'plan_price_id',v_session.price_id)
  );
  RETURN v_tenant;
EXCEPTION WHEN OTHERS THEN
  -- The surrounding statement remains atomic; the provider worker can record the
  -- diagnostic on billing_events in a separate retry transaction.
  RAISE;
END;
$$;

ALTER FUNCTION app_private.create_onboarding_session(uuid,uuid,text,text,text,text,text,char,timestamptz) OWNER TO postgres;
ALTER FUNCTION app_private.record_billing_event(text,text,text,char,jsonb) OWNER TO postgres;
ALTER FUNCTION app_private.activate_paid_tenant(uuid,uuid,text,text,timestamptz,timestamptz) OWNER TO postgres;

REVOKE ALL ON FUNCTION app_private.create_onboarding_session(uuid,uuid,text,text,text,text,text,char,timestamptz)
  FROM PUBLIC, anon, authenticated, service_role, multilot_app;
REVOKE ALL ON FUNCTION app_private.record_billing_event(text,text,text,char,jsonb)
  FROM PUBLIC, anon, authenticated, service_role, multilot_app;
REVOKE ALL ON FUNCTION app_private.activate_paid_tenant(uuid,uuid,text,text,timestamptz,timestamptz)
  FROM PUBLIC, anon, authenticated, service_role, multilot_app;

GRANT EXECUTE ON FUNCTION app_private.create_onboarding_session(uuid,uuid,text,text,text,text,text,char,timestamptz)
  TO multilot_billing_worker;
GRANT EXECUTE ON FUNCTION app_private.record_billing_event(text,text,text,char,jsonb)
  TO multilot_billing_worker;
GRANT EXECUTE ON FUNCTION app_private.activate_paid_tenant(uuid,uuid,text,text,timestamptz,timestamptz)
  TO multilot_billing_worker;

COMMENT ON ROLE multilot_billing_worker IS
  'NOLOGIN role used only by the verified payment-webhook worker through app_private provisioning functions.';
COMMENT ON FUNCTION app_private.activate_paid_tenant(uuid,uuid,text,text,timestamptz,timestamptz) IS
  'Atomically creates tenant, cloned RBAC, owner membership, billing account, active subscription and outbox event.';
