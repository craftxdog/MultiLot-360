-- Composite tenant FKs supersede these legacy single-column constraints. Keeping
-- both confuses ORM relation introspection without adding integrity.
ALTER TABLE public.permisos_por_rol DROP CONSTRAINT permisos_por_rol_rol_id_fkey;
ALTER TABLE public.codigos_acceso_vendedor DROP CONSTRAINT codigos_acceso_vendedor_vendedor_id_fkey;
ALTER TABLE public.turnos DROP CONSTRAINT turnos_config_id_fkey;
ALTER TABLE public.ventas DROP CONSTRAINT ventas_turno_id_fkey;
ALTER TABLE public.ventas DROP CONSTRAINT ventas_vendedor_id_fkey;
ALTER TABLE public.venta_detalle DROP CONSTRAINT venta_detalle_venta_id_fkey;
ALTER TABLE public.numeros_bloqueados DROP CONSTRAINT numeros_bloqueados_turno_id_fkey;
ALTER TABLE public.resultados DROP CONSTRAINT resultados_turno_id_fkey;
ALTER TABLE public.pagos_premios DROP CONSTRAINT pagos_premios_resultado_id_fkey;
ALTER TABLE public.pagos_premios DROP CONSTRAINT pagos_premios_venta_id_fkey;
ALTER TABLE public.limites_numero DROP CONSTRAINT limites_numero_config_id_fkey;
ALTER TABLE public.limites_numero DROP CONSTRAINT limites_numero_vendedor_id_fkey;

-- Preserve the cascade semantics that used to be supplied by the legacy FKs.
ALTER TABLE public.pagos_premios DROP CONSTRAINT fk_pagos_venta_tenant;
ALTER TABLE public.pagos_premios ADD CONSTRAINT fk_pagos_venta_tenant
  FOREIGN KEY (tenant_id, venta_id) REFERENCES public.ventas(tenant_id, id) ON DELETE CASCADE;
ALTER TABLE public.limites_numero DROP CONSTRAINT fk_limites_config_tenant;
ALTER TABLE public.limites_numero ADD CONSTRAINT fk_limites_config_tenant
  FOREIGN KEY (tenant_id, config_id) REFERENCES public.sorteos_config(tenant_id, id) ON DELETE CASCADE;
ALTER TABLE public.limites_numero DROP CONSTRAINT fk_limites_vendedor_tenant;
ALTER TABLE public.limites_numero ADD CONSTRAINT fk_limites_vendedor_tenant
  FOREIGN KEY (tenant_id, vendedor_id) REFERENCES public.vendedores(tenant_id, id) ON DELETE CASCADE;
