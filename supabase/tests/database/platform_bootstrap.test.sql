-- Platform owner/support, commercial catalog, and internal tenant bootstrap.
-- Every fixture is rolled back.
BEGIN;

DO $catalog$
DECLARE
  v_actual jsonb;
BEGIN
  SELECT jsonb_object_agg(plan.codigo, price.monto_minor ORDER BY plan.codigo)
  INTO v_actual
  FROM public.billing_plans plan
  JOIN public.billing_prices price ON price.plan_id = plan.id
  JOIN public.billing_price_channels channel
    ON channel.price_id = price.id
   AND channel.canal = 'BANK_TRANSFER'
   AND channel.activo
  WHERE plan.codigo IN ('STARTER', 'BUSINESS', 'ENTERPRISE')
    AND price.moneda = 'USD'
    AND price.intervalo = 'MENSUAL'
    AND price.activo;

  IF v_actual <> '{"BUSINESS":2500,"ENTERPRISE":5000,"STARTER":1000}'::jsonb THEN
    RAISE EXCEPTION 'unexpected production catalog: %', v_actual;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.billing_price_channels channel
    JOIN public.billing_prices price ON price.id = channel.price_id
    JOIN public.billing_plans plan ON plan.id = price.plan_id
    WHERE plan.codigo IN ('STARTER', 'BUSINESS', 'ENTERPRISE')
      AND price.moneda = 'USD'
      AND channel.canal = 'PAYPAL'
      AND channel.activo
  ) THEN
    RAISE EXCEPTION 'PayPal was enabled without provider configuration';
  END IF;
END
$catalog$;

DO $bootstrap$
DECLARE
  v_owner_auth uuid := gen_random_uuid();
  v_support_auth uuid := gen_random_uuid();
  v_owner_profile uuid;
  v_support_profile uuid;
  v_tenant uuid;
  v_future_tenant uuid;
  v_new_module uuid;
BEGIN
  INSERT INTO auth.users (
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  ) VALUES (
    v_owner_auth,
    'authenticated',
    'authenticated',
    'qa-platform-owner@example.test',
    'x',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ), (
    v_support_auth,
    'authenticated',
    'authenticated',
    'qa-platform-support@example.test',
    'x',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

  v_owner_profile := app_private.bootstrap_platform_operator(
    'qa-platform-owner@example.test',
    'qa.platform.owner',
    'QA Platform Owner',
    'OWNER',
    true
  );
  v_support_profile := app_private.bootstrap_platform_operator(
    'qa-platform-support@example.test',
    'qa.platform.support',
    'QA Platform Support',
    'SUPPORT',
    true
  );

  IF NOT EXISTS (
    SELECT 1 FROM public.platform_admins
    WHERE perfil_id = v_owner_profile
      AND activo
      AND puede_revisar_facturacion
      AND nivel_acceso = 'OWNER'
      AND acceso_todos_tenants
  ) THEN
    RAISE EXCEPTION 'owner platform privileges were not provisioned';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.platform_admins
    WHERE perfil_id = v_support_profile
      AND activo
      AND nivel_acceso = 'SUPPORT'
      AND acceso_todos_tenants
  ) THEN
    RAISE EXCEPTION 'support platform privileges were not provisioned';
  END IF;

  IF EXISTS (
    SELECT tenant.id
    FROM public.tenants tenant
    WHERE tenant.eliminado_en IS NULL
    EXCEPT
    SELECT membership.tenant_id
    FROM public.membresias_tenant membership
    JOIN public.roles role
      ON role.tenant_id = membership.tenant_id
     AND role.id = membership.rol_id
    WHERE membership.perfil_id = v_support_profile
      AND membership.estado = 'ACTIVO'
      AND membership.es_soporte_plataforma
      AND membership.puede_gestionar_facturacion
      AND NOT membership.es_propietario
      AND upper(role.nombre) = 'ADMIN'
  ) THEN
    RAISE EXCEPTION 'support does not cover every existing tenant';
  END IF;

  v_tenant := app_private.bootstrap_internal_trial_tenant(
    'qa-atlasby',
    'QA AtlasBy',
    'qa-platform-owner@example.test',
    'STARTER',
    30
  );

  IF NOT EXISTS (
    SELECT 1
    FROM public.tenants tenant
    JOIN public.membresias_tenant membership ON membership.tenant_id = tenant.id
    JOIN public.roles role
      ON role.tenant_id = membership.tenant_id
     AND role.id = membership.rol_id
    JOIN public.tenant_subscriptions subscription ON subscription.tenant_id = tenant.id
    JOIN public.billing_prices price ON price.id = subscription.price_id
    WHERE tenant.id = v_tenant
      AND tenant.estado = 'PRUEBA'
      AND membership.perfil_id = v_owner_profile
      AND membership.es_propietario
      AND NOT membership.es_soporte_plataforma
      AND upper(role.nombre) = 'ADMIN'
      AND subscription.estado = 'PRUEBA'
      AND price.monto_minor = 1000
      AND price.moneda = 'USD'
  ) THEN
    RAISE EXCEPTION 'internal trial tenant ecosystem is incomplete';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.membresias_tenant membership
    JOIN public.roles role
      ON role.tenant_id = membership.tenant_id
     AND role.id = membership.rol_id
    WHERE membership.tenant_id = v_tenant
      AND membership.perfil_id = v_support_profile
      AND membership.es_soporte_plataforma
      AND membership.puede_gestionar_facturacion
      AND NOT membership.es_propietario
      AND upper(role.nombre) = 'ADMIN'
  ) THEN
    RAISE EXCEPTION 'support membership was not added to the bootstrapped tenant';
  END IF;

  INSERT INTO public.tenants (slug, nombre, estado, zona_horaria, moneda)
  VALUES ('qa-future-support', 'QA Future Support', 'ACTIVO', 'America/Managua', 'USD')
  RETURNING id INTO v_future_tenant;

  INSERT INTO public.roles (tenant_id, nombre)
  VALUES (v_future_tenant, 'ADMIN');

  IF NOT EXISTS (
    SELECT 1
    FROM public.membresias_tenant membership
    WHERE membership.tenant_id = v_future_tenant
      AND membership.perfil_id = v_support_profile
      AND membership.estado = 'ACTIVO'
      AND membership.es_soporte_plataforma
  ) THEN
    RAISE EXCEPTION 'future tenant support trigger did not provision access';
  END IF;

  -- Reproduce the permission-copy phase performed by the canonical tenant
  -- provisioners after role creation.
  INSERT INTO public.permisos_por_rol (
    tenant_id,
    rol_id,
    modulo_id,
    puede_leer,
    puede_crear,
    puede_actualizar,
    puede_borrar
  )
  SELECT v_future_tenant, role.id, module.id, true, true, true, true
  FROM public.roles role
  CROSS JOIN public.modulos module
  WHERE role.tenant_id = v_future_tenant
    AND upper(role.nombre) = 'ADMIN'
  ON CONFLICT (rol_id, modulo_id) DO UPDATE
  SET tenant_id = EXCLUDED.tenant_id,
      puede_leer = true,
      puede_crear = true,
      puede_actualizar = true,
      puede_borrar = true;

  IF EXISTS (
    SELECT 1
    FROM public.membresias_tenant membership
    JOIN public.roles role
      ON role.tenant_id = membership.tenant_id
     AND role.id = membership.rol_id
    CROSS JOIN public.modulos module
    LEFT JOIN public.permisos_por_rol permission
      ON permission.tenant_id = role.tenant_id
     AND permission.rol_id = role.id
     AND permission.modulo_id = module.id
    WHERE membership.perfil_id = v_support_profile
      AND membership.estado = 'ACTIVO'
      AND membership.es_soporte_plataforma
      AND (
        permission.modulo_id IS NULL
        OR NOT permission.puede_leer
        OR NOT permission.puede_crear
        OR NOT permission.puede_actualizar
        OR NOT permission.puede_borrar
      )
  ) THEN
    RAISE EXCEPTION 'support is missing full access to an existing module';
  END IF;

  INSERT INTO public.modulos (codigo, descripcion)
  VALUES ('QA_PLATFORM_SUPPORT_PROBE', 'Transactional support permission probe')
  RETURNING id INTO v_new_module;

  IF EXISTS (
    SELECT 1
    FROM public.membresias_tenant membership
    JOIN public.roles role
      ON role.tenant_id = membership.tenant_id
     AND role.id = membership.rol_id
    LEFT JOIN public.permisos_por_rol permission
      ON permission.tenant_id = role.tenant_id
     AND permission.rol_id = role.id
     AND permission.modulo_id = v_new_module
    WHERE membership.perfil_id = v_support_profile
      AND membership.estado = 'ACTIVO'
      AND membership.es_soporte_plataforma
      AND (
        permission.modulo_id IS NULL
        OR NOT permission.puede_leer
        OR NOT permission.puede_crear
        OR NOT permission.puede_actualizar
        OR NOT permission.puede_borrar
      )
  ) THEN
    RAISE EXCEPTION 'new module was not granted to platform support';
  END IF;
END
$bootstrap$;

ROLLBACK;
