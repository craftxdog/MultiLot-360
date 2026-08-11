-- Destructive-looking integration checks are transactionally isolated and rolled back.
BEGIN;

CREATE TEMP TABLE mt_test_ids (name text PRIMARY KEY, id uuid NOT NULL) ON COMMIT DROP;

DO $setup$
DECLARE
  v_legacy_role uuid;
  v_tenant_a uuid;
  v_tenant_b uuid;
  v_role_a uuid;
  v_role_b uuid;
  v_profile_a uuid;
  v_profile_b uuid;
  v_invited_profile uuid;
  v_member_a uuid;
  v_member_b uuid;
  v_invited_member uuid;
  v_vendor_a uuid;
  v_vendor_b uuid;
  v_invited_vendor uuid;
  v_config_a uuid;
  v_config_b uuid;
  v_shift_a uuid;
  v_shift_b uuid;
  v_sale_a uuid;
  v_sale_b uuid;
BEGIN
  SELECT id INTO v_legacy_role FROM public.roles ORDER BY creado_en LIMIT 1;

  INSERT INTO public.tenants(slug,nombre,estado) VALUES ('mt-test-a','Tenant Test A','ACTIVO') RETURNING id INTO v_tenant_a;
  INSERT INTO public.tenants(slug,nombre,estado) VALUES ('mt-test-b','Tenant Test B','ACTIVO') RETURNING id INTO v_tenant_b;
  INSERT INTO public.roles(tenant_id,nombre) VALUES (v_tenant_a,'ADMIN') RETURNING id INTO v_role_a;
  INSERT INTO public.roles(tenant_id,nombre) VALUES (v_tenant_b,'ADMIN') RETURNING id INTO v_role_b;

  INSERT INTO public.usuarios(username,pass_hash,rol_id,nombre)
    VALUES ('mt_test_profile_a','not-a-login-hash',v_legacy_role,'Test A') RETURNING id INTO v_profile_a;
  INSERT INTO public.usuarios(username,pass_hash,rol_id,nombre)
    VALUES ('mt_test_profile_b','not-a-login-hash',v_legacy_role,'Test B') RETURNING id INTO v_profile_b;
  INSERT INTO public.usuarios(username,pass_hash,rol_id,nombre,activo)
    VALUES ('mt_test_invited','supabase:pending',v_legacy_role,'Invited Test',false)
    RETURNING id INTO v_invited_profile;

  INSERT INTO public.membresias_tenant(tenant_id,perfil_id,rol_id,username,es_propietario)
    VALUES (v_tenant_a,v_profile_a,v_role_a,'owner',true) RETURNING id INTO v_member_a;
  INSERT INTO public.membresias_tenant(tenant_id,perfil_id,rol_id,username,es_propietario)
    VALUES (v_tenant_b,v_profile_b,v_role_b,'owner',true) RETURNING id INTO v_member_b;
  INSERT INTO public.membresias_tenant(tenant_id,perfil_id,rol_id,username,estado)
    VALUES (v_tenant_a,v_invited_profile,v_role_a,'invited','INVITADO')
    RETURNING id INTO v_invited_member;

  -- The same natural identifiers are valid in two isolated tenant ecosystems.
  INSERT INTO public.vendedores(tenant_id,membresia_id,usuario_id,nombre,cedula)
    VALUES (v_tenant_a,v_member_a,v_profile_a,'Seller','TEST-CEDULA') RETURNING id INTO v_vendor_a;
  INSERT INTO public.vendedores(tenant_id,membresia_id,usuario_id,nombre,cedula)
    VALUES (v_tenant_b,v_member_b,v_profile_b,'Seller','TEST-CEDULA') RETURNING id INTO v_vendor_b;
  INSERT INTO public.vendedores(
    tenant_id,membresia_id,usuario_id,nombre,cedula,activo
  ) VALUES (
    v_tenant_a,v_invited_member,v_invited_profile,'Invited Seller','INVITED-CEDULA',false
  ) RETURNING id INTO v_invited_vendor;
  INSERT INTO public.codigos_acceso_vendedor(
    tenant_id,usuario_id,vendedor_id,email,codigo_hash,enlace_token_hash,expira_en
  ) VALUES (
    v_tenant_a,v_invited_profile,v_invited_vendor,'invited@example.test',
    repeat('1',64),repeat('2',64),now()+interval '15 minutes'
  );
  INSERT INTO public.sorteos_config(tenant_id,codigo,hora)
    VALUES (v_tenant_a,'TEST-DRAW','23:59') RETURNING id INTO v_config_a;
  INSERT INTO public.sorteos_config(tenant_id,codigo,hora)
    VALUES (v_tenant_b,'TEST-DRAW','23:59') RETURNING id INTO v_config_b;
  INSERT INTO public.turnos(tenant_id,fecha,config_id)
    VALUES (v_tenant_a,current_date,v_config_a) RETURNING id INTO v_shift_a;
  INSERT INTO public.turnos(tenant_id,fecha,config_id)
    VALUES (v_tenant_b,current_date,v_config_b) RETURNING id INTO v_shift_b;
  INSERT INTO public.ventas(tenant_id,vendedor_id,turno_id)
    VALUES (v_tenant_a,v_vendor_a,v_shift_a) RETURNING id INTO v_sale_a;
  INSERT INTO public.ventas(tenant_id,vendedor_id,turno_id)
    VALUES (v_tenant_b,v_vendor_b,v_shift_b) RETURNING id INTO v_sale_b;

  INSERT INTO public.numeros_bloqueados(tenant_id,numero,turno_id,motivo)
    VALUES (v_tenant_a,'42',v_shift_a,'tenant isolation test');
  -- A block in A must not affect B.
  INSERT INTO public.venta_detalle(tenant_id,venta_id,numero,premio_miles)
    VALUES (v_tenant_b,v_sale_b,'42',1.25);

  INSERT INTO mt_test_ids VALUES
    ('tenant_a',v_tenant_a),('tenant_b',v_tenant_b),
    ('member_a',v_member_a),('member_b',v_member_b),
    ('vendor_a',v_vendor_a),('vendor_b',v_vendor_b),
    ('invited_profile',v_invited_profile),
    ('invited_member',v_invited_member),('invited_vendor',v_invited_vendor),
    ('sale_a',v_sale_a),('sale_b',v_sale_b),
    ('profile_a',v_profile_a),('profile_b',v_profile_b);
END
$setup$;

DO $integrity$
DECLARE
  a uuid := (SELECT id FROM mt_test_ids WHERE name='tenant_a');
  b uuid := (SELECT id FROM mt_test_ids WHERE name='tenant_b');
  vendor_a uuid := (SELECT id FROM mt_test_ids WHERE name='vendor_a');
  vendor_b uuid := (SELECT id FROM mt_test_ids WHERE name='vendor_b');
  sale_a uuid := (SELECT id FROM mt_test_ids WHERE name='sale_a');
  member_a uuid := (SELECT id FROM mt_test_ids WHERE name='member_a');
BEGIN
  -- Cross-tenant aggregate references must fail at trigger/FK level.
  BEGIN
    INSERT INTO public.ventas(tenant_id,vendedor_id,turno_id)
    SELECT a,vendor_b,t.id FROM public.turnos t WHERE t.tenant_id=a LIMIT 1;
    RAISE EXCEPTION 'cross-tenant sale unexpectedly succeeded';
  EXCEPTION WHEN check_violation OR foreign_key_violation THEN NULL;
  END;

  -- Tenant ownership can never be moved after insert.
  BEGIN
    UPDATE public.vendedores SET tenant_id=b WHERE id=vendor_a;
    RAISE EXCEPTION 'tenant mutation unexpectedly succeeded';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- The blocked number in tenant A must be enforced in A.
  BEGIN
    INSERT INTO public.venta_detalle(tenant_id,venta_id,numero,premio_miles)
      VALUES (a,sale_a,'42',1.00);
    RAISE EXCEPTION 'blocked number unexpectedly succeeded';
  EXCEPTION WHEN SQLSTATE '45000' THEN NULL;
  END;

  -- A tenant cannot lose its last active owner.
  BEGIN
    UPDATE public.membresias_tenant SET es_propietario=false WHERE id=member_a;
    RAISE EXCEPTION 'last owner removal unexpectedly succeeded';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END
$integrity$;

DO $billing$
DECLARE
  a uuid := (SELECT id FROM mt_test_ids WHERE name='tenant_a');
  v_plan uuid;
  v_price uuid;
  v_account uuid;
BEGIN
  SELECT id INTO v_plan FROM public.billing_plans WHERE codigo='STARTER';
  INSERT INTO public.billing_prices(plan_id,proveedor,proveedor_price_id,moneda,monto_minor)
    VALUES (v_plan,'TEST','price_mt_test','EUR',2500) RETURNING id INTO v_price;
  INSERT INTO mt_test_ids VALUES ('price',v_price);
  INSERT INTO public.tenant_billing_accounts(tenant_id,proveedor,proveedor_customer_id)
    VALUES (a,'TEST','customer_mt_test') RETURNING id INTO v_account;
  INSERT INTO public.tenant_subscriptions(tenant_id,billing_account_id,price_id,proveedor,proveedor_subscription_id,estado)
    VALUES (a,v_account,v_price,'TEST','sub_mt_test_1','ACTIVA');

  BEGIN
    INSERT INTO public.tenant_subscriptions(tenant_id,billing_account_id,price_id,proveedor,proveedor_subscription_id,estado)
      VALUES (a,v_account,v_price,'TEST','sub_mt_test_2','PRUEBA');
    RAISE EXCEPTION 'second live subscription unexpectedly succeeded';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  INSERT INTO public.billing_events(tenant_id,proveedor,proveedor_event_id,tipo,payload_hash)
    VALUES (a,'TEST','evt_mt_test','invoice.paid',repeat('a',64));
  BEGIN
    INSERT INTO public.billing_events(tenant_id,proveedor,proveedor_event_id,tipo,payload_hash)
      VALUES (a,'TEST','evt_mt_test','invoice.paid',repeat('a',64));
    RAISE EXCEPTION 'duplicate provider event unexpectedly succeeded';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
END
$billing$;

GRANT SELECT, INSERT ON mt_test_ids TO multilot_billing_worker, multilot_app;
SET LOCAL ROLE multilot_billing_worker;

INSERT INTO mt_test_ids(name,id)
SELECT 'onboarding', app_private.create_onboarding_session(
  (SELECT id FROM mt_test_ids WHERE name='profile_a'),
  (SELECT id FROM mt_test_ids WHERE name='price'),
  'TEST','checkout_mt_test','paid-mt-test','Paid Tenant Test',
  'America/Managua','EUR',now() + interval '30 minutes'
);
INSERT INTO mt_test_ids(name,id)
SELECT 'billing_event', app_private.record_billing_event(
  'TEST','evt_paid_mt_test','checkout.completed',repeat('b',64),'{}'::jsonb
);
INSERT INTO mt_test_ids(name,id)
SELECT 'paid_tenant', app_private.activate_paid_tenant(
  (SELECT id FROM mt_test_ids WHERE name='onboarding'),
  (SELECT id FROM mt_test_ids WHERE name='billing_event'),
  'customer_paid_mt_test','subscription_paid_mt_test',now(),now() + interval '1 month'
);

DO $paid_signup_worker$
DECLARE
  v_profile uuid;
  v_onboarding uuid;
  v_tenant uuid;
BEGIN
  IF (SELECT count(*) FROM app_private.list_signup_prices('TEST')) <> 1 THEN
    RAISE EXCEPTION 'billing worker could not list the active signup price';
  END IF;

  SELECT profile_id,onboarding_session_id INTO v_profile,v_onboarding
  FROM app_private.start_paid_signup(
    gen_random_uuid(),'owner-paid-signup@example.test','owner.paid.signup','Paid Signup Owner',
    (SELECT id FROM mt_test_ids WHERE name='price'),'TEST','paid-signup-mt-test',
    'Paid Signup Tenant','America/Managua','EUR',now() + interval '30 minutes'
  );
  INSERT INTO mt_test_ids VALUES ('paid_signup_profile',v_profile),('paid_signup_onboarding',v_onboarding);
  PERFORM app_private.bind_paid_signup(v_onboarding,'subscription_paid_signup_mt_test');
  v_tenant := app_private.process_subscription_event(
    'TEST','evt_paid_signup_mt_test','PAYMENT.COMPLETED',repeat('c',64),'{}'::jsonb,
    'subscription_paid_signup_mt_test','customer_paid_signup_mt_test','ACTIVA',
    now(),now() + interval '1 month'
  );
  INSERT INTO mt_test_ids VALUES ('paid_signup_tenant',v_tenant);

  IF app_private.process_subscription_event(
    'TEST','evt_paid_signup_mt_test','PAYMENT.COMPLETED',repeat('c',64),'{}'::jsonb,
    'subscription_paid_signup_mt_test','customer_paid_signup_mt_test','ACTIVA',
    now(),now() + interval '1 month'
  ) <> v_tenant THEN
    RAISE EXCEPTION 'duplicate verified billing event was not idempotent';
  END IF;
END
$paid_signup_worker$;

DO $platform_audit_worker$
DECLARE
  v_event jsonb;
BEGIN
  v_event := app_private.record_platform_audit(
    NULL, 'MT_PLATFORM_TEST', jsonb_build_object('source','database-test')
  );
  IF v_event->>'event' <> 'MT_PLATFORM_TEST' OR v_event->>'id' IS NULL THEN
    RAISE EXCEPTION 'billing worker could not append a platform audit event';
  END IF;
  IF has_table_privilege(
    'multilot_billing_worker','public.auditoria_eventos','INSERT'
  ) THEN
    RAISE EXCEPTION 'billing worker has direct audit table access';
  END IF;
  IF has_function_privilege(
    'anon','app_private.record_platform_audit(uuid,text,jsonb)','EXECUTE'
  ) THEN
    RAISE EXCEPTION 'anonymous role can append a platform audit event';
  END IF;
END
$platform_audit_worker$;

RESET ROLE;

DO $provisioning$
DECLARE
  t uuid := (SELECT id FROM mt_test_ids WHERE name='paid_tenant');
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id=t AND estado='ACTIVO') THEN
    RAISE EXCEPTION 'paid tenant was not activated';
  END IF;
  IF (SELECT count(*) FROM public.membresias_tenant WHERE tenant_id=t AND es_propietario) <> 1 THEN
    RAISE EXCEPTION 'paid tenant owner membership was not provisioned';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.tenant_subscriptions WHERE tenant_id=t AND estado='ACTIVA') THEN
    RAISE EXCEPTION 'paid tenant subscription was not provisioned';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.outbox_events WHERE tenant_id=t AND event_type='tenant.activated') THEN
    RAISE EXCEPTION 'tenant activation outbox event was not emitted';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.membresias_tenant
    WHERE tenant_id=(SELECT id FROM mt_test_ids WHERE name='paid_signup_tenant')
      AND perfil_id=(SELECT id FROM mt_test_ids WHERE name='paid_signup_profile')
      AND es_propietario
  ) THEN
    RAISE EXCEPTION 'paid signup did not create the owner membership';
  END IF;
  IF has_table_privilege('multilot_billing_worker','public.tenants','SELECT') THEN
    RAISE EXCEPTION 'billing worker has direct tenant table access';
  END IF;
  IF has_function_privilege(
    'anon',
    'app_private.activate_paid_tenant(uuid,uuid,text,text,timestamp with time zone,timestamp with time zone)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'anonymous role can activate a paid tenant';
  END IF;
  IF has_function_privilege(
    'multilot_app',
    'app_private.process_subscription_event(text,text,text,character,jsonb,text,text,suscripcion_estado,timestamp with time zone,timestamp with time zone)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'tenant application role can process provider billing events';
  END IF;
END
$provisioning$;

DO $audit$
DECLARE
  a uuid := (SELECT id FROM mt_test_ids WHERE name='tenant_a');
  p uuid := (SELECT id FROM mt_test_ids WHERE name='profile_a');
  m uuid := (SELECT id FROM mt_test_ids WHERE name='member_a');
  v_id bigint;
BEGIN
  INSERT INTO public.auditoria_eventos(tenant_id,usuario_id,membresia_id,evento,payload)
    VALUES (a,p,m,'MT_TEST','{}') RETURNING id INTO v_id;
  BEGIN
    UPDATE public.auditoria_eventos SET evento='MUTATED' WHERE id=v_id;
    RAISE EXCEPTION 'audit mutation unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END
$audit$;

DO $privileges$
BEGIN
  IF to_regprocedure(
    'public.sp_set_limites_vendor_todos(uuid,numeric,date,date)'
  ) IS NOT NULL THEN
    RAISE EXCEPTION 'legacy global number-limit function still exists';
  END IF;
  IF has_function_privilege('anon','public.sp_crear_venta(uuid,jsonb)','EXECUTE')
     OR has_function_privilege('authenticated','public.sp_crear_venta(uuid,jsonb)','EXECUTE')
     OR has_function_privilege('service_role','public.sp_crear_venta(uuid,jsonb)','EXECUTE') THEN
    RAISE EXCEPTION 'legacy global sale RPC remains executable through a Data API role';
  END IF;
END
$privileges$;

SET LOCAL ROLE multilot_app;
DO $invitation_context$
DECLARE
  a uuid := (SELECT id FROM mt_test_ids WHERE name='tenant_a');
BEGIN
  IF app_private.set_seller_invitation_context(
    'invited@example.test',repeat('0',64),NULL
  ) THEN
    RAISE EXCEPTION 'invalid invitation credential activated a tenant context';
  END IF;
  IF NOT app_private.set_seller_invitation_context(
    'invited@example.test',repeat('1',64),NULL
  ) THEN
    RAISE EXCEPTION 'valid invitation credential did not activate context';
  END IF;
  IF app_private.current_tenant_id() <> a THEN
    RAISE EXCEPTION 'invitation activated the wrong tenant context';
  END IF;
  IF (SELECT count(*) FROM public.vendedores) <> 2
     OR EXISTS (SELECT 1 FROM public.vendedores WHERE tenant_id<>a) THEN
    RAISE EXCEPTION 'invitation context leaked a foreign tenant';
  END IF;
END
$invitation_context$;
RESET ROLE;

SELECT set_config('app.current_tenant_id',(SELECT id::text FROM mt_test_ids WHERE name='tenant_a'),true);
SELECT set_config('app.current_profile_id',(SELECT id::text FROM mt_test_ids WHERE name='profile_a'),true);
SELECT set_config('app.current_membership_id',(SELECT id::text FROM mt_test_ids WHERE name='member_a'),true);
SET LOCAL ROLE multilot_app;

DO $tenant_number_limits$
DECLARE
  a uuid := (SELECT id FROM mt_test_ids WHERE name='tenant_a');
  vendor_a uuid := (SELECT id FROM mt_test_ids WHERE name='vendor_a');
BEGIN
  IF public.sp_set_limites_vendor_todos(
    a, vendor_a, 25.50, current_date, NULL
  ) <> 100 THEN
    RAISE EXCEPTION 'tenant-scoped number-limit batch did not process 100 numbers';
  END IF;
  IF (
    SELECT count(*) FROM public.limites_numero
    WHERE tenant_id=a AND vendedor_id=vendor_a AND config_id IS NULL
  ) <> 100 THEN
    RAISE EXCEPTION 'tenant-scoped number-limit batch wrote incomplete data';
  END IF;
END
$tenant_number_limits$;

DO $rls$
BEGIN
  IF (SELECT count(*) FROM public.tenants) <> 1 THEN
    RAISE EXCEPTION 'tenant RLS leaked tenant rows';
  END IF;
  IF (SELECT count(*) FROM public.vendedores) <> 2 THEN
    RAISE EXCEPTION 'tenant RLS leaked seller rows';
  END IF;
  IF EXISTS (SELECT 1 FROM public.vendedores WHERE tenant_id <> app_private.current_tenant_id()) THEN
    RAISE EXCEPTION 'tenant RLS exposed a foreign seller';
  END IF;
END
$rls$;

RESET ROLE;
ROLLBACK;
