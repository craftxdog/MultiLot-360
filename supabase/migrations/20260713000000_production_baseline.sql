


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";

CREATE SCHEMA IF NOT EXISTS "extensions";

CREATE EXTENSION IF NOT EXISTS "btree_gist" WITH SCHEMA "extensions";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."codigo_acceso_estado" AS ENUM (
    'PENDIENTE',
    'USADO',
    'EXPIRADO',
    'REVOCADO'
);


ALTER TYPE "public"."codigo_acceso_estado" OWNER TO "postgres";


CREATE TYPE "public"."turno_estado" AS ENUM (
    'ABIERTO',
    'BLOQUEO',
    'CERRADO'
);


ALTER TYPE "public"."turno_estado" OWNER TO "postgres";


CREATE TYPE "public"."venta_estado" AS ENUM (
    'ACTIVA',
    'ANULADA'
);


ALTER TYPE "public"."venta_estado" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_limite_numero_aplicable"("p_vendedor" "uuid", "p_numero" "text", "p_config" "uuid", "p_fecha" "date") RETURNS TABLE("id" "uuid", "limite_miles" numeric, "vendedor_id" "uuid", "config_id" "uuid")
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
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
$$;


ALTER FUNCTION "public"."fn_limite_numero_aplicable"("p_vendedor" "uuid", "p_numero" "text", "p_config" "uuid", "p_fecha" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_matriz_por_turno"("p_fecha" "date", "p_codigo" "text") RETURNS TABLE("numero" character, "premio_miles" numeric)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
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
$$;


ALTER FUNCTION "public"."fn_matriz_por_turno"("p_fecha" "date", "p_codigo" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_matriz_por_turno_vendedor"("p_fecha" "date", "p_codigo" "text", "p_vendedor" "uuid") RETURNS TABLE("numero" character, "premio_miles" numeric)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
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
$$;


ALTER FUNCTION "public"."fn_matriz_por_turno_vendedor"("p_fecha" "date", "p_codigo" "text", "p_vendedor" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_num2"("n" "text") RETURNS character
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $_$
declare
  limpio text := regexp_replace(coalesce(n, ''), '\D', '', 'g');
begin
  if limpio !~ '^[0-9]{1,2}$' then
    raise exception 'Numero invalido: %', n using errcode = '22023';
  end if;

  return lpad(limpio, 2, '0')::char(2);
end;
$_$;


ALTER FUNCTION "public"."fn_num2"("n" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_premios_por_resultado"("p_resultado" "uuid") RETURNS TABLE("venta_id" "uuid", "vendedor_id" "uuid", "total_ganador_miles" numeric)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
SELECT v.id, v.vendedor_id, SUM(d.premio_miles)
FROM public.resultados r
JOIN public.ventas v
  ON v.turno_id = r.turno_id AND v.estado = 'ACTIVA'
JOIN public.venta_detalle d
  ON d.venta_id = v.id AND d.numero = r.numero_ganador
WHERE r.id = p_resultado
GROUP BY v.id, v.vendedor_id
ORDER BY v.creado_en;
$$;


ALTER FUNCTION "public"."fn_premios_por_resultado"("p_resultado" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_touch_actualizado_en"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."fn_touch_actualizado_en"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_turno_actual"("at_time" timestamp with time zone DEFAULT "now"()) RETURNS "uuid"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  fecha_local date := (at_time at time zone 'America/Managua')::date;
  hora_local time := (at_time at time zone 'America/Managua')::time;
  turno uuid;
begin
  select t.id into turno
  from public.turnos t
  join public.sorteos_config c on c.id = t.config_id
  where t.fecha = fecha_local
    and t.estado = 'ABIERTO'
    and c.activo
    and (not c.solo_martes or extract(dow from fecha_local) = 2)
    and hora_local <= (c.hora - make_interval(secs => c.lock_segundos_antes))
  order by c.hora
  limit 1;

  if turno is null then
    raise exception 'Fuera de ventana de venta para %', fecha_local using errcode = '45000';
  end if;

  return turno;
end;
$$;


ALTER FUNCTION "public"."fn_turno_actual"("at_time" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sp_anular_venta"("p_venta" "uuid", "p_usuario" "uuid", "p_motivo" "text") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_estado public.venta_estado;
  v_cutoff_local timestamp;
  v_ahora_local timestamp := (now() at time zone 'America/Managua');
begin
  if p_motivo is null or btrim(p_motivo) = '' then
    raise exception 'Motivo de anulacion requerido' using errcode = '22023';
  end if;

  select ven.estado,
         ((tur.fecha + cfg.hora) - make_interval(secs => cfg.lock_segundos_antes))
    into v_estado, v_cutoff_local
  from public.ventas ven
  join public.turnos tur on tur.id = ven.turno_id
  join public.sorteos_config cfg on cfg.id = tur.config_id
  where ven.id = p_venta;

  if not found then
    raise exception 'Venta no existe' using errcode = '45000';
  end if;

  if v_estado <> 'ACTIVA' then
    raise exception 'La venta no esta activa' using errcode = '45000';
  end if;

  if v_ahora_local >= v_cutoff_local then
    raise exception 'No se puede anular: sorteo finalizado o bloqueado' using errcode = '45000';
  end if;

  update public.ventas
     set estado = 'ANULADA',
         anulada_por = p_usuario,
         anulada_en = now(),
         motivo_anulacion = btrim(p_motivo)
   where id = p_venta;
end;
$$;


ALTER FUNCTION "public"."sp_anular_venta"("p_venta" "uuid", "p_usuario" "uuid", "p_motivo" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sp_crear_venta"("p_vendedor" "uuid", "p_items" "jsonb") RETURNS TABLE("venta_id" "uuid", "total_miles" numeric)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
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
$$;


ALTER FUNCTION "public"."sp_crear_venta"("p_vendedor" "uuid", "p_items" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sp_generar_turnos"("p_desde" "date", "p_hasta" "date") RETURNS integer
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  f date;
  cfg record;
  creados integer := 0;
  filas integer;
begin
  if p_desde is null or p_hasta is null or p_hasta < p_desde then
    raise exception 'Rango de fechas invalido' using errcode = '22023';
  end if;

  for f in select generate_series(p_desde, p_hasta, interval '1 day')::date loop
    for cfg in select * from public.sorteos_config where activo loop
      if cfg.solo_martes and extract(dow from f) <> 2 then
        continue;
      end if;

      insert into public.turnos(fecha, config_id)
      values (f, cfg.id)
      on conflict (fecha, config_id) do nothing;

      get diagnostics filas = row_count;
      creados := creados + filas;
    end loop;
  end loop;

  return creados;
end;
$$;


ALTER FUNCTION "public"."sp_generar_turnos"("p_desde" "date", "p_hasta" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sp_set_limites_vendor_todos"("p_vendedor" "uuid", "p_limite_miles" numeric, "p_desde" "date", "p_hasta" "date" DEFAULT NULL::"date") RETURNS integer
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
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
$$;


ALTER FUNCTION "public"."sp_set_limites_vendor_todos"("p_vendedor" "uuid", "p_limite_miles" numeric, "p_desde" "date", "p_hasta" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_detalle_validar"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
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
$$;


ALTER FUNCTION "public"."trg_detalle_validar"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_resultados_normalizar"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
begin
  new.numero_ganador := public.fn_num2(new.numero_ganador::text);
  return new;
end;
$$;


ALTER FUNCTION "public"."trg_resultados_normalizar"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_vendedores_default_nombre"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_nombre text;
begin
  if new.nombre is null or btrim(new.nombre) = '' then
    select coalesce(nullif(btrim(u.nombre), ''), u.username)
      into v_nombre
    from public.usuarios u
    where u.id = new.usuario_id;

    new.nombre := v_nombre;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."trg_vendedores_default_nombre"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_ventas_set_turno"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
begin
  if new.turno_id is null then
    new.turno_id := public.fn_turno_actual(new.creado_en);
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."trg_ventas_set_turno"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_ventas_total"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
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
$$;


ALTER FUNCTION "public"."trg_ventas_total"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."auditoria_eventos" (
    "id" bigint NOT NULL,
    "usuario_id" "uuid",
    "evento" "text" NOT NULL,
    "payload" "jsonb",
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "auditoria_evento_no_vacio_chk" CHECK (("btrim"("evento") <> ''::"text"))
);


ALTER TABLE "public"."auditoria_eventos" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."auditoria_eventos_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."auditoria_eventos_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."auditoria_eventos_id_seq" OWNED BY "public"."auditoria_eventos"."id";



CREATE TABLE IF NOT EXISTS "public"."codigos_acceso_vendedor" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "usuario_id" "uuid" NOT NULL,
    "vendedor_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "codigo_hash" "text" NOT NULL,
    "estado" "public"."codigo_acceso_estado" DEFAULT 'PENDIENTE'::"public"."codigo_acceso_estado" NOT NULL,
    "expira_en" timestamp(6) with time zone NOT NULL,
    "usado_en" timestamp(6) with time zone,
    "creado_por" "uuid",
    "creado_en" timestamp(6) with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."codigos_acceso_vendedor" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cortes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "fecha_inicio" "date" NOT NULL,
    "fecha_fin" "date" NOT NULL,
    "descripcion" "text",
    "visible_a_vendedores" boolean DEFAULT true NOT NULL,
    "creado_por" "uuid",
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "cortes_rango_chk" CHECK (("fecha_fin" >= "fecha_inicio"))
);


ALTER TABLE "public"."cortes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."limites_numero" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "vendedor_id" "uuid",
    "numero" character(2) NOT NULL,
    "limite_miles" numeric(14,2) NOT NULL,
    "vigente_desde" "date" DEFAULT CURRENT_DATE NOT NULL,
    "vigente_hasta" "date",
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "config_id" "uuid",
    CONSTRAINT "limites_limite_no_negativo_chk" CHECK (("limite_miles" >= (0)::numeric)),
    CONSTRAINT "limites_numero_chk" CHECK (("numero" ~ '^[0-9]{2}$'::"text")),
    CONSTRAINT "limites_vigencia_chk" CHECK ((("vigente_hasta" IS NULL) OR ("vigente_hasta" >= "vigente_desde")))
);


ALTER TABLE "public"."limites_numero" OWNER TO "postgres";


COMMENT ON TABLE "public"."limites_numero" IS 'Limits for a number. vendedor_id NULL means global; config_id NULL means default for every draw configuration.';



COMMENT ON COLUMN "public"."limites_numero"."vendedor_id" IS 'Seller scope. NULL means the limit is global for every seller.';



COMMENT ON COLUMN "public"."limites_numero"."config_id" IS 'Draw configuration scope. NULL means the limit applies by default to every draw configuration.';



CREATE TABLE IF NOT EXISTS "public"."modulos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "codigo" "text" NOT NULL,
    "descripcion" "text",
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "modulos_codigo_formato_chk" CHECK ((("codigo" = "upper"("codigo")) AND ("btrim"("codigo") <> ''::"text")))
);


ALTER TABLE "public"."modulos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notificaciones" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "usuario_id" "uuid" NOT NULL,
    "tipo" character varying(80) NOT NULL,
    "titulo" character varying(160) NOT NULL,
    "mensaje" "text" NOT NULL,
    "datos" "jsonb",
    "dedup_key" character varying(220),
    "leida_en" timestamp with time zone,
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."notificaciones" OWNER TO "postgres";


COMMENT ON TABLE "public"."notificaciones" IS 'Notificaciones persistentes por usuario; el backend controla autorizacion y entrega realtime.';



CREATE TABLE IF NOT EXISTS "public"."numeros_bloqueados" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "numero" character(2) NOT NULL,
    "turno_id" "uuid",
    "fecha" "date",
    "motivo" "text",
    "creado_por" "uuid",
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "numeros_bloqueados_alcance_chk" CHECK (((("turno_id" IS NOT NULL) AND ("fecha" IS NULL)) OR (("turno_id" IS NULL) AND ("fecha" IS NOT NULL)))),
    CONSTRAINT "numeros_bloqueados_numero_chk" CHECK (("numero" ~ '^[0-9]{2}$'::"text"))
);


ALTER TABLE "public"."numeros_bloqueados" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pagos_premios" (
    "venta_id" "uuid" NOT NULL,
    "resultado_id" "uuid" NOT NULL,
    "monto_pagado_miles" numeric(14,2) NOT NULL,
    "pagado_por" "uuid",
    "pagado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "pagos_monto_no_negativo_chk" CHECK (("monto_pagado_miles" >= (0)::numeric))
);


ALTER TABLE "public"."pagos_premios" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."parametros" (
    "clave" "text" NOT NULL,
    "valor" "text" NOT NULL,
    "actualizado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "parametros_clave_no_vacia_chk" CHECK (("btrim"("clave") <> ''::"text"))
);


ALTER TABLE "public"."parametros" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."permisos_por_rol" (
    "rol_id" "uuid" NOT NULL,
    "modulo_id" "uuid" NOT NULL,
    "puede_leer" boolean DEFAULT true NOT NULL,
    "puede_crear" boolean DEFAULT false NOT NULL,
    "puede_actualizar" boolean DEFAULT false NOT NULL,
    "puede_borrar" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."permisos_por_rol" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."resultados" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "turno_id" "uuid" NOT NULL,
    "numero_ganador" character(2) NOT NULL,
    "creado_por" "uuid",
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "resultados_numero_ganador_chk" CHECK (("numero_ganador" ~ '^[0-9]{2}$'::"text"))
);


ALTER TABLE "public"."resultados" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nombre" "text" NOT NULL,
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "roles_nombre_formato_chk" CHECK ((("nombre" = "upper"("nombre")) AND ("btrim"("nombre") <> ''::"text")))
);


ALTER TABLE "public"."roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sorteos_config" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "codigo" "text" NOT NULL,
    "hora" time without time zone NOT NULL,
    "solo_martes" boolean DEFAULT false NOT NULL,
    "lock_segundos_antes" integer DEFAULT 60 NOT NULL,
    "reopen_segundos_despues" integer DEFAULT 600 NOT NULL,
    "activo" boolean DEFAULT true NOT NULL,
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "actualizado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "auto_generar_turnos" boolean DEFAULT true NOT NULL,
    "fecha_unica" "date",
    "eliminado_en" timestamp with time zone,
    "motivo_eliminacion" "text",
    CONSTRAINT "ck_sorteos_config_auto_generation" CHECK (((("auto_generar_turnos" = true) AND ("fecha_unica" IS NULL)) OR (("auto_generar_turnos" = false) AND ("fecha_unica" IS NOT NULL)))),
    CONSTRAINT "sorteos_codigo_no_vacio_chk" CHECK (("btrim"("codigo") <> ''::"text")),
    CONSTRAINT "sorteos_lock_no_negativo_chk" CHECK (("lock_segundos_antes" >= 0)),
    CONSTRAINT "sorteos_reopen_no_negativo_chk" CHECK (("reopen_segundos_despues" >= 0))
);


ALTER TABLE "public"."sorteos_config" OWNER TO "postgres";


COMMENT ON COLUMN "public"."sorteos_config"."auto_generar_turnos" IS 'Indica si la configuracion genera turnos automaticamente para cada fecha operable.';



COMMENT ON COLUMN "public"."sorteos_config"."fecha_unica" IS 'Fecha exclusiva para configuraciones de un solo dia cuando auto_generar_turnos=false.';



COMMENT ON COLUMN "public"."sorteos_config"."eliminado_en" IS 'Marca de baja logica; configuraciones eliminadas logicamente no deben generar ni aceptar turnos.';



CREATE TABLE IF NOT EXISTS "public"."turnos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "fecha" "date" NOT NULL,
    "config_id" "uuid" NOT NULL,
    "estado" "public"."turno_estado" DEFAULT 'ABIERTO'::"public"."turno_estado" NOT NULL,
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "actualizado_en" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."turnos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."usuarios" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "auth_user_id" "uuid",
    "username" "text" NOT NULL,
    "pass_hash" "text" NOT NULL,
    "rol_id" "uuid" NOT NULL,
    "activo" boolean DEFAULT true NOT NULL,
    "nombre" "text",
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "actualizado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "eliminado_en" timestamp with time zone,
    "motivo_eliminacion" "text",
    CONSTRAINT "usuarios_nombre_no_vacio_chk" CHECK ((("nombre" IS NULL) OR ("btrim"("nombre") <> ''::"text"))),
    CONSTRAINT "usuarios_username_formato_chk" CHECK ((("username" = "lower"("username")) AND ("username" ~ '^[a-z0-9._-]{3,50}$'::"text")))
);


ALTER TABLE "public"."usuarios" OWNER TO "postgres";


COMMENT ON COLUMN "public"."usuarios"."eliminado_en" IS 'Marca de eliminacion logica. NULL significa que el usuario no esta eliminado logicamente.';



CREATE TABLE IF NOT EXISTS "public"."vendedores" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "usuario_id" "uuid" NOT NULL,
    "nombre" "text" NOT NULL,
    "cedula" "text" NOT NULL,
    "telefono" "text",
    "direccion" "text",
    "activo" boolean DEFAULT true NOT NULL,
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "actualizado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "eliminado_en" timestamp with time zone,
    "motivo_eliminacion" "text",
    CONSTRAINT "vendedores_cedula_no_vacia_chk" CHECK (("btrim"("cedula") <> ''::"text")),
    CONSTRAINT "vendedores_nombre_no_vacio_chk" CHECK (("btrim"("nombre") <> ''::"text"))
);


ALTER TABLE "public"."vendedores" OWNER TO "postgres";


COMMENT ON COLUMN "public"."vendedores"."eliminado_en" IS 'Marca de eliminacion logica. NULL significa que el vendedor no esta eliminado logicamente.';



CREATE TABLE IF NOT EXISTS "public"."venta_detalle" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "venta_id" "uuid" NOT NULL,
    "numero" character(2) NOT NULL,
    "premio_miles" numeric(14,2) NOT NULL,
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "venta_detalle_numero_chk" CHECK (("numero" ~ '^[0-9]{2}$'::"text")),
    CONSTRAINT "venta_detalle_premio_positivo_chk" CHECK (("premio_miles" > (0)::numeric))
);


ALTER TABLE "public"."venta_detalle" OWNER TO "postgres";


COMMENT ON COLUMN "public"."venta_detalle"."premio_miles" IS 'Amount sold for the number, in thousands, with up to two decimal places.';



CREATE TABLE IF NOT EXISTS "public"."ventas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "vendedor_id" "uuid" NOT NULL,
    "turno_id" "uuid",
    "creado_en" timestamp with time zone DEFAULT "now"() NOT NULL,
    "total_miles" numeric(14,2) DEFAULT 0 NOT NULL,
    "estado" "public"."venta_estado" DEFAULT 'ACTIVA'::"public"."venta_estado" NOT NULL,
    "anulada_por" "uuid",
    "anulada_en" timestamp with time zone,
    "motivo_anulacion" "text",
    CONSTRAINT "ventas_anulacion_consistente_chk" CHECK (((("estado" = 'ACTIVA'::"public"."venta_estado") AND ("anulada_por" IS NULL) AND ("anulada_en" IS NULL) AND ("motivo_anulacion" IS NULL)) OR (("estado" = 'ANULADA'::"public"."venta_estado") AND ("anulada_por" IS NOT NULL) AND ("anulada_en" IS NOT NULL) AND ("btrim"(COALESCE("motivo_anulacion", ''::"text")) <> ''::"text")))),
    CONSTRAINT "ventas_total_no_negativo_chk" CHECK (("total_miles" >= (0)::numeric))
);


ALTER TABLE "public"."ventas" OWNER TO "postgres";


COMMENT ON COLUMN "public"."ventas"."total_miles" IS 'Sale total in thousands with up to two decimal places.';



ALTER TABLE ONLY "public"."auditoria_eventos" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."auditoria_eventos_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."auditoria_eventos"
    ADD CONSTRAINT "auditoria_eventos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."codigos_acceso_vendedor"
    ADD CONSTRAINT "codigos_acceso_vendedor_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cortes"
    ADD CONSTRAINT "cortes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."limites_numero"
    ADD CONSTRAINT "ex_limites_numero_no_overlap" EXCLUDE USING "gist" (COALESCE("vendedor_id", '00000000-0000-0000-0000-000000000000'::"uuid") WITH =, COALESCE("config_id", '00000000-0000-0000-0000-000000000000'::"uuid") WITH =, "numero" WITH =, "daterange"("vigente_desde", COALESCE("vigente_hasta", 'infinity'::"date"), '[]'::"text") WITH &&) DEFERRABLE;



ALTER TABLE ONLY "public"."limites_numero"
    ADD CONSTRAINT "limites_numero_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."modulos"
    ADD CONSTRAINT "modulos_codigo_key" UNIQUE ("codigo");



ALTER TABLE ONLY "public"."modulos"
    ADD CONSTRAINT "modulos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notificaciones"
    ADD CONSTRAINT "notificaciones_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."numeros_bloqueados"
    ADD CONSTRAINT "numeros_bloqueados_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pagos_premios"
    ADD CONSTRAINT "pagos_premios_pkey" PRIMARY KEY ("venta_id");



ALTER TABLE ONLY "public"."parametros"
    ADD CONSTRAINT "parametros_pkey" PRIMARY KEY ("clave");



ALTER TABLE ONLY "public"."permisos_por_rol"
    ADD CONSTRAINT "permisos_por_rol_pkey" PRIMARY KEY ("rol_id", "modulo_id");



ALTER TABLE ONLY "public"."resultados"
    ADD CONSTRAINT "resultados_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."resultados"
    ADD CONSTRAINT "resultados_turno_id_key" UNIQUE ("turno_id");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_nombre_key" UNIQUE ("nombre");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sorteos_config"
    ADD CONSTRAINT "sorteos_config_codigo_key" UNIQUE ("codigo");



ALTER TABLE ONLY "public"."sorteos_config"
    ADD CONSTRAINT "sorteos_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."turnos"
    ADD CONSTRAINT "turnos_fecha_config_id_key" UNIQUE ("fecha", "config_id");



ALTER TABLE ONLY "public"."turnos"
    ADD CONSTRAINT "turnos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."usuarios"
    ADD CONSTRAINT "usuarios_auth_user_id_key" UNIQUE ("auth_user_id");



ALTER TABLE ONLY "public"."usuarios"
    ADD CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."usuarios"
    ADD CONSTRAINT "usuarios_username_key" UNIQUE ("username");



ALTER TABLE ONLY "public"."vendedores"
    ADD CONSTRAINT "vendedores_cedula_key" UNIQUE ("cedula");



ALTER TABLE ONLY "public"."vendedores"
    ADD CONSTRAINT "vendedores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vendedores"
    ADD CONSTRAINT "vendedores_usuario_id_key" UNIQUE ("usuario_id");



ALTER TABLE ONLY "public"."venta_detalle"
    ADD CONSTRAINT "venta_detalle_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ventas"
    ADD CONSTRAINT "ventas_pkey" PRIMARY KEY ("id");



CREATE INDEX "ix_auditoria_eventos_creado_en" ON "public"."auditoria_eventos" USING "btree" ("creado_en" DESC);



CREATE INDEX "ix_auditoria_eventos_usuario_id" ON "public"."auditoria_eventos" USING "btree" ("usuario_id");



CREATE INDEX "ix_bloq_num_fecha" ON "public"."numeros_bloqueados" USING "btree" ("numero", "fecha");



CREATE INDEX "ix_bloq_num_turno" ON "public"."numeros_bloqueados" USING "btree" ("numero", "turno_id");



CREATE INDEX "ix_codigos_acceso_vendedor_creado_por" ON "public"."codigos_acceso_vendedor" USING "btree" ("creado_por");



CREATE INDEX "ix_codigos_acceso_vendedor_email_estado" ON "public"."codigos_acceso_vendedor" USING "btree" ("email", "estado");



CREATE INDEX "ix_codigos_acceso_vendedor_usuario_estado" ON "public"."codigos_acceso_vendedor" USING "btree" ("usuario_id", "estado");



CREATE INDEX "ix_codigos_acceso_vendedor_vendedor_estado" ON "public"."codigos_acceso_vendedor" USING "btree" ("vendedor_id", "estado");



CREATE INDEX "ix_cortes_creado_por" ON "public"."cortes" USING "btree" ("creado_por");



CREATE INDEX "ix_limites_numero_config" ON "public"."limites_numero" USING "btree" ("config_id", "numero") WHERE ("config_id" IS NOT NULL);



CREATE INDEX "ix_limites_numero_vendedor" ON "public"."limites_numero" USING "btree" ("vendedor_id", "numero") WHERE ("vendedor_id" IS NOT NULL);



CREATE INDEX "ix_limites_numero_vigencia" ON "public"."limites_numero" USING "btree" ("numero", "vigente_desde", "vigente_hasta");



CREATE INDEX "ix_notificaciones_tipo_creado" ON "public"."notificaciones" USING "btree" ("tipo", "creado_en" DESC);



CREATE INDEX "ix_notificaciones_usuario_creado" ON "public"."notificaciones" USING "btree" ("usuario_id", "creado_en" DESC);



CREATE INDEX "ix_notificaciones_usuario_leida" ON "public"."notificaciones" USING "btree" ("usuario_id", "leida_en", "creado_en" DESC);



CREATE INDEX "ix_numeros_bloqueados_creado_por" ON "public"."numeros_bloqueados" USING "btree" ("creado_por");



CREATE INDEX "ix_numeros_bloqueados_turno_id" ON "public"."numeros_bloqueados" USING "btree" ("turno_id");



CREATE INDEX "ix_pagos_premios_pagado_en" ON "public"."pagos_premios" USING "btree" ("pagado_en");



CREATE INDEX "ix_pagos_premios_pagado_por" ON "public"."pagos_premios" USING "btree" ("pagado_por");



CREATE INDEX "ix_pagos_premios_resultado_id" ON "public"."pagos_premios" USING "btree" ("resultado_id");



CREATE INDEX "ix_permisos_por_rol_modulo_id" ON "public"."permisos_por_rol" USING "btree" ("modulo_id");



CREATE INDEX "ix_resultados_creado_en" ON "public"."resultados" USING "btree" ("creado_en");



CREATE INDEX "ix_resultados_creado_por" ON "public"."resultados" USING "btree" ("creado_por");



CREATE INDEX "ix_resultados_turno" ON "public"."resultados" USING "btree" ("turno_id");



CREATE INDEX "ix_sorteos_activo_hora" ON "public"."sorteos_config" USING "btree" ("activo", "hora");



CREATE INDEX "ix_sorteos_auto_activo" ON "public"."sorteos_config" USING "btree" ("auto_generar_turnos", "activo") WHERE ("eliminado_en" IS NULL);



CREATE INDEX "ix_sorteos_fecha_unica" ON "public"."sorteos_config" USING "btree" ("fecha_unica") WHERE (("fecha_unica" IS NOT NULL) AND ("eliminado_en" IS NULL));



CREATE INDEX "ix_turnos_config_id" ON "public"."turnos" USING "btree" ("config_id");



CREATE INDEX "ix_turnos_estado" ON "public"."turnos" USING "btree" ("estado");



CREATE INDEX "ix_turnos_fecha_cfg" ON "public"."turnos" USING "btree" ("fecha", "config_id");



CREATE INDEX "ix_usuarios_eliminado_en" ON "public"."usuarios" USING "btree" ("eliminado_en") WHERE ("eliminado_en" IS NOT NULL);



CREATE INDEX "ix_usuarios_rol_id" ON "public"."usuarios" USING "btree" ("rol_id");



CREATE INDEX "ix_usuarios_username" ON "public"."usuarios" USING "btree" ("username");



CREATE INDEX "ix_vendedores_eliminado_en" ON "public"."vendedores" USING "btree" ("eliminado_en") WHERE ("eliminado_en" IS NOT NULL);



CREATE INDEX "ix_vendedores_usuario" ON "public"."vendedores" USING "btree" ("usuario_id");



CREATE INDEX "ix_venta_detalle_numero" ON "public"."venta_detalle" USING "btree" ("numero");



CREATE INDEX "ix_venta_detalle_venta" ON "public"."venta_detalle" USING "btree" ("venta_id");



CREATE INDEX "ix_ventas_anulada_por" ON "public"."ventas" USING "btree" ("anulada_por");



CREATE INDEX "ix_ventas_turno_estado" ON "public"."ventas" USING "btree" ("turno_id", "estado");



CREATE INDEX "ix_ventas_vendedor_creado" ON "public"."ventas" USING "btree" ("vendedor_id", "creado_en" DESC);



CREATE UNIQUE INDEX "uq_bloq_num_diario" ON "public"."numeros_bloqueados" USING "btree" ("numero", "fecha") WHERE ("turno_id" IS NULL);



CREATE UNIQUE INDEX "uq_bloq_num_turno" ON "public"."numeros_bloqueados" USING "btree" ("numero", "turno_id") WHERE ("turno_id" IS NOT NULL);



CREATE UNIQUE INDEX "uq_limites_numero_activo_scope" ON "public"."limites_numero" USING "btree" (COALESCE("vendedor_id", '00000000-0000-0000-0000-000000000000'::"uuid"), COALESCE("config_id", '00000000-0000-0000-0000-000000000000'::"uuid"), "numero") WHERE ("vigente_hasta" IS NULL);



CREATE UNIQUE INDEX "uq_notificaciones_dedup_key" ON "public"."notificaciones" USING "btree" ("dedup_key") WHERE ("dedup_key" IS NOT NULL);



CREATE OR REPLACE TRIGGER "resultados_biu_normalizar" BEFORE INSERT OR UPDATE ON "public"."resultados" FOR EACH ROW EXECUTE FUNCTION "public"."trg_resultados_normalizar"();



CREATE OR REPLACE TRIGGER "sorteos_config_bu_touch" BEFORE UPDATE ON "public"."sorteos_config" FOR EACH ROW EXECUTE FUNCTION "public"."fn_touch_actualizado_en"();



CREATE OR REPLACE TRIGGER "turnos_bu_touch" BEFORE UPDATE ON "public"."turnos" FOR EACH ROW EXECUTE FUNCTION "public"."fn_touch_actualizado_en"();



CREATE OR REPLACE TRIGGER "usuarios_bu_touch" BEFORE UPDATE ON "public"."usuarios" FOR EACH ROW EXECUTE FUNCTION "public"."fn_touch_actualizado_en"();



CREATE OR REPLACE TRIGGER "vendedores_bi_default_nombre" BEFORE INSERT ON "public"."vendedores" FOR EACH ROW EXECUTE FUNCTION "public"."trg_vendedores_default_nombre"();



CREATE OR REPLACE TRIGGER "vendedores_bu_touch" BEFORE UPDATE ON "public"."vendedores" FOR EACH ROW EXECUTE FUNCTION "public"."fn_touch_actualizado_en"();



CREATE OR REPLACE TRIGGER "venta_detalle_aiud_sum" AFTER INSERT OR DELETE OR UPDATE ON "public"."venta_detalle" FOR EACH ROW EXECUTE FUNCTION "public"."trg_ventas_total"();



CREATE OR REPLACE TRIGGER "venta_detalle_biu_validar" BEFORE INSERT OR UPDATE ON "public"."venta_detalle" FOR EACH ROW EXECUTE FUNCTION "public"."trg_detalle_validar"();



CREATE OR REPLACE TRIGGER "ventas_bi_set_turno" BEFORE INSERT ON "public"."ventas" FOR EACH ROW EXECUTE FUNCTION "public"."trg_ventas_set_turno"();



ALTER TABLE ONLY "public"."auditoria_eventos"
    ADD CONSTRAINT "auditoria_eventos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id");



ALTER TABLE ONLY "public"."codigos_acceso_vendedor"
    ADD CONSTRAINT "codigos_acceso_vendedor_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "public"."usuarios"("id");



ALTER TABLE ONLY "public"."codigos_acceso_vendedor"
    ADD CONSTRAINT "codigos_acceso_vendedor_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."codigos_acceso_vendedor"
    ADD CONSTRAINT "codigos_acceso_vendedor_vendedor_id_fkey" FOREIGN KEY ("vendedor_id") REFERENCES "public"."vendedores"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cortes"
    ADD CONSTRAINT "cortes_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "public"."usuarios"("id");



ALTER TABLE ONLY "public"."notificaciones"
    ADD CONSTRAINT "fk_notificaciones_usuario" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."limites_numero"
    ADD CONSTRAINT "limites_numero_config_id_fkey" FOREIGN KEY ("config_id") REFERENCES "public"."sorteos_config"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."limites_numero"
    ADD CONSTRAINT "limites_numero_vendedor_id_fkey" FOREIGN KEY ("vendedor_id") REFERENCES "public"."vendedores"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."numeros_bloqueados"
    ADD CONSTRAINT "numeros_bloqueados_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "public"."usuarios"("id");



ALTER TABLE ONLY "public"."numeros_bloqueados"
    ADD CONSTRAINT "numeros_bloqueados_turno_id_fkey" FOREIGN KEY ("turno_id") REFERENCES "public"."turnos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pagos_premios"
    ADD CONSTRAINT "pagos_premios_pagado_por_fkey" FOREIGN KEY ("pagado_por") REFERENCES "public"."usuarios"("id");



ALTER TABLE ONLY "public"."pagos_premios"
    ADD CONSTRAINT "pagos_premios_resultado_id_fkey" FOREIGN KEY ("resultado_id") REFERENCES "public"."resultados"("id");



ALTER TABLE ONLY "public"."pagos_premios"
    ADD CONSTRAINT "pagos_premios_venta_id_fkey" FOREIGN KEY ("venta_id") REFERENCES "public"."ventas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."permisos_por_rol"
    ADD CONSTRAINT "permisos_por_rol_modulo_id_fkey" FOREIGN KEY ("modulo_id") REFERENCES "public"."modulos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."permisos_por_rol"
    ADD CONSTRAINT "permisos_por_rol_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "public"."roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."resultados"
    ADD CONSTRAINT "resultados_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "public"."usuarios"("id");



ALTER TABLE ONLY "public"."resultados"
    ADD CONSTRAINT "resultados_turno_id_fkey" FOREIGN KEY ("turno_id") REFERENCES "public"."turnos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."turnos"
    ADD CONSTRAINT "turnos_config_id_fkey" FOREIGN KEY ("config_id") REFERENCES "public"."sorteos_config"("id");



ALTER TABLE ONLY "public"."usuarios"
    ADD CONSTRAINT "usuarios_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "public"."roles"("id");



ALTER TABLE ONLY "public"."vendedores"
    ADD CONSTRAINT "vendedores_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."venta_detalle"
    ADD CONSTRAINT "venta_detalle_venta_id_fkey" FOREIGN KEY ("venta_id") REFERENCES "public"."ventas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ventas"
    ADD CONSTRAINT "ventas_anulada_por_fkey" FOREIGN KEY ("anulada_por") REFERENCES "public"."usuarios"("id");



ALTER TABLE ONLY "public"."ventas"
    ADD CONSTRAINT "ventas_turno_id_fkey" FOREIGN KEY ("turno_id") REFERENCES "public"."turnos"("id");



ALTER TABLE ONLY "public"."ventas"
    ADD CONSTRAINT "ventas_vendedor_id_fkey" FOREIGN KEY ("vendedor_id") REFERENCES "public"."vendedores"("id");



ALTER TABLE "public"."auditoria_eventos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."codigos_acceso_vendedor" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cortes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."limites_numero" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."modulos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notificaciones" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."numeros_bloqueados" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pagos_premios" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."parametros" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."permisos_por_rol" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."resultados" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sorteos_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."turnos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."usuarios" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vendedores" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."venta_detalle" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ventas" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_limite_numero_aplicable"("p_vendedor" "uuid", "p_numero" "text", "p_config" "uuid", "p_fecha" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_limite_numero_aplicable"("p_vendedor" "uuid", "p_numero" "text", "p_config" "uuid", "p_fecha" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_limite_numero_aplicable"("p_vendedor" "uuid", "p_numero" "text", "p_config" "uuid", "p_fecha" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_matriz_por_turno"("p_fecha" "date", "p_codigo" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_matriz_por_turno"("p_fecha" "date", "p_codigo" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_matriz_por_turno"("p_fecha" "date", "p_codigo" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_matriz_por_turno_vendedor"("p_fecha" "date", "p_codigo" "text", "p_vendedor" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_matriz_por_turno_vendedor"("p_fecha" "date", "p_codigo" "text", "p_vendedor" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_matriz_por_turno_vendedor"("p_fecha" "date", "p_codigo" "text", "p_vendedor" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_num2"("n" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_num2"("n" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_num2"("n" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_premios_por_resultado"("p_resultado" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_premios_por_resultado"("p_resultado" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_premios_por_resultado"("p_resultado" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_touch_actualizado_en"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_touch_actualizado_en"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_touch_actualizado_en"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_turno_actual"("at_time" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."fn_turno_actual"("at_time" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_turno_actual"("at_time" timestamp with time zone) TO "service_role";



REVOKE ALL ON FUNCTION "public"."rls_auto_enable"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sp_anular_venta"("p_venta" "uuid", "p_usuario" "uuid", "p_motivo" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."sp_anular_venta"("p_venta" "uuid", "p_usuario" "uuid", "p_motivo" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sp_anular_venta"("p_venta" "uuid", "p_usuario" "uuid", "p_motivo" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."sp_crear_venta"("p_vendedor" "uuid", "p_items" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."sp_crear_venta"("p_vendedor" "uuid", "p_items" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sp_crear_venta"("p_vendedor" "uuid", "p_items" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."sp_generar_turnos"("p_desde" "date", "p_hasta" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."sp_generar_turnos"("p_desde" "date", "p_hasta" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sp_generar_turnos"("p_desde" "date", "p_hasta" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."sp_set_limites_vendor_todos"("p_vendedor" "uuid", "p_limite_miles" numeric, "p_desde" "date", "p_hasta" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."sp_set_limites_vendor_todos"("p_vendedor" "uuid", "p_limite_miles" numeric, "p_desde" "date", "p_hasta" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sp_set_limites_vendor_todos"("p_vendedor" "uuid", "p_limite_miles" numeric, "p_desde" "date", "p_hasta" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_detalle_validar"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_detalle_validar"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_detalle_validar"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_resultados_normalizar"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_resultados_normalizar"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_resultados_normalizar"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_vendedores_default_nombre"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_vendedores_default_nombre"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_vendedores_default_nombre"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_ventas_set_turno"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_ventas_set_turno"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_ventas_set_turno"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_ventas_total"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_ventas_total"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_ventas_total"() TO "service_role";



GRANT ALL ON TABLE "public"."auditoria_eventos" TO "anon";
GRANT ALL ON TABLE "public"."auditoria_eventos" TO "authenticated";
GRANT ALL ON TABLE "public"."auditoria_eventos" TO "service_role";



GRANT ALL ON SEQUENCE "public"."auditoria_eventos_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."auditoria_eventos_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."auditoria_eventos_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."codigos_acceso_vendedor" TO "anon";
GRANT ALL ON TABLE "public"."codigos_acceso_vendedor" TO "authenticated";
GRANT ALL ON TABLE "public"."codigos_acceso_vendedor" TO "service_role";



GRANT ALL ON TABLE "public"."cortes" TO "anon";
GRANT ALL ON TABLE "public"."cortes" TO "authenticated";
GRANT ALL ON TABLE "public"."cortes" TO "service_role";



GRANT ALL ON TABLE "public"."limites_numero" TO "anon";
GRANT ALL ON TABLE "public"."limites_numero" TO "authenticated";
GRANT ALL ON TABLE "public"."limites_numero" TO "service_role";



GRANT ALL ON TABLE "public"."modulos" TO "anon";
GRANT ALL ON TABLE "public"."modulos" TO "authenticated";
GRANT ALL ON TABLE "public"."modulos" TO "service_role";



GRANT ALL ON TABLE "public"."notificaciones" TO "anon";
GRANT ALL ON TABLE "public"."notificaciones" TO "authenticated";
GRANT ALL ON TABLE "public"."notificaciones" TO "service_role";



GRANT ALL ON TABLE "public"."numeros_bloqueados" TO "anon";
GRANT ALL ON TABLE "public"."numeros_bloqueados" TO "authenticated";
GRANT ALL ON TABLE "public"."numeros_bloqueados" TO "service_role";



GRANT ALL ON TABLE "public"."pagos_premios" TO "anon";
GRANT ALL ON TABLE "public"."pagos_premios" TO "authenticated";
GRANT ALL ON TABLE "public"."pagos_premios" TO "service_role";



GRANT ALL ON TABLE "public"."parametros" TO "anon";
GRANT ALL ON TABLE "public"."parametros" TO "authenticated";
GRANT ALL ON TABLE "public"."parametros" TO "service_role";



GRANT ALL ON TABLE "public"."permisos_por_rol" TO "anon";
GRANT ALL ON TABLE "public"."permisos_por_rol" TO "authenticated";
GRANT ALL ON TABLE "public"."permisos_por_rol" TO "service_role";



GRANT ALL ON TABLE "public"."resultados" TO "anon";
GRANT ALL ON TABLE "public"."resultados" TO "authenticated";
GRANT ALL ON TABLE "public"."resultados" TO "service_role";



GRANT ALL ON TABLE "public"."roles" TO "anon";
GRANT ALL ON TABLE "public"."roles" TO "authenticated";
GRANT ALL ON TABLE "public"."roles" TO "service_role";



GRANT ALL ON TABLE "public"."sorteos_config" TO "anon";
GRANT ALL ON TABLE "public"."sorteos_config" TO "authenticated";
GRANT ALL ON TABLE "public"."sorteos_config" TO "service_role";



GRANT ALL ON TABLE "public"."turnos" TO "anon";
GRANT ALL ON TABLE "public"."turnos" TO "authenticated";
GRANT ALL ON TABLE "public"."turnos" TO "service_role";



GRANT ALL ON TABLE "public"."usuarios" TO "anon";
GRANT ALL ON TABLE "public"."usuarios" TO "authenticated";
GRANT ALL ON TABLE "public"."usuarios" TO "service_role";



GRANT ALL ON TABLE "public"."vendedores" TO "anon";
GRANT ALL ON TABLE "public"."vendedores" TO "authenticated";
GRANT ALL ON TABLE "public"."vendedores" TO "service_role";



GRANT ALL ON TABLE "public"."venta_detalle" TO "anon";
GRANT ALL ON TABLE "public"."venta_detalle" TO "authenticated";
GRANT ALL ON TABLE "public"."venta_detalle" TO "service_role";



GRANT ALL ON TABLE "public"."ventas" TO "anon";
GRANT ALL ON TABLE "public"."ventas" TO "authenticated";
GRANT ALL ON TABLE "public"."ventas" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






