# Runbook de operación multi-tenant

## Gates antes de habilitar empresas reales

1. Crear un rol `LOGIN` secreto para la API, miembro de `multilot_app` y
   `multilot_billing_worker`; ambos roles de grupo son `NOINHERIT` y solo se
   activan con `SET LOCAL ROLE` dentro de transacciones separadas.
2. Cambiar `DATABASE_URL` en Dokploy para que la API deje de conectarse como
   `postgres`.
3. Confirmar que el middleware de tenant y el worker de billing permanecen
   habilitados; ya ejecutan las transacciones y roles separados.
4. Resolver tenant por selección explícita, subdominio o dominio verificado. No
   aceptar un `tenant_id` del body sin comprobar su membresía.
5. Cargar el tarifario comercial real USD/NIO y una cuenta receptora AlphaBy
   activa por moneda. Los datos de `seed.development.sql` son ficticios.
6. Crear al menos una cuenta individual en `platform_admins`, activa y con
   `puede_revisar_facturacion=true`, para quien conciliará transferencias.
7. Si PayPal coexistirá, crear sus planes, activar los canales PayPal y registrar
   el webhook HTTPS `/api/v1/billing/webhooks/paypal`.
8. Activar confirmación obligatoria de email y protección de contraseñas
   filtradas en Supabase Auth. HIBP requiere plan Supabase Pro; mientras el
   proyecto sea Free, conservar mínimo de 8 caracteres en Auth y API y tratar la
   advertencia del advisor como un gate previo a producción.
9. Configurar una tarea diaria autenticada para `/billing/internal/cycle`.
10. Ejecutar unit, E2E, ambas pruebas SQL y advisors en development antes del
   primer alta de tenant.

## Flujo de registro y pago mensual

```text
POST /billing/signup
  -> usuario Supabase Auth + tenant PENDIENTE_PAGO + owner
  -> confirmación obligatoria del correo
  -> portal exclusivo de facturación
  -> documento comercial + cuenta USD o NIO
  -> declaración + evidencia privada
  -> conciliación por administrador financiero AlphaBy
  -> payment ledger + tenant ACTIVO (una transacción)
  -> sesión normal dentro del tenant
```

La pantalla puede pedir datos de tarjeta durante autenticación, pero debe ser un
componente alojado/tokenizado por el proveedor. La API recibe un token o session
ID; MultiLot nunca recibe números de tarjeta ni CVV.

## Dokploy

Variables nuevas recomendadas por entorno:

```text
DATABASE_URL=<pooled URL del LOGIN multilot_api>
DIRECT_URL=<conexión administrativa solo para migraciones CI>
BILLING_PROVIDER=disabled
BILLING_WORKER_SECRET=<32+ caracteres aleatorios e independientes>
BILLING_RETURN_URL=<frontend>/facturacion/confirmada
BILLING_CANCEL_URL=<frontend>/onboarding/cancel
PAYPAL_ENABLED=false
PAYPAL_ENVIRONMENT=live
PAYPAL_CLIENT_ID=<secret>
PAYPAL_CLIENT_SECRET=<secret>
PAYPAL_WEBHOOK_ID=<secret/config>
```

`PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` y `PAYPAL_WEBHOOK_ID` solo son
obligatorios si `PAYPAL_ENABLED=true`. La transferencia bancaria no necesita
credenciales Banpro: esta versión concilia manualmente el estado bancario y no
simula que una captura sea una confirmación.

`DIRECT_URL` no debe estar disponible en el contenedor runtime. Debe
vivir únicamente en el job de migración protegido. Development y production usan
customers, prices, webhook IDs y credenciales diferentes.

Para development se permite `BILLING_PROVIDER=development`, el catálogo de
`supabase/seed.development.sql` y `/billing/development/complete` con
`BILLING_DEVELOPMENT_SECRET`. La validación de entorno prohíbe ese proveedor en
producción cuando el registro está habilitado.

El pooler es válido porque el contexto usa `SET LOCAL` dentro de una transacción.
Nunca establecer contexto fuera de `$transaction`; una conexión reutilizada
podría ejecutar la siguiente consulta sin el contexto esperado.

### Tarea programada de Dokploy

Ejecutar una vez al día, por ejemplo a las `00:15 America/Managua`, sin enviar
`now` desde producción:

```sh
curl --fail --silent --show-error \
  -X POST "https://api.example.com/api/v1/billing/internal/cycle" \
  -H "content-type: application/json" \
  -H "x-billing-worker-secret: $BILLING_WORKER_SECRET" \
  -d '{}'
```

El secreto debe existir solamente en el servicio/cron de Dokploy. El endpoint es
idempotente por día y usa un lock transaccional para impedir ejecuciones
concurrentes. Supervisar el HTTP no-2xx y `billing_runs`.

### Configuración inicial de cobro

No colocar números de cuenta reales en una migración. Cargarlos por un proceso
administrativo protegido:

```sql
INSERT INTO public.billing_bank_accounts(
  codigo,banco,titular,moneda,tipo_cuenta,numero_cuenta,instrucciones,orden
) VALUES
  ('ALPHABY_USD','<BANCO>','<TITULAR>','USD','<TIPO>','<CUENTA USD>','<INSTRUCCIONES>',10),
  ('ALPHABY_NIO','<BANCO>','<TITULAR>','NIO','<TIPO>','<CUENTA NIO>','<INSTRUCCIONES>',20);
```

Una cuenta nueva debe insertarse desactivada, conciliarse y luego sustituir la
anterior dentro de una transacción; el índice permite solo una activa por
moneda. Los precios usan unidades menores y deben aprobarse comercialmente antes
de activar el canal `BANK_TRANSFER`.

## Migraciones y validación

Orden recomendado:

```text
backup administrado/verificado
-> aplicar migraciones Supabase
-> prisma db pull
-> revisar cardinalidades de índices únicos parciales
-> prisma validate
-> prisma generate
-> aislamiento SQL
-> advisors security/performance
-> despliegue de API
```

Las pruebas `supabase/tests/database/multi_tenant_isolation.test.sql` y
`bank_transfer_billing.test.sql` se ejecutan con `ON_ERROR_STOP` y terminan en
`ROLLBACK`. La segunda valida email confirmado, portal pendiente, vendedor
denegado, monto/moneda exactos, Storage privado, evidencia, cola global,
aprobación atómica, ledger append-only, duplicados, cron idempotente, grants y
RLS de todas las tablas públicas.

## Suspensión y cobro fallido

- El ciclo diario marca suscripción `MOROSA` y tenant `MOROSO` al vencer.
- Durante tres días de gracia el contexto operacional permanece permitido.
- Al vencer la gracia cambia a `SUSPENDIDO`; solo billing permanece disponible.
- Una evidencia oportuna puede pausar esa suspensión hasta 48 horas mientras se
  revisa, nunca indefinidamente.
- El pago confirmado devuelve ambos estados a `ACTIVA`/`ACTIVO`.
- A los 15 días se reemite desde la reactivación; a los 30 se archiva un tenant
  que nunca pagó.
- El webhook de cancelación o expiración suspende el tenant inmediatamente. Si se
  ofrece "cancelar al final del periodo", la aplicación debe conservar la
  suscripción activa y solicitar la cancelación al proveedor cuando llegue
  `periodo_termina_en`.
- Estos cambios deben producir eventos outbox y auditoría.

## Respuesta a incidentes

Ante sospecha de fuga entre tenants:

1. Suspender altas y rotar credenciales de los roles LOGIN.
2. Confirmar que el runtime no usa `postgres` ni `service_role` para SQL.
3. Consultar `auditoria_eventos` por tenant, membresía, request y ventana temporal.
4. Reejecutar la prueba de aislamiento y revisar políticas/grants.
5. Verificar que todas las consultas se ejecutaron dentro de una transacción con
   contexto.
6. Restaurar a un proyecto aislado si se necesita análisis histórico; no restaurar
   producción encima del origen sin preservar evidencia.
