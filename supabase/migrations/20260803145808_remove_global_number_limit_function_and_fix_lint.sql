-- The legacy four-argument overload has no tenant boundary and is no longer
-- used by the NestJS application. Remove it instead of keeping an attractive
-- cross-tenant footgun, even though Data API roles were already revoked.
DROP FUNCTION IF EXISTS public.sp_set_limites_vendor_todos(
  uuid, numeric, date, date
);

CREATE OR REPLACE FUNCTION public.sp_set_limites_vendor_todos(
  p_tenant uuid,
  p_vendedor uuid,
  p_limite_miles numeric,
  p_desde date,
  p_hasta date DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_rows integer;
  v_total integer := 0;
  v_num char(2);
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.vendedores
    WHERE tenant_id = p_tenant AND id = p_vendedor
  ) THEN
    RAISE EXCEPTION 'Vendedor no existe en tenant' USING ERRCODE = '23503';
  END IF;
  IF p_limite_miles IS NULL
     OR p_limite_miles < 0
     OR p_limite_miles <> round(p_limite_miles, 2)
     OR p_desde IS NULL
     OR (p_hasta IS NOT NULL AND p_hasta < p_desde) THEN
    RAISE EXCEPTION 'Limite o vigencia invalida' USING ERRCODE = '22023';
  END IF;

  -- The FOR iterator is declared automatically by PL/pgSQL. Declaring it in
  -- the DECLARE block shadows that iterator and triggers plpgsql warnings.
  FOR v_number IN 0..99 LOOP
    v_num := lpad(v_number::text, 2, '0')::char(2);
    UPDATE public.limites_numero
       SET limite_miles = p_limite_miles,
           vigente_desde = p_desde,
           vigente_hasta = p_hasta
     WHERE tenant_id = p_tenant
       AND vendedor_id = p_vendedor
       AND config_id IS NULL
       AND numero = v_num
       AND vigente_hasta IS NULL;
    GET DIAGNOSTICS v_rows = ROW_COUNT;

    IF v_rows = 0 THEN
      INSERT INTO public.limites_numero(
        tenant_id, vendedor_id, config_id, numero, limite_miles,
        vigente_desde, vigente_hasta
      ) VALUES (
        p_tenant, p_vendedor, NULL, v_num, p_limite_miles,
        p_desde, p_hasta
      );
      v_rows := 1;
    END IF;
    v_total := v_total + v_rows;
  END LOOP;
  RETURN v_total;
END;
$$;

REVOKE ALL ON FUNCTION public.sp_set_limites_vendor_todos(
  uuid, uuid, numeric, date, date
) FROM PUBLIC, anon, authenticated, service_role, multilot_billing_worker;
GRANT EXECUTE ON FUNCTION public.sp_set_limites_vendor_todos(
  uuid, uuid, numeric, date, date
) TO multilot_app;

COMMENT ON FUNCTION public.sp_set_limites_vendor_todos(
  uuid, uuid, numeric, date, date
) IS 'Upserts all 00-99 seller limits inside an explicit tenant boundary.';
