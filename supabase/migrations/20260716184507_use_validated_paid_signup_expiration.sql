-- Keep the onboarding deadline supplied by the billing worker authoritative.
-- A bounded window prevents a compromised worker from creating an indefinitely
-- valid pending signup while preserving the commercial 15-day default.
CREATE OR REPLACE FUNCTION app_private.start_paid_signup(
  p_auth_user_id uuid,p_email text,p_username text,p_name text,p_price_id uuid,
  p_provider text,p_tenant_slug text,p_tenant_name text,
  p_timezone text DEFAULT 'America/Managua',p_currency char(3) DEFAULT 'USD',
  p_expires_at timestamptz DEFAULT (now()+interval '15 days')
)
RETURNS TABLE(profile_id uuid,onboarding_session_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog,public
AS $$
DECLARE
  v_template_role uuid;
  v_profile uuid;
  v_tenant uuid;
  v_owner_role uuid;
  v_membership uuid;
  v_account uuid;
  v_subscription uuid;
  v_session uuid;
  v_provider text := upper(btrim(p_provider));
  v_pending_provider_id text := 'pending:'||gen_random_uuid()::text;
BEGIN
  IF p_auth_user_id IS NULL
     OR p_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     OR lower(btrim(p_username)) !~ '^[a-z0-9][a-z0-9._-]{2,49}$'
     OR btrim(p_name)='' OR length(btrim(p_name))>120
     OR lower(btrim(p_tenant_slug)) !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
     OR btrim(p_tenant_name)='' OR length(btrim(p_tenant_name))>160
     OR v_provider !~ '^[A-Z][A-Z0-9_]*$'
     OR p_expires_at IS NULL OR p_expires_at<=now()
     OR p_expires_at>now()+interval '30 days' THEN
    RAISE EXCEPTION 'invalid company signup data' USING ERRCODE='22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.billing_prices bp
    JOIN public.billing_plans pl ON pl.id=bp.plan_id
    JOIN public.billing_price_channels ch ON ch.price_id=bp.id
    WHERE bp.id=p_price_id AND bp.activo AND pl.activo AND ch.activo
      AND ch.canal=v_provider AND bp.moneda=upper(p_currency)
  ) THEN
    RAISE EXCEPTION 'active price channel is required' USING ERRCODE='22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.tenants
    WHERE slug=lower(btrim(p_tenant_slug)) AND eliminado_en IS NULL
  ) THEN
    RAISE EXCEPTION 'tenant slug is already in use' USING ERRCODE='23505';
  END IF;

  SELECT r.id INTO v_template_role
  FROM public.roles r JOIN public.tenants t ON t.id=r.tenant_id AND t.es_legacy
  ORDER BY (upper(r.nombre)='ADMIN') DESC,r.creado_en,r.id LIMIT 1;
  IF v_template_role IS NULL THEN
    RAISE EXCEPTION 'admin role template is missing' USING ERRCODE='55000';
  END IF;

  INSERT INTO public.usuarios(auth_user_id,username,pass_hash,rol_id,nombre,activo)
  VALUES (p_auth_user_id,lower(btrim(p_username)),'supabase:managed',v_template_role,
    btrim(p_name),true) RETURNING id INTO v_profile;
  INSERT INTO public.tenants(slug,nombre,estado,zona_horaria,moneda)
  VALUES (lower(btrim(p_tenant_slug)),btrim(p_tenant_name),'PENDIENTE_PAGO',
    p_timezone,upper(p_currency)) RETURNING id INTO v_tenant;

  INSERT INTO public.roles(tenant_id,nombre)
  SELECT v_tenant,r.nombre FROM public.roles r
  JOIN public.tenants t ON t.id=r.tenant_id WHERE t.es_legacy;
  INSERT INTO public.permisos_por_rol(
    tenant_id,rol_id,modulo_id,puede_leer,puede_crear,puede_actualizar,puede_borrar
  )
  SELECT v_tenant,target.id,p.modulo_id,p.puede_leer,p.puede_crear,
    p.puede_actualizar,p.puede_borrar
  FROM public.permisos_por_rol p
  JOIN public.roles source ON source.id=p.rol_id
  JOIN public.tenants legacy ON legacy.id=source.tenant_id AND legacy.es_legacy
  JOIN public.roles target
    ON target.tenant_id=v_tenant AND target.nombre=source.nombre;
  SELECT id INTO v_owner_role FROM public.roles
  WHERE tenant_id=v_tenant
  ORDER BY (upper(nombre)='ADMIN') DESC,creado_en,id LIMIT 1;
  INSERT INTO public.membresias_tenant(
    tenant_id,perfil_id,rol_id,username,estado,es_propietario,
    puede_gestionar_facturacion
  ) VALUES (
    v_tenant,v_profile,v_owner_role,lower(btrim(p_username)),'ACTIVO',true,true
  ) RETURNING id INTO v_membership;

  INSERT INTO public.tenant_billing_accounts(
    tenant_id,proveedor,email_facturacion,razon_social
  ) VALUES (v_tenant,'MULTI',lower(btrim(p_email)),btrim(p_tenant_name))
  RETURNING id INTO v_account;
  INSERT INTO public.tenant_subscriptions(
    tenant_id,billing_account_id,price_id,proveedor,estado
  ) VALUES (v_tenant,v_account,p_price_id,v_provider,'INCOMPLETA')
  RETURNING id INTO v_subscription;
  INSERT INTO public.tenant_onboarding_sessions(
    perfil_id,auth_user_id,email,tenant_id,price_id,proveedor,
    proveedor_session_id,estado,expira_en,tenant_slug,tenant_nombre,
    zona_horaria,moneda,metodo_pago
  ) VALUES (
    v_profile,p_auth_user_id,lower(btrim(p_email)),v_tenant,p_price_id,v_provider,
    v_pending_provider_id,'PENDIENTE',p_expires_at,
    lower(btrim(p_tenant_slug)),btrim(p_tenant_name),p_timezone,upper(p_currency),
    CASE WHEN v_provider IN ('BANK_TRANSFER','PAYPAL','DEVELOPMENT')
      THEN v_provider ELSE 'DEVELOPMENT' END
  ) RETURNING id INTO v_session;
  INSERT INTO public.outbox_events(
    tenant_id,aggregate_type,aggregate_id,event_type,payload
  ) VALUES (
    v_tenant,'tenant',v_tenant,'tenant.pending_payment',jsonb_build_object(
      'tenant_id',v_tenant,'profile_id',v_profile,'membership_id',v_membership,
      'subscription_id',v_subscription,'payment_method',v_provider
    )
  );
  RETURN QUERY SELECT v_profile,v_session;
END;
$$;

COMMENT ON FUNCTION app_private.start_paid_signup(
  uuid,text,text,text,uuid,text,text,text,text,char,timestamptz
) IS 'Creates a bounded pending-payment tenant ecosystem using the worker-supplied onboarding deadline.';
