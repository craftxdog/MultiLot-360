-- Cover every foreign key introduced by the bank-transfer billing control
-- plane. PostgreSQL does not create indexes automatically on the referencing
-- side of a foreign key; these indexes keep joins, parent updates, and deletes
-- predictable as billing history grows.

CREATE INDEX IF NOT EXISTS ix_bank_transfer_submissions_tenant_actor
  ON public.bank_transfer_submissions (tenant_id, submitted_by_membership_id);

CREATE INDEX IF NOT EXISTS ix_bank_transfer_submissions_tenant_invoice
  ON public.bank_transfer_submissions (tenant_id, invoice_id);

CREATE INDEX IF NOT EXISTS ix_billing_invoice_items_invoice_id
  ON public.billing_invoice_items (invoice_id);

CREATE INDEX IF NOT EXISTS ix_payment_evidence_files_tenant_actor
  ON public.payment_evidence_files (tenant_id, uploaded_by_membership_id);

CREATE INDEX IF NOT EXISTS ix_payment_reviews_platform_admin_id
  ON public.payment_reviews (platform_admin_id);

CREATE INDEX IF NOT EXISTS ix_subscription_reversals_platform_admin_id
  ON public.subscription_payment_reversals (platform_admin_id);

CREATE INDEX IF NOT EXISTS ix_subscription_payments_tenant_invoice
  ON public.subscription_payments (tenant_id, invoice_id);

CREATE INDEX IF NOT EXISTS ix_subscription_payments_tenant_submission
  ON public.subscription_payments (tenant_id, submission_id);

CREATE INDEX IF NOT EXISTS ix_subscription_payments_tenant_subscription
  ON public.subscription_payments (tenant_id, subscription_id);

CREATE INDEX IF NOT EXISTS ix_subscription_payments_billing_event_id
  ON public.subscription_payments (billing_event_id);

CREATE INDEX IF NOT EXISTS ix_subscription_payments_confirmed_admin
  ON public.subscription_payments (confirmado_por_platform_admin_id);
