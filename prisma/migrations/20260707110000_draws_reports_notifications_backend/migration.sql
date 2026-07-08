ALTER TABLE public.sorteos_config
  ADD COLUMN IF NOT EXISTS auto_generar_turnos boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS fecha_unica date,
  ADD COLUMN IF NOT EXISTS eliminado_en timestamptz,
  ADD COLUMN IF NOT EXISTS motivo_eliminacion text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_sorteos_config_auto_generation'
  ) THEN
    ALTER TABLE public.sorteos_config
      ADD CONSTRAINT ck_sorteos_config_auto_generation
      CHECK (
        (auto_generar_turnos = true AND fecha_unica IS NULL)
        OR
        (auto_generar_turnos = false AND fecha_unica IS NOT NULL)
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_sorteos_auto_activo
  ON public.sorteos_config(auto_generar_turnos, activo)
  WHERE eliminado_en IS NULL;

CREATE INDEX IF NOT EXISTS ix_sorteos_fecha_unica
  ON public.sorteos_config(fecha_unica)
  WHERE fecha_unica IS NOT NULL AND eliminado_en IS NULL;

COMMENT ON COLUMN public.sorteos_config.auto_generar_turnos IS
  'Indica si la configuracion genera turnos automaticamente para cada fecha operable.';

COMMENT ON COLUMN public.sorteos_config.fecha_unica IS
  'Fecha exclusiva para configuraciones de un solo dia cuando auto_generar_turnos=false.';

COMMENT ON COLUMN public.sorteos_config.eliminado_en IS
  'Marca de baja logica; configuraciones eliminadas logicamente no deben generar ni aceptar turnos.';

UPDATE public.permisos_por_rol
SET puede_borrar = true
WHERE rol_id IN (
  SELECT id FROM public.roles WHERE upper(nombre) IN ('ADMIN', 'VENDEDOR')
)
AND modulo_id = (
  SELECT id FROM public.modulos WHERE codigo = 'NOTIFICACIONES'
);
