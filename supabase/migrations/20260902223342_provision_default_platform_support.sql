-- Provision the canonical AlphaBy support operator across every tenant.
--
-- The Supabase Auth identity is deliberately NOT created here: its password
-- must be submitted only through the Auth Admin API/dashboard and must never
-- be stored in migration history. Once support@alphaby.cloud exists, the final
-- block links it to the platform and synchronizes its tenant memberships.

SET lock_timeout = '10s';
SET statement_timeout = '120s';

CREATE OR REPLACE FUNCTION app_private.ensure_platform_support_memberships(
  p_profile_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_affected integer := 0;
  v_enabled boolean := false;
  v_username text;
BEGIN
  SELECT
    platform_admin.activo AND platform_admin.acceso_todos_tenants,
    profile.username
  INTO v_enabled, v_username
  FROM public.platform_admins platform_admin
  JOIN public.usuarios profile ON profile.id = platform_admin.perfil_id
  WHERE platform_admin.perfil_id = p_profile_id
    AND profile.activo
    AND profile.eliminado_en IS NULL;

  IF NOT COALESCE(v_enabled, false) THEN
    UPDATE public.membresias_tenant
    SET estado = 'SUSPENDIDO',
        actualizado_en = now()
    WHERE perfil_id = p_profile_id
      AND es_soporte_plataforma
      AND eliminado_en IS NULL
      AND estado <> 'SUSPENDIDO';
    GET DIAGNOSTICS v_affected = ROW_COUNT;
    RETURN v_affected;
  END IF;

  IF v_username IS NULL OR v_username !~ '^[a-z0-9._-]{3,50}$' THEN
    RAISE EXCEPTION 'active platform support profile has an invalid username'
      USING ERRCODE = '22023';
  END IF;

  -- ADMIN is intentional. Several API routes enforce the administrative role
  -- in addition to granular module permissions. The explicit support marker
  -- keeps this access distinguishable from tenant ownership and seller access.
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
    admin_role.tenant_id,
    p_profile_id,
    admin_role.id,
    v_username,
    'ACTIVO',
    false,
    true,
    true
  FROM public.roles admin_role
  JOIN public.tenants tenant
    ON tenant.id = admin_role.tenant_id
   AND tenant.eliminado_en IS NULL
  WHERE upper(admin_role.nombre) = 'ADMIN'
  ON CONFLICT (tenant_id, perfil_id) DO UPDATE
  SET rol_id = EXCLUDED.rol_id,
      username = EXCLUDED.username,
      estado = 'ACTIVO',
      es_propietario = false,
      puede_gestionar_facturacion = true,
      actualizado_en = now(),
      eliminado_en = NULL
  WHERE public.membresias_tenant.es_soporte_plataforma;

  GET DIAGNOSTICS v_affected = ROW_COUNT;
  RETURN v_affected;
END
$function$;

-- The canonical ADMIN role is created as part of every supported tenant
-- provisioning flow. Its insert is therefore the reliable point at which to
-- attach every active AlphaBy support operator to a new tenant.
CREATE OR REPLACE FUNCTION app_private.trg_provision_platform_support_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_profile_id uuid;
BEGIN
  IF upper(NEW.nombre) <> 'ADMIN' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.permisos_por_rol (
    tenant_id,
    rol_id,
    modulo_id,
    puede_leer,
    puede_crear,
    puede_actualizar,
    puede_borrar
  )
  SELECT NEW.tenant_id, NEW.id, module.id, true, true, true, true
  FROM public.modulos module
  ON CONFLICT (rol_id, modulo_id) DO UPDATE
  SET tenant_id = EXCLUDED.tenant_id,
      puede_leer = true,
      puede_crear = true,
      puede_actualizar = true,
      puede_borrar = true;

  FOR v_profile_id IN
    SELECT platform_admin.perfil_id
    FROM public.platform_admins platform_admin
    JOIN public.usuarios profile ON profile.id = platform_admin.perfil_id
    WHERE platform_admin.activo
      AND platform_admin.acceso_todos_tenants
      AND profile.activo
      AND profile.eliminado_en IS NULL
  LOOP
    PERFORM app_private.ensure_platform_support_memberships(v_profile_id);
  END LOOP;

  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS roles_provision_platform_support ON public.roles;
CREATE TRIGGER roles_provision_platform_support
AFTER INSERT ON public.roles
FOR EACH ROW
EXECUTE FUNCTION app_private.trg_provision_platform_support_role();

-- Repair every current tenant before installing the future-module trigger.
INSERT INTO public.permisos_por_rol (
  tenant_id,
  rol_id,
  modulo_id,
  puede_leer,
  puede_crear,
  puede_actualizar,
  puede_borrar
)
SELECT admin_role.tenant_id, admin_role.id, module.id, true, true, true, true
FROM public.roles admin_role
CROSS JOIN public.modulos module
JOIN public.tenants tenant
  ON tenant.id = admin_role.tenant_id
 AND tenant.eliminado_en IS NULL
WHERE upper(admin_role.nombre) = 'ADMIN'
ON CONFLICT (rol_id, modulo_id) DO UPDATE
SET tenant_id = EXCLUDED.tenant_id,
    puede_leer = true,
    puede_crear = true,
    puede_actualizar = true,
    puede_borrar = true;

-- New modules remain immediately accessible to every tenant administrator,
-- including the audited AlphaBy support membership.
CREATE OR REPLACE FUNCTION app_private.trg_grant_new_module_to_administrators()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
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
    admin_role.tenant_id,
    admin_role.id,
    NEW.id,
    true,
    true,
    true,
    true
  FROM public.roles admin_role
  JOIN public.tenants tenant
    ON tenant.id = admin_role.tenant_id
   AND tenant.eliminado_en IS NULL
  WHERE upper(admin_role.nombre) = 'ADMIN'
  ON CONFLICT (rol_id, modulo_id) DO UPDATE
  SET tenant_id = EXCLUDED.tenant_id,
      puede_leer = true,
      puede_crear = true,
      puede_actualizar = true,
      puede_borrar = true;

  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS modules_grant_administrator_access ON public.modulos;
CREATE TRIGGER modules_grant_administrator_access
AFTER INSERT ON public.modulos
FOR EACH ROW
EXECUTE FUNCTION app_private.trg_grant_new_module_to_administrators();

ALTER FUNCTION app_private.ensure_platform_support_memberships(uuid)
  OWNER TO postgres;
ALTER FUNCTION app_private.trg_provision_platform_support_role()
  OWNER TO postgres;
ALTER FUNCTION app_private.trg_grant_new_module_to_administrators()
  OWNER TO postgres;

REVOKE ALL ON FUNCTION app_private.ensure_platform_support_memberships(uuid)
  FROM PUBLIC, anon, authenticated, service_role, multilot_app, multilot_billing_worker;
REVOKE ALL ON FUNCTION app_private.trg_provision_platform_support_role()
  FROM PUBLIC, anon, authenticated, service_role, multilot_app, multilot_billing_worker;
REVOKE ALL ON FUNCTION app_private.trg_grant_new_module_to_administrators()
  FROM PUBLIC, anon, authenticated, service_role, multilot_app, multilot_billing_worker;

DO $canonical_support$
DECLARE
  v_auth_user_id uuid;
  v_profile_id uuid;
BEGIN
  SELECT auth_user.id
  INTO v_auth_user_id
  FROM auth.users auth_user
  WHERE lower(auth_user.email) = 'support@alphaby.cloud'
  LIMIT 1;

  -- Deployment can safely precede Auth account creation. Reapplying the
  -- idempotent bootstrap call after creating the identity performs the link.
  IF v_auth_user_id IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.usuarios profile
    WHERE profile.username = 'soporte.tecnico'
      AND profile.auth_user_id IS DISTINCT FROM v_auth_user_id
  ) THEN
    RAISE EXCEPTION 'username soporte.tecnico is already assigned to another identity'
      USING ERRCODE = '23505';
  END IF;

  UPDATE public.usuarios
  SET username = 'soporte.tecnico',
      nombre = 'Soporte Tecnico',
      activo = true,
      eliminado_en = NULL,
      motivo_eliminacion = NULL,
      actualizado_en = now()
  WHERE auth_user_id = v_auth_user_id;

  v_profile_id := app_private.bootstrap_platform_operator(
    'support@alphaby.cloud',
    'soporte.tecnico',
    'Soporte Tecnico',
    'SUPPORT',
    true
  );

  PERFORM app_private.ensure_platform_support_memberships(v_profile_id);
END
$canonical_support$;

-- Resynchronize every previously registered global operator after changing
-- membership semantics from SOPORTE to the fully compatible ADMIN role.
DO $resynchronize_platform_support$
DECLARE
  v_profile_id uuid;
BEGIN
  FOR v_profile_id IN
    SELECT platform_admin.perfil_id
    FROM public.platform_admins platform_admin
    WHERE platform_admin.activo
      AND platform_admin.acceso_todos_tenants
  LOOP
    PERFORM app_private.ensure_platform_support_memberships(v_profile_id);
  END LOOP;
END
$resynchronize_platform_support$;

COMMENT ON FUNCTION app_private.ensure_platform_support_memberships(uuid) IS
  'Synchronizes explicit ADMIN memberships for an active AlphaBy platform operator without granting tenant ownership or seller identity.';
COMMENT ON FUNCTION app_private.trg_grant_new_module_to_administrators() IS
  'Grants every new application module to each tenant ADMIN role, including audited platform-support memberships.';
