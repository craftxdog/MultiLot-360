-- Make one-to-one composite relations explicit and remove redundant single-column
-- billing FKs. The composite FKs retain stronger same-tenant enforcement.
ALTER TABLE public.resultados
  ADD CONSTRAINT uq_resultados_tenant_turno UNIQUE (tenant_id, turno_id);

ALTER TABLE public.pagos_premios
  ADD CONSTRAINT uq_pagos_tenant_venta UNIQUE (tenant_id, venta_id);

ALTER TABLE public.tenant_subscriptions
  DROP CONSTRAINT tenant_subscriptions_billing_account_id_fkey;
ALTER TABLE public.tenant_subscriptions
  DROP CONSTRAINT fk_subscriptions_account_tenant;
ALTER TABLE public.tenant_subscriptions
  ADD CONSTRAINT fk_subscriptions_account_tenant
  FOREIGN KEY (tenant_id, billing_account_id)
  REFERENCES public.tenant_billing_accounts(tenant_id, id) ON DELETE CASCADE;

ALTER TABLE public.billing_payment_methods
  DROP CONSTRAINT billing_payment_methods_billing_account_id_fkey;
ALTER TABLE public.billing_payment_methods
  DROP CONSTRAINT fk_payment_methods_account_tenant;
ALTER TABLE public.billing_payment_methods
  ADD CONSTRAINT fk_payment_methods_account_tenant
  FOREIGN KEY (tenant_id, billing_account_id)
  REFERENCES public.tenant_billing_accounts(tenant_id, id) ON DELETE CASCADE;
