-- Keep the daily billing worker aligned with the tenant lifecycle.
-- Archived/cancelled tenants must never receive new renewal documents.

CREATE OR REPLACE FUNCTION app_private.run_billing_cycle(p_now timestamptz DEFAULT now())
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog,public
AS $$
DECLARE
  v_run uuid;
  v_key text := 'daily:'||to_char(p_now AT TIME ZONE 'America/Managua','YYYY-MM-DD');
  v_settings public.billing_settings%ROWTYPE;
  v_row record;
  v_issued integer := 0;
  v_delinquent integer := 0;
  v_suspended integer := 0;
  v_reissued integer := 0;
  v_expired integer := 0;
  v_archived integer := 0;
  v_start timestamptz;
  v_end timestamptz;
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtextextended('alphaby:billing-cycle',0)) THEN
    RETURN jsonb_build_object('accepted',false,'reason','already_running');
  END IF;

  INSERT INTO public.billing_runs(run_key)
  VALUES (v_key) ON CONFLICT (run_key) DO NOTHING RETURNING id INTO v_run;
  IF v_run IS NULL THEN
    RETURN jsonb_build_object('accepted',true,'duplicate',true,'runKey',v_key);
  END IF;

  SELECT * INTO v_settings FROM public.billing_settings WHERE singleton;

  -- Issue renewal documents five days before the current period ends.
  FOR v_row IN
    SELECT s.*,p.intervalo
    FROM public.tenant_subscriptions s
    JOIN public.billing_prices p ON p.id=s.price_id
    JOIN public.tenants t ON t.id=s.tenant_id
    WHERE s.estado='ACTIVA' AND t.estado='ACTIVO' AND t.eliminado_en IS NULL
      AND s.cancelar_al_final=false AND s.periodo_termina_en IS NOT NULL
      AND s.periodo_termina_en<=p_now+make_interval(days=>v_settings.renewal_issue_days)
      AND NOT EXISTS (
        SELECT 1 FROM public.billing_invoices i
        WHERE i.tenant_id=s.tenant_id AND i.subscription_id=s.id
          AND i.periodo_inicia_en=s.periodo_termina_en AND i.estado<>'ANULADA'
      )
    FOR UPDATE OF s SKIP LOCKED
  LOOP
    v_start := v_row.periodo_termina_en;
    v_end := v_start+CASE v_row.intervalo
      WHEN 'ANUAL' THEN interval '1 year' ELSE interval '1 month' END;
    PERFORM app_private.create_subscription_invoice(
      v_row.tenant_id,v_row.id,v_start,v_end,v_start,'RENEWAL'
    );
    v_issued := v_issued+1;
  END LOOP;

  -- Grace state preserves operations for three days.
  WITH affected AS (
    UPDATE public.tenants t SET estado='MOROSO',actualizado_en=now()
    FROM public.billing_invoices i
    WHERE i.tenant_id=t.id AND i.estado IN ('ABIERTA','FALLIDA')
      AND i.vencimiento_en<p_now AND COALESCE(i.gracia_termina_en,i.vencimiento_en)>=p_now
      AND t.estado='ACTIVO' AND t.eliminado_en IS NULL RETURNING t.id
  ) SELECT count(*) INTO v_delinquent FROM affected;

  UPDATE public.tenant_subscriptions s SET estado='MOROSA',actualizado_en=now()
  WHERE s.tenant_id IN (
    SELECT i.tenant_id
    FROM public.billing_invoices i
    JOIN public.tenants t ON t.id=i.tenant_id
    WHERE i.estado IN ('ABIERTA','FALLIDA') AND i.vencimiento_en<p_now
      AND COALESCE(i.gracia_termina_en,i.vencimiento_en)>=p_now
      AND t.eliminado_en IS NULL AND t.estado IN ('ACTIVO','MOROSO')
  ) AND s.estado='ACTIVA';

  -- After grace, access is billing-only unless a timely proof is in its bounded pause.
  WITH affected AS (
    UPDATE public.tenants t SET estado='SUSPENDIDO',actualizado_en=now()
    FROM public.billing_invoices i
    WHERE i.tenant_id=t.id AND i.estado IN ('ABIERTA','FALLIDA')
      AND COALESCE(i.gracia_termina_en,i.vencimiento_en)<p_now
      AND COALESCE(i.revision_pausa_hasta,'-infinity'::timestamptz)<=p_now
      AND t.estado IN ('ACTIVO','MOROSO') AND t.eliminado_en IS NULL RETURNING t.id
  ) SELECT count(*) INTO v_suspended FROM affected;

  UPDATE public.tenant_subscriptions s SET estado='PAUSADA',actualizado_en=now()
  WHERE s.tenant_id IN (
    SELECT i.tenant_id
    FROM public.billing_invoices i
    JOIN public.tenants t ON t.id=i.tenant_id
    WHERE i.estado IN ('ABIERTA','FALLIDA')
      AND COALESCE(i.gracia_termina_en,i.vencimiento_en)<p_now
      AND COALESCE(i.revision_pausa_hasta,'-infinity'::timestamptz)<=p_now
      AND t.eliminado_en IS NULL AND t.estado IN ('ACTIVO','MOROSO','SUSPENDIDO')
  ) AND s.estado IN ('ACTIVA','MOROSA');

  -- More than fifteen days late: void the stale period and issue a reactivation
  -- document from today. Cancelled or archived tenants are deliberately excluded.
  FOR v_row IN
    SELECT i.*,s.price_id,p.intervalo
    FROM public.billing_invoices i
    JOIN public.tenant_subscriptions s ON s.tenant_id=i.tenant_id AND s.id=i.subscription_id
    JOIN public.billing_prices p ON p.id=s.price_id
    JOIN public.tenants t ON t.id=i.tenant_id
    WHERE i.estado IN ('ABIERTA','FALLIDA')
      AND i.vencimiento_en+make_interval(days=>v_settings.late_reissue_days)<p_now
      AND COALESCE(i.revision_pausa_hasta,'-infinity'::timestamptz)<=p_now
      AND t.eliminado_en IS NULL AND t.estado IN ('ACTIVO','MOROSO','SUSPENDIDO')
      AND NOT EXISTS (
        SELECT 1 FROM public.bank_transfer_submissions bs
        WHERE bs.invoice_id=i.id AND bs.estado='EN_REVISION'
      )
    FOR UPDATE OF i SKIP LOCKED
  LOOP
    UPDATE public.billing_invoices SET estado='ANULADA',revision_pausa_hasta=NULL
    WHERE id=v_row.id;
    v_start := p_now;
    v_end := v_start+CASE v_row.intervalo
      WHEN 'ANUAL' THEN interval '1 year' ELSE interval '1 month' END;
    PERFORM app_private.create_subscription_invoice(
      v_row.tenant_id,v_row.subscription_id,v_start,v_end,p_now,'REACTIVATION'
    );
    v_reissued := v_reissued+1;
  END LOOP;

  -- Abandoned first-payment onboarding: expire at day 15, archive at day 30.
  WITH affected AS (
    UPDATE public.tenant_onboarding_sessions o SET estado='EXPIRADA'
    FROM public.tenants t
    WHERE o.tenant_id=t.id AND o.estado='PENDIENTE'
      AND o.creado_en+interval '15 days'<p_now AND t.eliminado_en IS NULL
    RETURNING o.tenant_id
  ) SELECT count(*) INTO v_expired FROM affected;

  UPDATE public.tenants t SET estado='SUSPENDIDO',actualizado_en=now()
  WHERE t.estado='PENDIENTE_PAGO' AND t.eliminado_en IS NULL AND EXISTS (
    SELECT 1 FROM public.tenant_onboarding_sessions o
    WHERE o.tenant_id=t.id AND o.estado='EXPIRADA'
  );

  WITH affected AS (
    UPDATE public.tenants t SET estado='CANCELADO',eliminado_en=p_now,actualizado_en=now()
    WHERE t.estado IN ('PENDIENTE_PAGO','SUSPENDIDO') AND t.eliminado_en IS NULL
      AND t.creado_en+make_interval(days=>v_settings.pending_archive_days)<p_now
      AND NOT EXISTS (
        SELECT 1 FROM public.subscription_payments sp WHERE sp.tenant_id=t.id
      )
    RETURNING t.id
  ) SELECT count(*) INTO v_archived FROM affected;

  UPDATE public.billing_runs SET estado='COMPLETADO',finished_at=now(),metrics=jsonb_build_object(
    'issued',v_issued,'delinquent',v_delinquent,'suspended',v_suspended,
    'reissued',v_reissued,'onboardingExpired',v_expired,'pendingArchived',v_archived
  ) WHERE id=v_run;

  RETURN jsonb_build_object('accepted',true,'duplicate',false,'runId',v_run,
    'issued',v_issued,'delinquent',v_delinquent,'suspended',v_suspended,
    'reissued',v_reissued,'onboardingExpired',v_expired,'pendingArchived',v_archived);
EXCEPTION WHEN OTHERS THEN
  IF v_run IS NOT NULL THEN
    UPDATE public.billing_runs SET estado='FALLIDO',finished_at=now(),error=SQLERRM
    WHERE id=v_run;
  END IF;
  RAISE;
END;
$$;

ALTER FUNCTION app_private.run_billing_cycle(timestamptz) OWNER TO postgres;
REVOKE ALL ON FUNCTION app_private.run_billing_cycle(timestamptz)
  FROM PUBLIC,anon,authenticated,multilot_app;
GRANT EXECUTE ON FUNCTION app_private.run_billing_cycle(timestamptz)
  TO multilot_billing_worker;
