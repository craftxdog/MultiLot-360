BEGIN;

-- Fail atomically instead of waiting indefinitely for a production lock.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- Monetary values are expressed in thousands. Two decimal places support
-- amounts such as 0.50 (500) and 1.40 (1,400) without floating-point storage.
ALTER TABLE public.ventas
  ALTER COLUMN total_miles TYPE numeric(14, 2)
  USING total_miles::numeric(14, 2),
  ALTER COLUMN total_miles SET DEFAULT 0;

ALTER TABLE public.venta_detalle
  ALTER COLUMN premio_miles TYPE numeric(14, 2)
  USING premio_miles::numeric(14, 2);

ALTER TABLE public.pagos_premios
  ALTER COLUMN monto_pagado_miles TYPE numeric(14, 2)
  USING monto_pagado_miles::numeric(14, 2);

ALTER TABLE public.limites_numero
  ALTER COLUMN limite_miles TYPE numeric(14, 2)
  USING limite_miles::numeric(14, 2);

CREATE OR REPLACE FUNCTION public.trg_ventas_total()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_venta uuid := COALESCE(NEW.venta_id, OLD.venta_id);
BEGIN
  UPDATE public.ventas v
     SET total_miles = (
       SELECT COALESCE(SUM(d.premio_miles), 0::numeric)
       FROM public.venta_detalle d
       WHERE d.venta_id = v.id
     )
   WHERE v.id = v_venta;

  RETURN NULL;
END;
$function$;

DROP FUNCTION IF EXISTS public.fn_limite_numero_aplicable(uuid, text, uuid, date);

CREATE FUNCTION public.fn_limite_numero_aplicable(
  p_vendedor uuid,
  p_numero text,
  p_config uuid,
  p_fecha date
)
RETURNS TABLE(
  id uuid,
  limite_miles numeric,
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
  v_acumulado numeric(14, 2);
  v_limite_id uuid;
  v_limite numeric(14, 2);
  v_limite_vendedor uuid;
  v_limite_config uuid;
BEGIN
  SELECT v.vendedor_id, v.turno_id
    INTO v_vendedor, v_turno
  FROM public.ventas v
  WHERE v.id = NEW.venta_id;

  IF v_vendedor IS NULL OR v_turno IS NULL THEN
    RAISE EXCEPTION 'Venta % no existe o no tiene turno asignado', NEW.venta_id
      USING ERRCODE = '45000';
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
      OR (b.turno_id IS NULL AND b.fecha = v_fecha)
    )
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'Numero % bloqueado para %', v_num, v_fecha
      USING ERRCODE = '45000';
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
    SELECT COALESCE(SUM(d.premio_miles), 0::numeric)
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
      RAISE EXCEPTION 'Limite alcanzado para numero % (limite=%, acumulado=%)',
        v_num, v_limite, v_acumulado USING ERRCODE = '45000';
    END IF;
  END IF;

  NEW.numero := v_num;
  RETURN NEW;
END;
$function$;

DROP FUNCTION IF EXISTS public.sp_crear_venta(uuid, jsonb);

CREATE FUNCTION public.sp_crear_venta(p_vendedor uuid, p_items jsonb)
RETURNS TABLE(venta_id uuid, total_miles numeric)
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_id uuid;
  itm jsonb;
  v_premio numeric;
BEGIN
  IF p_items IS NULL
     OR jsonb_typeof(p_items) <> 'array'
     OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'La venta requiere al menos un item'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.ventas(vendedor_id)
  VALUES (p_vendedor)
  RETURNING id INTO v_id;

  FOR itm IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_premio := (itm->>'premio_miles')::numeric;

    IF v_premio <= 0 OR v_premio <> ROUND(v_premio, 2) THEN
      RAISE EXCEPTION 'Monto invalido: debe ser positivo y tener maximo dos decimales'
        USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.venta_detalle(venta_id, numero, premio_miles)
    VALUES (v_id, itm->>'numero', v_premio);
  END LOOP;

  RETURN QUERY
  SELECT v_id, v.total_miles
  FROM public.ventas v
  WHERE v.id = v_id;
END;
$function$;

DROP FUNCTION IF EXISTS public.sp_set_limites_vendor_todos(uuid, integer, date, date);

CREATE FUNCTION public.sp_set_limites_vendor_todos(
  p_vendedor uuid,
  p_limite_miles numeric,
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
  IF p_limite_miles IS NULL
     OR p_limite_miles < 0
     OR p_limite_miles <> ROUND(p_limite_miles, 2) THEN
    RAISE EXCEPTION 'Limite invalido' USING ERRCODE = '22023';
  END IF;

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
        vendedor_id, config_id, numero, limite_miles,
        vigente_desde, vigente_hasta
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

DROP FUNCTION IF EXISTS public.fn_matriz_por_turno(date, text);

CREATE FUNCTION public.fn_matriz_por_turno(p_fecha date, p_codigo text)
RETURNS TABLE(numero char(2), premio_miles numeric)
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $function$
WITH nums AS (
  SELECT LPAD(n::text, 2, '0')::char(2) AS n
  FROM generate_series(0, 99) g(n)
), turno AS (
  SELECT t.id AS turno_id
  FROM public.turnos t
  JOIN public.sorteos_config c ON c.id = t.config_id
  WHERE t.fecha = p_fecha AND c.codigo = p_codigo
), sumas AS (
  SELECT d.numero, SUM(d.premio_miles) AS suma
  FROM public.ventas v
  JOIN public.venta_detalle d ON d.venta_id = v.id
  JOIN turno t ON t.turno_id = v.turno_id
  WHERE v.estado = 'ACTIVA'
  GROUP BY d.numero
)
SELECT nums.n, COALESCE(sumas.suma, 0::numeric)
FROM nums
LEFT JOIN sumas ON sumas.numero = nums.n
ORDER BY 1;
$function$;

DROP FUNCTION IF EXISTS public.fn_matriz_por_turno_vendedor(date, text, uuid);

CREATE FUNCTION public.fn_matriz_por_turno_vendedor(
  p_fecha date,
  p_codigo text,
  p_vendedor uuid
)
RETURNS TABLE(numero char(2), premio_miles numeric)
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $function$
WITH nums AS (
  SELECT LPAD(n::text, 2, '0')::char(2) AS n
  FROM generate_series(0, 99) g(n)
), turno AS (
  SELECT t.id AS turno_id
  FROM public.turnos t
  JOIN public.sorteos_config c ON c.id = t.config_id
  WHERE t.fecha = p_fecha AND c.codigo = p_codigo
), sumas AS (
  SELECT d.numero, SUM(d.premio_miles) AS suma
  FROM public.ventas v
  JOIN public.venta_detalle d ON d.venta_id = v.id
  JOIN turno t ON t.turno_id = v.turno_id
  WHERE v.estado = 'ACTIVA' AND v.vendedor_id = p_vendedor
  GROUP BY d.numero
)
SELECT nums.n, COALESCE(sumas.suma, 0::numeric)
FROM nums
LEFT JOIN sumas ON sumas.numero = nums.n
ORDER BY 1;
$function$;

DROP FUNCTION IF EXISTS public.fn_premios_por_resultado(uuid);

CREATE FUNCTION public.fn_premios_por_resultado(p_resultado uuid)
RETURNS TABLE(venta_id uuid, vendedor_id uuid, total_ganador_miles numeric)
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $function$
SELECT v.id, v.vendedor_id, SUM(d.premio_miles)
FROM public.resultados r
JOIN public.ventas v
  ON v.turno_id = r.turno_id AND v.estado = 'ACTIVA'
JOIN public.venta_detalle d
  ON d.venta_id = v.id AND d.numero = r.numero_ganador
WHERE r.id = p_resultado
GROUP BY v.id, v.vendedor_id
ORDER BY v.creado_en;
$function$;

COMMENT ON COLUMN public.ventas.total_miles IS
  'Sale total in thousands with up to two decimal places.';
COMMENT ON COLUMN public.venta_detalle.premio_miles IS
  'Amount sold for the number, in thousands, with up to two decimal places.';

COMMIT;
