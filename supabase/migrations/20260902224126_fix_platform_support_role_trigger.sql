-- Keep role creation compatible with existing provisioning code. The canonical
-- tenant functions copy their permission matrix immediately after inserting
-- roles, so this trigger must only synchronize support memberships and must
-- not pre-insert rows that those flows own.

SET lock_timeout = '10s';
SET statement_timeout = '120s';

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

ALTER FUNCTION app_private.trg_provision_platform_support_role()
  OWNER TO postgres;
REVOKE ALL ON FUNCTION app_private.trg_provision_platform_support_role()
  FROM PUBLIC, anon, authenticated, service_role, multilot_app, multilot_billing_worker;

COMMENT ON FUNCTION app_private.trg_provision_platform_support_role() IS
  'Synchronizes platform-support memberships after ADMIN role creation without mutating the provisioner-owned permission copy.';
