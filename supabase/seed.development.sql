-- Development-only billing catalog. Never execute this file in production.
-- Amounts and bank coordinates are deliberately fictitious. Replace them with
-- AlphaBy's approved commercial price list and real beneficiary accounts in
-- each target environment before accepting money.
INSERT INTO public.billing_prices(
  plan_id,proveedor,proveedor_price_id,moneda,monto_minor,intervalo,activo
)
SELECT p.id,'DEVELOPMENT','dev_' || lower(p.codigo),'USD',
       CASE p.codigo WHEN 'STARTER' THEN 2900 WHEN 'BUSINESS' THEN 7900 ELSE 19900 END,
       'MENSUAL',true
FROM public.billing_plans p
WHERE p.codigo IN ('STARTER','BUSINESS','ENTERPRISE')
ON CONFLICT (plan_id,moneda,intervalo) DO UPDATE
SET proveedor=EXCLUDED.proveedor,
    proveedor_price_id=EXCLUDED.proveedor_price_id,
    monto_minor=EXCLUDED.monto_minor,
    activo=true;

INSERT INTO public.billing_prices(
  plan_id,proveedor,proveedor_price_id,moneda,monto_minor,intervalo,activo
)
SELECT p.id,'DEVELOPMENT','dev_' || lower(p.codigo) || '_nio','NIO',
       CASE p.codigo WHEN 'STARTER' THEN 106500 WHEN 'BUSINESS' THEN 290000 ELSE 730000 END,
       'MENSUAL',true
FROM public.billing_plans p
WHERE p.codigo IN ('STARTER','BUSINESS','ENTERPRISE')
ON CONFLICT (plan_id,moneda,intervalo) DO UPDATE
SET proveedor=EXCLUDED.proveedor,
    proveedor_price_id=EXCLUDED.proveedor_price_id,
    monto_minor=EXCLUDED.monto_minor,
    activo=true;

INSERT INTO public.billing_bank_accounts(
  codigo,banco,titular,moneda,tipo_cuenta,numero_cuenta,instrucciones,activo,orden
) VALUES
  (
    'ALPHABY_DEV_USD','BANCO DE PRUEBAS','ALPHABY DEVELOPMENT','USD',
    'CORRIENTE','DEVELOPMENT-USD-0001',
    'Cuenta ficticia. No realizar transferencias reales.',true,10
  ),
  (
    'ALPHABY_DEV_NIO','BANCO DE PRUEBAS','ALPHABY DEVELOPMENT','NIO',
    'CORRIENTE','DEVELOPMENT-NIO-0001',
    'Cuenta ficticia. No realizar transferencias reales.',true,20
  )
ON CONFLICT (codigo) DO UPDATE
SET banco=EXCLUDED.banco,
    titular=EXCLUDED.titular,
    tipo_cuenta=EXCLUDED.tipo_cuenta,
    numero_cuenta=EXCLUDED.numero_cuenta,
    instrucciones=EXCLUDED.instrucciones,
    activo=EXCLUDED.activo,
    orden=EXCLUDED.orden;
