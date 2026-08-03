-- The development database predated the local invitation-token migration.
-- Restore the hashed action token expected by the API; plaintext is never stored.
ALTER TABLE public.codigos_acceso_vendedor
  ADD COLUMN IF NOT EXISTS enlace_token_hash char(64);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.codigos_acceso_vendedor'::regclass
      AND conname = 'uq_codigos_acceso_vendedor_enlace_token_hash'
  ) THEN
    ALTER TABLE public.codigos_acceso_vendedor
      ADD CONSTRAINT uq_codigos_acceso_vendedor_enlace_token_hash UNIQUE (enlace_token_hash);
  END IF;
END
$$;
