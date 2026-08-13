-- High-profile billing lifecycle/security checks; every fixture is rolled back.
BEGIN;

CREATE TEMP TABLE billing_test_ids(name text PRIMARY KEY,id uuid NOT NULL) ON COMMIT DROP;
GRANT SELECT,INSERT ON billing_test_ids TO multilot_billing_worker,multilot_app;

DO $setup$
DECLARE
  v_plan uuid;
  v_price uuid;
  v_owner_auth uuid := gen_random_uuid();
  v_admin_auth uuid := gen_random_uuid();
  v_seller_auth uuid := gen_random_uuid();
  v_legacy_role uuid;
  v_admin_profile uuid;
  v_bank uuid;
BEGIN
  SELECT id INTO v_plan FROM public.billing_plans WHERE codigo='STARTER';
  SELECT bp.id INTO v_price
  FROM public.billing_prices bp
  WHERE bp.plan_id=v_plan AND bp.moneda='USD' AND bp.intervalo='MENSUAL'
  LIMIT 1;
  IF v_price IS NULL THEN
    INSERT INTO public.billing_prices(
      plan_id,proveedor,proveedor_price_id,moneda,monto_minor,intervalo
    ) VALUES (v_plan,'DEVELOPMENT','bank_test_price','USD',2500,'MENSUAL')
    RETURNING id INTO v_price;
  ELSE
    UPDATE public.billing_prices SET activo=true WHERE id=v_price;
  END IF;
  INSERT INTO public.billing_price_channels(price_id,canal,activo)
  VALUES (v_price,'BANK_TRANSFER',true)
  ON CONFLICT (price_id,canal) DO UPDATE
  SET activo=true,actualizado_en=now();
  SELECT id INTO v_bank FROM public.billing_bank_accounts
  WHERE moneda='USD' AND activo LIMIT 1;
  IF v_bank IS NULL THEN
    INSERT INTO public.billing_bank_accounts(
      codigo,banco,titular,moneda,tipo_cuenta,numero_cuenta,instrucciones
    ) VALUES (
      'TEST_USD','Banco Test','AlphaBy Test','USD','CORRIENTE','000011112222',
      'Use the invoice bank reference.'
    ) RETURNING id INTO v_bank;
  END IF;

  INSERT INTO auth.users(
    id,aud,role,email,encrypted_password,email_confirmed_at,
    raw_app_meta_data,raw_user_meta_data,created_at,updated_at
  ) VALUES (
    v_owner_auth,'authenticated','authenticated','billing-owner@example.test','x',NULL,
    '{}'::jsonb,'{}'::jsonb,now(),now()
  ),(
    v_admin_auth,'authenticated','authenticated','finance-admin@example.test','x',now(),
    '{}'::jsonb,'{}'::jsonb,now(),now()
  ),(
    v_seller_auth,'authenticated','authenticated','billing-seller@example.test','x',now(),
    '{}'::jsonb,'{}'::jsonb,now(),now()
  );
  SELECT r.id INTO v_legacy_role
  FROM public.roles r JOIN public.tenants t ON t.id=r.tenant_id AND t.es_legacy
  ORDER BY r.creado_en LIMIT 1;
  INSERT INTO public.usuarios(auth_user_id,username,pass_hash,rol_id,nombre)
  VALUES (v_admin_auth,'billing_finance_admin','supabase:managed',v_legacy_role,'Finance Admin')
  RETURNING id INTO v_admin_profile;
  INSERT INTO public.platform_admins(perfil_id,activo,puede_revisar_facturacion)
  VALUES (v_admin_profile,true,true);

  INSERT INTO billing_test_ids VALUES
    ('price',v_price),('owner_auth',v_owner_auth),('admin_auth',v_admin_auth),
    ('seller_auth',v_seller_auth),('admin_profile',v_admin_profile),('bank',v_bank);
END
$setup$;

SET LOCAL ROLE multilot_billing_worker;
DO $bounded_onboarding_expiry$
BEGIN
  BEGIN
    PERFORM * FROM app_private.start_paid_signup(
      (SELECT id FROM billing_test_ids WHERE name='owner_auth'),
      'billing-owner@example.test','billing_owner','Billing Owner',
      (SELECT id FROM billing_test_ids WHERE name='price'),'BANK_TRANSFER',
      'billing-bank-test','Billing Bank Test','America/Managua','USD',
      now()+interval '31 days'
    );
    RAISE EXCEPTION 'unbounded onboarding expiry unexpectedly succeeded';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
END
$bounded_onboarding_expiry$;

DO $provision_pending$
DECLARE
  v_profile uuid;
  v_onboarding uuid;
BEGIN
  SELECT profile_id,onboarding_session_id INTO v_profile,v_onboarding
  FROM app_private.start_paid_signup(
    (SELECT id FROM billing_test_ids WHERE name='owner_auth'),
    'billing-owner@example.test','billing_owner','Billing Owner',
    (SELECT id FROM billing_test_ids WHERE name='price'),'BANK_TRANSFER',
    'billing-bank-test','Billing Bank Test','America/Managua','USD',
    now()+interval '15 days'
  );
  INSERT INTO billing_test_ids VALUES
    ('owner_profile',v_profile),('onboarding',v_onboarding);
END
$provision_pending$;
RESET ROLE;

INSERT INTO billing_test_ids(name,id)
SELECT 'tenant',tenant_id FROM public.tenant_onboarding_sessions
WHERE id=(SELECT id FROM billing_test_ids WHERE name='onboarding');

DO $pending_state$
DECLARE v_tenant uuid := (SELECT id FROM billing_test_ids WHERE name='tenant');
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id=v_tenant AND estado='PENDIENTE_PAGO') THEN
    RAISE EXCEPTION 'signup did not create a pending-payment tenant';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.tenant_subscriptions
    WHERE tenant_id=v_tenant AND estado='INCOMPLETA'
  ) THEN RAISE EXCEPTION 'signup did not create an incomplete subscription'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.membresias_tenant
    WHERE tenant_id=v_tenant AND es_propietario AND puede_gestionar_facturacion
  ) THEN RAISE EXCEPTION 'pending tenant owner lacks billing ownership'; END IF;
  IF EXISTS (SELECT 1 FROM public.billing_invoices WHERE tenant_id=v_tenant) THEN
    RAISE EXCEPTION 'invoice was issued before email verification';
  END IF;
END
$pending_state$;

DO $seller_fixture$
DECLARE
  v_tenant uuid := (SELECT id FROM billing_test_ids WHERE name='tenant');
  v_legacy_role uuid;
  v_tenant_role uuid;
  v_profile uuid;
  v_membership uuid;
BEGIN
  SELECT r.id INTO v_legacy_role FROM public.roles r
  JOIN public.tenants t ON t.id=r.tenant_id AND t.es_legacy
  ORDER BY r.creado_en LIMIT 1;
  SELECT id INTO v_tenant_role FROM public.roles
  WHERE tenant_id=v_tenant ORDER BY creado_en LIMIT 1;
  INSERT INTO public.usuarios(auth_user_id,username,pass_hash,rol_id,nombre)
  VALUES ((SELECT id FROM billing_test_ids WHERE name='seller_auth'),
    'billing_seller','supabase:managed',v_legacy_role,'Billing Seller')
  RETURNING id INTO v_profile;
  INSERT INTO public.membresias_tenant(
    tenant_id,perfil_id,rol_id,username,estado,puede_gestionar_facturacion
  ) VALUES (v_tenant,v_profile,v_tenant_role,'billing_seller','ACTIVO',true)
  RETURNING id INTO v_membership;
  INSERT INTO public.vendedores(
    tenant_id,membresia_id,usuario_id,nombre,cedula,activo
  ) VALUES (v_tenant,v_membership,v_profile,'Billing Seller','BILLING-SELLER',true);
END
$seller_fixture$;

SET LOCAL ROLE multilot_app;
DO $seller_billing_denied$
BEGIN
  BEGIN
    PERFORM * FROM app_private.resolve_billing_request_context(
      (SELECT id FROM billing_test_ids WHERE name='seller_auth'),
      (SELECT id::text FROM billing_test_ids WHERE name='tenant')
    );
    RAISE EXCEPTION 'seller unexpectedly entered billing despite explicit deny';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END
$seller_billing_denied$;
RESET ROLE;

SET LOCAL ROLE multilot_app;
DO $unverified_denied$
BEGIN
  BEGIN
    PERFORM * FROM app_private.resolve_billing_request_context(
      (SELECT id FROM billing_test_ids WHERE name='owner_auth'),NULL
    );
    RAISE EXCEPTION 'unverified owner unexpectedly entered billing';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END
$unverified_denied$;
RESET ROLE;

UPDATE auth.users SET email_confirmed_at=now(),updated_at=now()
WHERE id=(SELECT id FROM billing_test_ids WHERE name='owner_auth');

SET LOCAL ROLE multilot_app;
DO $open_billing_portal$
DECLARE
  v_context record;
  v_invoice uuid;
  v_submission uuid;
  v_evidence uuid;
  v_tenant uuid := (SELECT id FROM billing_test_ids WHERE name='tenant');
BEGIN
  SELECT * INTO v_context FROM app_private.resolve_billing_request_context(
    (SELECT id FROM billing_test_ids WHERE name='owner_auth'),v_tenant::text
  );
  PERFORM app_private.set_billing_request_context(
    (SELECT id FROM billing_test_ids WHERE name='owner_auth'),v_context.tenant_id,
    v_context.profile_id,v_context.membership_id
  );
  v_invoice := app_private.ensure_initial_bank_invoice();
  INSERT INTO billing_test_ids VALUES ('invoice',v_invoice);
  IF (app_private.get_billing_portal()->'tenant'->>'status')<>'PENDIENTE_PAGO' THEN
    RAISE EXCEPTION 'billing portal did not preserve pending tenant state';
  END IF;

  BEGIN
    PERFORM app_private.create_bank_transfer_submission(
      v_invoice,(SELECT id FROM billing_test_ids WHERE name='bank'),
      'BANK-FAIL-AMOUNT',
      (SELECT monto_minor-1 FROM public.billing_prices
        WHERE id=(SELECT id FROM billing_test_ids WHERE name='price')),
      'USD',now(),'Billing Owner',NULL
    );
    RAISE EXCEPTION 'partial payment declaration unexpectedly succeeded';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;

  v_submission := app_private.create_bank_transfer_submission(
    v_invoice,(SELECT id FROM billing_test_ids WHERE name='bank'),
    'BANK-OK-0001',
    (SELECT monto_minor FROM public.billing_prices
      WHERE id=(SELECT id FROM billing_test_ids WHERE name='price')),
    'USD',now(),'Billing Owner','1234'
  );
  INSERT INTO billing_test_ids VALUES ('submission',v_submission);
  v_evidence := app_private.register_payment_evidence(
    v_submission,v_tenant::text||'/'||v_submission::text||'/proof.pdf',
    'proof.pdf','application/pdf',128,repeat('a',64)
  );
  INSERT INTO billing_test_ids VALUES ('evidence',v_evidence);
  IF NOT EXISTS (
    SELECT 1 FROM public.bank_transfer_submissions
    WHERE id=v_submission AND estado='EN_REVISION'
  ) THEN RAISE EXCEPTION 'evidence did not enqueue transfer review'; END IF;
END
$open_billing_portal$;
RESET ROLE;

SET LOCAL ROLE multilot_app;
DO $platform_review$
DECLARE
  v_context record;
  v_result jsonb;
BEGIN
  SELECT * INTO v_context FROM app_private.set_platform_billing_context(
    (SELECT id FROM billing_test_ids WHERE name='admin_auth')
  );
  IF NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(
      app_private.list_platform_transfer_queue('EN_REVISION',100)
    ) AS item
    WHERE item->>'id'=(SELECT id::text FROM billing_test_ids WHERE name='submission')
  ) THEN RAISE EXCEPTION 'finance review queue is incomplete'; END IF;
  v_result := app_private.review_bank_transfer(
    (SELECT id FROM billing_test_ids WHERE name='submission'),
    'APROBADA','REAL-BANK-TXN-0001','Verified against bank statement'
  );
  IF v_result->>'paymentId' IS NULL THEN
    RAISE EXCEPTION 'approval did not create the canonical payment';
  END IF;
  BEGIN
    PERFORM app_private.review_bank_transfer(
      (SELECT id FROM billing_test_ids WHERE name='submission'),
      'APROBADA','REAL-BANK-TXN-0001','duplicate'
    );
    RAISE EXCEPTION 'duplicate approval unexpectedly succeeded';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
END
$platform_review$;
RESET ROLE;

DO $confirmed_state$
DECLARE v_tenant uuid := (SELECT id FROM billing_test_ids WHERE name='tenant');
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id=v_tenant AND estado='ACTIVO') THEN
    RAISE EXCEPTION 'approved payment did not activate tenant';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.billing_invoices
    WHERE id=(SELECT id FROM billing_test_ids WHERE name='invoice')
      AND estado='PAGADA' AND pagada_en IS NOT NULL
  ) THEN RAISE EXCEPTION 'approved payment did not settle invoice'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.subscription_payments
    WHERE invoice_id=(SELECT id FROM billing_test_ids WHERE name='invoice')
      AND origen='TRANSFERENCIA_BANCARIA'
      AND monto_minor=(SELECT monto_minor FROM public.billing_prices
        WHERE id=(SELECT id FROM billing_test_ids WHERE name='price'))
  ) THEN RAISE EXCEPTION 'canonical payment ledger row is missing'; END IF;
  BEGIN
    UPDATE public.subscription_payments SET monto_minor=1
    WHERE invoice_id=(SELECT id FROM billing_test_ids WHERE name='invoice');
    RAISE EXCEPTION 'payment ledger mutation unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END
$confirmed_state$;

DO $archived_tenant_fixture$
DECLARE
  v_tenant uuid := (SELECT id FROM billing_test_ids WHERE name='tenant');
  v_subscription uuid;
  v_invoice uuid;
BEGIN
  SELECT id INTO v_subscription
  FROM public.tenant_subscriptions
  WHERE tenant_id=v_tenant;

  v_invoice := app_private.create_subscription_invoice(
    v_tenant,v_subscription,
    '2025-12-01T00:00:00Z','2026-01-01T00:00:00Z',
    '2025-12-01T00:00:00Z','REACTIVATION'
  );
  INSERT INTO billing_test_ids VALUES ('archived_invoice',v_invoice);

  UPDATE public.tenant_subscriptions
  SET estado='CANCELADA',cancelar_al_final=true
  WHERE id=v_subscription;
  UPDATE public.tenants
  SET estado='CANCELADO',eliminado_en='2026-01-02T00:00:00Z'
  WHERE id=v_tenant;
END
$archived_tenant_fixture$;

SET LOCAL ROLE multilot_billing_worker;
DO $cycle_and_privileges$
DECLARE v_first jsonb; v_second jsonb;
BEGIN
  v_first := app_private.run_billing_cycle('2026-07-16T12:00:00Z');
  v_second := app_private.run_billing_cycle('2026-07-16T12:30:00Z');
  IF COALESCE((v_first->>'accepted')::boolean,false)<>true
     OR COALESCE((v_second->>'duplicate')::boolean,false)<>true THEN
    RAISE EXCEPTION 'billing cycle is not idempotent';
  END IF;
END
$cycle_and_privileges$;
RESET ROLE;

DO $archived_tenant_not_reissued$
DECLARE
  v_tenant uuid := (SELECT id FROM billing_test_ids WHERE name='tenant');
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.billing_invoices
    WHERE id=(SELECT id FROM billing_test_ids WHERE name='archived_invoice')
      AND estado='ABIERTA'
  ) THEN
    RAISE EXCEPTION 'archived tenant invoice was mutated by the billing cycle';
  END IF;
  IF (SELECT count(*) FROM public.billing_invoices WHERE tenant_id=v_tenant)<>2 THEN
    RAISE EXCEPTION 'billing cycle reissued a document for an archived tenant';
  END IF;
END
$archived_tenant_not_reissued$;

DO $least_privilege$
BEGIN
  IF has_function_privilege('anon','app_private.review_bank_transfer(uuid,revision_pago_decision,text,text)','EXECUTE')
     OR has_function_privilege('authenticated','app_private.get_billing_portal()','EXECUTE')
     OR has_table_privilege('multilot_app','public.subscription_payments','UPDATE') THEN
    RAISE EXCEPTION 'billing least-privilege boundary is open';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname='public' AND rowsecurity=false
  ) THEN RAISE EXCEPTION 'a public table is missing RLS'; END IF;
END
$least_privilege$;

ROLLBACK;
