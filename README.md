# MultiLot 360 API

API de lotería construida con NestJS, Prisma, PostgreSQL/Supabase Auth, Redis y
MailerSend. El código sigue DDD con arquitectura hexagonal por bounded context.

## Arquitectura

Cada módulo de negocio separa sus responsabilidades en cuatro capas:

```txt
src/modules/<context>/
  domain/          entidades y puertos
  application/     casos de uso
  infrastructure/  adaptadores Prisma y proveedores externos
  presentation/    controladores, DTOs y mappers HTTP
```

Los elementos compartidos de dominio viven en `src/shared-kernel`; los
componentes HTTP reutilizables viven en `src/common`; los proveedores externos
globales viven en `src/infrastructure`.

La descripción detallada está en
`docs/architecture/hexagonal-ddd-structure.md`.

## Requisitos

- Node.js 22 o superior.
- Yarn 1.x.
- Proyecto Supabase y base PostgreSQL configurados.
- Redis local para que `GET /api/v1/health/ready` quede completamente sano.
- Dominio y token activos de MailerSend para correos reales.

## Configuración

```bash
yarn install --frozen-lockfile
cp .env.example .env
```

Completa las credenciales privadas solamente en archivos `.env` ignorados por
Git. Nunca publiques `SUPABASE_SERVICE_ROLE_KEY`, contraseñas, JWT ni
`MAILERSEND_API_TOKEN`.

Variables web usadas por los correos:

```dotenv
APP_WEB_URL=http://localhost:8080
SELLER_ACTIVATION_URL=http://localhost:8080/activar-vendedor
ACCOUNT_CONFIRMATION_URL=http://localhost:8080/confirmar-cuenta
```

`SELLER_ACTIVATION_URL` recibe `email` y `code` como query parameters. El
frontend debe precargarlos y enviar el código, junto con la contraseña elegida,
a `POST /api/v1/identity-access/sellers/access-code/confirm`. Abrir el enlace no
consume ni confirma el código automáticamente.

## Prisma

La base remota es la fuente de verdad mientras se mantenga el flujo
introspectivo:

```bash
yarn prisma:pull
yarn prisma:generate
yarn prisma:validate
```

Revisa siempre el diff de `prisma/schema.prisma` después de `db pull`.

## Ejecución

```bash
yarn docker:up
yarn start:dev
```

- API: `http://localhost:3000/api/v1`
- Swagger: `http://localhost:3000/docs`
- Liveness: `http://localhost:3000/api/v1/health`
- Readiness: `http://localhost:3000/api/v1/health/ready`
- Socket.IO: `http://localhost:3000/realtime` (path `/socket.io`)

## Tiempo real

Socket.IO notifica cambios confirmados en sorteos, turnos, límites, bloqueos,
ventas, resultados, premios, cortes y parámetros. La conexión usa el access
token de Supabase en `auth.token`; las salas se calculan en el servidor según
el usuario, rol, vendedor y módulos autorizados.

Los eventos no sustituyen las respuestas REST. El cliente los usa para
invalidar y refrescar sus consultas, especialmente después de reconectar. El
contrato completo está en `src/infrastructure/realtime/README.md`.

## Validación local

```bash
yarn format:check
yarn lint:check
yarn test --runInBand --no-watchman
yarn test:e2e --runInBand --no-watchman
yarn prisma:validate
yarn build
```

## Smoke real

El runner `scripts/api-smoke.ts` comprueba los endpoints públicos, Auth y RBAC.
Con el flujo operacional habilitado crea datos identificados con
`codex-smoke-*` y recorre:

```txt
sorteo -> turno -> límite -> bloqueo -> venta múltiple -> anulación
       -> cierre -> resultado -> venta ganadora -> pago de premio
       -> corte -> reportes -> parámetros -> auditoría
```

Prueba básica con login administrativo:

```bash
SMOKE_ADMIN_EMAIL=admin@example.com \
SMOKE_ADMIN_PASSWORD='secret' \
yarn test:api:smoke
```

Flujo operacional completo:

```bash
SMOKE_ADMIN_EMAIL=admin@example.com \
SMOKE_ADMIN_PASSWORD='secret' \
SMOKE_EXISTING_SELLER_EMAIL=seller@example.com \
SMOKE_RUN_OPERATIONAL_FLOW=true \
yarn test:api:smoke
```

Flujo destructivo de invitación y correo real:

```bash
SMOKE_ADMIN_EMAIL=admin@example.com \
SMOKE_ADMIN_PASSWORD='secret' \
SMOKE_RUN_INVITATION_FLOW=true \
SMOKE_INVITATION_EMAIL=recipient@example.com \
yarn test:api:smoke
```

Opciones adicionales:

- `SMOKE_ADMIN_JWT` y `SMOKE_SELLER_JWT`: sesiones existentes.
- `SMOKE_SELLER_EMAIL` y `SMOKE_SELLER_PASSWORD`: login real del vendedor.
- `SMOKE_SELLER_ID`: vendedor usado por el flujo operacional.
- `SMOKE_DATE`: fecha `YYYY-MM-DD` del flujo.
- `SMOKE_REQUIRE_READY_DEPENDENCIES=true`: falla si DB, configuración o Redis
  no están sanos.

El flujo de invitación envía correos y crea registros reales. Úsalo solamente
con destinatarios y entornos autorizados.

Smoke de autenticación y entrega Socket.IO con la API levantada:

```bash
SMOKE_ADMIN_EMAIL=admin@example.com \
SMOKE_ADMIN_PASSWORD='secret' \
yarn test:realtime:smoke
```

## CI

GitHub Actions ejecuta validación de Prisma, generación del cliente, formato,
lint, pruebas unitarias y build sobre `develop` y `master`.
