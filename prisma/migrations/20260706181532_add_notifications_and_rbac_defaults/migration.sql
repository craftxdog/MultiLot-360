CREATE TABLE IF NOT EXISTS public.notificaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL,
  tipo varchar(80) NOT NULL,
  titulo varchar(160) NOT NULL,
  mensaje text NOT NULL,
  datos jsonb,
  dedup_key varchar(220),
  leida_en timestamptz,
  creado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_notificaciones_usuario
    FOREIGN KEY (usuario_id)
    REFERENCES public.usuarios(id)
    ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_notificaciones_dedup_key
  ON public.notificaciones(dedup_key)
  WHERE dedup_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_notificaciones_usuario_creado
  ON public.notificaciones(usuario_id, creado_en DESC);

CREATE INDEX IF NOT EXISTS ix_notificaciones_usuario_leida
  ON public.notificaciones(usuario_id, leida_en, creado_en DESC);

CREATE INDEX IF NOT EXISTS ix_notificaciones_tipo_creado
  ON public.notificaciones(tipo, creado_en DESC);

ALTER TABLE public.notificaciones ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.notificaciones IS
  'Notificaciones persistentes por usuario; el backend controla autorizacion y entrega realtime.';

INSERT INTO public.modulos (codigo, descripcion)
VALUES ('NOTIFICACIONES', 'Bandeja de notificaciones operacionales')
ON CONFLICT (codigo) DO UPDATE
SET descripcion = EXCLUDED.descripcion;

INSERT INTO public.permisos_por_rol (
  rol_id,
  modulo_id,
  puede_leer,
  puede_crear,
  puede_actualizar,
  puede_borrar
)
SELECT
  roles.id,
  modulos.id,
  true,
  true,
  true,
  true
FROM public.roles
JOIN public.modulos ON modulos.codigo = 'NOTIFICACIONES'
WHERE upper(roles.nombre) = 'ADMIN'
ON CONFLICT (rol_id, modulo_id) DO UPDATE
SET puede_leer = true,
    puede_crear = true,
    puede_actualizar = true,
    puede_borrar = true;

INSERT INTO public.permisos_por_rol (
  rol_id,
  modulo_id,
  puede_leer,
  puede_crear,
  puede_actualizar,
  puede_borrar
)
SELECT
  roles.id,
  modulos.id,
  true,
  false,
  modulos.codigo = 'NOTIFICACIONES',
  false
FROM public.roles
JOIN public.modulos
  ON modulos.codigo IN (
    'TURNOS',
    'NUMEROS_BLOQUEADOS',
    'LIMITES_NUMERO',
    'RESULTADOS',
    'NOTIFICACIONES'
  )
WHERE upper(roles.nombre) = 'VENDEDOR'
ON CONFLICT (rol_id, modulo_id) DO UPDATE
SET puede_leer = true,
    puede_actualizar = EXCLUDED.puede_actualizar;

INSERT INTO public.parametros (clave, valor)
VALUES (
  'notifications.sales_milestone',
  '{"enabled":true,"thresholdMiles":100,"sellerTitle":"Meta de ventas alcanzada","sellerMessage":"¡Felicidades {{sellerName}}! Has vendido {{totalMiles}} mil en este turno.","adminTitle":"Vendedor alcanzó una meta","adminMessage":"{{sellerName}} alcanzó {{totalMiles}} mil vendidos en el turno {{shiftId}}."}'
)
ON CONFLICT (clave) DO NOTHING;
