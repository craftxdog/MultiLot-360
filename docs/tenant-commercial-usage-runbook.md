# Ruta de uso comercial multi-tenant

Esta guía explica cómo vender acceso mensual a empresas nuevas, activar su
tenant y operar la jornada completa con la actualización multi-tenant.

## Idea principal

MultiLot 360 usa una sola base de datos compartida. Cada empresa es un registro
en `tenants` y todos sus datos operacionales cuelgan de `tenant_id`: usuarios,
membresías, roles, permisos, vendedores, sorteos, turnos, ventas, premios,
cortes, parámetros, auditoría y notificaciones.

El cliente no compra una instalación separada. Compra una suscripción mensual
para su empresa. Esa empresa nace como `PENDIENTE_PAGO`; antes de aprobar el
primer pago solo puede entrar al portal de facturación. Cuando AlphaBy aprueba
el pago, la activación cambia el tenant a `ACTIVO` y se abren los módulos
operacionales.

## Ruta para vender acceso a una empresa nueva

1. Publicar el plan comercial:
   - Cargar precios reales en `billing_prices`.
   - Activar canales en `billing_price_channels`, normalmente
     `BANK_TRANSFER` como principal y `PAYPAL` solo si está habilitado.
   - Cargar una cuenta AlphaBy activa por moneda en `billing_bank_accounts`:
     una para `USD` y una para `NIO`.

   Antes de abrir el registro, confirme que no quede ningún precio con
   `proveedor='DEVELOPMENT'` ni cuentas cuyo código empiece por
   `ALPHABY_DEV_`. La API puede responder `200` con catálogo vacío mientras el
   tarifario real no ha sido activado; en ese estado no debe mostrarse el
   formulario de alta comercial.

2. Mostrar planes al cliente:
   - `GET /billing/plans?channel=BANK_TRANSFER`
   - La UI debe presentar moneda, monto mensual, canal disponible y condiciones.

3. Registrar empresa y propietario:
   - `POST /billing/signup`
   - Body mínimo:

```json
{
  "email": "propietario@empresa.com",
  "username": "propietario",
  "name": "Ana Perez",
  "password": "<CONTRASEÑA-SEGURA-DEL-PROPIETARIO>",
  "companyName": "Loteria Central, S.A.",
  "companySlug": "loteria-central",
  "priceId": "uuid-devuelto-por-billing-plans",
  "paymentMethod": "BANK_TRANSFER",
  "timezone": "America/Managua"
}
```

Resultado esperado: usuario Auth, perfil interno, tenant
`PENDIENTE_PAGO`, membresía propietaria, roles base, cuenta de facturación y
suscripción incompleta.

4. Confirmar correo e iniciar sesión:
   - El propietario confirma su correo desde Supabase Auth.
   - Luego usa `POST /auth/login`.
   - Si tiene más de un tenant, el login debe incluir `tenant` con slug o UUID.

5. Abrir portal de facturación:
   - `GET /billing/portal`
   - `POST /billing/portal/invoices/initial`
   - El portal muestra documento comercial, vencimiento, precio congelado y
     cuenta bancaria de la misma moneda.

6. Declarar transferencia:
   - `POST /billing/portal/transfers`
   - La API exige monto exacto, moneda exacta y cuenta compatible.
   - No acepta pago parcial ni conversión entre NIO/USD.

7. Subir evidencia:
   - `POST /billing/portal/transfers/:id/evidence`
   - `multipart/form-data`, campo `file`.
   - Solo PDF, JPEG o PNG reales, máximo 10 MiB.
   - La evidencia no aprueba dinero; solo manda la declaración a revisión.

8. Aprobar desde AlphaBy:
   - `GET /billing/admin/transfers?status=EN_REVISION&limit=100`
   - `POST /billing/admin/transfers/:id/review`

```json
{
  "decision": "APROBADA",
  "confirmedBankReference": "referencia real del banco",
  "notes": "Monto, cuenta y beneficiario conciliados"
}
```

La aprobación es atómica: crea revisión inmutable, pago confirmado, factura
pagada, suscripción activa y tenant `ACTIVO`. Si se rechaza, conserva historial
y el tenant sigue pendiente o moroso.

## Ruta para agregar usuarios dentro de un tenant activo

1. El propietario o un ADMIN entra al tenant activo.
2. Consulta permisos y módulos con `GET /auth/me`.
3. Invita vendedor:
   - `POST /identity-access/sellers/invitations`
   - El sistema crea perfil/membresía/vendedor inactivos y envía token opaco o
     código de un solo uso.
4. El vendedor acepta:
   - `POST /identity-access/sellers/access-code/confirm`
   - El alta activa usuario, membresía y vendedor en una transacción.
5. El vendedor inicia sesión:
   - `POST /auth/login`
   - `GET /auth/me` debe devolver `seller.id`.

Un vendedor no puede administrar facturación AlphaBy, usuarios, roles globales,
pagos de premios ni configuración que no le pertenezca. El propietario y los
usuarios con permiso `billing` sí pueden ver el portal de pagos; vendedores no.

## Ruta de venta operacional

1. Configurar sorteos:
   - `POST /draws/configurations`
   - `GET /draws/configurations`

2. Abrir jornada:
   - `POST /draws/shifts/auto-generate` o `POST /draws/shifts`
   - `GET /draws/shifts/active`

3. Vender:
   - Vendedor normal: `POST /sales` sin `sellerId`; la API usa su vendedor
     activo.
   - ADMIN vendiendo como sí mismo: `POST /sales` sin `sellerId`; la API crea o
     reutiliza su perfil vendedor interno ligado a la membresía admin.
   - ADMIN vendiendo a nombre de un vendedor: `POST /sales` con `sellerId`.

```json
{
  "shiftId": "uuid-del-turno-abierto",
  "items": [
    { "number": "07", "prizeMiles": 10 },
    { "number": "25", "prizeMiles": 5 }
  ]
}
```

La venta siempre queda dentro del tenant actual y pasa por validaciones de
turno abierto, límites, bloqueos, totales y concurrencia. Si falla un número,
no se crea venta parcial.

4. Control durante el día:
   - `GET /sales`
   - `GET /sales/:saleId`
   - `GET /sales-matrix`
   - `PATCH /sales/:saleId/void` cuando aplique.

5. Cerrar y pagar:
   - `PATCH /draws/shifts/:shiftId/close`
   - `POST /results`
   - `GET /results/:resultId/winning-sales`
   - `POST /prize-payments`
   - `POST /cash-cuts`
   - `GET /cash-cuts/:cutId/summary`

## Renovación mensual

El worker diario ejecuta:

```text
POST /billing/internal/cycle
Header: x-billing-worker-secret
```

Debe configurarse en Dokploy como tarea programada. El ciclo emite renovaciones,
aplica mora, gracia, suspensión, reactivación y archivo de onboarding impago.
La operación es idempotente por día.

## Reglas para producción

- Probar siempre en `develop` antes de promover.
- No conectar producción como `postgres`; usar el rol runtime `multilot_api`.
- No usar `BILLING_PROVIDER=development` en producción.
- No versionar cuentas bancarias reales, service role, secretos de worker,
  credenciales PayPal ni URLs directas administrativas.
- PayPal es opcional; transferencia bancaria sigue siendo el canal principal.
- La revisión de transferencia la hace una cuenta individual AlphaBy registrada
  en `platform_admins`, con MFA y permiso de revisión.
- No almacenar tarjetas, CVV, credenciales bancarias ni estados de cuenta
  completos.

## Documentos relacionados

- `docs/api.md`: referencia HTTP y DTOs.
- `docs/architecture/multi-tenant-database.md`: aislamiento, RLS y estructura.
- `docs/architecture/saas-billing-bank-transfers.md`: modelo de cobro mensual.
- `docs/multi-tenant-database-runbook.md`: operación de base de datos.
- `docs/qa/end-to-end-endpoint-flows.md`: certificación funcional completa.
