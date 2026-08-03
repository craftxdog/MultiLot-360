-- AlphaBy accounts-receivable control plane.
-- Bank transfers are declarations until a platform finance administrator
-- reconciles them against the real bank account. Card/bank credentials never
-- enter this schema and every confirmation converges on one payment ledger.

SET lock_timeout = '10s';
SET statement_timeout = '120s';

CREATE TYPE public.transferencia_pago_estado AS ENUM (
  'PENDIENTE_EVIDENCIA', 'EN_REVISION', 'APROBADA', 'RECHAZADA', 'CANCELADA'
);
CREATE TYPE public.revision_pago_decision AS ENUM ('APROBADA', 'RECHAZADA');
CREATE TYPE public.origen_pago_suscripcion AS ENUM (
  'TRANSFERENCIA_BANCARIA', 'PAYPAL', 'DEVELOPMENT'
);
CREATE TYPE public.billing_run_estado AS ENUM (
  'EJECUTANDO', 'COMPLETADO', 'FALLIDO'
);

ALTER TABLE public.membresias_tenant
  ADD COLUMN puede_gestionar_facturacion boolean NOT NULL DEFAULT false;

ALTER TABLE public.platform_admins
  ADD COLUMN activo boolean NOT NULL DEFAULT true,
  ADD COLUMN puede_revisar_facturacion boolean NOT NULL DEFAULT true;

ALTER TABLE public.tenant_onboarding_sessions
  ADD COLUMN metodo_pago text NOT NULL DEFAULT 'BANK_TRANSFER',
  ADD CONSTRAINT ck_onboarding_metodo_pago
    CHECK (metodo_pago IN ('BANK_TRANSFER','PAYPAL','DEVELOPMENT'));

-- A canonical price can be sold through several payment channels without
-- duplicating the plan, amount or subscription relation.
CREATE TABLE public.billing_price_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  price_id uuid NOT NULL REFERENCES public.billing_prices(id) ON DELETE CASCADE,
  canal text NOT NULL,
  proveedor_price_id text,
  activo boolean NOT NULL DEFAULT true,
  configuracion jsonb NOT NULL DEFAULT '{}'::jsonb,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_billing_price_channel UNIQUE (price_id, canal),
  CONSTRAINT ck_billing_price_channel_name CHECK (canal ~ '^[A-Z][A-Z0-9_]*$'),
  CONSTRAINT ck_billing_price_channel_config CHECK (jsonb_typeof(configuracion) = 'object')
);
CREATE UNIQUE INDEX uq_billing_price_channel_provider_id
  ON public.billing_price_channels (canal, proveedor_price_id)
  WHERE proveedor_price_id IS NOT NULL;
CREATE INDEX ix_billing_price_channels_active
  ON public.billing_price_channels (canal, activo, price_id);

INSERT INTO public.billing_price_channels(price_id,canal,proveedor_price_id,activo)
SELECT id, upper(proveedor), proveedor_price_id, activo
FROM public.billing_prices
ON CONFLICT (price_id,canal) DO NOTHING;

INSERT INTO public.billing_price_channels(price_id,canal,proveedor_price_id,activo)
SELECT id, 'BANK_TRANSFER', NULL, activo
FROM public.billing_prices
ON CONFLICT (price_id,canal) DO NOTHING;

CREATE OR REPLACE FUNCTION app_private.trg_sync_legacy_price_channels()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog,public
AS $$
BEGIN
  IF TG_OP='UPDATE' AND upper(OLD.proveedor)<>upper(NEW.proveedor) THEN
    DELETE FROM public.billing_price_channels
    WHERE price_id=NEW.id AND canal=upper(OLD.proveedor);
  END IF;
  INSERT INTO public.billing_price_channels(
    price_id,canal,proveedor_price_id,activo
  ) VALUES (
    NEW.id,upper(NEW.proveedor),NEW.proveedor_price_id,NEW.activo
  ) ON CONFLICT (price_id,canal) DO UPDATE
  SET proveedor_price_id=EXCLUDED.proveedor_price_id,activo=EXCLUDED.activo;
  INSERT INTO public.billing_price_channels(price_id,canal,activo)
  VALUES (NEW.id,'BANK_TRANSFER',NEW.activo)
  ON CONFLICT (price_id,canal) DO UPDATE SET activo=EXCLUDED.activo;
  RETURN NEW;
END;
$$;
CREATE TRIGGER billing_prices_sync_channels
AFTER INSERT OR UPDATE OF proveedor,proveedor_price_id,activo
ON public.billing_prices
FOR EACH ROW EXECUTE FUNCTION app_private.trg_sync_legacy_price_channels();

-- Provider customer/subscription ids are optional for manual bank transfer.
ALTER TABLE public.tenant_billing_accounts
  DROP CONSTRAINT uq_billing_accounts_provider_customer;
CREATE UNIQUE INDEX uq_billing_accounts_provider_customer_present
  ON public.tenant_billing_accounts (proveedor, proveedor_customer_id)
  WHERE proveedor_customer_id IS NOT NULL;

ALTER TABLE public.tenant_subscriptions
  DROP CONSTRAINT uq_subscriptions_provider;
CREATE UNIQUE INDEX uq_subscriptions_provider_present
  ON public.tenant_subscriptions (proveedor, proveedor_subscription_id)
  WHERE proveedor_subscription_id IS NOT NULL;

CREATE TABLE public.billing_bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  banco text NOT NULL,
  titular text NOT NULL,
  moneda char(3) NOT NULL,
  tipo_cuenta text NOT NULL,
  numero_cuenta text NOT NULL,
  instrucciones text,
  activo boolean NOT NULL DEFAULT true,
  orden smallint NOT NULL DEFAULT 0,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_billing_bank_accounts_code CHECK (codigo ~ '^[A-Z][A-Z0-9_]*$'),
  CONSTRAINT ck_billing_bank_accounts_currency CHECK (moneda IN ('NIO','USD')),
  CONSTRAINT ck_billing_bank_accounts_number CHECK (length(btrim(numero_cuenta)) BETWEEN 4 AND 64),
  CONSTRAINT ck_billing_bank_accounts_order CHECK (orden >= 0)
);
CREATE UNIQUE INDEX uq_billing_bank_account_active_currency
  ON public.billing_bank_accounts (moneda)
  WHERE activo;

CREATE TABLE public.billing_document_sequences (
  document_type text NOT NULL,
  document_year smallint NOT NULL,
  last_value bigint NOT NULL DEFAULT 0,
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (document_type, document_year),
  CONSTRAINT ck_billing_document_sequence_type CHECK (document_type ~ '^[A-Z][A-Z0-9_]*$'),
  CONSTRAINT ck_billing_document_sequence_year CHECK (document_year BETWEEN 2020 AND 9999),
  CONSTRAINT ck_billing_document_sequence_value CHECK (last_value >= 0)
);

ALTER TABLE public.billing_invoices
  ADD COLUMN numero_documento text,
  ADD COLUMN referencia_bancaria text,
  ADD COLUMN periodo_inicia_en timestamptz,
  ADD COLUMN periodo_termina_en timestamptz,
  ADD COLUMN emitida_en timestamptz,
  ADD COLUMN gracia_termina_en timestamptz,
  ADD COLUMN revision_pausa_hasta timestamptz,
  ADD COLUMN metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD CONSTRAINT ck_billing_invoice_period CHECK (
    periodo_termina_en IS NULL OR periodo_inicia_en IS NULL
    OR periodo_termina_en > periodo_inicia_en
  ),
  ADD CONSTRAINT ck_billing_invoice_metadata CHECK (jsonb_typeof(metadata) = 'object');
CREATE UNIQUE INDEX uq_billing_invoices_document_number
  ON public.billing_invoices (numero_documento)
  WHERE numero_documento IS NOT NULL;
CREATE UNIQUE INDEX uq_billing_invoices_bank_reference
  ON public.billing_invoices (referencia_bancaria)
  WHERE referencia_bancaria IS NOT NULL;
CREATE INDEX ix_billing_invoices_collection
  ON public.billing_invoices (estado, vencimiento_en, gracia_termina_en)
  WHERE estado IN ('ABIERTA','FALLIDA');

-- Tenant-qualified key used by every child ledger table.
ALTER TABLE public.billing_invoices
  ADD CONSTRAINT uq_billing_invoices_tenant_id_id UNIQUE (tenant_id,id);

CREATE TABLE public.billing_invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES public.billing_invoices(id) ON DELETE CASCADE,
  descripcion text NOT NULL,
  cantidad integer NOT NULL DEFAULT 1,
  precio_unitario_minor bigint NOT NULL,
  subtotal_minor bigint NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  creado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_invoice_items_invoice_tenant FOREIGN KEY (tenant_id,invoice_id)
    REFERENCES public.billing_invoices(tenant_id,id),
  CONSTRAINT ck_invoice_items_amount CHECK (
    cantidad > 0 AND precio_unitario_minor >= 0
    AND subtotal_minor = cantidad::bigint * precio_unitario_minor
  ),
  CONSTRAINT ck_invoice_items_metadata CHECK (jsonb_typeof(metadata) = 'object')
);
CREATE INDEX ix_billing_invoice_items_invoice
  ON public.billing_invoice_items (tenant_id, invoice_id, creado_en);

CREATE TABLE public.bank_transfer_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL,
  bank_account_id uuid NOT NULL REFERENCES public.billing_bank_accounts(id),
  submitted_by_membership_id uuid NOT NULL,
  estado public.transferencia_pago_estado NOT NULL DEFAULT 'PENDIENTE_EVIDENCIA',
  moneda char(3) NOT NULL,
  monto_minor bigint NOT NULL,
  referencia_declarada text,
  fecha_transferencia timestamptz NOT NULL,
  nombre_ordenante text NOT NULL,
  cuenta_origen_ultimos4 char(4),
  indicadores_riesgo jsonb NOT NULL DEFAULT '[]'::jsonb,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_bank_submission_invoice_tenant FOREIGN KEY (tenant_id,invoice_id)
    REFERENCES public.billing_invoices(tenant_id,id),
  CONSTRAINT fk_bank_submission_actor_tenant FOREIGN KEY (tenant_id,submitted_by_membership_id)
    REFERENCES public.membresias_tenant(tenant_id,id),
  CONSTRAINT uq_bank_submissions_tenant_id_id UNIQUE (tenant_id,id),
  CONSTRAINT ck_bank_submission_currency CHECK (moneda IN ('NIO','USD')),
  CONSTRAINT ck_bank_submission_amount CHECK (monto_minor > 0),
  CONSTRAINT ck_bank_submission_reference CHECK (
    referencia_declarada IS NULL OR length(btrim(referencia_declarada)) BETWEEN 3 AND 120
  ),
  CONSTRAINT ck_bank_submission_last4 CHECK (
    cuenta_origen_ultimos4 IS NULL OR cuenta_origen_ultimos4 ~ '^[0-9]{4}$'
  ),
  CONSTRAINT ck_bank_submission_risk CHECK (jsonb_typeof(indicadores_riesgo) = 'array'),
  CONSTRAINT ck_bank_submission_transfer_date CHECK (fecha_transferencia <= creado_en + interval '10 minutes')
);
CREATE UNIQUE INDEX uq_bank_submission_invoice_live
  ON public.bank_transfer_submissions (invoice_id)
  WHERE estado IN ('PENDIENTE_EVIDENCIA','EN_REVISION','APROBADA');
CREATE UNIQUE INDEX uq_bank_submission_reference
  ON public.bank_transfer_submissions (bank_account_id,lower(referencia_declarada))
  WHERE referencia_declarada IS NOT NULL AND estado <> 'CANCELADA';
CREATE INDEX ix_bank_submissions_review_queue
  ON public.bank_transfer_submissions (estado,creado_en)
  WHERE estado = 'EN_REVISION';
CREATE INDEX ix_bank_submissions_tenant_created
  ON public.bank_transfer_submissions (tenant_id,creado_en DESC);

CREATE TABLE public.payment_evidence_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  submission_id uuid NOT NULL,
  uploaded_by_membership_id uuid NOT NULL,
  bucket_id text NOT NULL DEFAULT 'billing-evidence',
  object_path text NOT NULL UNIQUE,
  original_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL,
  sha256 char(64) NOT NULL,
  creado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_payment_evidence_submission_tenant FOREIGN KEY (tenant_id,submission_id)
    REFERENCES public.bank_transfer_submissions(tenant_id,id) ON DELETE CASCADE,
  CONSTRAINT fk_payment_evidence_actor_tenant FOREIGN KEY (tenant_id,uploaded_by_membership_id)
    REFERENCES public.membresias_tenant(tenant_id,id),
  CONSTRAINT ck_payment_evidence_bucket CHECK (bucket_id = 'billing-evidence'),
  CONSTRAINT ck_payment_evidence_mime CHECK (mime_type IN ('application/pdf','image/jpeg','image/png')),
  CONSTRAINT ck_payment_evidence_size CHECK (size_bytes BETWEEN 1 AND 10485760),
  CONSTRAINT ck_payment_evidence_hash CHECK (sha256 ~ '^[0-9a-f]{64}$')
);
CREATE INDEX ix_payment_evidence_submission
  ON public.payment_evidence_files (tenant_id,submission_id,creado_en);

CREATE TABLE public.payment_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  submission_id uuid NOT NULL,
  platform_admin_id uuid NOT NULL REFERENCES public.platform_admins(perfil_id),
  decision public.revision_pago_decision NOT NULL,
  referencia_bancaria_confirmada text,
  notas text,
  creado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_payment_review_submission_tenant FOREIGN KEY (tenant_id,submission_id)
    REFERENCES public.bank_transfer_submissions(tenant_id,id),
  CONSTRAINT ck_payment_review_approval_reference CHECK (
    decision <> 'APROBADA' OR length(btrim(referencia_bancaria_confirmada)) BETWEEN 3 AND 160
  )
);
CREATE UNIQUE INDEX uq_payment_review_approval
  ON public.payment_reviews (submission_id)
  WHERE decision = 'APROBADA';
CREATE INDEX ix_payment_reviews_submission_created
  ON public.payment_reviews (tenant_id,submission_id,creado_en DESC);

CREATE TABLE public.subscription_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL,
  subscription_id uuid NOT NULL,
  submission_id uuid,
  billing_event_id uuid REFERENCES public.billing_events(id),
  origen public.origen_pago_suscripcion NOT NULL,
  referencia_externa text NOT NULL,
  moneda char(3) NOT NULL,
  monto_minor bigint NOT NULL,
  confirmado_por_platform_admin_id uuid REFERENCES public.platform_admins(perfil_id),
  confirmado_en timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT fk_subscription_payment_invoice_tenant FOREIGN KEY (tenant_id,invoice_id)
    REFERENCES public.billing_invoices(tenant_id,id),
  CONSTRAINT fk_subscription_payment_subscription_tenant FOREIGN KEY (tenant_id,subscription_id)
    REFERENCES public.tenant_subscriptions(tenant_id,id),
  CONSTRAINT fk_subscription_payment_submission_tenant FOREIGN KEY (tenant_id,submission_id)
    REFERENCES public.bank_transfer_submissions(tenant_id,id),
  CONSTRAINT uq_subscription_payments_invoice UNIQUE (invoice_id),
  CONSTRAINT uq_subscription_payments_reference UNIQUE (origen,referencia_externa),
  CONSTRAINT ck_subscription_payment_currency CHECK (moneda ~ '^[A-Z]{3}$'),
  CONSTRAINT ck_subscription_payment_amount CHECK (monto_minor > 0),
  CONSTRAINT ck_subscription_payment_metadata CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT ck_subscription_payment_source CHECK (
    (origen = 'TRANSFERENCIA_BANCARIA' AND submission_id IS NOT NULL AND confirmado_por_platform_admin_id IS NOT NULL)
    OR (origen IN ('PAYPAL','DEVELOPMENT') AND billing_event_id IS NOT NULL)
  )
);
CREATE INDEX ix_subscription_payments_tenant_confirmed
  ON public.subscription_payments (tenant_id,confirmado_en DESC);

CREATE TABLE public.subscription_payment_reversals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.subscription_payments(id),
  platform_admin_id uuid NOT NULL REFERENCES public.platform_admins(perfil_id),
  motivo text NOT NULL,
  creado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_subscription_payment_reversal UNIQUE (payment_id),
  CONSTRAINT ck_subscription_payment_reversal_reason CHECK (length(btrim(motivo)) BETWEEN 5 AND 500)
);

CREATE TABLE public.billing_settings (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  renewal_issue_days smallint NOT NULL DEFAULT 5,
  grace_days smallint NOT NULL DEFAULT 3,
  review_pause_hours smallint NOT NULL DEFAULT 48,
  late_reissue_days smallint NOT NULL DEFAULT 15,
  pending_archive_days smallint NOT NULL DEFAULT 30,
  review_target_hours smallint NOT NULL DEFAULT 24,
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_billing_settings_ranges CHECK (
    renewal_issue_days BETWEEN 1 AND 30
    AND grace_days BETWEEN 0 AND 30
    AND review_pause_hours BETWEEN 1 AND 72
    AND late_reissue_days BETWEEN 1 AND 90
    AND pending_archive_days BETWEEN late_reissue_days AND 180
    AND review_target_hours BETWEEN 1 AND 72
  )
);
INSERT INTO public.billing_settings(singleton) VALUES (true);

CREATE TABLE public.billing_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_key text NOT NULL UNIQUE,
  estado public.billing_run_estado NOT NULL DEFAULT 'EJECUTANDO',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  CONSTRAINT ck_billing_runs_metrics CHECK (jsonb_typeof(metrics) = 'object'),
  CONSTRAINT ck_billing_runs_finished CHECK (
    (estado = 'EJECUTANDO' AND finished_at IS NULL)
    OR (estado IN ('COMPLETADO','FALLIDO') AND finished_at IS NOT NULL)
  )
);
CREATE INDEX ix_billing_runs_started ON public.billing_runs (started_at DESC);

-- Private evidence bucket. No storage.objects policy is created: only the API's
-- server-side service client can upload/download, and it issues short signed URLs.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES (
  'billing-evidence','billing-evidence',false,10485760,
  ARRAY['application/pdf','image/jpeg','image/png']::text[]
)
ON CONFLICT (id) DO UPDATE
SET public=false,
    file_size_limit=EXCLUDED.file_size_limit,
    allowed_mime_types=EXCLUDED.allowed_mime_types;

-- Every public table remains inaccessible to Supabase Data API roles.
REVOKE ALL ON public.billing_price_channels,public.billing_bank_accounts,
  public.billing_document_sequences,public.billing_invoice_items,
  public.bank_transfer_submissions,public.payment_evidence_files,
  public.payment_reviews,public.subscription_payments,
  public.subscription_payment_reversals,public.billing_settings,
  public.billing_runs
FROM PUBLIC,anon,authenticated,service_role;

GRANT SELECT ON public.billing_price_channels,public.billing_bank_accounts,
  public.billing_invoice_items,public.bank_transfer_submissions,
  public.payment_evidence_files,public.payment_reviews,
  public.subscription_payments
TO multilot_app;

REVOKE INSERT,UPDATE,DELETE ON public.tenant_billing_accounts,
  public.tenant_subscriptions,public.billing_invoices,public.billing_payment_methods
FROM multilot_app;

-- RLS is also enabled explicitly even though the project event trigger does it.
ALTER TABLE public.billing_price_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_document_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_transfer_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_evidence_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_payment_reversals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_runs ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION app_private.current_platform_admin_id()
RETURNS uuid
LANGUAGE sql
STABLE
PARALLEL SAFE
SET search_path = pg_catalog
AS $$
  SELECT NULLIF(current_setting('app.current_platform_admin_id',true),'')::uuid
$$;

CREATE OR REPLACE FUNCTION app_private.current_has_billing_access()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog,public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.membresias_tenant m
    WHERE m.id = app_private.current_membership_id()
      AND m.tenant_id = app_private.current_tenant_id()
      AND m.perfil_id = app_private.current_profile_id()
      AND m.estado = 'ACTIVO'
      AND m.eliminado_en IS NULL
      AND (m.es_propietario OR m.puede_gestionar_facturacion)
      AND NOT EXISTS (
        SELECT 1 FROM public.vendedores v
        WHERE v.tenant_id=m.tenant_id AND v.membresia_id=m.id
          AND v.activo AND v.eliminado_en IS NULL
      )
  )
$$;

CREATE OR REPLACE FUNCTION app_private.resolve_billing_request_context(
  p_auth_user_id uuid,
  p_tenant_selector text DEFAULT NULL
)
RETURNS TABLE(profile_id uuid,tenant_id uuid,membership_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog,public,auth
AS $$
DECLARE
  v_count integer;
BEGIN
  IF p_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'auth user id is required' USING ERRCODE='22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM auth.users au
    WHERE au.id=p_auth_user_id AND au.email_confirmed_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'verified email is required for billing access' USING ERRCODE='42501';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.usuarios u
  JOIN public.membresias_tenant m ON m.perfil_id=u.id
  JOIN public.tenants t ON t.id=m.tenant_id
  WHERE u.auth_user_id=p_auth_user_id
    AND u.activo AND u.eliminado_en IS NULL
    AND m.estado='ACTIVO' AND m.eliminado_en IS NULL
    AND t.estado IN ('PENDIENTE_PAGO','PRUEBA','ACTIVO','MOROSO','SUSPENDIDO')
    AND t.eliminado_en IS NULL
    AND (m.es_propietario OR m.puede_gestionar_facturacion)
    AND NOT EXISTS (
      SELECT 1 FROM public.vendedores v
      WHERE v.tenant_id=m.tenant_id AND v.membresia_id=m.id
        AND v.activo AND v.eliminado_en IS NULL
    )
    AND (
      p_tenant_selector IS NULL OR t.slug=lower(p_tenant_selector)
      OR t.id::text=p_tenant_selector
    );
  IF v_count=0 THEN
    RAISE EXCEPTION 'no billing membership matches the requested tenant' USING ERRCODE='42501';
  END IF;
  IF v_count>1 THEN
    RAISE EXCEPTION 'tenant selection is required for billing' USING ERRCODE='22023';
  END IF;

  RETURN QUERY
  SELECT u.id,t.id,m.id
  FROM public.usuarios u
  JOIN public.membresias_tenant m ON m.perfil_id=u.id
  JOIN public.tenants t ON t.id=m.tenant_id
  WHERE u.auth_user_id=p_auth_user_id
    AND u.activo AND u.eliminado_en IS NULL
    AND m.estado='ACTIVO' AND m.eliminado_en IS NULL
    AND t.estado IN ('PENDIENTE_PAGO','PRUEBA','ACTIVO','MOROSO','SUSPENDIDO')
    AND t.eliminado_en IS NULL
    AND (m.es_propietario OR m.puede_gestionar_facturacion)
    AND NOT EXISTS (
      SELECT 1 FROM public.vendedores v
      WHERE v.tenant_id=m.tenant_id AND v.membresia_id=m.id
        AND v.activo AND v.eliminado_en IS NULL
    )
    AND (
      p_tenant_selector IS NULL OR t.slug=lower(p_tenant_selector)
      OR t.id::text=p_tenant_selector
    )
  LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION app_private.set_billing_request_context(
  p_auth_user_id uuid,p_tenant_id uuid,p_profile_id uuid,p_membership_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog,public,auth
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM auth.users au
    JOIN public.usuarios u ON u.auth_user_id=au.id
    JOIN public.membresias_tenant m ON m.perfil_id=u.id
    JOIN public.tenants t ON t.id=m.tenant_id
    WHERE au.id=p_auth_user_id AND au.email_confirmed_at IS NOT NULL
      AND u.id=p_profile_id AND u.activo AND u.eliminado_en IS NULL
      AND m.id=p_membership_id AND m.tenant_id=p_tenant_id
      AND m.estado='ACTIVO' AND m.eliminado_en IS NULL
      AND t.estado IN ('PENDIENTE_PAGO','PRUEBA','ACTIVO','MOROSO','SUSPENDIDO')
      AND t.eliminado_en IS NULL
      AND (m.es_propietario OR m.puede_gestionar_facturacion)
      AND NOT EXISTS (
        SELECT 1 FROM public.vendedores v
        WHERE v.tenant_id=m.tenant_id AND v.membresia_id=m.id
          AND v.activo AND v.eliminado_en IS NULL
      )
  ) THEN
    RAISE EXCEPTION 'invalid billing request context' USING ERRCODE='42501';
  END IF;
  PERFORM set_config('app.current_auth_user_id',p_auth_user_id::text,true);
  PERFORM set_config('app.current_tenant_id',p_tenant_id::text,true);
  PERFORM set_config('app.current_profile_id',p_profile_id::text,true);
  PERFORM set_config('app.current_membership_id',p_membership_id::text,true);
  PERFORM set_config('app.current_platform_admin_id','',true);
END;
$$;

CREATE OR REPLACE FUNCTION app_private.set_platform_billing_context(p_auth_user_id uuid)
RETURNS TABLE(profile_id uuid,platform_admin_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog,public
AS $$
BEGIN
  SELECT u.id,pa.perfil_id INTO profile_id,platform_admin_id
  FROM public.usuarios u
  JOIN public.platform_admins pa ON pa.perfil_id=u.id
  WHERE u.auth_user_id=p_auth_user_id
    AND u.activo AND u.eliminado_en IS NULL
    AND pa.activo AND pa.puede_revisar_facturacion
  LIMIT 1;
  IF profile_id IS NULL THEN
    RAISE EXCEPTION 'active platform finance administrator is required' USING ERRCODE='42501';
  END IF;
  PERFORM set_config('app.current_auth_user_id',p_auth_user_id::text,true);
  PERFORM set_config('app.current_profile_id',profile_id::text,true);
  PERFORM set_config('app.current_platform_admin_id',platform_admin_id::text,true);
  PERFORM set_config('app.current_tenant_id','',true);
  PERFORM set_config('app.current_membership_id','',true);
  RETURN NEXT;
END;
$$;

ALTER FUNCTION app_private.current_platform_admin_id() OWNER TO postgres;
ALTER FUNCTION app_private.current_has_billing_access() OWNER TO postgres;
ALTER FUNCTION app_private.resolve_billing_request_context(uuid,text) OWNER TO postgres;
ALTER FUNCTION app_private.set_billing_request_context(uuid,uuid,uuid,uuid) OWNER TO postgres;
ALTER FUNCTION app_private.set_platform_billing_context(uuid) OWNER TO postgres;

REVOKE ALL ON FUNCTION app_private.current_platform_admin_id(),
  app_private.current_has_billing_access(),
  app_private.resolve_billing_request_context(uuid,text),
  app_private.set_billing_request_context(uuid,uuid,uuid,uuid),
  app_private.set_platform_billing_context(uuid)
FROM PUBLIC,anon,authenticated,service_role,multilot_billing_worker;
GRANT EXECUTE ON FUNCTION app_private.current_platform_admin_id(),
  app_private.current_has_billing_access(),
  app_private.resolve_billing_request_context(uuid,text),
  app_private.set_billing_request_context(uuid,uuid,uuid,uuid),
  app_private.set_platform_billing_context(uuid)
TO multilot_app;

-- Replace broad tenant-only billing policies with owner/explicit-billing access.
DROP POLICY IF EXISTS tenant_isolation ON public.tenant_billing_accounts;
DROP POLICY IF EXISTS tenant_isolation ON public.tenant_subscriptions;
DROP POLICY IF EXISTS tenant_isolation ON public.billing_invoices;
DROP POLICY IF EXISTS tenant_isolation ON public.billing_payment_methods;
DROP POLICY IF EXISTS tenant_isolation ON public.billing_events;
CREATE POLICY billing_accounts_read_authorized ON public.tenant_billing_accounts
  FOR SELECT TO multilot_app
  USING (tenant_id=(SELECT app_private.current_tenant_id())
    AND (SELECT app_private.current_has_billing_access()));
CREATE POLICY subscriptions_read_authorized ON public.tenant_subscriptions
  FOR SELECT TO multilot_app
  USING (tenant_id=(SELECT app_private.current_tenant_id())
    AND (SELECT app_private.current_has_billing_access()));
CREATE POLICY invoices_read_authorized ON public.billing_invoices
  FOR SELECT TO multilot_app
  USING (tenant_id=(SELECT app_private.current_tenant_id())
    AND (SELECT app_private.current_has_billing_access()));
CREATE POLICY payment_methods_read_authorized ON public.billing_payment_methods
  FOR SELECT TO multilot_app
  USING (tenant_id=(SELECT app_private.current_tenant_id())
    AND (SELECT app_private.current_has_billing_access()));

CREATE POLICY price_channels_read_catalog ON public.billing_price_channels
  FOR SELECT TO multilot_app USING (activo);
CREATE POLICY bank_accounts_read_billing ON public.billing_bank_accounts
  FOR SELECT TO multilot_app
  USING (activo AND (SELECT app_private.current_has_billing_access()));

DO $billing_tenant_read_policies$
DECLARE v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'billing_invoice_items','bank_transfer_submissions','payment_evidence_files',
    'payment_reviews','subscription_payments'
  ] LOOP
    EXECUTE format(
      'CREATE POLICY billing_read_authorized ON public.%I FOR SELECT TO multilot_app USING (tenant_id=(SELECT app_private.current_tenant_id()) AND (SELECT app_private.current_has_billing_access()))',
      v_table
    );
  END LOOP;
END
$billing_tenant_read_policies$;

CREATE OR REPLACE FUNCTION app_private.trg_billing_append_only()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  RAISE EXCEPTION 'billing ledger records are append-only' USING ERRCODE='42501';
END;
$$;
CREATE TRIGGER payment_reviews_append_only
  BEFORE UPDATE OR DELETE ON public.payment_reviews
  FOR EACH ROW EXECUTE FUNCTION app_private.trg_billing_append_only();
CREATE TRIGGER subscription_payments_append_only
  BEFORE UPDATE OR DELETE ON public.subscription_payments
  FOR EACH ROW EXECUTE FUNCTION app_private.trg_billing_append_only();
CREATE TRIGGER payment_reversals_append_only
  BEFORE UPDATE OR DELETE ON public.subscription_payment_reversals
  FOR EACH ROW EXECUTE FUNCTION app_private.trg_billing_append_only();

CREATE TRIGGER billing_price_channels_touch
  BEFORE UPDATE ON public.billing_price_channels
  FOR EACH ROW EXECUTE FUNCTION public.fn_touch_actualizado_en();
CREATE TRIGGER billing_bank_accounts_touch
  BEFORE UPDATE ON public.billing_bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.fn_touch_actualizado_en();
CREATE TRIGGER bank_transfer_submissions_touch
  BEFORE UPDATE ON public.bank_transfer_submissions
  FOR EACH ROW EXECUTE FUNCTION public.fn_touch_actualizado_en();
CREATE TRIGGER billing_settings_touch
  BEFORE UPDATE ON public.billing_settings
  FOR EACH ROW EXECUTE FUNCTION public.fn_touch_actualizado_en();

CREATE TRIGGER invoice_items_tenant_immutable
  BEFORE UPDATE ON public.billing_invoice_items
  FOR EACH ROW EXECUTE FUNCTION app_private.trg_tenant_id_immutable();
CREATE TRIGGER bank_submissions_tenant_immutable
  BEFORE UPDATE ON public.bank_transfer_submissions
  FOR EACH ROW EXECUTE FUNCTION app_private.trg_tenant_id_immutable();
CREATE TRIGGER payment_evidence_tenant_immutable
  BEFORE UPDATE ON public.payment_evidence_files
  FOR EACH ROW EXECUTE FUNCTION app_private.trg_tenant_id_immutable();

CREATE OR REPLACE FUNCTION app_private.next_billing_document_number(
  p_document_type text,p_at timestamptz DEFAULT now()
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog,public
AS $$
DECLARE
  v_year smallint := extract(year FROM p_at)::smallint;
  v_value bigint;
  v_prefix text;
BEGIN
  IF p_document_type NOT IN ('COBRO','RECIBO','NOTA_CREDITO') THEN
    RAISE EXCEPTION 'unsupported billing document type' USING ERRCODE='22023';
  END IF;
  INSERT INTO public.billing_document_sequences(document_type,document_year,last_value)
  VALUES (p_document_type,v_year,1)
  ON CONFLICT (document_type,document_year) DO UPDATE
  SET last_value=public.billing_document_sequences.last_value+1,
      actualizado_en=now()
  RETURNING last_value INTO v_value;
  v_prefix := CASE p_document_type
    WHEN 'COBRO' THEN 'AC'
    WHEN 'RECIBO' THEN 'RC'
    ELSE 'NC' END;
  RETURN format('%s-%s-%s',v_prefix,v_year,lpad(v_value::text,8,'0'));
END;
$$;

CREATE OR REPLACE FUNCTION app_private.create_subscription_invoice(
  p_tenant_id uuid,p_subscription_id uuid,p_period_start timestamptz,
  p_period_end timestamptz,p_due_at timestamptz,p_reason text DEFAULT 'RENEWAL'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog,public
AS $$
DECLARE
  v_subscription public.tenant_subscriptions%ROWTYPE;
  v_price public.billing_prices%ROWTYPE;
  v_plan public.billing_plans%ROWTYPE;
  v_invoice uuid;
  v_number text;
  v_reference text;
  v_grace_days integer;
BEGIN
  SELECT * INTO v_subscription
  FROM public.tenant_subscriptions
  WHERE tenant_id=p_tenant_id AND id=p_subscription_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'subscription was not found' USING ERRCODE='22023';
  END IF;
  SELECT * INTO v_price FROM public.billing_prices
  WHERE id=v_subscription.price_id AND activo;
  IF v_price.id IS NOT NULL THEN
    SELECT * INTO v_plan FROM public.billing_plans
    WHERE id=v_price.plan_id AND activo;
  END IF;
  IF v_price.id IS NULL OR v_plan.id IS NULL OR p_period_start IS NULL OR p_period_end<=p_period_start
     OR p_due_at IS NULL THEN
    RAISE EXCEPTION 'invalid invoice period or price' USING ERRCODE='22023';
  END IF;

  SELECT i.id INTO v_invoice
  FROM public.billing_invoices i
  WHERE i.tenant_id=p_tenant_id AND i.subscription_id=p_subscription_id
    AND i.periodo_inicia_en=p_period_start AND i.estado<>'ANULADA'
  LIMIT 1;
  IF v_invoice IS NOT NULL THEN RETURN v_invoice; END IF;

  SELECT grace_days INTO v_grace_days FROM public.billing_settings WHERE singleton;
  v_number := app_private.next_billing_document_number('COBRO',now());
  v_reference := 'ABY-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,16));

  INSERT INTO public.billing_invoices(
    tenant_id,subscription_id,proveedor,proveedor_invoice_id,estado,moneda,
    subtotal_minor,impuesto_minor,total_minor,vencimiento_en,numero_documento,
    referencia_bancaria,periodo_inicia_en,periodo_termina_en,emitida_en,
    gracia_termina_en,metadata
  ) VALUES (
    p_tenant_id,p_subscription_id,'ALPHABY',v_number,'ABIERTA',v_price.moneda,
    v_price.monto_minor,0,v_price.monto_minor,p_due_at,v_number,v_reference,
    p_period_start,p_period_end,now(),p_due_at+make_interval(days=>v_grace_days),
    jsonb_build_object('reason',p_reason,'document_kind','COMMERCIAL_CHARGE',
      'fiscal_document',false)
  ) RETURNING id INTO v_invoice;

  INSERT INTO public.billing_invoice_items(
    tenant_id,invoice_id,descripcion,cantidad,precio_unitario_minor,subtotal_minor,metadata
  ) VALUES (
    p_tenant_id,v_invoice,
    format('Suscripcion %s - %s',v_plan.nombre,
      CASE v_price.intervalo WHEN 'MENSUAL' THEN 'mensual' ELSE 'anual' END),
    1,v_price.monto_minor,v_price.monto_minor,
    jsonb_build_object('plan_code',v_plan.codigo,'price_id',v_price.id)
  );
  RETURN v_invoice;
END;
$$;

CREATE OR REPLACE FUNCTION app_private.ensure_initial_bank_invoice()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog,public
AS $$
DECLARE
  v_tenant uuid := app_private.current_tenant_id();
  v_subscription public.tenant_subscriptions%ROWTYPE;
  v_price public.billing_prices%ROWTYPE;
  v_invoice uuid;
  v_period_end timestamptz;
BEGIN
  IF v_tenant IS NULL OR NOT app_private.current_has_billing_access() THEN
    RAISE EXCEPTION 'billing access is required' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id=app_private.current_auth_user_id() AND email_confirmed_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'verified email is required before invoicing' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_subscription
  FROM public.tenant_subscriptions
  WHERE tenant_id=v_tenant
    AND estado IN ('INCOMPLETA','MOROSA','PAUSADA','ACTIVA')
  ORDER BY creado_en DESC LIMIT 1 FOR UPDATE;
  IF v_subscription.id IS NULL THEN
    RAISE EXCEPTION 'billable subscription was not found' USING ERRCODE='22023';
  END IF;
  SELECT * INTO v_price FROM public.billing_prices WHERE id=v_subscription.price_id;
  SELECT id INTO v_invoice
  FROM public.billing_invoices
  WHERE tenant_id=v_tenant AND subscription_id=v_subscription.id
    AND estado IN ('ABIERTA','FALLIDA','PAGADA')
  ORDER BY creado_en DESC LIMIT 1;
  IF v_invoice IS NOT NULL THEN RETURN v_invoice; END IF;
  v_period_end := now()+CASE v_price.intervalo
    WHEN 'ANUAL' THEN interval '1 year' ELSE interval '1 month' END;
  RETURN app_private.create_subscription_invoice(
    v_tenant,v_subscription.id,now(),v_period_end,now()+interval '7 days','INITIAL'
  );
END;
$$;

CREATE OR REPLACE FUNCTION app_private.get_billing_portal()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog,public
AS $$
DECLARE
  v_tenant uuid := app_private.current_tenant_id();
  v_result jsonb;
BEGIN
  IF v_tenant IS NULL OR NOT app_private.current_has_billing_access() THEN
    RAISE EXCEPTION 'billing access is required' USING ERRCODE='42501';
  END IF;
  SELECT jsonb_build_object(
    'tenant',jsonb_build_object(
      'id',t.id,'slug',t.slug,'name',t.nombre,'status',t.estado,
      'currency',t.moneda,'createdAt',t.creado_en
    ),
    'account',COALESCE((
      SELECT to_jsonb(a)-'datos_fiscales'
      FROM public.tenant_billing_accounts a WHERE a.tenant_id=v_tenant
    ),'null'::jsonb),
    'subscription',COALESCE((
      SELECT jsonb_build_object(
        'id',s.id,'status',s.estado,'provider',s.proveedor,
        'periodStartsAt',s.periodo_inicia_en,'periodEndsAt',s.periodo_termina_en,
        'cancelAtPeriodEnd',s.cancelar_al_final,'priceId',p.id,
        'amountMinor',p.monto_minor,'currency',p.moneda,'interval',p.intervalo,
        'plan',jsonb_build_object('code',pl.codigo,'name',pl.nombre,
          'limits',pl.limites,'features',pl.caracteristicas)
      ) FROM public.tenant_subscriptions s
      JOIN public.billing_prices p ON p.id=s.price_id
      JOIN public.billing_plans pl ON pl.id=p.plan_id
      WHERE s.tenant_id=v_tenant ORDER BY s.creado_en DESC LIMIT 1
    ),'null'::jsonb),
    'onboarding',COALESCE((
      SELECT jsonb_build_object(
        'id',o.id,'status',o.estado,'paymentMethod',o.metodo_pago,
        'email',o.email,'ownerName',u.nombre,'providerPriceId',ch.proveedor_price_id,
        'expiresAt',o.expira_en
      )
      FROM public.tenant_onboarding_sessions o
      JOIN public.usuarios u ON u.id=o.perfil_id
      LEFT JOIN public.billing_price_channels ch
        ON ch.price_id=o.price_id AND ch.canal='PAYPAL' AND ch.activo
      WHERE o.tenant_id=v_tenant ORDER BY o.creado_en DESC LIMIT 1
    ),'null'::jsonb),
    'invoices',COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id',i.id,'number',i.numero_documento,'bankReference',i.referencia_bancaria,
        'status',i.estado,'currency',i.moneda,'subtotalMinor',i.subtotal_minor,
        'taxMinor',i.impuesto_minor,'totalMinor',i.total_minor,'issuedAt',i.emitida_en,
        'dueAt',i.vencimiento_en,'graceEndsAt',i.gracia_termina_en,
        'reviewPauseUntil',i.revision_pausa_hasta,'paidAt',i.pagada_en,
        'periodStartsAt',i.periodo_inicia_en,'periodEndsAt',i.periodo_termina_en,
        'items',COALESCE((SELECT jsonb_agg(jsonb_build_object(
          'id',ii.id,'description',ii.descripcion,'quantity',ii.cantidad,
          'unitAmountMinor',ii.precio_unitario_minor,'subtotalMinor',ii.subtotal_minor
        ) ORDER BY ii.creado_en) FROM public.billing_invoice_items ii
          WHERE ii.tenant_id=i.tenant_id AND ii.invoice_id=i.id),'[]'::jsonb)
      ) ORDER BY i.creado_en DESC)
      FROM public.billing_invoices i WHERE i.tenant_id=v_tenant
    ),'[]'::jsonb),
    'bankAccounts',COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id',b.id,'code',b.codigo,'bank',b.banco,'holder',b.titular,
        'currency',b.moneda,'accountType',b.tipo_cuenta,
        'accountNumber',b.numero_cuenta,'instructions',b.instrucciones
      ) ORDER BY b.orden,b.codigo)
      FROM public.billing_bank_accounts b WHERE b.activo
    ),'[]'::jsonb),
    'transferSubmissions',COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id',s.id,'invoiceId',s.invoice_id,'bankAccountId',s.bank_account_id,
        'status',s.estado,'currency',s.moneda,'amountMinor',s.monto_minor,
        'declaredReference',s.referencia_declarada,'transferredAt',s.fecha_transferencia,
        'payerName',s.nombre_ordenante,'riskFlags',s.indicadores_riesgo,
        'createdAt',s.creado_en,'evidence',COALESCE((SELECT jsonb_agg(jsonb_build_object(
          'id',e.id,'objectPath',e.object_path,'originalName',e.original_name,
          'mimeType',e.mime_type,'sizeBytes',e.size_bytes,'createdAt',e.creado_en
        ) ORDER BY e.creado_en) FROM public.payment_evidence_files e
          WHERE e.tenant_id=s.tenant_id AND e.submission_id=s.id),'[]'::jsonb)
      ) ORDER BY s.creado_en DESC)
      FROM public.bank_transfer_submissions s WHERE s.tenant_id=v_tenant
    ),'[]'::jsonb),
    'policy',jsonb_build_object(
      'documentDisclaimer','Documento comercial de cobro - no constituye factura fiscal',
      'partialPaymentsAccepted',false,'currencyConversionAccepted',false,
      'reviewTargetHours',(SELECT review_target_hours FROM public.billing_settings WHERE singleton)
    )
  ) INTO v_result
  FROM public.tenants t WHERE t.id=v_tenant;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION app_private.bind_portal_paypal_signup(
  p_provider_subscription_id text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog,public
AS $$
DECLARE
  v_tenant uuid := app_private.current_tenant_id();
  v_onboarding uuid;
BEGIN
  IF v_tenant IS NULL OR NOT app_private.current_has_billing_access()
     OR nullif(btrim(p_provider_subscription_id),'') IS NULL THEN
    RAISE EXCEPTION 'valid billing context and subscription are required' USING ERRCODE='42501';
  END IF;
  SELECT o.id INTO v_onboarding
  FROM public.tenant_onboarding_sessions o
  JOIN public.billing_price_channels ch
    ON ch.price_id=o.price_id AND ch.canal='PAYPAL' AND ch.activo
  WHERE o.tenant_id=v_tenant AND o.estado='PENDIENTE' AND o.expira_en>now()
    AND ch.proveedor_price_id IS NOT NULL
  ORDER BY o.creado_en DESC LIMIT 1 FOR UPDATE OF o;
  IF v_onboarding IS NULL THEN
    RAISE EXCEPTION 'PayPal onboarding is not available' USING ERRCODE='22023';
  END IF;
  UPDATE public.tenant_onboarding_sessions
  SET proveedor='PAYPAL',metodo_pago='PAYPAL',
      proveedor_session_id=btrim(p_provider_subscription_id)
  WHERE id=v_onboarding;
  UPDATE public.tenant_subscriptions
  SET proveedor='PAYPAL',proveedor_subscription_id=btrim(p_provider_subscription_id),
      actualizado_en=now()
  WHERE tenant_id=v_tenant AND estado='INCOMPLETA';
  RETURN v_onboarding;
END;
$$;

CREATE OR REPLACE FUNCTION app_private.create_bank_transfer_submission(
  p_invoice_id uuid,p_bank_account_id uuid,p_reference text,
  p_amount_minor bigint,p_currency char(3),p_transferred_at timestamptz,
  p_payer_name text,p_source_last4 char(4) DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog,public
AS $$
DECLARE
  v_tenant uuid := app_private.current_tenant_id();
  v_membership uuid := app_private.current_membership_id();
  v_invoice public.billing_invoices%ROWTYPE;
  v_bank public.billing_bank_accounts%ROWTYPE;
  v_submission uuid;
  v_risk jsonb := '[]'::jsonb;
BEGIN
  IF v_tenant IS NULL OR NOT app_private.current_has_billing_access() THEN
    RAISE EXCEPTION 'billing access is required' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_invoice FROM public.billing_invoices
  WHERE tenant_id=v_tenant AND id=p_invoice_id FOR UPDATE;
  SELECT * INTO v_bank FROM public.billing_bank_accounts
  WHERE id=p_bank_account_id AND activo;
  IF v_invoice.id IS NULL OR v_invoice.estado NOT IN ('ABIERTA','FALLIDA') THEN
    RAISE EXCEPTION 'invoice is not payable' USING ERRCODE='22023';
  END IF;
  IF v_bank.id IS NULL OR v_bank.moneda<>v_invoice.moneda THEN
    RAISE EXCEPTION 'bank account does not accept invoice currency' USING ERRCODE='22023';
  END IF;
  IF p_amount_minor<>v_invoice.total_minor OR upper(p_currency)<>v_invoice.moneda THEN
    RAISE EXCEPTION 'exact invoice amount and currency are required' USING ERRCODE='22023';
  END IF;
  IF p_transferred_at IS NULL OR p_transferred_at>now()+interval '10 minutes'
     OR p_transferred_at<now()-interval '90 days'
     OR nullif(btrim(p_payer_name),'') IS NULL THEN
    RAISE EXCEPTION 'invalid transfer declaration' USING ERRCODE='22023';
  END IF;
  IF nullif(btrim(p_reference),'') IS NULL THEN
    v_risk := jsonb_build_array('MISSING_BANK_REFERENCE');
  END IF;
  INSERT INTO public.bank_transfer_submissions(
    tenant_id,invoice_id,bank_account_id,submitted_by_membership_id,moneda,
    monto_minor,referencia_declarada,fecha_transferencia,nombre_ordenante,
    cuenta_origen_ultimos4,indicadores_riesgo
  ) VALUES (
    v_tenant,p_invoice_id,p_bank_account_id,v_membership,upper(p_currency),
    p_amount_minor,nullif(btrim(p_reference),''),p_transferred_at,btrim(p_payer_name),
    p_source_last4,v_risk
  ) RETURNING id INTO v_submission;
  RETURN v_submission;
END;
$$;

CREATE OR REPLACE FUNCTION app_private.register_payment_evidence(
  p_submission_id uuid,p_object_path text,p_original_name text,p_mime_type text,
  p_size_bytes bigint,p_sha256 char(64)
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog,public
AS $$
DECLARE
  v_tenant uuid := app_private.current_tenant_id();
  v_membership uuid := app_private.current_membership_id();
  v_submission public.bank_transfer_submissions%ROWTYPE;
  v_evidence uuid;
  v_pause_hours integer;
BEGIN
  IF v_tenant IS NULL OR NOT app_private.current_has_billing_access() THEN
    RAISE EXCEPTION 'billing access is required' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_submission FROM public.bank_transfer_submissions
  WHERE tenant_id=v_tenant AND id=p_submission_id FOR UPDATE;
  IF v_submission.id IS NULL OR v_submission.estado<>'PENDIENTE_EVIDENCIA' THEN
    RAISE EXCEPTION 'submission is not awaiting evidence' USING ERRCODE='22023';
  END IF;
  IF p_object_path NOT LIKE v_tenant::text||'/'||p_submission_id::text||'/%'
     OR p_mime_type NOT IN ('application/pdf','image/jpeg','image/png')
     OR p_size_bytes NOT BETWEEN 1 AND 10485760
     OR p_sha256 !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'invalid private evidence metadata' USING ERRCODE='22023';
  END IF;
  INSERT INTO public.payment_evidence_files(
    tenant_id,submission_id,uploaded_by_membership_id,object_path,original_name,
    mime_type,size_bytes,sha256
  ) VALUES (
    v_tenant,p_submission_id,v_membership,p_object_path,btrim(p_original_name),
    p_mime_type,p_size_bytes,p_sha256
  ) RETURNING id INTO v_evidence;
  SELECT review_pause_hours INTO v_pause_hours FROM public.billing_settings WHERE singleton;
  UPDATE public.bank_transfer_submissions SET estado='EN_REVISION'
  WHERE id=p_submission_id;
  UPDATE public.billing_invoices
  SET estado='ABIERTA',revision_pausa_hasta=CASE
    WHEN v_submission.fecha_transferencia<=COALESCE(gracia_termina_en,vencimiento_en)
      THEN now()+make_interval(hours=>v_pause_hours)
    ELSE NULL END
  WHERE tenant_id=v_tenant AND id=v_submission.invoice_id;
  INSERT INTO public.outbox_events(tenant_id,aggregate_type,aggregate_id,event_type,payload)
  VALUES (v_tenant,'bank_transfer_submission',p_submission_id,
    'billing.transfer.submitted',jsonb_build_object('submission_id',p_submission_id,
      'invoice_id',v_submission.invoice_id));
  RETURN v_evidence;
END;
$$;

CREATE OR REPLACE FUNCTION app_private.confirm_subscription_payment(
  p_invoice_id uuid,p_origin public.origen_pago_suscripcion,p_external_reference text,
  p_submission_id uuid DEFAULT NULL,p_billing_event_id uuid DEFAULT NULL,
  p_platform_admin_id uuid DEFAULT NULL,p_confirmed_at timestamptz DEFAULT now(),
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog,public
AS $$
DECLARE
  v_invoice public.billing_invoices%ROWTYPE;
  v_subscription public.tenant_subscriptions%ROWTYPE;
  v_price public.billing_prices%ROWTYPE;
  v_payment uuid;
  v_start timestamptz;
  v_end timestamptz;
BEGIN
  IF nullif(btrim(p_external_reference),'') IS NULL
     OR p_confirmed_at IS NULL OR jsonb_typeof(p_metadata)<>'object' THEN
    RAISE EXCEPTION 'invalid payment confirmation' USING ERRCODE='22023';
  END IF;
  SELECT * INTO v_invoice FROM public.billing_invoices
  WHERE id=p_invoice_id FOR UPDATE;
  IF v_invoice.id IS NULL THEN
    RAISE EXCEPTION 'invoice was not found' USING ERRCODE='22023';
  END IF;
  SELECT * INTO v_subscription FROM public.tenant_subscriptions
  WHERE tenant_id=v_invoice.tenant_id AND id=v_invoice.subscription_id FOR UPDATE;
  SELECT * INTO v_price FROM public.billing_prices WHERE id=v_subscription.price_id;
  IF v_subscription.id IS NULL OR v_invoice.total_minor<=0 THEN
    RAISE EXCEPTION 'invoice has no billable subscription' USING ERRCODE='22023';
  END IF;
  IF p_origin='TRANSFERENCIA_BANCARIA' AND (
       p_submission_id IS NULL OR p_platform_admin_id IS NULL OR p_billing_event_id IS NOT NULL
     ) THEN
    RAISE EXCEPTION 'manual payment requires submission and reviewer' USING ERRCODE='22023';
  END IF;
  IF p_origin IN ('PAYPAL','DEVELOPMENT') AND p_billing_event_id IS NULL THEN
    RAISE EXCEPTION 'provider payment requires a verified billing event' USING ERRCODE='22023';
  END IF;

  INSERT INTO public.subscription_payments(
    tenant_id,invoice_id,subscription_id,submission_id,billing_event_id,origen,
    referencia_externa,moneda,monto_minor,confirmado_por_platform_admin_id,
    confirmado_en,metadata
  ) VALUES (
    v_invoice.tenant_id,v_invoice.id,v_subscription.id,p_submission_id,p_billing_event_id,
    p_origin,btrim(p_external_reference),v_invoice.moneda,v_invoice.total_minor,
    p_platform_admin_id,p_confirmed_at,p_metadata
  ) ON CONFLICT (origen,referencia_externa) DO NOTHING
  RETURNING id INTO v_payment;

  IF v_payment IS NULL THEN
    SELECT id INTO v_payment FROM public.subscription_payments
    WHERE origen=p_origin AND referencia_externa=btrim(p_external_reference)
      AND invoice_id=v_invoice.id;
    IF v_payment IS NULL THEN
      RAISE EXCEPTION 'payment reference belongs to another invoice' USING ERRCODE='23505';
    END IF;
    RETURN v_payment;
  END IF;

  IF v_subscription.periodo_termina_en IS NOT NULL
     AND v_subscription.periodo_termina_en>p_confirmed_at
     AND v_subscription.estado IN ('ACTIVA','MOROSA') THEN
    v_start := v_subscription.periodo_termina_en;
  ELSIF v_invoice.metadata->>'reason'='RENEWAL'
        AND v_invoice.periodo_inicia_en>=p_confirmed_at-interval '15 days' THEN
    v_start := v_invoice.periodo_inicia_en;
  ELSE
    v_start := p_confirmed_at;
  END IF;
  v_end := v_start+CASE v_price.intervalo
    WHEN 'ANUAL' THEN interval '1 year' ELSE interval '1 month' END;

  UPDATE public.billing_invoices
  SET estado='PAGADA',pagada_en=p_confirmed_at,revision_pausa_hasta=NULL
  WHERE id=v_invoice.id;
  UPDATE public.tenant_subscriptions
  SET estado='ACTIVA',periodo_inicia_en=v_start,periodo_termina_en=v_end,
      actualizado_en=now()
  WHERE id=v_subscription.id;
  UPDATE public.tenants
  SET estado='ACTIVO',actualizado_en=now()
  WHERE id=v_invoice.tenant_id AND eliminado_en IS NULL;
  UPDATE public.tenant_onboarding_sessions
  SET estado='COMPLETADA',completada_en=COALESCE(completada_en,p_confirmed_at)
  WHERE tenant_id=v_invoice.tenant_id AND estado='PENDIENTE';
  INSERT INTO public.outbox_events(tenant_id,aggregate_type,aggregate_id,event_type,payload)
  VALUES (v_invoice.tenant_id,'subscription_payment',v_payment,'billing.payment.confirmed',
    jsonb_build_object('payment_id',v_payment,'invoice_id',v_invoice.id,
      'subscription_id',v_subscription.id,'origin',p_origin));
  RETURN v_payment;
END;
$$;

CREATE OR REPLACE FUNCTION app_private.list_platform_transfer_queue(
  p_status public.transferencia_pago_estado DEFAULT 'EN_REVISION',
  p_limit integer DEFAULT 100
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog,public
AS $$
DECLARE v_result jsonb;
BEGIN
  IF app_private.current_platform_admin_id() IS NULL THEN
    RAISE EXCEPTION 'platform finance access is required' USING ERRCODE='42501';
  END IF;
  IF p_limit NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'invalid review queue limit' USING ERRCODE='22023';
  END IF;
  SELECT COALESCE(jsonb_agg(row_data ORDER BY created_at),'[]'::jsonb)
  INTO v_result
  FROM (
    SELECT s.creado_en AS created_at,jsonb_build_object(
      'id',s.id,'status',s.estado,'tenant',jsonb_build_object(
        'id',t.id,'slug',t.slug,'name',t.nombre,'status',t.estado),
      'invoice',jsonb_build_object('id',i.id,'number',i.numero_documento,
        'bankReference',i.referencia_bancaria,'currency',i.moneda,
        'totalMinor',i.total_minor,'dueAt',i.vencimiento_en),
      'bankAccount',jsonb_build_object('id',b.id,'bank',b.banco,'holder',b.titular,
        'currency',b.moneda,'accountNumber',b.numero_cuenta),
      'amountMinor',s.monto_minor,'currency',s.moneda,
      'declaredReference',s.referencia_declarada,'transferredAt',s.fecha_transferencia,
      'payerName',s.nombre_ordenante,'sourceLast4',s.cuenta_origen_ultimos4,
      'riskFlags',s.indicadores_riesgo,'createdAt',s.creado_en,
      'evidence',COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id',e.id,'objectPath',e.object_path,'originalName',e.original_name,
        'mimeType',e.mime_type,'sizeBytes',e.size_bytes,'sha256',e.sha256,
        'createdAt',e.creado_en) ORDER BY e.creado_en)
        FROM public.payment_evidence_files e
        WHERE e.tenant_id=s.tenant_id AND e.submission_id=s.id),'[]'::jsonb)
    ) row_data
    FROM public.bank_transfer_submissions s
    JOIN public.tenants t ON t.id=s.tenant_id
    JOIN public.billing_invoices i ON i.tenant_id=s.tenant_id AND i.id=s.invoice_id
    JOIN public.billing_bank_accounts b ON b.id=s.bank_account_id
    WHERE s.estado=p_status
    ORDER BY s.creado_en
    LIMIT p_limit
  ) q;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION app_private.review_bank_transfer(
  p_submission_id uuid,p_decision public.revision_pago_decision,
  p_confirmed_bank_reference text DEFAULT NULL,p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog,public
AS $$
DECLARE
  v_admin uuid := app_private.current_platform_admin_id();
  v_submission public.bank_transfer_submissions%ROWTYPE;
  v_invoice public.billing_invoices%ROWTYPE;
  v_review uuid;
  v_payment uuid;
BEGIN
  IF v_admin IS NULL THEN
    RAISE EXCEPTION 'platform finance access is required' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_submission FROM public.bank_transfer_submissions
  WHERE id=p_submission_id FOR UPDATE;
  IF v_submission.id IS NULL OR v_submission.estado<>'EN_REVISION' THEN
    RAISE EXCEPTION 'transfer is not awaiting review' USING ERRCODE='22023';
  END IF;
  SELECT * INTO v_invoice FROM public.billing_invoices
  WHERE tenant_id=v_submission.tenant_id AND id=v_submission.invoice_id FOR UPDATE;
  IF v_invoice.estado='PAGADA' OR v_invoice.moneda<>v_submission.moneda
     OR v_invoice.total_minor<>v_submission.monto_minor THEN
    RAISE EXCEPTION 'transfer no longer matches a payable invoice' USING ERRCODE='22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.payment_evidence_files
    WHERE tenant_id=v_submission.tenant_id AND submission_id=v_submission.id
  ) THEN
    RAISE EXCEPTION 'payment evidence is required' USING ERRCODE='22023';
  END IF;
  IF p_notes IS NOT NULL AND length(p_notes)>1000 THEN
    RAISE EXCEPTION 'review notes are too long' USING ERRCODE='22023';
  END IF;

  INSERT INTO public.payment_reviews(
    tenant_id,submission_id,platform_admin_id,decision,
    referencia_bancaria_confirmada,notas
  ) VALUES (
    v_submission.tenant_id,v_submission.id,v_admin,p_decision,
    nullif(btrim(p_confirmed_bank_reference),''),nullif(btrim(p_notes),'')
  ) RETURNING id INTO v_review;

  IF p_decision='RECHAZADA' THEN
    UPDATE public.bank_transfer_submissions SET estado='RECHAZADA'
    WHERE id=v_submission.id;
    UPDATE public.billing_invoices
    SET estado='ABIERTA',revision_pausa_hasta=NULL
    WHERE id=v_invoice.id;
    INSERT INTO public.outbox_events(tenant_id,aggregate_type,aggregate_id,event_type,payload)
    VALUES (v_submission.tenant_id,'bank_transfer_submission',v_submission.id,
      'billing.transfer.rejected',jsonb_build_object('submission_id',v_submission.id,
        'invoice_id',v_invoice.id,'review_id',v_review));
    RETURN jsonb_build_object('reviewId',v_review,'decision',p_decision,
      'paymentId',NULL);
  END IF;

  IF nullif(btrim(p_confirmed_bank_reference),'') IS NULL THEN
    RAISE EXCEPTION 'confirmed bank reference is required' USING ERRCODE='22023';
  END IF;
  v_payment := app_private.confirm_subscription_payment(
    v_invoice.id,'TRANSFERENCIA_BANCARIA',btrim(p_confirmed_bank_reference),
    v_submission.id,NULL,v_admin,now(),jsonb_build_object('review_id',v_review)
  );
  UPDATE public.bank_transfer_submissions SET estado='APROBADA'
  WHERE id=v_submission.id;
  RETURN jsonb_build_object('reviewId',v_review,'decision',p_decision,
    'paymentId',v_payment,'tenantId',v_submission.tenant_id);
END;
$$;

ALTER FUNCTION app_private.next_billing_document_number(text,timestamptz) OWNER TO postgres;
ALTER FUNCTION app_private.create_subscription_invoice(uuid,uuid,timestamptz,timestamptz,timestamptz,text) OWNER TO postgres;
ALTER FUNCTION app_private.ensure_initial_bank_invoice() OWNER TO postgres;
ALTER FUNCTION app_private.get_billing_portal() OWNER TO postgres;
ALTER FUNCTION app_private.bind_portal_paypal_signup(text) OWNER TO postgres;
ALTER FUNCTION app_private.create_bank_transfer_submission(uuid,uuid,text,bigint,char,timestamptz,text,char) OWNER TO postgres;
ALTER FUNCTION app_private.register_payment_evidence(uuid,text,text,text,bigint,char) OWNER TO postgres;
ALTER FUNCTION app_private.confirm_subscription_payment(uuid,public.origen_pago_suscripcion,text,uuid,uuid,uuid,timestamptz,jsonb) OWNER TO postgres;
ALTER FUNCTION app_private.list_platform_transfer_queue(public.transferencia_pago_estado,integer) OWNER TO postgres;
ALTER FUNCTION app_private.review_bank_transfer(uuid,public.revision_pago_decision,text,text) OWNER TO postgres;

REVOKE ALL ON FUNCTION app_private.next_billing_document_number(text,timestamptz),
  app_private.create_subscription_invoice(uuid,uuid,timestamptz,timestamptz,timestamptz,text),
  app_private.ensure_initial_bank_invoice(),app_private.get_billing_portal(),
  app_private.bind_portal_paypal_signup(text),
  app_private.create_bank_transfer_submission(uuid,uuid,text,bigint,char,timestamptz,text,char),
  app_private.register_payment_evidence(uuid,text,text,text,bigint,char),
  app_private.confirm_subscription_payment(uuid,public.origen_pago_suscripcion,text,uuid,uuid,uuid,timestamptz,jsonb),
  app_private.list_platform_transfer_queue(public.transferencia_pago_estado,integer),
  app_private.review_bank_transfer(uuid,public.revision_pago_decision,text,text)
FROM PUBLIC,anon,authenticated,service_role;

GRANT EXECUTE ON FUNCTION app_private.ensure_initial_bank_invoice(),
  app_private.get_billing_portal(),
  app_private.bind_portal_paypal_signup(text),
  app_private.create_bank_transfer_submission(uuid,uuid,text,bigint,char,timestamptz,text,char),
  app_private.register_payment_evidence(uuid,text,text,text,bigint,char),
  app_private.list_platform_transfer_queue(public.transferencia_pago_estado,integer),
  app_private.review_bank_transfer(uuid,public.revision_pago_decision,text,text)
TO multilot_app;

-- Internal ledger primitives are never callable by tenant, Data API or service roles.
REVOKE ALL ON FUNCTION app_private.next_billing_document_number(text,timestamptz),
  app_private.create_subscription_invoice(uuid,uuid,timestamptz,timestamptz,timestamptz,text),
  app_private.confirm_subscription_payment(uuid,public.origen_pago_suscripcion,text,uuid,uuid,uuid,timestamptz,jsonb)
FROM multilot_app,multilot_billing_worker;

-- Registration now provisions the isolated ecosystem immediately in
-- PENDIENTE_PAGO. Payment only changes lifecycle state; it no longer creates the
-- tenant, which makes retrying or switching payment channels safe.
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
     OR v_provider !~ '^[A-Z][A-Z0-9_]*$' THEN
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
  IF EXISTS (SELECT 1 FROM public.tenants WHERE slug=lower(btrim(p_tenant_slug)) AND eliminado_en IS NULL) THEN
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
  JOIN public.roles target ON target.tenant_id=v_tenant AND target.nombre=source.nombre;
  SELECT id INTO v_owner_role FROM public.roles
  WHERE tenant_id=v_tenant ORDER BY (upper(nombre)='ADMIN') DESC,creado_en,id LIMIT 1;
  INSERT INTO public.membresias_tenant(
    tenant_id,perfil_id,rol_id,username,estado,es_propietario,puede_gestionar_facturacion
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
    v_pending_provider_id,'PENDIENTE',now()+interval '15 days',
    lower(btrim(p_tenant_slug)),btrim(p_tenant_name),p_timezone,upper(p_currency),
    CASE WHEN v_provider IN ('BANK_TRANSFER','PAYPAL','DEVELOPMENT')
      THEN v_provider ELSE 'DEVELOPMENT' END
  ) RETURNING id INTO v_session;
  INSERT INTO public.outbox_events(tenant_id,aggregate_type,aggregate_id,event_type,payload)
  VALUES (v_tenant,'tenant',v_tenant,'tenant.pending_payment',jsonb_build_object(
    'tenant_id',v_tenant,'profile_id',v_profile,'membership_id',v_membership,
    'subscription_id',v_subscription,'payment_method',v_provider));
  RETURN QUERY SELECT v_profile,v_session;
END;
$$;

CREATE OR REPLACE FUNCTION app_private.bind_paid_signup(
  p_onboarding_session_id uuid,p_provider_subscription_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog,public
AS $$
DECLARE v_session public.tenant_onboarding_sessions%ROWTYPE;
BEGIN
  IF nullif(btrim(p_provider_subscription_id),'') IS NULL THEN
    RAISE EXCEPTION 'provider subscription id is required' USING ERRCODE='22023';
  END IF;
  SELECT * INTO v_session FROM public.tenant_onboarding_sessions
  WHERE id=p_onboarding_session_id AND estado='PENDIENTE'
    AND expira_en>now() FOR UPDATE;
  IF v_session.id IS NULL THEN
    RAISE EXCEPTION 'onboarding session cannot be bound' USING ERRCODE='22023';
  END IF;
  UPDATE public.tenant_onboarding_sessions
  SET proveedor_session_id=btrim(p_provider_subscription_id)
  WHERE id=v_session.id;
  UPDATE public.tenant_subscriptions
  SET proveedor=v_session.proveedor,
      proveedor_subscription_id=btrim(p_provider_subscription_id),
      actualizado_en=now()
  WHERE tenant_id=v_session.tenant_id AND price_id=v_session.price_id
    AND estado='INCOMPLETA';
END;
$$;

CREATE OR REPLACE FUNCTION app_private.process_subscription_event(
  p_provider text,p_provider_event_id text,p_event_type text,p_payload_hash char(64),
  p_payload jsonb,p_provider_subscription_id text,p_provider_customer_id text,
  p_subscription_status public.suscripcion_estado,p_period_starts_at timestamptz,
  p_period_ends_at timestamptz
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog,public
AS $$
DECLARE
  v_provider text := upper(btrim(p_provider));
  v_event uuid;
  v_existing_hash char(64);
  v_existing_processed timestamptz;
  v_tenant uuid;
  v_subscription public.tenant_subscriptions%ROWTYPE;
  v_price public.billing_prices%ROWTYPE;
  v_invoice uuid;
  v_start timestamptz;
  v_end timestamptz;
  v_origin public.origen_pago_suscripcion;
BEGIN
  IF p_payload_hash !~ '^[0-9a-f]{64}$' OR jsonb_typeof(p_payload)<>'object' THEN
    RAISE EXCEPTION 'invalid provider event payload' USING ERRCODE='22023';
  END IF;
  INSERT INTO public.billing_events(proveedor,proveedor_event_id,tipo,payload_hash,payload)
  VALUES (v_provider,p_provider_event_id,p_event_type,p_payload_hash,p_payload)
  ON CONFLICT (proveedor,proveedor_event_id) DO NOTHING
  RETURNING id INTO v_event;
  IF v_event IS NULL THEN
    SELECT id,payload_hash,tenant_id,procesado_en
    INTO v_event,v_existing_hash,v_tenant,v_existing_processed
    FROM public.billing_events
    WHERE proveedor=v_provider AND proveedor_event_id=p_provider_event_id;
    IF v_existing_hash<>p_payload_hash THEN
      RAISE EXCEPTION 'provider event id reused with a different payload' USING ERRCODE='23505';
    END IF;
    IF v_existing_processed IS NOT NULL THEN RETURN v_tenant; END IF;
  END IF;

  SELECT * INTO v_subscription FROM public.tenant_subscriptions
  WHERE proveedor=v_provider AND proveedor_subscription_id=p_provider_subscription_id
  FOR UPDATE;
  IF v_subscription.id IS NULL THEN
    RAISE EXCEPTION 'provider subscription was not bound to onboarding' USING ERRCODE='22023';
  END IF;
  v_tenant := v_subscription.tenant_id;
  UPDATE public.tenant_billing_accounts
  SET proveedor_customer_id=COALESCE(nullif(btrim(p_provider_customer_id),''),proveedor_customer_id),
      actualizado_en=now()
  WHERE tenant_id=v_tenant;

  IF p_subscription_status='ACTIVA' THEN
    SELECT * INTO v_price FROM public.billing_prices WHERE id=v_subscription.price_id;
    v_start := COALESCE(p_period_starts_at,now());
    v_end := COALESCE(p_period_ends_at,v_start+CASE v_price.intervalo
      WHEN 'ANUAL' THEN interval '1 year' ELSE interval '1 month' END);
    SELECT id INTO v_invoice FROM public.billing_invoices
    WHERE tenant_id=v_tenant AND subscription_id=v_subscription.id
      AND estado IN ('ABIERTA','FALLIDA') ORDER BY creado_en DESC LIMIT 1;
    IF v_invoice IS NULL THEN
      v_invoice := app_private.create_subscription_invoice(
        v_tenant,v_subscription.id,v_start,v_end,now(),'PROVIDER'
      );
    END IF;
    v_origin := CASE WHEN v_provider='PAYPAL' THEN 'PAYPAL'::public.origen_pago_suscripcion
      ELSE 'DEVELOPMENT'::public.origen_pago_suscripcion END;
    PERFORM app_private.confirm_subscription_payment(
      v_invoice,v_origin,p_provider_event_id,NULL,v_event,NULL,
      COALESCE(p_period_starts_at,now()),jsonb_build_object('event_type',p_event_type)
    );
  ELSE
    UPDATE public.tenant_subscriptions
    SET estado=p_subscription_status,
      periodo_inicia_en=COALESCE(p_period_starts_at,periodo_inicia_en),
      periodo_termina_en=COALESCE(p_period_ends_at,periodo_termina_en),
      cancelada_en=CASE WHEN p_subscription_status='CANCELADA' THEN now() ELSE cancelada_en END,
      actualizado_en=now()
    WHERE id=v_subscription.id;
    UPDATE public.tenants SET estado=CASE p_subscription_status
      WHEN 'MOROSA' THEN 'MOROSO'::public.tenant_estado
      WHEN 'PAUSADA' THEN 'SUSPENDIDO'::public.tenant_estado
      WHEN 'CANCELADA' THEN 'CANCELADO'::public.tenant_estado
      ELSE estado END,actualizado_en=now()
    WHERE id=v_tenant;
  END IF;
  UPDATE public.billing_events
  SET tenant_id=v_tenant,procesado_en=now(),intentos=intentos+1
  WHERE id=v_event;
  RETURN v_tenant;
END;
$$;

ALTER FUNCTION app_private.start_paid_signup(uuid,text,text,text,uuid,text,text,text,text,char,timestamptz) OWNER TO postgres;
ALTER FUNCTION app_private.bind_paid_signup(uuid,text) OWNER TO postgres;
ALTER FUNCTION app_private.process_subscription_event(text,text,text,char,jsonb,text,text,public.suscripcion_estado,timestamptz,timestamptz) OWNER TO postgres;
REVOKE ALL ON FUNCTION app_private.start_paid_signup(uuid,text,text,text,uuid,text,text,text,text,char,timestamptz),
  app_private.bind_paid_signup(uuid,text),
  app_private.process_subscription_event(text,text,text,char,jsonb,text,text,public.suscripcion_estado,timestamptz,timestamptz)
FROM PUBLIC,anon,authenticated,service_role,multilot_app;
GRANT EXECUTE ON FUNCTION app_private.start_paid_signup(uuid,text,text,text,uuid,text,text,text,text,char,timestamptz),
  app_private.bind_paid_signup(uuid,text),
  app_private.process_subscription_event(text,text,text,char,jsonb,text,text,public.suscripcion_estado,timestamptz,timestamptz)
TO multilot_billing_worker;

CREATE OR REPLACE FUNCTION app_private.list_signup_prices(p_provider text)
RETURNS TABLE(
  price_id uuid,plan_code text,plan_name text,description text,limits jsonb,
  features jsonb,provider text,provider_price_id text,currency char(3),
  amount_minor bigint,billing_interval public.intervalo_facturacion
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog,public
AS $$
  SELECT bp.id,pl.codigo,pl.nombre,pl.descripcion,pl.limites,pl.caracteristicas,
    ch.canal,ch.proveedor_price_id,bp.moneda,bp.monto_minor,bp.intervalo
  FROM public.billing_prices bp
  JOIN public.billing_plans pl ON pl.id=bp.plan_id
  JOIN public.billing_price_channels ch ON ch.price_id=bp.id
  WHERE bp.activo AND pl.activo AND ch.activo
    AND ch.canal=upper(btrim(p_provider))
    AND (ch.canal='BANK_TRANSFER' OR ch.proveedor_price_id IS NOT NULL)
  ORDER BY bp.monto_minor,pl.codigo
$$;
ALTER FUNCTION app_private.list_signup_prices(text) OWNER TO postgres;
REVOKE ALL ON FUNCTION app_private.list_signup_prices(text)
  FROM PUBLIC,anon,authenticated,service_role,multilot_app;
GRANT EXECUTE ON FUNCTION app_private.list_signup_prices(text)
  TO multilot_billing_worker;

-- Idempotent daily lifecycle job. Dokploy invokes the API worker endpoint on a
-- schedule; advisory locking prevents overlapping runs across replicas.
CREATE OR REPLACE FUNCTION app_private.run_billing_cycle(p_now timestamptz DEFAULT now())
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog,public
AS $$
DECLARE
  v_run uuid;
  v_key text := 'daily:'||to_char(p_now AT TIME ZONE 'UTC','YYYY-MM-DD');
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
      AND t.estado='ACTIVO' RETURNING t.id
  ) SELECT count(*) INTO v_delinquent FROM affected;
  UPDATE public.tenant_subscriptions s SET estado='MOROSA',actualizado_en=now()
  WHERE s.tenant_id IN (
    SELECT i.tenant_id FROM public.billing_invoices i
    WHERE i.estado IN ('ABIERTA','FALLIDA') AND i.vencimiento_en<p_now
      AND COALESCE(i.gracia_termina_en,i.vencimiento_en)>=p_now
  ) AND s.estado='ACTIVA';

  -- After grace, access is billing-only unless a timely proof is in its bounded pause.
  WITH affected AS (
    UPDATE public.tenants t SET estado='SUSPENDIDO',actualizado_en=now()
    FROM public.billing_invoices i
    WHERE i.tenant_id=t.id AND i.estado IN ('ABIERTA','FALLIDA')
      AND COALESCE(i.gracia_termina_en,i.vencimiento_en)<p_now
      AND COALESCE(i.revision_pausa_hasta,'-infinity'::timestamptz)<=p_now
      AND t.estado IN ('ACTIVO','MOROSO') RETURNING t.id
  ) SELECT count(*) INTO v_suspended FROM affected;
  UPDATE public.tenant_subscriptions s SET estado='PAUSADA',actualizado_en=now()
  WHERE s.tenant_id IN (
    SELECT i.tenant_id FROM public.billing_invoices i
    WHERE i.estado IN ('ABIERTA','FALLIDA')
      AND COALESCE(i.gracia_termina_en,i.vencimiento_en)<p_now
      AND COALESCE(i.revision_pausa_hasta,'-infinity'::timestamptz)<=p_now
  ) AND s.estado IN ('ACTIVA','MOROSA');

  -- More than fifteen days late: void the stale period and issue a reactivation
  -- document from today. No unpaid days are granted for free.
  FOR v_row IN
    SELECT i.*,s.price_id,p.intervalo
    FROM public.billing_invoices i
    JOIN public.tenant_subscriptions s ON s.tenant_id=i.tenant_id AND s.id=i.subscription_id
    JOIN public.billing_prices p ON p.id=s.price_id
    WHERE i.estado IN ('ABIERTA','FALLIDA')
      AND i.vencimiento_en+make_interval(days=>v_settings.late_reissue_days)<p_now
      AND COALESCE(i.revision_pausa_hasta,'-infinity'::timestamptz)<=p_now
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
    UPDATE public.tenant_onboarding_sessions o
    SET estado='EXPIRADA'
    WHERE o.estado='PENDIENTE' AND o.creado_en+interval '15 days'<p_now
    RETURNING o.tenant_id
  ) SELECT count(*) INTO v_expired FROM affected;
  UPDATE public.tenants t SET estado='SUSPENDIDO',actualizado_en=now()
  WHERE t.estado='PENDIENTE_PAGO' AND EXISTS (
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
  FROM PUBLIC,anon,authenticated,service_role,multilot_app;
GRANT EXECUTE ON FUNCTION app_private.run_billing_cycle(timestamptz)
  TO multilot_billing_worker;

COMMENT ON TABLE public.subscription_payments IS
  'Immutable AlphaBy subscription payment ledger; reversals are separate append-only records.';
COMMENT ON TABLE public.bank_transfer_submissions IS
  'Customer declarations only. A row is not money until an AlphaBy platform administrator approves it.';
COMMENT ON TABLE public.billing_invoices IS
  'Commercial charge documents. They are not fiscal invoices unless a future fiscal integration explicitly says so.';
COMMENT ON FUNCTION app_private.review_bank_transfer(uuid,public.revision_pago_decision,text,text) IS
  'Single-review v1 reconciliation boundary. Approval atomically confirms payment and activates or renews the tenant.';
