-- MultiLot 360: shared-schema multi-tenancy, SaaS control plane and database isolation.
-- This migration is intentionally expand-first: legacy identity columns remain until
-- the API contract is migrated to tenant memberships.

SET lock_timeout = '10s';
SET statement_timeout = '120s';

CREATE SCHEMA IF NOT EXISTS app_private;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC, anon, authenticated, service_role;

DO $role$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'multilot_app') THEN
    CREATE ROLE multilot_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
END
$role$;

GRANT multilot_app TO postgres;

CREATE TYPE public.tenant_estado AS ENUM (
  'PENDIENTE_PAGO', 'PRUEBA', 'ACTIVO', 'MOROSO', 'SUSPENDIDO', 'CANCELADO'
);
CREATE TYPE public.membresia_estado AS ENUM ('INVITADO', 'ACTIVO', 'SUSPENDIDO', 'REVOCADO');
CREATE TYPE public.invitacion_tenant_estado AS ENUM ('PENDIENTE', 'ACEPTADA', 'EXPIRADA', 'REVOCADA');
CREATE TYPE public.intervalo_facturacion AS ENUM ('MENSUAL', 'ANUAL');
CREATE TYPE public.suscripcion_estado AS ENUM (
  'INCOMPLETA', 'PRUEBA', 'ACTIVA', 'MOROSA', 'PAUSADA', 'CANCELADA'
);
CREATE TYPE public.factura_estado AS ENUM ('BORRADOR', 'ABIERTA', 'PAGADA', 'FALLIDA', 'ANULADA');
CREATE TYPE public.evento_outbox_estado AS ENUM ('PENDIENTE', 'PROCESANDO', 'PUBLICADO', 'FALLIDO');

CREATE TABLE public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  nombre text NOT NULL,
  estado public.tenant_estado NOT NULL DEFAULT 'PENDIENTE_PAGO',
  zona_horaria text NOT NULL DEFAULT 'America/Managua',
  moneda char(3) NOT NULL DEFAULT 'NIO',
  configuracion jsonb NOT NULL DEFAULT '{}'::jsonb,
  es_legacy boolean NOT NULL DEFAULT false,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  eliminado_en timestamptz,
  CONSTRAINT ck_tenants_slug CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  CONSTRAINT ck_tenants_moneda CHECK (moneda ~ '^[A-Z]{3}$'),
  CONSTRAINT ck_tenants_configuracion_objeto CHECK (jsonb_typeof(configuracion) = 'object')
);
CREATE UNIQUE INDEX uq_tenants_slug_activo ON public.tenants (lower(slug)) WHERE eliminado_en IS NULL;
CREATE UNIQUE INDEX uq_tenants_legacy ON public.tenants (es_legacy) WHERE es_legacy;

INSERT INTO public.tenants (slug, nombre, estado, zona_horaria, moneda, es_legacy)
VALUES ('multilot-legacy', 'MultiLot 360 Legacy', 'ACTIVO', 'America/Managua', 'NIO', true);

CREATE OR REPLACE FUNCTION app_private.current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
PARALLEL SAFE
SET search_path = pg_catalog
AS $$
  SELECT NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION app_private.current_profile_id()
RETURNS uuid
LANGUAGE sql
STABLE
PARALLEL SAFE
SET search_path = pg_catalog
AS $$
  SELECT NULLIF(current_setting('app.current_profile_id', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION app_private.current_membership_id()
RETURNS uuid
LANGUAGE sql
STABLE
PARALLEL SAFE
SET search_path = pg_catalog
AS $$
  SELECT NULLIF(current_setting('app.current_membership_id', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION app_private.current_auth_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
PARALLEL SAFE
SET search_path = pg_catalog
AS $$
  SELECT NULLIF(current_setting('app.current_auth_user_id', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION app_private.current_or_legacy_tenant_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_tenant uuid := app_private.current_tenant_id();
BEGIN
  IF v_tenant IS NOT NULL THEN
    RETURN v_tenant;
  END IF;
  SELECT id INTO v_tenant FROM public.tenants WHERE es_legacy AND eliminado_en IS NULL;
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'tenant context is required' USING ERRCODE = '42501';
  END IF;
  RETURN v_tenant;
END;
$$;

COMMENT ON FUNCTION app_private.current_or_legacy_tenant_id() IS
  'Transitional fallback for the pre-tenant API. Remove legacy fallback after the API always sets app.current_tenant_id.';

-- Roles become tenant-scoped. usuarios remains a global identity profile during
-- the expand phase; tenant-specific authorization lives in membresias_tenant.
ALTER TABLE public.roles ADD COLUMN tenant_id uuid;
UPDATE public.roles SET tenant_id = (SELECT id FROM public.tenants WHERE es_legacy);
ALTER TABLE public.roles ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.roles ALTER COLUMN tenant_id SET DEFAULT app_private.current_or_legacy_tenant_id();
ALTER TABLE public.roles ADD CONSTRAINT fk_roles_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);
ALTER TABLE public.roles DROP CONSTRAINT IF EXISTS roles_nombre_key;
ALTER TABLE public.roles ADD CONSTRAINT uq_roles_tenant_nombre UNIQUE (tenant_id, nombre);
ALTER TABLE public.roles ADD CONSTRAINT uq_roles_tenant_id_id UNIQUE (tenant_id, id);

ALTER TABLE public.permisos_por_rol ADD COLUMN tenant_id uuid;
UPDATE public.permisos_por_rol p SET tenant_id = r.tenant_id FROM public.roles r WHERE r.id = p.rol_id;
ALTER TABLE public.permisos_por_rol ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.permisos_por_rol ALTER COLUMN tenant_id SET DEFAULT app_private.current_or_legacy_tenant_id();
ALTER TABLE public.permisos_por_rol ADD CONSTRAINT fk_permisos_rol_tenant
  FOREIGN KEY (tenant_id, rol_id) REFERENCES public.roles(tenant_id, id) ON DELETE CASCADE;
CREATE INDEX ix_permisos_tenant ON public.permisos_por_rol (tenant_id);

CREATE TABLE public.membresias_tenant (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  perfil_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  rol_id uuid NOT NULL,
  username text NOT NULL,
  estado public.membresia_estado NOT NULL DEFAULT 'ACTIVO',
  es_propietario boolean NOT NULL DEFAULT false,
  invitado_por_membresia_id uuid,
  ultimo_acceso_en timestamptz,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  eliminado_en timestamptz,
  CONSTRAINT fk_membresias_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_membresias_rol FOREIGN KEY (tenant_id, rol_id) REFERENCES public.roles(tenant_id, id),
  CONSTRAINT uq_membresias_tenant_id_id UNIQUE (tenant_id, id),
  CONSTRAINT uq_membresias_tenant_perfil UNIQUE (tenant_id, perfil_id),
  CONSTRAINT ck_membresias_propietario_activo CHECK (NOT es_propietario OR estado = 'ACTIVO')
);
CREATE UNIQUE INDEX uq_membresias_tenant_username
  ON public.membresias_tenant (tenant_id, lower(username)) WHERE eliminado_en IS NULL;
CREATE INDEX ix_membresias_perfil_estado ON public.membresias_tenant (perfil_id, estado);

WITH ranked AS (
  SELECT u.id perfil_id, u.username, u.rol_id,
         row_number() OVER (ORDER BY (upper(r.nombre) = 'ADMIN') DESC, u.activo DESC, u.creado_en, u.id) AS owner_rank
  FROM public.usuarios u
  JOIN public.roles r ON r.id = u.rol_id
)
INSERT INTO public.membresias_tenant (tenant_id, perfil_id, rol_id, username, estado, es_propietario)
SELECT t.id, x.perfil_id, x.rol_id, x.username,
       CASE WHEN u.activo AND u.eliminado_en IS NULL THEN 'ACTIVO'::public.membresia_estado
            ELSE 'SUSPENDIDO'::public.membresia_estado END,
       x.owner_rank = 1
FROM ranked x
JOIN public.usuarios u ON u.id = x.perfil_id
CROSS JOIN public.tenants t
WHERE t.es_legacy;

ALTER TABLE public.membresias_tenant ADD CONSTRAINT fk_membresias_invitador
  FOREIGN KEY (tenant_id, invitado_por_membresia_id)
  REFERENCES public.membresias_tenant(tenant_id, id);

CREATE TABLE public.tenant_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  dominio text NOT NULL,
  verificado_en timestamptz,
  creado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_tenant_domains_tenant_id_id UNIQUE (tenant_id, id),
  CONSTRAINT ck_tenant_domains_lower CHECK (dominio = lower(dominio))
);
CREATE UNIQUE INDEX uq_tenant_domains_dominio ON public.tenant_domains(lower(dominio));

CREATE TABLE public.tenant_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email text NOT NULL,
  rol_id uuid NOT NULL,
  token_hash char(64) NOT NULL,
  estado public.invitacion_tenant_estado NOT NULL DEFAULT 'PENDIENTE',
  invitado_por_membresia_id uuid NOT NULL,
  expira_en timestamptz NOT NULL,
  aceptada_en timestamptz,
  creado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_tenant_invitations_rol FOREIGN KEY (tenant_id, rol_id) REFERENCES public.roles(tenant_id, id),
  CONSTRAINT fk_tenant_invitations_actor FOREIGN KEY (tenant_id, invitado_por_membresia_id)
    REFERENCES public.membresias_tenant(tenant_id, id),
  CONSTRAINT uq_tenant_invitations_tenant_id_id UNIQUE (tenant_id, id),
  CONSTRAINT uq_tenant_invitations_token UNIQUE (token_hash),
  CONSTRAINT ck_tenant_invitations_expira CHECK (expira_en > creado_en)
);
CREATE UNIQUE INDEX uq_tenant_invitations_pending_email
  ON public.tenant_invitations (tenant_id, lower(email)) WHERE estado = 'PENDIENTE';

CREATE TABLE public.platform_admins (
  perfil_id uuid PRIMARY KEY REFERENCES public.usuarios(id) ON DELETE CASCADE,
  creado_en timestamptz NOT NULL DEFAULT now()
);

-- Add tenant ownership to every business aggregate and backfill the legacy estate.
ALTER TABLE public.vendedores ADD COLUMN tenant_id uuid;
ALTER TABLE public.vendedores ADD COLUMN membresia_id uuid;
ALTER TABLE public.codigos_acceso_vendedor ADD COLUMN tenant_id uuid;
ALTER TABLE public.codigos_acceso_vendedor ADD COLUMN creado_por_membresia_id uuid;
ALTER TABLE public.sorteos_config ADD COLUMN tenant_id uuid;
ALTER TABLE public.turnos ADD COLUMN tenant_id uuid;
ALTER TABLE public.ventas ADD COLUMN tenant_id uuid;
ALTER TABLE public.ventas ADD COLUMN anulada_por_membresia_id uuid;
ALTER TABLE public.venta_detalle ADD COLUMN tenant_id uuid;
ALTER TABLE public.numeros_bloqueados ADD COLUMN tenant_id uuid;
ALTER TABLE public.numeros_bloqueados ADD COLUMN creado_por_membresia_id uuid;
ALTER TABLE public.resultados ADD COLUMN tenant_id uuid;
ALTER TABLE public.resultados ADD COLUMN creado_por_membresia_id uuid;
ALTER TABLE public.pagos_premios ADD COLUMN tenant_id uuid;
ALTER TABLE public.pagos_premios ADD COLUMN pagado_por_membresia_id uuid;
ALTER TABLE public.parametros ADD COLUMN tenant_id uuid;
ALTER TABLE public.cortes ADD COLUMN tenant_id uuid;
ALTER TABLE public.cortes ADD COLUMN creado_por_membresia_id uuid;
ALTER TABLE public.auditoria_eventos ADD COLUMN tenant_id uuid;
ALTER TABLE public.auditoria_eventos ADD COLUMN membresia_id uuid;
ALTER TABLE public.notificaciones ADD COLUMN tenant_id uuid;
ALTER TABLE public.notificaciones ADD COLUMN membresia_id uuid;
ALTER TABLE public.limites_numero ADD COLUMN tenant_id uuid;

UPDATE public.vendedores v SET tenant_id = m.tenant_id, membresia_id = m.id
FROM public.membresias_tenant m WHERE m.perfil_id = v.usuario_id;
UPDATE public.codigos_acceso_vendedor c SET tenant_id = v.tenant_id FROM public.vendedores v WHERE v.id = c.vendedor_id;
UPDATE public.sorteos_config SET tenant_id = (SELECT id FROM public.tenants WHERE es_legacy);
UPDATE public.turnos t SET tenant_id = s.tenant_id FROM public.sorteos_config s WHERE s.id = t.config_id;
UPDATE public.ventas v SET tenant_id = s.tenant_id FROM public.vendedores s WHERE s.id = v.vendedor_id;
UPDATE public.venta_detalle d SET tenant_id = v.tenant_id FROM public.ventas v WHERE v.id = d.venta_id;
UPDATE public.numeros_bloqueados SET tenant_id = (SELECT id FROM public.tenants WHERE es_legacy);
UPDATE public.resultados r SET tenant_id = t.tenant_id FROM public.turnos t WHERE t.id = r.turno_id;
UPDATE public.pagos_premios p SET tenant_id = v.tenant_id FROM public.ventas v WHERE v.id = p.venta_id;
UPDATE public.parametros SET tenant_id = (SELECT id FROM public.tenants WHERE es_legacy);
UPDATE public.cortes SET tenant_id = (SELECT id FROM public.tenants WHERE es_legacy);
UPDATE public.auditoria_eventos SET tenant_id = (SELECT id FROM public.tenants WHERE es_legacy);
UPDATE public.notificaciones SET tenant_id = (SELECT id FROM public.tenants WHERE es_legacy);
UPDATE public.limites_numero SET tenant_id = (SELECT id FROM public.tenants WHERE es_legacy);

UPDATE public.codigos_acceso_vendedor x SET creado_por_membresia_id = m.id
FROM public.membresias_tenant m WHERE m.tenant_id = x.tenant_id AND m.perfil_id = x.creado_por;
UPDATE public.ventas x SET anulada_por_membresia_id = m.id
FROM public.membresias_tenant m WHERE m.tenant_id = x.tenant_id AND m.perfil_id = x.anulada_por;
UPDATE public.numeros_bloqueados x SET creado_por_membresia_id = m.id
FROM public.membresias_tenant m WHERE m.tenant_id = x.tenant_id AND m.perfil_id = x.creado_por;
UPDATE public.resultados x SET creado_por_membresia_id = m.id
FROM public.membresias_tenant m WHERE m.tenant_id = x.tenant_id AND m.perfil_id = x.creado_por;
UPDATE public.pagos_premios x SET pagado_por_membresia_id = m.id
FROM public.membresias_tenant m WHERE m.tenant_id = x.tenant_id AND m.perfil_id = x.pagado_por;
UPDATE public.cortes x SET creado_por_membresia_id = m.id
FROM public.membresias_tenant m WHERE m.tenant_id = x.tenant_id AND m.perfil_id = x.creado_por;
UPDATE public.auditoria_eventos x SET membresia_id = m.id
FROM public.membresias_tenant m WHERE m.tenant_id = x.tenant_id AND m.perfil_id = x.usuario_id;
UPDATE public.notificaciones x SET membresia_id = m.id
FROM public.membresias_tenant m WHERE m.tenant_id = x.tenant_id AND m.perfil_id = x.usuario_id;

DO $not_null$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'vendedores','codigos_acceso_vendedor','sorteos_config','turnos','ventas','venta_detalle',
    'numeros_bloqueados','resultados','pagos_premios','parametros','cortes','auditoria_eventos',
    'notificaciones','limites_numero'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN tenant_id SET NOT NULL', v_table);
    EXECUTE format(
      'ALTER TABLE public.%I ALTER COLUMN tenant_id SET DEFAULT app_private.current_or_legacy_tenant_id()',
      v_table
    );
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)',
      v_table, 'fk_' || v_table || '_tenant'
    );
    EXECUTE format('CREATE INDEX %I ON public.%I (tenant_id)', 'ix_' || v_table || '_tenant', v_table);
  END LOOP;
END
$not_null$;

ALTER TABLE public.vendedores ALTER COLUMN membresia_id SET NOT NULL;

-- Replace global natural-key uniqueness with tenant-scoped uniqueness.
ALTER TABLE public.vendedores DROP CONSTRAINT IF EXISTS vendedores_cedula_key;
ALTER TABLE public.vendedores DROP CONSTRAINT IF EXISTS vendedores_usuario_id_key;
ALTER TABLE public.vendedores ADD CONSTRAINT uq_vendedores_tenant_cedula UNIQUE (tenant_id, cedula);
ALTER TABLE public.vendedores ADD CONSTRAINT uq_vendedores_tenant_membresia UNIQUE (tenant_id, membresia_id);
ALTER TABLE public.vendedores ADD CONSTRAINT uq_vendedores_tenant_id_id UNIQUE (tenant_id, id);

ALTER TABLE public.sorteos_config DROP CONSTRAINT IF EXISTS sorteos_config_codigo_key;
ALTER TABLE public.sorteos_config ADD CONSTRAINT uq_sorteos_tenant_codigo UNIQUE (tenant_id, codigo);
ALTER TABLE public.sorteos_config ADD CONSTRAINT uq_sorteos_tenant_id_id UNIQUE (tenant_id, id);
ALTER TABLE public.turnos ADD CONSTRAINT uq_turnos_tenant_id_id UNIQUE (tenant_id, id);
ALTER TABLE public.ventas ADD CONSTRAINT uq_ventas_tenant_id_id UNIQUE (tenant_id, id);
ALTER TABLE public.resultados ADD CONSTRAINT uq_resultados_tenant_id_id UNIQUE (tenant_id, id);

ALTER TABLE public.parametros DROP CONSTRAINT IF EXISTS parametros_pkey;
ALTER TABLE public.parametros ADD CONSTRAINT parametros_pkey PRIMARY KEY (tenant_id, clave);

DROP INDEX IF EXISTS public.uq_bloq_num_diario;
DROP INDEX IF EXISTS public.uq_bloq_num_turno;
CREATE UNIQUE INDEX uq_bloq_tenant_num_diario
  ON public.numeros_bloqueados (tenant_id, numero, fecha) WHERE turno_id IS NULL;
CREATE UNIQUE INDEX uq_bloq_tenant_num_turno
  ON public.numeros_bloqueados (tenant_id, numero, turno_id) WHERE turno_id IS NOT NULL;

DROP INDEX IF EXISTS public.uq_notificaciones_dedup_key;
CREATE UNIQUE INDEX uq_notificaciones_tenant_dedup
  ON public.notificaciones (tenant_id, dedup_key) WHERE dedup_key IS NOT NULL;

ALTER TABLE public.limites_numero DROP CONSTRAINT IF EXISTS ex_limites_numero_no_overlap;
DROP INDEX IF EXISTS public.uq_limites_numero_global_activo;
CREATE UNIQUE INDEX uq_limites_numero_global_activo
  ON public.limites_numero (tenant_id, numero, COALESCE(config_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE vendedor_id IS NULL AND vigente_hasta IS NULL;
ALTER TABLE public.limites_numero ADD CONSTRAINT ex_limites_numero_no_overlap
  EXCLUDE USING gist (
    tenant_id WITH =,
    COALESCE(vendedor_id, '00000000-0000-0000-0000-000000000000'::uuid) WITH =,
    COALESCE(config_id, '00000000-0000-0000-0000-000000000000'::uuid) WITH =,
    numero WITH =,
    daterange(vigente_desde, COALESCE(vigente_hasta, 'infinity'::date), '[]') WITH &&
  );

-- Composite foreign keys are the final guard against cross-tenant references.
ALTER TABLE public.vendedores ADD CONSTRAINT fk_vendedores_membresia_tenant
  FOREIGN KEY (tenant_id, membresia_id) REFERENCES public.membresias_tenant(tenant_id, id);
ALTER TABLE public.codigos_acceso_vendedor ADD CONSTRAINT fk_codigos_vendedor_tenant
  FOREIGN KEY (tenant_id, vendedor_id) REFERENCES public.vendedores(tenant_id, id) ON DELETE CASCADE;
ALTER TABLE public.codigos_acceso_vendedor ADD CONSTRAINT fk_codigos_actor_tenant
  FOREIGN KEY (tenant_id, creado_por_membresia_id) REFERENCES public.membresias_tenant(tenant_id, id);
ALTER TABLE public.turnos ADD CONSTRAINT fk_turnos_config_tenant
  FOREIGN KEY (tenant_id, config_id) REFERENCES public.sorteos_config(tenant_id, id);
ALTER TABLE public.ventas ADD CONSTRAINT fk_ventas_vendedor_tenant
  FOREIGN KEY (tenant_id, vendedor_id) REFERENCES public.vendedores(tenant_id, id);
ALTER TABLE public.ventas ADD CONSTRAINT fk_ventas_turno_tenant
  FOREIGN KEY (tenant_id, turno_id) REFERENCES public.turnos(tenant_id, id);
ALTER TABLE public.ventas ADD CONSTRAINT fk_ventas_actor_tenant
  FOREIGN KEY (tenant_id, anulada_por_membresia_id) REFERENCES public.membresias_tenant(tenant_id, id);
ALTER TABLE public.venta_detalle ADD CONSTRAINT fk_detalle_venta_tenant
  FOREIGN KEY (tenant_id, venta_id) REFERENCES public.ventas(tenant_id, id) ON DELETE CASCADE;
ALTER TABLE public.numeros_bloqueados ADD CONSTRAINT fk_bloqueos_turno_tenant
  FOREIGN KEY (tenant_id, turno_id) REFERENCES public.turnos(tenant_id, id) ON DELETE CASCADE;
ALTER TABLE public.numeros_bloqueados ADD CONSTRAINT fk_bloqueos_actor_tenant
  FOREIGN KEY (tenant_id, creado_por_membresia_id) REFERENCES public.membresias_tenant(tenant_id, id);
ALTER TABLE public.resultados ADD CONSTRAINT fk_resultados_turno_tenant
  FOREIGN KEY (tenant_id, turno_id) REFERENCES public.turnos(tenant_id, id) ON DELETE CASCADE;
ALTER TABLE public.resultados ADD CONSTRAINT fk_resultados_actor_tenant
  FOREIGN KEY (tenant_id, creado_por_membresia_id) REFERENCES public.membresias_tenant(tenant_id, id);
ALTER TABLE public.pagos_premios ADD CONSTRAINT fk_pagos_venta_tenant
  FOREIGN KEY (tenant_id, venta_id) REFERENCES public.ventas(tenant_id, id);
ALTER TABLE public.pagos_premios ADD CONSTRAINT fk_pagos_resultado_tenant
  FOREIGN KEY (tenant_id, resultado_id) REFERENCES public.resultados(tenant_id, id);
ALTER TABLE public.pagos_premios ADD CONSTRAINT fk_pagos_actor_tenant
  FOREIGN KEY (tenant_id, pagado_por_membresia_id) REFERENCES public.membresias_tenant(tenant_id, id);
ALTER TABLE public.cortes ADD CONSTRAINT fk_cortes_actor_tenant
  FOREIGN KEY (tenant_id, creado_por_membresia_id) REFERENCES public.membresias_tenant(tenant_id, id);
ALTER TABLE public.auditoria_eventos ADD CONSTRAINT fk_auditoria_membresia_tenant
  FOREIGN KEY (tenant_id, membresia_id) REFERENCES public.membresias_tenant(tenant_id, id);
ALTER TABLE public.notificaciones ADD CONSTRAINT fk_notificaciones_membresia_tenant
  FOREIGN KEY (tenant_id, membresia_id) REFERENCES public.membresias_tenant(tenant_id, id);
ALTER TABLE public.limites_numero ADD CONSTRAINT fk_limites_vendedor_tenant
  FOREIGN KEY (tenant_id, vendedor_id) REFERENCES public.vendedores(tenant_id, id);
ALTER TABLE public.limites_numero ADD CONSTRAINT fk_limites_config_tenant
  FOREIGN KEY (tenant_id, config_id) REFERENCES public.sorteos_config(tenant_id, id);

-- Provider-neutral SaaS billing control plane. Only tokens and provider identifiers
-- are stored; raw card data, PAN and CVV must never enter this database.
CREATE TABLE public.billing_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  nombre text NOT NULL,
  descripcion text,
  limites jsonb NOT NULL DEFAULT '{}'::jsonb,
  caracteristicas jsonb NOT NULL DEFAULT '{}'::jsonb,
  activo boolean NOT NULL DEFAULT true,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_billing_plans_codigo CHECK (codigo ~ '^[A-Z][A-Z0-9_]*$'),
  CONSTRAINT ck_billing_plans_json CHECK (
    jsonb_typeof(limites) = 'object' AND jsonb_typeof(caracteristicas) = 'object'
  )
);

INSERT INTO public.billing_plans (codigo, nombre, descripcion, limites, caracteristicas)
VALUES
  ('STARTER', 'Starter', 'Operación esencial para una empresa pequeña',
   '{"vendedores":5,"usuarios":8}'::jsonb, '{"reportes":true,"auditoria":true}'::jsonb),
  ('BUSINESS', 'Business', 'Operación completa para equipos en crecimiento',
   '{"vendedores":25,"usuarios":40}'::jsonb, '{"reportes":true,"auditoria":true,"api":true}'::jsonb),
  ('ENTERPRISE', 'Enterprise', 'Límites y condiciones comerciales personalizadas',
   '{}'::jsonb, '{"reportes":true,"auditoria":true,"api":true,"soporte_prioritario":true}'::jsonb);

CREATE TABLE public.billing_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.billing_plans(id),
  proveedor text NOT NULL,
  proveedor_price_id text,
  moneda char(3) NOT NULL,
  monto_minor bigint NOT NULL,
  intervalo public.intervalo_facturacion NOT NULL DEFAULT 'MENSUAL',
  activo boolean NOT NULL DEFAULT true,
  creado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_billing_prices_monto CHECK (monto_minor >= 0),
  CONSTRAINT ck_billing_prices_moneda CHECK (moneda ~ '^[A-Z]{3}$'),
  CONSTRAINT uq_billing_prices_provider UNIQUE NULLS NOT DISTINCT (proveedor, proveedor_price_id),
  CONSTRAINT uq_billing_prices_plan_currency_interval UNIQUE (plan_id, moneda, intervalo)
);

CREATE TABLE public.tenant_billing_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  proveedor text NOT NULL,
  proveedor_customer_id text,
  email_facturacion text,
  razon_social text,
  identificacion_fiscal text,
  datos_fiscales jsonb NOT NULL DEFAULT '{}'::jsonb,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_billing_accounts_provider_customer UNIQUE NULLS NOT DISTINCT (proveedor, proveedor_customer_id),
  CONSTRAINT uq_billing_accounts_tenant_id_id UNIQUE (tenant_id, id),
  CONSTRAINT ck_billing_accounts_datos CHECK (jsonb_typeof(datos_fiscales) = 'object')
);

CREATE TABLE public.tenant_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  billing_account_id uuid NOT NULL REFERENCES public.tenant_billing_accounts(id) ON DELETE CASCADE,
  price_id uuid NOT NULL REFERENCES public.billing_prices(id),
  proveedor text NOT NULL,
  proveedor_subscription_id text,
  estado public.suscripcion_estado NOT NULL DEFAULT 'INCOMPLETA',
  periodo_inicia_en timestamptz,
  periodo_termina_en timestamptz,
  prueba_termina_en timestamptz,
  cancelar_al_final boolean NOT NULL DEFAULT false,
  cancelada_en timestamptz,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_subscriptions_tenant_id_id UNIQUE (tenant_id, id),
  CONSTRAINT fk_subscriptions_account_tenant FOREIGN KEY (tenant_id, billing_account_id)
    REFERENCES public.tenant_billing_accounts(tenant_id, id),
  CONSTRAINT uq_subscriptions_provider UNIQUE NULLS NOT DISTINCT (proveedor, proveedor_subscription_id),
  CONSTRAINT ck_subscriptions_periodo CHECK (
    periodo_termina_en IS NULL OR periodo_inicia_en IS NULL OR periodo_termina_en > periodo_inicia_en
  )
);
CREATE UNIQUE INDEX uq_tenant_subscription_vigente
  ON public.tenant_subscriptions (tenant_id)
  WHERE estado IN ('INCOMPLETA', 'PRUEBA', 'ACTIVA', 'MOROSA', 'PAUSADA');
CREATE INDEX ix_subscriptions_estado_periodo ON public.tenant_subscriptions (estado, periodo_termina_en);

CREATE TABLE public.billing_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  subscription_id uuid,
  proveedor text NOT NULL,
  proveedor_invoice_id text,
  estado public.factura_estado NOT NULL DEFAULT 'BORRADOR',
  moneda char(3) NOT NULL,
  subtotal_minor bigint NOT NULL DEFAULT 0,
  impuesto_minor bigint NOT NULL DEFAULT 0,
  total_minor bigint NOT NULL DEFAULT 0,
  vencimiento_en timestamptz,
  pagada_en timestamptz,
  url_factura text,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_invoices_subscription FOREIGN KEY (tenant_id, subscription_id)
    REFERENCES public.tenant_subscriptions(tenant_id, id),
  CONSTRAINT uq_invoices_provider UNIQUE NULLS NOT DISTINCT (proveedor, proveedor_invoice_id),
  CONSTRAINT ck_invoices_amounts CHECK (
    subtotal_minor >= 0 AND impuesto_minor >= 0 AND total_minor >= 0
    AND total_minor = subtotal_minor + impuesto_minor
  )
);
CREATE INDEX ix_invoices_tenant_created ON public.billing_invoices (tenant_id, creado_en DESC);

CREATE TABLE public.billing_payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  billing_account_id uuid NOT NULL REFERENCES public.tenant_billing_accounts(id) ON DELETE CASCADE,
  proveedor text NOT NULL,
  proveedor_payment_method_id text NOT NULL,
  tipo text NOT NULL,
  marca text,
  ultimos4 char(4),
  exp_mes smallint,
  exp_anio smallint,
  predeterminado boolean NOT NULL DEFAULT false,
  creado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_payment_methods_provider UNIQUE (proveedor, proveedor_payment_method_id),
  CONSTRAINT fk_payment_methods_account_tenant FOREIGN KEY (tenant_id, billing_account_id)
    REFERENCES public.tenant_billing_accounts(tenant_id, id),
  CONSTRAINT ck_payment_methods_last4 CHECK (ultimos4 IS NULL OR ultimos4 ~ '^[0-9]{4}$'),
  CONSTRAINT ck_payment_methods_exp CHECK (exp_mes IS NULL OR exp_mes BETWEEN 1 AND 12)
);
CREATE UNIQUE INDEX uq_payment_method_default
  ON public.billing_payment_methods (tenant_id) WHERE predeterminado;

CREATE TABLE public.billing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  proveedor text NOT NULL,
  proveedor_event_id text NOT NULL,
  tipo text NOT NULL,
  payload_hash char(64) NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  recibido_en timestamptz NOT NULL DEFAULT now(),
  procesado_en timestamptz,
  error text,
  intentos integer NOT NULL DEFAULT 0,
  CONSTRAINT uq_billing_events_provider UNIQUE (proveedor, proveedor_event_id),
  CONSTRAINT ck_billing_events_payload CHECK (jsonb_typeof(payload) = 'object'),
  CONSTRAINT ck_billing_events_intentos CHECK (intentos >= 0)
);
CREATE INDEX ix_billing_events_pending ON public.billing_events (recibido_en) WHERE procesado_en IS NULL;

CREATE TABLE public.tenant_onboarding_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  price_id uuid NOT NULL REFERENCES public.billing_prices(id),
  proveedor text NOT NULL,
  proveedor_session_id text NOT NULL,
  estado text NOT NULL DEFAULT 'PENDIENTE',
  expira_en timestamptz NOT NULL,
  completada_en timestamptz,
  creado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_onboarding_provider_session UNIQUE (proveedor, proveedor_session_id),
  CONSTRAINT ck_onboarding_estado CHECK (estado IN ('PENDIENTE','COMPLETADA','EXPIRADA','CANCELADA')),
  CONSTRAINT ck_onboarding_expira CHECK (expira_en > creado_en)
);

CREATE TABLE public.idempotency_keys (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  scope text NOT NULL,
  idempotency_key text NOT NULL,
  request_hash char(64) NOT NULL,
  response_status integer,
  response_body jsonb,
  bloqueada_hasta timestamptz,
  expira_en timestamptz NOT NULL,
  creado_en timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, scope, idempotency_key),
  CONSTRAINT ck_idempotency_expira CHECK (expira_en > creado_en)
);
CREATE INDEX ix_idempotency_expira ON public.idempotency_keys (expira_en);

CREATE TABLE public.outbox_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  aggregate_type text NOT NULL,
  aggregate_id uuid,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  estado public.evento_outbox_estado NOT NULL DEFAULT 'PENDIENTE',
  intentos integer NOT NULL DEFAULT 0,
  disponible_en timestamptz NOT NULL DEFAULT now(),
  bloqueado_en timestamptz,
  publicado_en timestamptz,
  ultimo_error text,
  creado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_outbox_payload CHECK (jsonb_typeof(payload) = 'object'),
  CONSTRAINT ck_outbox_intentos CHECK (intentos >= 0)
);
CREATE INDEX ix_outbox_dispatch
  ON public.outbox_events (estado, disponible_en, creado_en) WHERE estado IN ('PENDIENTE','FALLIDO');

CREATE OR REPLACE FUNCTION app_private.set_request_context(
  p_auth_user_id uuid,
  p_tenant_id uuid,
  p_profile_id uuid,
  p_membership_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.usuarios u
    JOIN public.membresias_tenant m ON m.perfil_id = u.id
    JOIN public.tenants t ON t.id = m.tenant_id
    WHERE u.id = p_profile_id
      AND u.auth_user_id = p_auth_user_id
      AND u.activo AND u.eliminado_en IS NULL
      AND m.id = p_membership_id AND m.tenant_id = p_tenant_id
      AND m.estado = 'ACTIVO' AND m.eliminado_en IS NULL
      AND t.estado IN ('PRUEBA', 'ACTIVO', 'MOROSO') AND t.eliminado_en IS NULL
  ) THEN
    RAISE EXCEPTION 'invalid or inactive tenant context' USING ERRCODE = '42501';
  END IF;

  PERFORM set_config('app.current_auth_user_id', p_auth_user_id::text, true);
  PERFORM set_config('app.current_tenant_id', p_tenant_id::text, true);
  PERFORM set_config('app.current_profile_id', p_profile_id::text, true);
  PERFORM set_config('app.current_membership_id', p_membership_id::text, true);
END;
$$;

ALTER FUNCTION app_private.set_request_context(uuid, uuid, uuid, uuid) OWNER TO postgres;

CREATE OR REPLACE FUNCTION app_private.trg_tenant_id_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
    RAISE EXCEPTION 'tenant_id is immutable on %.%', TG_TABLE_SCHEMA, TG_TABLE_NAME
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION app_private.trg_protect_last_owner()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF OLD.es_propietario AND OLD.estado = 'ACTIVO' AND OLD.eliminado_en IS NULL
     AND (TG_OP = 'DELETE' OR NOT NEW.es_propietario OR NEW.estado <> 'ACTIVO' OR NEW.eliminado_en IS NOT NULL)
     AND NOT EXISTS (
       SELECT 1 FROM public.membresias_tenant m
       WHERE m.tenant_id = OLD.tenant_id AND m.id <> OLD.id
         AND m.es_propietario AND m.estado = 'ACTIVO' AND m.eliminado_en IS NULL
     ) THEN
    RAISE EXCEPTION 'a tenant must keep at least one active owner' USING ERRCODE = '23514';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER membresias_protect_last_owner
BEFORE UPDATE OR DELETE ON public.membresias_tenant
FOR EACH ROW EXECUTE FUNCTION app_private.trg_protect_last_owner();

CREATE OR REPLACE FUNCTION app_private.trg_audit_append_only()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  IF current_setting('app.allow_audit_mutation', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'audit events are append-only' USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER auditoria_append_only
BEFORE UPDATE OR DELETE ON public.auditoria_eventos
FOR EACH ROW EXECUTE FUNCTION app_private.trg_audit_append_only();

-- Ensure common update timestamps are maintained in the database.
DO $touch$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'tenants','membresias_tenant','billing_plans','tenant_billing_accounts',
    'tenant_subscriptions','billing_invoices'
  ]
  LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.fn_touch_actualizado_en()',
                   v_table || '_bu_touch', v_table);
  END LOOP;
END
$touch$;

-- Tenant IDs are immutable after creation on every tenant-owned record.
DO $immutable$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'roles','permisos_por_rol','membresias_tenant','tenant_domains','tenant_invitations',
    'vendedores','codigos_acceso_vendedor','sorteos_config','turnos','ventas','venta_detalle',
    'numeros_bloqueados','resultados','pagos_premios','parametros','cortes','auditoria_eventos',
    'notificaciones','limites_numero','tenant_billing_accounts','tenant_subscriptions',
    'billing_invoices','billing_payment_methods','idempotency_keys','outbox_events'
  ]
  LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION app_private.trg_tenant_id_immutable()',
                   v_table || '_tenant_immutable', v_table);
  END LOOP;
END
$immutable$;

-- Tenant-aware business programmability. The legacy overloads remain present only
-- for migration compatibility and are not executable by application/Data API roles.
CREATE OR REPLACE FUNCTION public.fn_limite_numero_aplicable(
  p_tenant uuid,
  p_vendedor uuid,
  p_numero text,
  p_config uuid,
  p_fecha date
)
RETURNS TABLE(id uuid, limite_miles numeric, vendedor_id uuid, config_id uuid)
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT l.id, l.limite_miles, l.vendedor_id, l.config_id
  FROM public.limites_numero l
  WHERE l.tenant_id = p_tenant
    AND l.numero = public.fn_num2(p_numero)
    AND (l.vendedor_id = p_vendedor OR l.vendedor_id IS NULL)
    AND (l.config_id = p_config OR l.config_id IS NULL)
    AND l.vigente_desde <= p_fecha
    AND (l.vigente_hasta IS NULL OR l.vigente_hasta >= p_fecha)
  ORDER BY
    (l.config_id IS NULL),
    (l.vendedor_id IS NULL),
    l.vigente_hasta NULLS FIRST
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.fn_turno_actual(
  p_tenant uuid,
  at_time timestamptz DEFAULT now()
)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_timezone text;
  v_fecha date;
  v_hora time;
  v_turno uuid;
BEGIN
  SELECT zona_horaria INTO v_timezone
  FROM public.tenants WHERE id = p_tenant AND eliminado_en IS NULL;
  IF v_timezone IS NULL THEN
    RAISE EXCEPTION 'Tenant no existe' USING ERRCODE = '22023';
  END IF;

  v_fecha := (at_time AT TIME ZONE v_timezone)::date;
  v_hora := (at_time AT TIME ZONE v_timezone)::time;

  SELECT t.id INTO v_turno
  FROM public.turnos t
  JOIN public.sorteos_config c ON c.tenant_id = t.tenant_id AND c.id = t.config_id
  WHERE t.tenant_id = p_tenant
    AND t.fecha = v_fecha AND t.estado = 'ABIERTO' AND c.activo
    AND (NOT c.solo_martes OR extract(dow FROM v_fecha) = 2)
    AND v_hora <= (c.hora - make_interval(secs => c.lock_segundos_antes))
  ORDER BY c.hora
  LIMIT 1;

  IF v_turno IS NULL THEN
    RAISE EXCEPTION 'Fuera de ventana de venta para %', v_fecha USING ERRCODE = '45000';
  END IF;
  RETURN v_turno;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_ventas_set_turno()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_vendor_tenant uuid;
BEGIN
  SELECT tenant_id INTO v_vendor_tenant FROM public.vendedores WHERE id = NEW.vendedor_id;
  IF v_vendor_tenant IS NULL THEN
    RAISE EXCEPTION 'Vendedor no existe' USING ERRCODE = '23503';
  END IF;

  NEW.tenant_id := COALESCE(NEW.tenant_id, v_vendor_tenant);
  IF NEW.tenant_id <> v_vendor_tenant THEN
    RAISE EXCEPTION 'El vendedor pertenece a otro tenant' USING ERRCODE = '23514';
  END IF;

  IF NEW.turno_id IS NULL THEN
    NEW.turno_id := public.fn_turno_actual(NEW.tenant_id, NEW.creado_en);
  ELSIF NOT EXISTS (
    SELECT 1 FROM public.turnos t WHERE t.id = NEW.turno_id AND t.tenant_id = NEW.tenant_id
  ) THEN
    RAISE EXCEPTION 'El turno pertenece a otro tenant' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_ventas_total()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_venta uuid := COALESCE(NEW.venta_id, OLD.venta_id);
  v_tenant uuid := COALESCE(NEW.tenant_id, OLD.tenant_id);
BEGIN
  UPDATE public.ventas v
  SET total_miles = (
    SELECT COALESCE(sum(d.premio_miles), 0::numeric)
    FROM public.venta_detalle d
    WHERE d.tenant_id = v_tenant AND d.venta_id = v_venta
  )
  WHERE v.tenant_id = v_tenant AND v.id = v_venta;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_detalle_validar()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant uuid;
  v_vendedor uuid;
  v_turno uuid;
  v_config uuid;
  v_num char(2) := public.fn_num2(NEW.numero::text);
  v_fecha date;
  v_acumulado numeric(14,2);
  v_limite_id uuid;
  v_limite numeric(14,2);
BEGIN
  SELECT v.tenant_id, v.vendedor_id, v.turno_id
    INTO v_tenant, v_vendedor, v_turno
  FROM public.ventas v WHERE v.id = NEW.venta_id;

  IF v_tenant IS NULL OR v_vendedor IS NULL OR v_turno IS NULL THEN
    RAISE EXCEPTION 'Venta % no existe o no tiene turno', NEW.venta_id USING ERRCODE = '45000';
  END IF;
  NEW.tenant_id := COALESCE(NEW.tenant_id, v_tenant);
  IF NEW.tenant_id <> v_tenant THEN
    RAISE EXCEPTION 'El detalle pertenece a otro tenant' USING ERRCODE = '23514';
  END IF;

  SELECT t.fecha, t.config_id INTO v_fecha, v_config
  FROM public.turnos t WHERE t.tenant_id = v_tenant AND t.id = v_turno;

  -- Serializes concurrent attempts for the same tenant/draw/number and closes the
  -- read-sum-write race that could otherwise exceed a configured number limit.
  PERFORM pg_advisory_xact_lock(hashtextextended(
    v_tenant::text || ':' || v_turno::text || ':' || v_num::text, 0
  ));

  IF EXISTS (
    SELECT 1 FROM public.numeros_bloqueados b
    WHERE b.tenant_id = v_tenant AND b.numero = v_num
      AND ((b.turno_id IS NOT NULL AND b.turno_id = v_turno)
        OR (b.turno_id IS NULL AND b.fecha = v_fecha))
  ) THEN
    RAISE EXCEPTION 'Numero % bloqueado para %', v_num, v_fecha USING ERRCODE = '45000';
  END IF;

  SELECT l.id, l.limite_miles INTO v_limite_id, v_limite
  FROM public.fn_limite_numero_aplicable(v_tenant, v_vendedor, v_num::text, v_config, v_fecha) l;

  IF v_limite IS NOT NULL THEN
    SELECT COALESCE(sum(d.premio_miles), 0::numeric) INTO v_acumulado
    FROM public.venta_detalle d
    JOIN public.ventas v ON v.tenant_id = d.tenant_id AND v.id = d.venta_id
    JOIN public.turnos t ON t.tenant_id = v.tenant_id AND t.id = v.turno_id
    JOIN LATERAL public.fn_limite_numero_aplicable(
      v.tenant_id, v.vendedor_id, d.numero::text, t.config_id, t.fecha
    ) l ON l.id = v_limite_id
    WHERE d.tenant_id = v_tenant AND d.numero = v_num
      AND v.estado = 'ACTIVA' AND t.fecha = v_fecha
      AND (TG_OP = 'INSERT' OR d.id <> NEW.id);

    IF v_acumulado + NEW.premio_miles > v_limite THEN
      RAISE EXCEPTION 'Limite alcanzado para numero % (limite=%, acumulado=%)',
        v_num, v_limite, v_acumulado USING ERRCODE = '45000';
    END IF;
  END IF;

  NEW.numero := v_num;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sp_crear_venta(p_tenant uuid, p_vendedor uuid, p_items jsonb)
RETURNS TABLE(venta_id uuid, total_miles numeric)
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
  v_item jsonb;
  v_amount numeric;
BEGIN
  IF p_tenant IS NULL OR p_items IS NULL OR jsonb_typeof(p_items) <> 'array'
     OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Tenant y al menos un item son requeridos' USING ERRCODE = '22023';
  END IF;
  IF app_private.current_tenant_id() IS DISTINCT FROM p_tenant AND current_user = 'multilot_app' THEN
    RAISE EXCEPTION 'Tenant fuera del contexto actual' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.ventas(tenant_id, vendedor_id) VALUES (p_tenant, p_vendedor) RETURNING id INTO v_id;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    v_amount := (v_item->>'premio_miles')::numeric;
    IF v_amount <= 0 OR v_amount <> round(v_amount, 2) THEN
      RAISE EXCEPTION 'Monto invalido' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.venta_detalle(tenant_id, venta_id, numero, premio_miles)
    VALUES (p_tenant, v_id, v_item->>'numero', v_amount);
  END LOOP;
  RETURN QUERY SELECT v_id, v.total_miles FROM public.ventas v
    WHERE v.tenant_id = p_tenant AND v.id = v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.sp_generar_turnos(p_tenant uuid, p_desde date, p_hasta date)
RETURNS integer
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_fecha date;
  v_cfg record;
  v_created integer := 0;
  v_rows integer;
BEGIN
  IF p_tenant IS NULL OR p_desde IS NULL OR p_hasta IS NULL OR p_hasta < p_desde
     OR p_hasta - p_desde > 366 THEN
    RAISE EXCEPTION 'Rango de fechas invalido' USING ERRCODE = '22023';
  END IF;
  FOR v_fecha IN SELECT generate_series(p_desde, p_hasta, interval '1 day')::date LOOP
    FOR v_cfg IN SELECT * FROM public.sorteos_config WHERE tenant_id = p_tenant AND activo LOOP
      CONTINUE WHEN v_cfg.solo_martes AND extract(dow FROM v_fecha) <> 2;
      INSERT INTO public.turnos(tenant_id, fecha, config_id)
      VALUES (p_tenant, v_fecha, v_cfg.id) ON CONFLICT (fecha, config_id) DO NOTHING;
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      v_created := v_created + v_rows;
    END LOOP;
  END LOOP;
  RETURN v_created;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_matriz_por_turno(p_tenant uuid, p_fecha date, p_codigo text)
RETURNS TABLE(numero char(2), premio_miles numeric)
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  WITH nums AS (
    SELECT lpad(n::text, 2, '0')::char(2) n FROM generate_series(0,99) g(n)
  ), selected_turno AS (
    SELECT t.id FROM public.turnos t JOIN public.sorteos_config c
      ON c.tenant_id = t.tenant_id AND c.id = t.config_id
    WHERE t.tenant_id = p_tenant AND t.fecha = p_fecha AND c.codigo = p_codigo
  ), sums AS (
    SELECT d.numero, sum(d.premio_miles) amount
    FROM public.ventas v JOIN public.venta_detalle d
      ON d.tenant_id = v.tenant_id AND d.venta_id = v.id
    JOIN selected_turno t ON t.id = v.turno_id
    WHERE v.tenant_id = p_tenant AND v.estado = 'ACTIVA' GROUP BY d.numero
  )
  SELECT nums.n, COALESCE(sums.amount, 0::numeric)
  FROM nums LEFT JOIN sums ON sums.numero = nums.n ORDER BY 1
$$;

CREATE OR REPLACE FUNCTION public.fn_matriz_por_turno_vendedor(
  p_tenant uuid, p_fecha date, p_codigo text, p_vendedor uuid
)
RETURNS TABLE(numero char(2), premio_miles numeric)
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  WITH nums AS (
    SELECT lpad(n::text, 2, '0')::char(2) n FROM generate_series(0,99) g(n)
  ), selected_turno AS (
    SELECT t.id FROM public.turnos t JOIN public.sorteos_config c
      ON c.tenant_id = t.tenant_id AND c.id = t.config_id
    WHERE t.tenant_id = p_tenant AND t.fecha = p_fecha AND c.codigo = p_codigo
  ), sums AS (
    SELECT d.numero, sum(d.premio_miles) amount
    FROM public.ventas v JOIN public.venta_detalle d
      ON d.tenant_id = v.tenant_id AND d.venta_id = v.id
    JOIN selected_turno t ON t.id = v.turno_id
    WHERE v.tenant_id = p_tenant AND v.vendedor_id = p_vendedor AND v.estado = 'ACTIVA'
    GROUP BY d.numero
  )
  SELECT nums.n, COALESCE(sums.amount, 0::numeric)
  FROM nums LEFT JOIN sums ON sums.numero = nums.n ORDER BY 1
$$;

CREATE OR REPLACE FUNCTION public.fn_premios_por_resultado(p_tenant uuid, p_resultado uuid)
RETURNS TABLE(venta_id uuid, vendedor_id uuid, total_ganador_miles numeric)
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT v.id, v.vendedor_id, sum(d.premio_miles)
  FROM public.resultados r
  JOIN public.ventas v ON v.tenant_id = r.tenant_id AND v.turno_id = r.turno_id AND v.estado = 'ACTIVA'
  JOIN public.venta_detalle d ON d.tenant_id = v.tenant_id AND d.venta_id = v.id
    AND d.numero = r.numero_ganador
  WHERE r.tenant_id = p_tenant AND r.id = p_resultado
  GROUP BY v.id, v.vendedor_id ORDER BY min(v.creado_en)
$$;

CREATE OR REPLACE FUNCTION public.sp_anular_venta(
  p_tenant uuid, p_venta uuid, p_membresia uuid, p_motivo text
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_estado public.venta_estado;
  v_cutoff timestamp;
  v_now timestamp;
  v_timezone text;
  v_profile uuid;
BEGIN
  IF p_motivo IS NULL OR btrim(p_motivo) = '' THEN
    RAISE EXCEPTION 'Motivo de anulacion requerido' USING ERRCODE = '22023';
  END IF;
  SELECT m.perfil_id INTO v_profile FROM public.membresias_tenant m
  WHERE m.tenant_id = p_tenant AND m.id = p_membresia AND m.estado = 'ACTIVO';
  IF v_profile IS NULL THEN RAISE EXCEPTION 'Membresia invalida' USING ERRCODE = '42501'; END IF;

  SELECT ven.estado, ((tur.fecha + cfg.hora) - make_interval(secs => cfg.lock_segundos_antes)), ten.zona_horaria
    INTO v_estado, v_cutoff, v_timezone
  FROM public.ventas ven JOIN public.turnos tur ON tur.tenant_id = ven.tenant_id AND tur.id = ven.turno_id
  JOIN public.sorteos_config cfg ON cfg.tenant_id = tur.tenant_id AND cfg.id = tur.config_id
  JOIN public.tenants ten ON ten.id = ven.tenant_id
  WHERE ven.tenant_id = p_tenant AND ven.id = p_venta FOR UPDATE OF ven;
  IF NOT FOUND THEN RAISE EXCEPTION 'Venta no existe' USING ERRCODE = '45000'; END IF;
  IF v_estado <> 'ACTIVA' THEN RAISE EXCEPTION 'La venta no esta activa' USING ERRCODE = '45000'; END IF;
  v_now := now() AT TIME ZONE v_timezone;
  IF v_now >= v_cutoff THEN
    RAISE EXCEPTION 'No se puede anular: sorteo finalizado o bloqueado' USING ERRCODE = '45000';
  END IF;
  UPDATE public.ventas SET estado = 'ANULADA', anulada_por = v_profile,
    anulada_por_membresia_id = p_membresia, anulada_en = now(), motivo_anulacion = btrim(p_motivo)
  WHERE tenant_id = p_tenant AND id = p_venta;
END;
$$;

CREATE OR REPLACE FUNCTION public.sp_set_limites_vendor_todos(
  p_tenant uuid,
  p_vendedor uuid,
  p_limite_miles numeric,
  p_desde date,
  p_hasta date DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_n integer;
  v_rows integer;
  v_total integer := 0;
  v_num char(2);
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.vendedores WHERE tenant_id = p_tenant AND id = p_vendedor) THEN
    RAISE EXCEPTION 'Vendedor no existe en tenant' USING ERRCODE = '23503';
  END IF;
  IF p_limite_miles IS NULL OR p_limite_miles < 0 OR p_limite_miles <> round(p_limite_miles, 2)
     OR p_desde IS NULL OR (p_hasta IS NOT NULL AND p_hasta < p_desde) THEN
    RAISE EXCEPTION 'Limite o vigencia invalida' USING ERRCODE = '22023';
  END IF;
  FOR v_n IN 0..99 LOOP
    v_num := lpad(v_n::text, 2, '0')::char(2);
    UPDATE public.limites_numero
      SET limite_miles = p_limite_miles, vigente_desde = p_desde, vigente_hasta = p_hasta
    WHERE tenant_id = p_tenant AND vendedor_id = p_vendedor AND config_id IS NULL
      AND numero = v_num AND vigente_hasta IS NULL;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows = 0 THEN
      INSERT INTO public.limites_numero(
        tenant_id, vendedor_id, config_id, numero, limite_miles, vigente_desde, vigente_hasta
      ) VALUES (p_tenant, p_vendedor, NULL, v_num, p_limite_miles, p_desde, p_hasta);
      v_rows := 1;
    END IF;
    v_total := v_total + v_rows;
  END LOOP;
  RETURN v_total;
END;
$$;

-- Remove the public SECURITY DEFINER helper left by the original baseline and put
-- the DDL safety net in a non-exposed schema with a fixed search path.
DROP EVENT TRIGGER IF EXISTS ensure_rls;
DROP FUNCTION IF EXISTS public.rls_auto_enable();

CREATE OR REPLACE FUNCTION app_private.rls_auto_enable()
RETURNS event_trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_cmd record;
BEGIN
  FOR v_cmd IN SELECT * FROM pg_event_trigger_ddl_commands() LOOP
    IF v_cmd.object_type IN ('table', 'partitioned table')
       AND v_cmd.schema_name = 'public'
       AND v_cmd.object_identity IS NOT NULL THEN
      EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', v_cmd.object_identity);
    END IF;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION app_private.rls_auto_enable() FROM PUBLIC, anon, authenticated, service_role;
CREATE EVENT TRIGGER ensure_rls
  ON ddl_command_end WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
  EXECUTE FUNCTION app_private.rls_auto_enable();

-- Lock the public Data API out of application data. The future API runtime uses a
-- dedicated non-bypass role and transaction-local request context instead.
REVOKE ALL ON SCHEMA public FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated, service_role;

GRANT USAGE ON SCHEMA public, app_private TO multilot_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO multilot_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO multilot_app;
REVOKE UPDATE, DELETE ON public.auditoria_eventos FROM multilot_app;
REVOKE INSERT, UPDATE, DELETE ON public.tenants, public.billing_plans, public.billing_prices,
  public.billing_events, public.tenant_onboarding_sessions FROM multilot_app;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA app_private FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION app_private.current_tenant_id() TO multilot_app;
GRANT EXECUTE ON FUNCTION app_private.current_profile_id() TO multilot_app;
GRANT EXECUTE ON FUNCTION app_private.current_membership_id() TO multilot_app;
GRANT EXECUTE ON FUNCTION app_private.current_auth_user_id() TO multilot_app;
GRANT EXECUTE ON FUNCTION app_private.current_or_legacy_tenant_id() TO multilot_app;
GRANT EXECUTE ON FUNCTION app_private.set_request_context(uuid, uuid, uuid, uuid) TO multilot_app;

GRANT EXECUTE ON FUNCTION public.fn_num2(text) TO multilot_app;
GRANT EXECUTE ON FUNCTION public.fn_limite_numero_aplicable(uuid, uuid, text, uuid, date) TO multilot_app;
GRANT EXECUTE ON FUNCTION public.fn_turno_actual(uuid, timestamptz) TO multilot_app;
GRANT EXECUTE ON FUNCTION public.sp_crear_venta(uuid, uuid, jsonb) TO multilot_app;
GRANT EXECUTE ON FUNCTION public.sp_generar_turnos(uuid, date, date) TO multilot_app;
GRANT EXECUTE ON FUNCTION public.sp_set_limites_vendor_todos(uuid, uuid, numeric, date, date) TO multilot_app;
GRANT EXECUTE ON FUNCTION public.sp_anular_venta(uuid, uuid, uuid, text) TO multilot_app;
GRANT EXECUTE ON FUNCTION public.fn_matriz_por_turno(uuid, date, text) TO multilot_app;
GRANT EXECUTE ON FUNCTION public.fn_matriz_por_turno_vendedor(uuid, date, text, uuid) TO multilot_app;
GRANT EXECUTE ON FUNCTION public.fn_premios_por_resultado(uuid, uuid) TO multilot_app;

-- RLS policies use a scalar transaction setting, which keeps the tenant predicate
-- indexable and avoids querying membership tables on every row.
DO $tenant_policies$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'roles','permisos_por_rol','membresias_tenant','tenant_domains','tenant_invitations',
    'vendedores','codigos_acceso_vendedor','sorteos_config','turnos','ventas','venta_detalle',
    'numeros_bloqueados','resultados','pagos_premios','parametros','cortes','auditoria_eventos',
    'notificaciones','limites_numero','tenant_billing_accounts','tenant_subscriptions',
    'billing_invoices','billing_payment_methods','billing_events','idempotency_keys','outbox_events'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON public.%I', v_table);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON public.%I TO multilot_app USING (tenant_id = (SELECT app_private.current_tenant_id())) WITH CHECK (tenant_id = (SELECT app_private.current_tenant_id()))',
      v_table
    );
  END LOOP;
END
$tenant_policies$;

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_read_self ON public.tenants FOR SELECT TO multilot_app
  USING (id = (SELECT app_private.current_tenant_id()));

ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY profile_read_self ON public.usuarios FOR SELECT TO multilot_app
  USING (
    id = (SELECT app_private.current_profile_id())
    OR auth_user_id = (SELECT app_private.current_auth_user_id())
  );
CREATE POLICY profile_update_self ON public.usuarios FOR UPDATE TO multilot_app
  USING (id = (SELECT app_private.current_profile_id()))
  WITH CHECK (id = (SELECT app_private.current_profile_id()));

ALTER TABLE public.modulos ENABLE ROW LEVEL SECURITY;
CREATE POLICY modules_read_catalog ON public.modulos FOR SELECT TO multilot_app USING (true);

ALTER TABLE public.billing_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY plans_read_catalog ON public.billing_plans FOR SELECT TO multilot_app USING (activo);
ALTER TABLE public.billing_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY prices_read_catalog ON public.billing_prices FOR SELECT TO multilot_app USING (activo);

ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
CREATE POLICY platform_admin_read_self ON public.platform_admins FOR SELECT TO multilot_app
  USING (perfil_id = (SELECT app_private.current_profile_id()));

ALTER TABLE public.tenant_onboarding_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY onboarding_read_self ON public.tenant_onboarding_sessions FOR SELECT TO multilot_app
  USING (perfil_id = (SELECT app_private.current_profile_id()));

-- Useful tenant-leading indexes for the dominant RLS and reporting access paths.
CREATE INDEX ix_ventas_tenant_turno_estado ON public.ventas (tenant_id, turno_id, estado);
CREATE INDEX ix_ventas_tenant_vendedor_creado ON public.ventas (tenant_id, vendedor_id, creado_en DESC);
CREATE INDEX ix_detalle_tenant_numero ON public.venta_detalle (tenant_id, numero);
CREATE INDEX ix_turnos_tenant_fecha_estado ON public.turnos (tenant_id, fecha, estado);
CREATE INDEX ix_notificaciones_tenant_membership_created
  ON public.notificaciones (tenant_id, membresia_id, creado_en DESC);
CREATE INDEX ix_auditoria_tenant_created ON public.auditoria_eventos (tenant_id, creado_en DESC);

COMMENT ON SCHEMA app_private IS 'Non-exposed tenant context, RLS and integrity helpers.';
COMMENT ON TABLE public.membresias_tenant IS
  'Tenant-specific identity, role and lifecycle. usuarios is the global person/profile record.';
COMMENT ON TABLE public.billing_payment_methods IS
  'Provider token metadata only. Never store PAN, CVV or raw payment credentials.';
COMMENT ON ROLE multilot_app IS
  'NOLOGIN/NOBYPASSRLS group role for the tenant API runtime; create a separate LOGIN role and SET ROLE per transaction.';
