-- Reference-only, idempotent seed. Never add users or operational data here.

INSERT INTO public.roles (nombre)
VALUES ('ADMIN'), ('VENDEDOR')
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO public.modulos (codigo, descripcion)
VALUES
  ('USUARIOS', 'Gestion de usuarios'),
  ('ROLES', 'Gestion de roles y permisos'),
  ('VENDEDORES', 'Gestion de vendedores'),
  ('SORTEOS', 'Configuracion de sorteos'),
  ('TURNOS', 'Gestion de turnos de sorteo'),
  ('VENTAS', 'Gestion de ventas'),
  ('MATRIZ_VENTAS', 'Matriz administrativa de ventas'),
  ('RESULTADOS', 'Gestion de resultados'),
  ('PAGOS_PREMIOS', 'Gestion de pagos de premios'),
  ('NUMEROS_BLOQUEADOS', 'Gestion de numeros bloqueados'),
  ('LIMITES_NUMERO', 'Gestion de limites por numero'),
  ('CORTES', 'Gestion de cortes'),
  ('PARAMETROS', 'Gestion de parametros del sistema'),
  ('AUDITORIA', 'Consulta de auditoria'),
  ('NOTIFICACIONES', 'Bandeja de notificaciones')
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
  r.id,
  m.id,
  true,
  m.codigo <> 'MATRIZ_VENTAS',
  m.codigo <> 'MATRIZ_VENTAS',
  m.codigo <> 'MATRIZ_VENTAS'
FROM public.roles r
CROSS JOIN public.modulos m
WHERE r.nombre = 'ADMIN'
ON CONFLICT (rol_id, modulo_id) DO UPDATE
SET
  puede_leer = EXCLUDED.puede_leer,
  puede_crear = EXCLUDED.puede_crear,
  puede_actualizar = EXCLUDED.puede_actualizar,
  puede_borrar = EXCLUDED.puede_borrar;

WITH seller_permissions (
  codigo,
  puede_leer,
  puede_crear,
  puede_actualizar,
  puede_borrar
) AS (
  VALUES
    ('VENTAS', true, true, true, false),
    ('TURNOS', true, false, false, false),
    ('NUMEROS_BLOQUEADOS', true, false, false, false),
    ('LIMITES_NUMERO', true, false, false, false),
    ('RESULTADOS', true, false, false, false),
    ('NOTIFICACIONES', true, false, true, false)
)
INSERT INTO public.permisos_por_rol (
  rol_id,
  modulo_id,
  puede_leer,
  puede_crear,
  puede_actualizar,
  puede_borrar
)
SELECT
  r.id,
  m.id,
  p.puede_leer,
  p.puede_crear,
  p.puede_actualizar,
  p.puede_borrar
FROM seller_permissions p
JOIN public.modulos m ON m.codigo = p.codigo
JOIN public.roles r ON r.nombre = 'VENDEDOR'
ON CONFLICT (rol_id, modulo_id) DO UPDATE
SET
  puede_leer = EXCLUDED.puede_leer,
  puede_crear = EXCLUDED.puede_crear,
  puede_actualizar = EXCLUDED.puede_actualizar,
  puede_borrar = EXCLUDED.puede_borrar;

INSERT INTO public.parametros (clave, valor)
VALUES
  ('dias_cambio_ticket', '3'),
  ('pago_por_mil', '700'),
  ('sales.allow_decimal_amounts', 'true'),
  ('sales.void_window_minutes', '10'),
  (
    'notifications.sales_milestone',
    '{"enabled":true,"thresholdMiles":100,"sellerTitle":"Meta de ventas alcanzada","sellerMessage":"Felicidades {{sellerName}}. Has vendido {{totalMiles}} mil en este turno.","adminTitle":"Vendedor alcanzo una meta","adminMessage":"{{sellerName}} alcanzo {{totalMiles}} mil vendidos en el turno {{shiftId}}."}'
  )
ON CONFLICT (clave) DO NOTHING;
