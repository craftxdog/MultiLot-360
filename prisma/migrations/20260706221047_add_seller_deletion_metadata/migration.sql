ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS eliminado_en timestamptz,
  ADD COLUMN IF NOT EXISTS motivo_eliminacion text;

ALTER TABLE public.vendedores
  ADD COLUMN IF NOT EXISTS eliminado_en timestamptz,
  ADD COLUMN IF NOT EXISTS motivo_eliminacion text;

CREATE INDEX IF NOT EXISTS ix_usuarios_eliminado_en
  ON public.usuarios(eliminado_en)
  WHERE eliminado_en IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_vendedores_eliminado_en
  ON public.vendedores(eliminado_en)
  WHERE eliminado_en IS NOT NULL;

COMMENT ON COLUMN public.usuarios.eliminado_en IS
  'Marca de eliminacion logica. NULL significa que el usuario no esta eliminado logicamente.';

COMMENT ON COLUMN public.vendedores.eliminado_en IS
  'Marca de eliminacion logica. NULL significa que el vendedor no esta eliminado logicamente.';
