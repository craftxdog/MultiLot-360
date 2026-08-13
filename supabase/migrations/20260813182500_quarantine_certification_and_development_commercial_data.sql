-- Production-safe cleanup for certification fixtures accidentally created by
-- earlier runtime certification. Preserve financial/audit rows while removing
-- every operational permission from the synthetic identities and tenants.

UPDATE public.platform_admins pa
SET activo=false,
    puede_revisar_facturacion=false
FROM public.usuarios u
WHERE u.id=pa.perfil_id
  AND (
    u.username LIKE 'qa.%'
    OR u.username='front.billing.admin'
  );

UPDATE public.membresias_tenant m
SET puede_gestionar_facturacion=false,
    actualizado_en=now()
FROM public.tenants t
WHERE t.id=m.tenant_id
  AND (t.slug LIKE 'qa-cert-%' OR t.nombre LIKE 'QA Certification %');

UPDATE public.vendedores v
SET activo=false,
    actualizado_en=now()
FROM public.tenants t
WHERE t.id=v.tenant_id
  AND (t.slug LIKE 'qa-cert-%' OR t.nombre LIKE 'QA Certification %');

UPDATE public.tenant_subscriptions s
SET estado='CANCELADA',
    cancelar_al_final=true,
    cancelada_en=COALESCE(s.cancelada_en,now()),
    actualizado_en=now()
FROM public.tenants t
WHERE t.id=s.tenant_id
  AND (t.slug LIKE 'qa-cert-%' OR t.nombre LIKE 'QA Certification %')
  AND s.estado<>'CANCELADA';

UPDATE public.tenant_onboarding_sessions o
SET estado='EXPIRADA'
FROM public.tenants t
WHERE t.id=o.tenant_id
  AND (t.slug LIKE 'qa-cert-%' OR t.nombre LIKE 'QA Certification %')
  AND o.estado='PENDIENTE';

UPDATE public.tenants
SET estado='CANCELADO',
    eliminado_en=COALESCE(eliminado_en,now()),
    actualizado_en=now(),
    configuracion=configuracion||jsonb_build_object(
      'certificationFixture',true,
      'archivedReason','production_certification_cleanup'
    )
WHERE slug LIKE 'qa-cert-%' OR nombre LIKE 'QA Certification %';

UPDATE public.usuarios
SET activo=false,
    eliminado_en=COALESCE(eliminado_en,now()),
    motivo_eliminacion=COALESCE(motivo_eliminacion,'Fixture de certificación archivado')
WHERE username LIKE 'qa.%' OR username='front.billing.admin';

-- Development commercial coordinates are deliberately fictitious. Disable
-- them so production cannot accept money until AlphaBy loads the approved
-- prices and real beneficiary accounts through the controlled runbook.
UPDATE public.billing_price_channels ch
SET activo=false,
    actualizado_en=now()
FROM public.billing_prices p
WHERE p.id=ch.price_id AND p.proveedor='DEVELOPMENT';

UPDATE public.billing_prices
SET activo=false
WHERE proveedor='DEVELOPMENT';

UPDATE public.billing_bank_accounts
SET activo=false,
    actualizado_en=now()
WHERE codigo LIKE 'ALPHABY_DEV_%'
   OR numero_cuenta LIKE 'DEVELOPMENT-%';
