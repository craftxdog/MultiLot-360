BEGIN;

CREATE EXTENSION IF NOT EXISTS btree_gist;

UPDATE public.modulos
   SET codigo = 'LIMITES_NUMERO',
       descripcion = 'Gestion de limites por numero'
 WHERE codigo = 'LIMITES_VENDEDOR';

DO $$
BEGIN
  IF to_regclass('public.limites_numero') IS NULL
     AND to_regclass('public.limites_numero_vendedor') IS NOT NULL THEN
    ALTER TABLE public.limites_numero_vendedor RENAME TO limites_numero;
  END IF;
END
$$;

ALTER TABLE public.limites_numero
  DROP CONSTRAINT IF EXISTS ex_limites_no_overlap;

DROP INDEX IF EXISTS public.uq_limites_vendedor_numero_activo;
DROP INDEX IF EXISTS public.ix_limites_vendedor_numero;

ALTER TABLE public.limites_numero
  ALTER COLUMN vendedor_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS config_id uuid;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'limites_numero_vendedor_pkey'
      AND conrelid = 'public.limites_numero'::regclass
  ) THEN
    ALTER TABLE public.limites_numero
      RENAME CONSTRAINT limites_numero_vendedor_pkey TO limites_numero_pkey;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'limites_numero_vendedor_vendedor_id_fkey'
      AND conrelid = 'public.limites_numero'::regclass
  ) THEN
    ALTER TABLE public.limites_numero
      RENAME CONSTRAINT limites_numero_vendedor_vendedor_id_fkey TO limites_numero_vendedor_id_fkey;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'limites_numero_config_id_fkey'
      AND conrelid = 'public.limites_numero'::regclass
  ) THEN
    ALTER TABLE public.limites_numero
      ADD CONSTRAINT limites_numero_config_id_fkey
      FOREIGN KEY (config_id)
      REFERENCES public.sorteos_config(id)
      ON DELETE CASCADE
      ON UPDATE NO ACTION;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS ix_limites_numero_vendedor
  ON public.limites_numero (vendedor_id, numero)
  WHERE vendedor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_limites_numero_config
  ON public.limites_numero (config_id, numero)
  WHERE config_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_limites_numero_vigencia
  ON public.limites_numero (numero, vigente_desde, vigente_hasta);

CREATE UNIQUE INDEX IF NOT EXISTS uq_limites_numero_activo_scope
  ON public.limites_numero (
    COALESCE(vendedor_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(config_id, '00000000-0000-0000-0000-000000000000'::uuid),
    numero
  )
  WHERE vigente_hasta IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ex_limites_numero_no_overlap'
      AND conrelid = 'public.limites_numero'::regclass
  ) THEN
    ALTER TABLE public.limites_numero
      ADD CONSTRAINT ex_limites_numero_no_overlap
      EXCLUDE USING gist (
        (COALESCE(vendedor_id, '00000000-0000-0000-0000-000000000000'::uuid)) WITH =,
        (COALESCE(config_id, '00000000-0000-0000-0000-000000000000'::uuid)) WITH =,
        numero WITH =,
        daterange(vigente_desde, COALESCE(vigente_hasta, 'infinity'::date), '[]') WITH &&
      )
      DEFERRABLE INITIALLY IMMEDIATE;
  END IF;
END
$$;

COMMENT ON TABLE public.limites_numero IS
  'Limits for a number. vendedor_id NULL means global; config_id NULL means default for every draw configuration.';

COMMENT ON COLUMN public.limites_numero.vendedor_id IS
  'Seller scope. NULL means the limit is global for every seller.';

COMMENT ON COLUMN public.limites_numero.config_id IS
  'Draw configuration scope. NULL means the limit applies by default to every draw configuration.';

CREATE OR REPLACE FUNCTION public.fn_limite_numero_aplicable(
  p_vendedor uuid,
  p_numero text,
  p_config uuid,
  p_fecha date
)
RETURNS TABLE(
  id uuid,
  limite_miles integer,
  vendedor_id uuid,
  config_id uuid
)
LANGUAGE sql
STABLE
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT l.id, l.limite_miles, l.vendedor_id, l.config_id
  FROM public.limites_numero l
  WHERE l.numero = public.fn_num2(p_numero)
    AND (l.vendedor_id = p_vendedor OR l.vendedor_id IS NULL)
    AND (l.config_id = p_config OR l.config_id IS NULL)
    AND l.vigente_desde <= p_fecha
    AND (l.vigente_hasta IS NULL OR l.vigente_hasta >= p_fecha)
  ORDER BY
    CASE WHEN l.config_id IS NOT NULL THEN 0 ELSE 1 END,
    CASE WHEN l.vendedor_id IS NOT NULL THEN 0 ELSE 1 END,
    l.vigente_hasta NULLS FIRST
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.trg_detalle_validar()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_vendedor uuid;
  v_turno uuid;
  v_config uuid;
  v_num char(2) := public.fn_num2(NEW.numero::text);
  v_fecha date;
  v_acumulado integer;
  v_limite_id uuid;
  v_limite integer;
  v_limite_vendedor uuid;
  v_limite_config uuid;
BEGIN
  SELECT v.vendedor_id, v.turno_id
    INTO v_vendedor, v_turno
  FROM public.ventas v
  WHERE v.id = NEW.venta_id;

  IF v_vendedor IS NULL OR v_turno IS NULL THEN
    RAISE EXCEPTION 'Venta % no existe o no tiene turno asignado', NEW.venta_id USING ERRCODE = '45000';
  END IF;

  SELECT t.fecha, t.config_id
    INTO v_fecha, v_config
  FROM public.turnos t
  WHERE t.id = v_turno;

  PERFORM 1
  FROM public.numeros_bloqueados b
  WHERE b.numero = v_num
    AND (
      (b.turno_id IS NOT NULL AND b.turno_id = v_turno)
      OR
      (b.turno_id IS NULL AND b.fecha = v_fecha)
    )
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'Numero % bloqueado para %', v_num, v_fecha USING ERRCODE = '45000';
  END IF;

  SELECT l.id, l.limite_miles, l.vendedor_id, l.config_id
    INTO v_limite_id, v_limite, v_limite_vendedor, v_limite_config
  FROM public.fn_limite_numero_aplicable(
    v_vendedor,
    v_num::text,
    v_config,
    v_fecha
  ) l;

  IF v_limite IS NOT NULL THEN
    SELECT COALESCE(SUM(d.premio_miles), 0)::integer
      INTO v_acumulado
    FROM public.venta_detalle d
    JOIN public.ventas v ON v.id = d.venta_id
    JOIN public.turnos t ON t.id = v.turno_id
    JOIN LATERAL public.fn_limite_numero_aplicable(
      v.vendedor_id,
      d.numero::text,
      t.config_id,
      t.fecha
    ) l ON l.id = v_limite_id
    WHERE d.numero = v_num
      AND v.estado = 'ACTIVA'
      AND t.fecha = v_fecha
      AND (TG_OP = 'INSERT' OR d.id <> NEW.id);

    IF v_acumulado + NEW.premio_miles > v_limite THEN
      RAISE EXCEPTION 'Limite alcanzado para numero % (limite=%, acumulado=%)', v_num, v_limite, v_acumulado
        USING ERRCODE = '45000';
    END IF;
  END IF;

  NEW.numero := v_num;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sp_set_limites_vendor_todos(
  p_vendedor uuid,
  p_limite_miles integer,
  p_desde date,
  p_hasta date DEFAULT NULL::date
)
RETURNS integer
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  n integer;
  rc integer;
  filas integer := 0;
  num2 char(2);
BEGIN
  FOR n IN 0..99 LOOP
    num2 := LPAD(n::text, 2, '0')::char(2);

    UPDATE public.limites_numero
       SET limite_miles = p_limite_miles,
           vigente_desde = p_desde,
           vigente_hasta = p_hasta
     WHERE vendedor_id = p_vendedor
       AND config_id IS NULL
       AND numero = num2
       AND vigente_hasta IS NULL;

    GET DIAGNOSTICS rc = ROW_COUNT;

    IF rc = 0 THEN
      INSERT INTO public.limites_numero(
        vendedor_id,
        config_id,
        numero,
        limite_miles,
        vigente_desde,
        vigente_hasta
      )
      VALUES (p_vendedor, NULL, num2, p_limite_miles, p_desde, p_hasta);
      filas := filas + 1;
    ELSE
      filas := filas + rc;
    END IF;
  END LOOP;

  RETURN filas;
END;
$function$;

COMMIT;
