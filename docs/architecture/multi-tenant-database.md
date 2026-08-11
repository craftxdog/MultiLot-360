# Arquitectura multi-tenant de base de datos

## Estado implementado

El proyecto Supabase de desarrollo `wweiogaeaikasrlldbdy` usa una sola base
PostgreSQL y un esquema compartido. Cada agregado de negocio posee `tenant_id`
obligatorio. El aislamiento no depende solamente de que la API recuerde filtrar:

1. RLS compara `tenant_id` con el contexto transaccional.
2. Claves foráneas compuestas `(tenant_id, id)` impiden relacionar datos de dos
   empresas.
3. Índices con `tenant_id` soportan RLS, reportes y verificaciones referenciales.
4. Triggers rechazan el cambio de tenant y protegen invariantes críticas.

Los seis usuarios, el vendedor, las ventas y el resto de datos anteriores fueron
asignados al tenant `multilot-legacy` sin cambiar sus identificadores ni borrar
registros.

## Identidad y autorización

`usuarios` representa una identidad global y conserva temporalmente las columnas
legadas `username`, `pass_hash` y `rol_id`. La autorización nueva vive en:

- `tenants`: empresa, estado comercial, zona horaria, moneda y configuración.
- `membresias_tenant`: relación de una persona con una empresa, rol, username,
  estado y condición de propietario.
- `roles` y `permisos_por_rol`: ahora pertenecen a un tenant.
- `tenant_invitations`: invitación con hash, expiración, rol y actor.
- `tenant_domains`: dominios personalizados verificables.
- `platform_admins`: operadores internos de la plataforma, separados de los
  administradores de cada empresa.

Una persona puede pertenecer a varias empresas. El trigger
`membresias_protect_last_owner` evita dejar una empresa sin propietario activo.

## Datos de negocio

Se agregó `tenant_id` a vendedores, códigos de acceso, sorteos, turnos, ventas,
detalles, bloqueos, resultados, pagos de premios, parámetros, cortes, auditoría,
notificaciones y límites. Las restricciones naturales ahora son locales a la
empresa; por ejemplo, dos tenants pueden usar el mismo código de sorteo, username
o cédula.

Los procedimientos de ventas, turnos, matrices, premios, anulaciones y límites
tienen versiones que exigen `p_tenant`. La validación del detalle de venta:

- normaliza el número;
- verifica venta, turno y tenant;
- respeta bloqueos solo del tenant;
- calcula el límite aplicable solo dentro del tenant;
- adquiere un advisory lock por tenant/turno/número para cerrar la carrera entre
  ventas concurrentes;
- recalcula el total usando tenant y venta.

Los RPC legados globales permanecen temporalmente en catálogo para facilitar la
transición, pero `anon`, `authenticated` y `service_role` no pueden ejecutarlos.

## RLS y roles de conexión

`multilot_app` es un rol de grupo `NOLOGIN`, `NOBYPASSRLS`. Todas las tablas
quedaron con RLS y las tablas tenant-owned usan la política `tenant_isolation`.
El contexto se establece dentro de la misma transacción:

```sql
SET LOCAL ROLE multilot_app;
SELECT app_private.set_request_context(
  :auth_user_id,
  :tenant_id,
  :profile_id,
  :membership_id
);
```

`set_request_context` confirma que Supabase Auth, perfil, membresía y estado del
tenant coinciden. Los cuatro valores se guardan con `set_config(..., true)`, por
lo que desaparecen al terminar la transacción y no contaminan otra conexión del
pool.

No se creó un rol `LOGIN` ni una contraseña dentro de la migración. En cada
entorno debe crearse fuera del repositorio y guardarse en Dokploy:

```sql
CREATE ROLE multilot_api LOGIN PASSWORD '<secret-from-vault>' NOINHERIT NOBYPASSRLS;
GRANT multilot_app TO multilot_api;
GRANT multilot_billing_worker TO multilot_api;
```

La API ya abre una transacción por request Bearer, ejecuta `SET LOCAL ROLE
multilot_app`, resuelve una membresía activa y establece el contexto antes de
consultar repositorios. Aun si development conserva temporalmente una URL de
propietario, las rutas protegidas quedan bajo RLS. Producción además rechaza al
arrancar una `DATABASE_URL` cuyo usuario sea `postgres`; debe usar
`multilot_api` mediante el pooler.

## Facturación y aprovisionamiento

La capa de cobros es neutral al proveedor:

- `billing_plans` y `billing_prices` definen producto, moneda, importe e intervalo.
- `tenant_billing_accounts` almacena el customer externo y datos fiscales.
- `tenant_subscriptions` conserva el historial y permite una sola suscripción
  vigente por empresa.
- `billing_invoices` refleja facturas y estados.
- `billing_payment_methods` guarda únicamente token externo, marca, últimos cuatro
  y expiración. Nunca PAN, CVV ni datos crudos de tarjeta.
- `billing_events` deduplica webhooks por proveedor/evento y compara el hash del
  payload.
- `tenant_onboarding_sessions` enlaza registro, checkout y empresa solicitada.
- `idempotency_keys` protege comandos HTTP reintentados.
- `outbox_events` desacopla correos, tiempo real y trabajos posteriores.

`multilot_billing_worker` es otro rol `NOLOGIN`, sin permisos directos sobre
tablas. Sus funciones de `app_private` permiten:

1. `create_onboarding_session`: registra el checkout creado por el proveedor.
2. `record_billing_event`: registra/deduplica el webhook cuya firma ya validó la
   API.
3. `activate_paid_tenant`: en una transacción crea tenant, clona roles y permisos,
   asigna propietario, crea cuenta y suscripción, completa onboarding, consume el
   evento y emite `tenant.activated` al outbox.
4. `start_paid_signup`/`bind_paid_signup`: crean la identidad pendiente sin
   membresía y enlazan el ID de suscripción devuelto por PayPal.
5. `process_subscription_event`: valida idempotencia y aplica activación, cobro
   recuperado, mora, pausa o cancelación.

La API implementa PayPal Subscriptions sandbox/live. El webhook se verifica con
el endpoint oficial de PayPal antes de entrar al worker. Las llamadas HTTP al
proveedor ocurren fuera de transacciones PostgreSQL.

La migración no inventa precios ni IDs del proveedor. Antes de habilitar checkout
se deben insertar filas reales en `billing_prices` con el proveedor elegido y sus
`provider_price_id`.

## Invariantes adicionales

- `tenant_id` es inmutable en todas las tablas tenant-owned.
- `auditoria_eventos` es append-only; mantenimiento excepcional requiere
  `SET LOCAL app.allow_audit_mutation = 'on'` como propietario de la base.
- Los webhooks son idempotentes y un ID repetido con payload distinto falla.
- Solo existe un método de pago predeterminado por tenant.
- Solo existe una suscripción en estado vivo por tenant.
- Los rangos de límites no pueden solaparse dentro del mismo alcance tenant,
  vendedor, sorteo y número.
- El schema `app_private` no está expuesto al Data API.

## Artefactos fuente

- Migración principal: `supabase/migrations/20260716131710_multi_tenant_control_plane_and_isolation.sql`
- Índices de FKs: `supabase/migrations/20260716133128_index_multi_tenant_foreign_keys.sql`
- Relaciones Prisma: `supabase/migrations/20260716133304_align_composite_relations_for_prisma.sql`
- Aprovisionamiento pagado: `supabase/migrations/20260716141848_add_atomic_paid_tenant_provisioning.sql`
- Alta segura/ciclo de cobro: `supabase/migrations/20260716153000_secure_paid_signup_and_billing_lifecycle.sql`
- Prueba integrada: `supabase/tests/database/multi_tenant_isolation.test.sql`
