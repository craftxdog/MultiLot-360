BEGIN;

INSERT INTO public.parametros (clave, valor)
VALUES ('sales.void_window_minutes', '10')
ON CONFLICT (clave) DO NOTHING;

COMMIT;
