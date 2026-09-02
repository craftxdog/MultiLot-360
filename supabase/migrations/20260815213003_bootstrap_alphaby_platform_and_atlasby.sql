-- AlphaBy production bootstrap:
--   * explicit platform-owner/support capabilities;
--   * audited tenant support memberships for every current and future tenant;
--   * approved USD monthly catalog ($10/$25/$50) for bank transfer;
--   * reusable, postgres-only bootstrap helpers for platform operators and
--     internal trial tenants.
--
-- Auth identities are still created by Supabase Auth. The final DO block only
-- links identities that already exist, so this migration remains safe in CI,
-- preview databases, and local environments without production users.

SET lock_timeout = '10s';
SET statement_timeout = '120s';

ALTER TABLE public.platform_admins
  ADD COLUMN IF NOT EXISTS nivel_acceso text NOT NULL DEFAULT 'BILLING',
  ADD COLUMN IF NOT EXISTS acceso_todos_tenants boolean NOT NULL DEFAULT false;

DO $constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_platform_admins_nivel_acceso'
      AND conrelid = 'public.platform_admins'::regclass
  ) THEN
    ALTER TABLE public.platform_admins
      ADD CONSTRAINT ck_platform_admins_nivel_acceso
      CHECK (nivel_acceso IN ('OWNER', 'SUPPORT', 'BILLING'));
  END IF;
END
$constraints$;

ALTER TABLE public.membresias_tenant
  ADD COLUMN IF NOT EXISTS es_soporte_plataforma boolean NOT NULL DEFAULT false;

DO $membership_constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_membership_platform_support_not_owner'
      AND conrelid = 'public.membresias_tenant'::regclass
  ) THEN
    ALTER TABLE public.membresias_tenant
      ADD CONSTRAINT ck_membership_platform_support_not_owner
      CHECK (NOT es_soporte_plataforma OR NOT es_propietario);
  END IF;
END
$membership_constraints$;

CREATE INDEX IF NOT EXISTS ix_memberships_platform_support
  ON public.membresias_tenant (perfil_id, tenant_id)
  WHERE es_soporte_plataforma AND eliminado_en IS NULL;

-- A platform-support membership is explicit and auditable. It is not an owner
-- and never creates a seller record, but receives the tenant SUPPORT role and
-- billing access so internal support can assist pending/suspended companies.
INSERT INTO public.roles (tenant_id, nombre)
SELECT t.id, 'SOPORTE'
FROM public.tenants t
WHERE t.eliminado_en IS NULL
ON CONFLICT (tenant_id, nombre) DO NOTHING;

INSERT INTO public.permisos_por_rol (
  tenant_id,
  rol_id,
  modulo_id,
  puede_leer,
  puede_crear,
  puede_actualizar,
  puede_borrar
)
SELECT
  support_role.tenant_id,
  support_role.id,
  permissions.modulo_id,
  permissions.puede_leer,
  permissions.puede_crear,
  permissions.puede_actualizar,
  permissions.puede_borrar
FROM public.roles support_role
JOIN public.roles admin_role
  ON admin_role.tenant_id = support_role.tenant_id
 AND upper(admin_role.nombre) = 'ADMIN'
JOIN public.permisos_por_rol permissions
  ON permissions.tenant_id = admin_role.tenant_id
 AND permissions.rol_id = admin_role.id
WHERE upper(support_role.nombre) = 'SOPORTE'
ON CONFLICT (rol_id, modulo_id) DO UPDATE
SET tenant_id = EXCLUDED.tenant_id,
    puede_leer = EXCLUDED.puede_leer,
    puede_crear = EXCLUDED.puede_crear,
    puede_actualizar = EXCLUDED.puede_actualizar,
    puede_borrar = EXCLUDED.puede_borrar;

CREATE OR REPLACE FUNCTION app_private.ensure_platform_support_memberships(
  p_profile_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_inserted integer := 0;
  v_enabled boolean := false;
BEGIN
  SELECT pa.activo AND pa.acceso_todos_tenants
  INTO v_enabled
  FROM public.platform_admins pa
  JOIN public.usuarios u ON u.id = pa.perfil_id
  WHERE pa.perfil_id = p_profile_id
    AND u.activo
    AND u.eliminado_en IS NULL;

  IF NOT COALESCE(v_enabled, false) THEN
    UPDATE public.membresias_tenant
    SET estado = 'SUSPENDIDO',
        actualizado_en = now()
    WHERE perfil_id = p_profile_id
      AND es_soporte_plataforma
      AND eliminado_en IS NULL
      AND estado <> 'SUSPENDIDO';
    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    RETURN v_inserted;
  END IF;

  INSERT INTO public.membresias_tenant (
    tenant_id,
    perfil_id,
    rol_id,
    username,
    estado,
    es_propietario,
    puede_gestionar_facturacion,
    es_soporte_plataforma
  )
  SELECT
    support_role.tenant_id,
    p_profile_id,
    support_role.id,
    'platform-' || substr(replace(p_profile_id::text, '-', ''), 1, 12),
    'ACTIVO',
    false,
    true,
    true
  FROM public.roles support_role
  JOIN public.tenants tenant
    ON tenant.id = support_role.tenant_id
   AND tenant.eliminado_en IS NULL
  WHERE upper(support_role.nombre) = 'SOPORTE'
  ON CONFLICT (tenant_id, perfil_id) DO UPDATE
  SET rol_id = EXCLUDED.rol_id,
      estado = 'ACTIVO',
      puede_gestionar_facturacion = true,
      actualizado_en = now(),
      eliminado_en = NULL
  WHERE public.membresias_tenant.es_soporte_plataforma;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END
$function$;

CREATE OR REPLACE FUNCTION app_private.trg_sync_platform_support_memberships()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  PERFORM app_private.ensure_platform_support_memberships(NEW.perfil_id);
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS platform_admins_sync_support_memberships
  ON public.platform_admins;
CREATE TRIGGER platform_admins_sync_support_memberships
AFTER INSERT OR UPDATE OF activo, acceso_todos_tenants
ON public.platform_admins
FOR EACH ROW
EXECUTE FUNCTION app_private.trg_sync_platform_support_memberships();

CREATE OR REPLACE FUNCTION app_private.trg_provision_platform_support_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_profile_id uuid;
BEGIN
  IF upper(NEW.nombre) <> 'SOPORTE' THEN
    RETURN NEW;
  END IF;

  FOR v_profile_id IN
    SELECT pa.perfil_id
    FROM public.platform_admins pa
    WHERE pa.activo AND pa.acceso_todos_tenants
  LOOP
    PERFORM app_private.ensure_platform_support_memberships(v_profile_id);
  END LOOP;

  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS roles_provision_platform_support
  ON public.roles;
CREATE TRIGGER roles_provision_platform_support
AFTER INSERT ON public.roles
FOR EACH ROW
EXECUTE FUNCTION app_private.trg_provision_platform_support_role();

-- Approved commercial list. Amounts are in minor units: 1000 = USD 10.00.
INSERT INTO public.billing_prices (
  plan_id,
  proveedor,
  proveedor_price_id,
  moneda,
  monto_minor,
  intervalo,
  activo
)
SELECT
  plan.id,
  'BANK_TRANSFER',
  'alphaby_' || lower(plan.codigo) || '_usd_monthly',
  'USD',
  CASE plan.codigo
    WHEN 'STARTER' THEN 1000
    WHEN 'BUSINESS' THEN 2500
    WHEN 'ENTERPRISE' THEN 5000
  END,
  'MENSUAL',
  true
FROM public.billing_plans plan
WHERE plan.codigo IN ('STARTER', 'BUSINESS', 'ENTERPRISE')
ON CONFLICT (plan_id, moneda, intervalo) DO UPDATE
SET proveedor = EXCLUDED.proveedor,
    proveedor_price_id = EXCLUDED.proveedor_price_id,
    monto_minor = EXCLUDED.monto_minor,
    activo = true;

INSERT INTO public.billing_price_channels (
  price_id,
  canal,
  proveedor_price_id,
  activo,
  configuracion
)
SELECT price.id, 'BANK_TRANSFER', NULL, true, '{}'::jsonb
FROM public.billing_prices price
JOIN public.billing_plans plan ON plan.id = price.plan_id
WHERE plan.codigo IN ('STARTER', 'BUSINESS', 'ENTERPRISE')
  AND price.moneda = 'USD'
  AND price.intervalo = 'MENSUAL'
ON CONFLICT (price_id, canal) DO UPDATE
SET activo = true,
    actualizado_en = now();

INSERT INTO public.billing_price_channels (
  price_id,
  canal,
  proveedor_price_id,
  activo,
  configuracion
)
SELECT price.id, 'PAYPAL', NULL, false, '{"pendingProviderConfiguration":true}'::jsonb
FROM public.billing_prices price
JOIN public.billing_plans plan ON plan.id = price.plan_id
WHERE plan.codigo IN ('STARTER', 'BUSINESS', 'ENTERPRISE')
  AND price.moneda = 'USD'
  AND price.intervalo = 'MENSUAL'
ON CONFLICT (price_id, canal) DO UPDATE
SET activo = false,
    proveedor_price_id = NULL,
    configuracion = EXCLUDED.configuracion,
    actualizado_en = now();

CREATE OR REPLACE FUNCTION app_private.bootstrap_platform_operator(
  p_email text,
  p_username text,
  p_name text,
  p_access_level text,
  p_all_tenants boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $function$
DECLARE
  v_auth_user_id uuid;
  v_profile_id uuid;
  v_template_role_id uuid;
  v_access_level text := upper(btrim(p_access_level));
BEGIN
  IF p_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     OR lower(btrim(p_username)) !~ '^[a-z0-9][a-z0-9._-]{2,49}$'
     OR btrim(p_name) = ''
     OR v_access_level NOT IN ('OWNER', 'SUPPORT', 'BILLING') THEN
    RAISE EXCEPTION 'invalid platform operator data' USING ERRCODE = '22023';
  END IF;

  SELECT auth_user.id
  INTO v_auth_user_id
  FROM auth.users auth_user
  WHERE lower(auth_user.email) = lower(btrim(p_email))
  LIMIT 1;

  IF v_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'Supabase Auth user does not exist for %', lower(btrim(p_email))
      USING ERRCODE = '23503';
  END IF;

  SELECT role.id
  INTO v_template_role_id
  FROM public.roles role
  JOIN public.tenants tenant
    ON tenant.id = role.tenant_id
   AND tenant.es_legacy
  WHERE upper(role.nombre) = 'ADMIN'
  ORDER BY role.creado_en, role.id
  LIMIT 1;

  IF v_template_role_id IS NULL THEN
    RAISE EXCEPTION 'legacy ADMIN role template is missing' USING ERRCODE = '55000';
  END IF;

  SELECT profile.id
  INTO v_profile_id
  FROM public.usuarios profile
  WHERE profile.auth_user_id = v_auth_user_id;

  IF v_profile_id IS NULL THEN
    INSERT INTO public.usuarios (
      auth_user_id,
      username,
      pass_hash,
      rol_id,
      nombre,
      activo
    ) VALUES (
      v_auth_user_id,
      lower(btrim(p_username)),
      'supabase:managed',
      v_template_role_id,
      btrim(p_name),
      true
    )
    RETURNING id INTO v_profile_id;
  ELSE
    UPDATE public.usuarios
    SET nombre = btrim(p_name),
        activo = true,
        eliminado_en = NULL,
        motivo_eliminacion = NULL,
        actualizado_en = now()
    WHERE id = v_profile_id;
  END IF;

  INSERT INTO public.platform_admins (
    perfil_id,
    activo,
    puede_revisar_facturacion,
    nivel_acceso,
    acceso_todos_tenants
  ) VALUES (
    v_profile_id,
    true,
    true,
    v_access_level,
    p_all_tenants
  )
  ON CONFLICT (perfil_id) DO UPDATE
  SET activo = true,
      puede_revisar_facturacion = true,
      nivel_acceso = EXCLUDED.nivel_acceso,
      acceso_todos_tenants = EXCLUDED.acceso_todos_tenants;

  PERFORM app_private.ensure_platform_support_memberships(v_profile_id);
  RETURN v_profile_id;
END
$function$;

CREATE OR REPLACE FUNCTION app_private.bootstrap_internal_trial_tenant(
  p_slug text,
  p_name text,
  p_owner_email text,
  p_price_code text DEFAULT 'STARTER',
  p_trial_days integer DEFAULT 30
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $function$
DECLARE
  v_owner_profile_id uuid;
  v_owner_username text;
  v_tenant_id uuid;
  v_admin_role_id uuid;
  v_billing_account_id uuid;
  v_price_id uuid;
  v_subscription_id uuid;
BEGIN
  IF lower(btrim(p_slug)) !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
     OR btrim(p_name) = ''
     OR p_trial_days < 1
     OR p_trial_days > 90 THEN
    RAISE EXCEPTION 'invalid internal trial tenant data' USING ERRCODE = '22023';
  END IF;

  SELECT profile.id, profile.username
  INTO v_owner_profile_id, v_owner_username
  FROM public.usuarios profile
  JOIN auth.users auth_user ON auth_user.id = profile.auth_user_id
  WHERE lower(auth_user.email) = lower(btrim(p_owner_email))
    AND profile.activo
    AND profile.eliminado_en IS NULL
  LIMIT 1;

  IF v_owner_profile_id IS NULL THEN
    RAISE EXCEPTION 'active owner profile does not exist for %', lower(btrim(p_owner_email))
      USING ERRCODE = '23503';
  END IF;

  SELECT price.id
  INTO v_price_id
  FROM public.billing_prices price
  JOIN public.billing_plans plan ON plan.id = price.plan_id
  JOIN public.billing_price_channels channel
    ON channel.price_id = price.id
   AND channel.canal = 'BANK_TRANSFER'
   AND channel.activo
  WHERE plan.codigo = upper(btrim(p_price_code))
    AND plan.activo
    AND price.moneda = 'USD'
    AND price.intervalo = 'MENSUAL'
    AND price.activo
  LIMIT 1;

  IF v_price_id IS NULL THEN
    RAISE EXCEPTION 'active USD BANK_TRANSFER price is missing for %', upper(btrim(p_price_code))
      USING ERRCODE = '55000';
  END IF;

  SELECT tenant.id
  INTO v_tenant_id
  FROM public.tenants tenant
  WHERE tenant.slug = lower(btrim(p_slug))
    AND tenant.eliminado_en IS NULL;

  IF v_tenant_id IS NULL THEN
    INSERT INTO public.tenants (
      slug,
      nombre,
      estado,
      zona_horaria,
      moneda,
      configuracion
    ) VALUES (
      lower(btrim(p_slug)),
      btrim(p_name),
      'PRUEBA',
      'America/Managua',
      'USD',
      jsonb_build_object(
        'internalBootstrap', true,
        'trialSource', 'alphaby',
        'trialDays', p_trial_days
      )
    )
    RETURNING id INTO v_tenant_id;
  ELSE
    UPDATE public.tenants
    SET nombre = btrim(p_name),
        estado = 'PRUEBA',
        zona_horaria = 'America/Managua',
        moneda = 'USD',
        configuracion = configuracion || jsonb_build_object(
          'internalBootstrap', true,
          'trialSource', 'alphaby',
          'trialDays', p_trial_days
        ),
        actualizado_en = now()
    WHERE id = v_tenant_id;
  END IF;

  INSERT INTO public.roles (tenant_id, nombre)
  SELECT v_tenant_id, template_role.nombre
  FROM public.roles template_role
  JOIN public.tenants legacy
    ON legacy.id = template_role.tenant_id
   AND legacy.es_legacy
  ON CONFLICT (tenant_id, nombre) DO NOTHING;

  INSERT INTO public.permisos_por_rol (
    tenant_id,
    rol_id,
    modulo_id,
    puede_leer,
    puede_crear,
    puede_actualizar,
    puede_borrar
  )
  SELECT
    v_tenant_id,
    target_role.id,
    permission.modulo_id,
    permission.puede_leer,
    permission.puede_crear,
    permission.puede_actualizar,
    permission.puede_borrar
  FROM public.permisos_por_rol permission
  JOIN public.roles template_role
    ON template_role.id = permission.rol_id
   AND template_role.tenant_id = permission.tenant_id
  JOIN public.tenants legacy
    ON legacy.id = template_role.tenant_id
   AND legacy.es_legacy
  JOIN public.roles target_role
    ON target_role.tenant_id = v_tenant_id
   AND target_role.nombre = template_role.nombre
  ON CONFLICT (rol_id, modulo_id) DO UPDATE
  SET tenant_id = EXCLUDED.tenant_id,
      puede_leer = EXCLUDED.puede_leer,
      puede_crear = EXCLUDED.puede_crear,
      puede_actualizar = EXCLUDED.puede_actualizar,
      puede_borrar = EXCLUDED.puede_borrar;

  INSERT INTO public.parametros (tenant_id, clave, valor)
  SELECT v_tenant_id, parameter.clave, parameter.valor
  FROM public.parametros parameter
  JOIN public.tenants legacy
    ON legacy.id = parameter.tenant_id
   AND legacy.es_legacy
  ON CONFLICT (tenant_id, clave) DO NOTHING;

  SELECT role.id
  INTO v_admin_role_id
  FROM public.roles role
  WHERE role.tenant_id = v_tenant_id
    AND upper(role.nombre) = 'ADMIN'
  LIMIT 1;

  INSERT INTO public.membresias_tenant (
    tenant_id,
    perfil_id,
    rol_id,
    username,
    estado,
    es_propietario,
    puede_gestionar_facturacion,
    es_soporte_plataforma
  ) VALUES (
    v_tenant_id,
    v_owner_profile_id,
    v_admin_role_id,
    v_owner_username,
    'ACTIVO',
    true,
    true,
    false
  )
  ON CONFLICT (tenant_id, perfil_id) DO UPDATE
  SET rol_id = EXCLUDED.rol_id,
      username = EXCLUDED.username,
      estado = 'ACTIVO',
      es_propietario = true,
      puede_gestionar_facturacion = true,
      es_soporte_plataforma = false,
      eliminado_en = NULL,
      actualizado_en = now();

  INSERT INTO public.tenant_billing_accounts (
    tenant_id,
    proveedor,
    email_facturacion,
    razon_social,
    datos_fiscales
  ) VALUES (
    v_tenant_id,
    'BANK_TRANSFER',
    lower(btrim(p_owner_email)),
    btrim(p_name),
    '{"internalTrial":true}'::jsonb
  )
  ON CONFLICT (tenant_id) DO UPDATE
  SET proveedor = EXCLUDED.proveedor,
      email_facturacion = EXCLUDED.email_facturacion,
      razon_social = EXCLUDED.razon_social,
      datos_fiscales = public.tenant_billing_accounts.datos_fiscales || EXCLUDED.datos_fiscales,
      actualizado_en = now()
  RETURNING id INTO v_billing_account_id;

  SELECT subscription.id
  INTO v_subscription_id
  FROM public.tenant_subscriptions subscription
  WHERE subscription.tenant_id = v_tenant_id
    AND subscription.estado IN ('INCOMPLETA', 'PRUEBA', 'ACTIVA', 'MOROSA', 'PAUSADA')
  LIMIT 1;

  IF v_subscription_id IS NULL THEN
    INSERT INTO public.tenant_subscriptions (
      tenant_id,
      billing_account_id,
      price_id,
      proveedor,
      proveedor_subscription_id,
      estado,
      periodo_inicia_en,
      periodo_termina_en,
      prueba_termina_en
    ) VALUES (
      v_tenant_id,
      v_billing_account_id,
      v_price_id,
      'BANK_TRANSFER',
      'internal-trial:' || lower(btrim(p_slug)),
      'PRUEBA',
      now(),
      now() + make_interval(days => p_trial_days),
      now() + make_interval(days => p_trial_days)
    );
  ELSE
    UPDATE public.tenant_subscriptions
    SET billing_account_id = v_billing_account_id,
        price_id = v_price_id,
        proveedor = 'BANK_TRANSFER',
        estado = 'PRUEBA',
        periodo_inicia_en = COALESCE(periodo_inicia_en, now()),
        periodo_termina_en = now() + make_interval(days => p_trial_days),
        prueba_termina_en = now() + make_interval(days => p_trial_days),
        cancelar_al_final = false,
        cancelada_en = NULL,
        actualizado_en = now()
    WHERE id = v_subscription_id;
  END IF;

  INSERT INTO public.outbox_events (
    tenant_id,
    aggregate_type,
    aggregate_id,
    event_type,
    payload
  )
  SELECT
    v_tenant_id,
    'tenant',
    v_tenant_id,
    'tenant.internal_trial_bootstrapped',
    jsonb_build_object(
      'tenantId', v_tenant_id,
      'ownerProfileId', v_owner_profile_id,
      'priceId', v_price_id,
      'trialDays', p_trial_days
    )
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.outbox_events event
    WHERE event.tenant_id = v_tenant_id
      AND event.event_type = 'tenant.internal_trial_bootstrapped'
  );

  RETURN v_tenant_id;
END
$function$;

ALTER FUNCTION app_private.ensure_platform_support_memberships(uuid)
  OWNER TO postgres;
ALTER FUNCTION app_private.trg_sync_platform_support_memberships()
  OWNER TO postgres;
ALTER FUNCTION app_private.trg_provision_platform_support_role()
  OWNER TO postgres;
ALTER FUNCTION app_private.bootstrap_platform_operator(text, text, text, text, boolean)
  OWNER TO postgres;
ALTER FUNCTION app_private.bootstrap_internal_trial_tenant(text, text, text, text, integer)
  OWNER TO postgres;

REVOKE ALL ON FUNCTION app_private.ensure_platform_support_memberships(uuid)
  FROM PUBLIC, anon, authenticated, service_role, multilot_app, multilot_billing_worker;
REVOKE ALL ON FUNCTION app_private.trg_sync_platform_support_memberships()
  FROM PUBLIC, anon, authenticated, service_role, multilot_app, multilot_billing_worker;
REVOKE ALL ON FUNCTION app_private.trg_provision_platform_support_role()
  FROM PUBLIC, anon, authenticated, service_role, multilot_app, multilot_billing_worker;
REVOKE ALL ON FUNCTION app_private.bootstrap_platform_operator(text, text, text, text, boolean)
  FROM PUBLIC, anon, authenticated, service_role, multilot_app, multilot_billing_worker;
REVOKE ALL ON FUNCTION app_private.bootstrap_internal_trial_tenant(text, text, text, text, integer)
  FROM PUBLIC, anon, authenticated, service_role, multilot_app, multilot_billing_worker;

-- Link production identities only when they already exist. Re-running the two
-- bootstrap calls after creating a missing Auth identity is safe and intended.
DO $bootstrap$
BEGIN
  IF EXISTS (
    SELECT 1 FROM auth.users
    WHERE lower(email) = 'craftzdog@alphaby.cloud'
  ) THEN
    PERFORM app_private.bootstrap_platform_operator(
      'craftzdog@alphaby.cloud',
      'craftzdog',
      'AlphaBy SaaS Owner',
      'OWNER',
      true
    );
    PERFORM app_private.bootstrap_internal_trial_tenant(
      'atlasby',
      'AtlasBy',
      'craftzdog@alphaby.cloud',
      'STARTER',
      30
    );
  END IF;

  IF EXISTS (
    SELECT 1 FROM auth.users
    WHERE lower(email) = 'suport@alphaby.cloud'
  ) THEN
    PERFORM app_private.bootstrap_platform_operator(
      'suport@alphaby.cloud',
      'alphaby.support',
      'AlphaBy Support',
      'SUPPORT',
      true
    );
  END IF;
END
$bootstrap$;

COMMENT ON COLUMN public.platform_admins.nivel_acceso IS
  'Internal AlphaBy access level. OWNER and SUPPORT are platform operators, not tenant ownership grants.';
COMMENT ON COLUMN public.platform_admins.acceso_todos_tenants IS
  'When true, explicit support memberships are synchronized for every non-deleted tenant.';
COMMENT ON COLUMN public.membresias_tenant.es_soporte_plataforma IS
  'Auditable membership provisioned for an active AlphaBy platform operator.';
COMMENT ON FUNCTION app_private.bootstrap_platform_operator(text, text, text, text, boolean) IS
  'Links an existing Supabase Auth identity to a least-privilege, auditable AlphaBy platform profile.';
COMMENT ON FUNCTION app_private.bootstrap_internal_trial_tenant(text, text, text, text, integer) IS
  'Creates or repairs an internal trial tenant using the canonical role, permission, parameter, and billing templates.';
