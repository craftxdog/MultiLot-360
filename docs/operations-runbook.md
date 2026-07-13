# Runbook operacional

## Objetivo

Este documento reúne los controles necesarios para ejecutar y desplegar la API
sin depender de conocimiento implícito del equipo.

## Dependencias

| Servicio | Uso | Requerido en producción |
| --- | --- | --- |
| PostgreSQL/Supabase | Datos de negocio y funciones SQL | Sí |
| Supabase Auth | Usuarios, JWT, OTP y refresh sessions | Sí |
| Redis | Adapter distribuido de Socket.IO | Sí para más de una instancia |
| MailerSend | Invitaciones, códigos y recuperación | Sí para correo real |

## Preparación local

```bash
yarn install --frozen-lockfile
cp .env.example .env
yarn prisma:generate
yarn docker:up
yarn start:dev
```

Comprobaciones:

```bash
curl http://localhost:3000/api/v1/health
curl http://localhost:3000/api/v1/health/ready
```

`health` comprueba el proceso. `health/ready` debe usarse para readiness del
orquestador porque verifica dependencias y responde `503 Service Unavailable`
si PostgreSQL, Redis o la configuración obligatoria no están disponibles.

En `NODE_ENV=production` el proceso se niega a iniciar si detecta Swagger,
signup público, HTTP/localhost en URLs públicas o CORS, secretos débiles,
PostgreSQL sin `DB_SSL=true`, Redis sin contraseña o realtime sin Redis.
Usar `.env.production.example` como inventario; nunca guardar sus valores reales
en Git.

El runtime activa TLS mediante el objeto `ssl` de `@prisma/adapter-pg`; por eso
`DATABASE_URL` no debe duplicar `sslmode`. `DIRECT_URL` y
`PRISMA_DATABASE_URL`, usados por Prisma CLI sin ese adaptador, sí deben incluir
`sslmode=require`.

## Variables sensibles

Nunca versionar:

- `DATABASE_URL` y `DIRECT_URL` con contraseña real;
- `SUPABASE_SERVICE_ROLE_KEY`;
- `SUPABASE_JWT_SECRET`;
- `MAILERSEND_API_TOKEN`;
- `SELLER_ACCESS_CODE_SECRET`;
- access tokens, refresh tokens u OTP de pruebas.

Los archivos `.env*` reales permanecen ignorados. `.env.example` solo contiene
nombres, formatos y valores locales no sensibles.

## Supabase Auth

Configuración recomendada en el dashboard:

1. Email/password habilitado.
2. Expiración de Email OTP igual a
   `PASSWORD_RESET_CODE_EXPIRES_IN_MINUTES`.
3. Access JWT con vida corta; un logout global no invalida inmediatamente un
   access token ya emitido.
4. Protección contra contraseñas filtradas habilitada.
5. Política de longitud/fortaleza compatible con los DTO de la API.
6. URLs de redirección limitadas a los frontends autorizados.

La service role se usa solo en el backend. La autorización de negocio no toma
roles desde `user_metadata`; resuelve `usuarios`, roles, módulos y permisos en
PostgreSQL.

## Postura RLS

Las tablas públicas tienen RLS habilitado y no exponen políticas para `anon` o
`authenticated`. Es intencional: el frontend consume esta API y no consulta
las tablas de negocio mediante PostgREST.

Si en el futuro se expone una tabla por Data API:

1. Diseñar políticas por ownership y operación.
2. Usar `TO authenticated` junto con predicados `USING` y `WITH CHECK`.
3. No basar autorización en `user_metadata`.
4. Ejecutar advisors de seguridad antes del despliegue.

## MailerSend

Antes de habilitar `MAILERSEND_ENABLED=true`:

1. Verificar el dominio de `MAILERSEND_FROM_EMAIL`.
2. Confirmar token API y remitente.
3. Configurar `PASSWORD_RESET_URL` y `SELLER_ACTIVATION_URL` con HTTPS.
4. Ejecutar un smoke autorizado con una cuenta de prueba.
5. Revisar entrega, rebotes y spam en MailerSend.

Los códigos sensibles se renderizan en el cuerpo del correo cuando el flujo lo
requiere, pero no se registran en logs. El enlace de recuperación incluye solo
el correo normalizado; el OTP no viaja en la URL.

## Base de datos y Prisma

Cada entorno nuevo debe aplicar en orden todos los archivos de
`supabase/migrations/` y ejecutar después `supabase/seed.sql`. El baseline
contiene solo estructura; las migraciones posteriores endurecen o evolucionan
esa estructura, y el seed contiene solo roles, módulos, permisos y parámetros
idempotentes. No se copian usuarios, vendedores, sorteos, turnos ni ventas
desde otro entorno.

La base remota es la fuente de verdad del flujo introspectivo:

```bash
yarn prisma:pull
git diff -- prisma/schema.prisma
yarn prisma:generate
yarn prisma:validate
```

Los SQL bajo `prisma/migrations/` documentan y permiten reproducir cambios
aplicados de forma controlada. No ejecutar un archivo nuevamente sin revisar su
estado en el entorno objetivo.

El proyecto Supabase original fue creado antes del historial de Prisma Migrate.
Si `prisma migrate deploy` devuelve `P3005`, no marcar migraciones ni baselinar
automáticamente una base productiva. Revisa el SQL y ejecuta únicamente el
archivo pendiente autorizado, por ejemplo:

```bash
yarn prisma db execute --file prisma/migrations/20260706181532_add_notifications_and_rbac_defaults/migration.sql
yarn rbac:verify
```

La verificación debe confirmar tabla `notificaciones`, módulo
`NOTIFICACIONES`, parámetro `notifications.sales_milestone` y permisos mínimos
del rol vendedor.

Las columnas monetarias operacionales deben permanecer en `numeric(14,2)`:

```txt
ventas.total_miles
venta_detalle.premio_miles
pagos_premios.monto_pagado_miles
limites_numero.limite_miles
```

## Redis y Socket.IO

- `REALTIME_ENABLED=true` habilita el gateway.
- `REALTIME_REDIS_ENABLED=true` distribuye eventos entre réplicas.
- Restringir `CORS_ORIGINS` a orígenes conocidos.
- Mantener `REALTIME_MAX_PAYLOAD_BYTES` acotado.
- No usar eventos Socket.IO para ejecutar mutaciones.

El cliente siempre hace refetch REST después de eventos o reconexión.
`notifications.created` se persiste antes de emitirse a la sala del usuario;
si el socket se pierde, la bandeja REST conserva el aviso.

## Validación previa a publicar

```bash
yarn prisma:validate
yarn prisma:generate
yarn format:check
yarn docs:check
yarn lint:check
yarn test --runInBand --no-watchman
yarn test:e2e --runInBand --no-watchman
yarn build
```

Para una prueba operacional real, levantar API y Redis y ejecutar
`yarn test:api:smoke` con credenciales temporales autorizadas. Los flujos que
crean invitaciones o envían correo deben habilitarse explícitamente.
El smoke realtime con vendedor temporal comprueba persistencia y lectura de
notificaciones. Si se interrumpe, ejecutar `yarn test:realtime:cleanup` para
eliminar solamente fixtures `codex.realtime.*`.

## Estrategia de ramas

- `develop`: integración continua y trabajo diario.
- `master`: versión estable/promovida.
- `feature/*` y `fix/*`: temporales; se eliminan después de integrarse.

Nunca forzar `master` o `develop`. Integrar por fast-forward cuando sea posible
y publicar solo después de pasar la matriz de validación.

## Despliegue y rollback

Orden recomendado:

1. Respaldar y aplicar cambio SQL compatible hacia atrás.
2. Generar el Prisma Client con el schema versionado.
3. Desplegar API.
4. Comprobar `health/ready`.
5. Ejecutar smoke de lectura y una mutación controlada.
6. Confirmar eventos realtime y logs sin secretos.

Si falla la API, revertir el despliegue de código primero. No revertir columnas
monetarias o datos sin un plan SQL probado y respaldo verificado.
