-- Repair tenants left incomplete by interrupted/manual provisioning. The
-- legacy tenant is the canonical template for role, permission, and parameter
-- defaults. Every statement is idempotent and preserves tenant overrides.

SET lock_timeout = '10s';
SET statement_timeout = '120s';

INSERT INTO public.roles (tenant_id, nombre)
SELECT target.id, template_role.nombre
FROM public.tenants target
JOIN public.tenants legacy ON legacy.es_legacy
JOIN public.roles template_role ON template_role.tenant_id = legacy.id
WHERE target.eliminado_en IS NULL
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
  target_role.tenant_id,
  target_role.id,
  template_permission.modulo_id,
  template_permission.puede_leer,
  template_permission.puede_crear,
  template_permission.puede_actualizar,
  template_permission.puede_borrar
FROM public.permisos_por_rol template_permission
JOIN public.roles template_role
  ON template_role.id = template_permission.rol_id
 AND template_role.tenant_id = template_permission.tenant_id
JOIN public.tenants legacy
  ON legacy.id = template_role.tenant_id
 AND legacy.es_legacy
JOIN public.roles target_role
  ON target_role.nombre = template_role.nombre
JOIN public.tenants target
  ON target.id = target_role.tenant_id
 AND target.eliminado_en IS NULL
ON CONFLICT (rol_id, modulo_id) DO NOTHING;

INSERT INTO public.parametros (tenant_id, clave, valor)
SELECT target.id, template_parameter.clave, template_parameter.valor
FROM public.tenants target
JOIN public.tenants legacy ON legacy.es_legacy
JOIN public.parametros template_parameter
  ON template_parameter.tenant_id = legacy.id
WHERE target.eliminado_en IS NULL
ON CONFLICT (tenant_id, clave) DO NOTHING;

DO $resynchronize_support$
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
$resynchronize_support$;
