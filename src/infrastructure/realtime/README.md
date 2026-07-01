# Realtime

Socket.IO notifica cambios operacionales ya confirmados por los casos de uso.
No reemplaza REST ni contiene comandos de escritura: PostgreSQL y los endpoints
HTTP siguen siendo la fuente de verdad.

## Flujo

```txt
HTTP controller -> use case -> repository/transaction -> event publisher
                                                    -> Socket.IO gateway
                                                    -> authorized rooms
                                                    -> client refetches REST
```

El puerto `IntegrationEventPublisher` vive en `shared-kernel/domain`. La
implementación Socket.IO y el adapter Redis viven en infraestructura. Así los
casos de uso no dependen de una librería de transporte.

## Conexión

El namespace es `/realtime` y el path predeterminado es `/socket.io`. El JWT de
Supabase se entrega durante el handshake, nunca como query parameter:

```ts
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000/realtime', {
  path: '/socket.io',
  auth: { token: supabaseAccessToken },
});

socket.on('realtime.ready', (session) => {
  console.log(session);
});

socket.on('sales.created', () => {
  // Invalidar/refrescar las consultas REST afectadas.
});
```

Al reconectar, el cliente debe volver a consultar sus vistas activas. Los
eventos son señales de invalidación rápidas, no un registro durable.

## Seguridad

- Cada conexión valida el JWT con `AccessTokenVerifierService`.
- La identidad, rol, módulos y vendedor se resuelven desde la base interna.
- Las salas se asignan únicamente en el servidor.
- No existen listeners Socket.IO que modifiquen el negocio.
- Los eventos contienen identificadores y estado mínimo, no secretos.
- El tamaño de entrada y los orígenes CORS están restringidos por configuración.

## Eventos

```txt
draws.configuration.created       draws.configuration.updated
draws.shift.opened                draws.shift.blocked
draws.shift.reopened              draws.shift.closed
number-limits.created             number-limits.updated
number-limits.expired             blocked-numbers.created
blocked-numbers.deleted           sales.created
sales.voided                      sales.void-policy.updated
results.created                   prize-payments.paid
cash-cuts.created                 parameters.updated
```

Todos usan el envelope versionado:

```ts
type RealtimeEnvelope<T> = {
  id: string;
  name: string;
  aggregateId?: string;
  occurredAt: string;
  version: 1;
  payload: T;
};
```

## Escalado

En una sola instancia use `REALTIME_REDIS_ENABLED=false`. Para varias
instancias active Redis, mantenga Redis en una red privada y configure sticky
sessions en el balanceador cuando permita HTTP long-polling. El adapter Redis
distribuye eventos mediante Pub/Sub; no ofrece recuperación durable de eventos.

## Prueba operativa

Con la API levantada:

```bash
SMOKE_ADMIN_EMAIL=admin@example.com \
SMOKE_ADMIN_PASSWORD='secret' \
yarn test:realtime:smoke
```

La prueba comprueba rechazo anónimo, handshake autenticado y entrega de un
evento real causado por un endpoint REST.

Para levantar temporalmente la compilación en otro puerto durante la prueba:

```bash
yarn build
SMOKE_BASE_URL=http://127.0.0.1:3001/api/v1 \
REALTIME_SMOKE_START_SERVER=true \
REALTIME_SMOKE_SERVER_PORT=3001 \
REALTIME_SMOKE_PROVISION_SELLER=true \
SMOKE_ADMIN_EMAIL=admin@example.com \
SMOKE_ADMIN_PASSWORD='secret' \
yarn test:realtime:smoke
```

Con `REALTIME_SMOKE_PROVISION_SELLER=true`, el runner crea una invitación de
prueba con MailerSend desactivado en la instancia temporal, confirma la cuenta,
inicia sesión como `VENDEDOR`, valida RBAC y entrega de eventos globales y por
vendedor. En `finally` elimina límites creados, usuario/vendedor, códigos de
acceso y usuario Supabase Auth. No use esta opción contra una API compartida;
requiere `REALTIME_SMOKE_START_SERVER=true` salvo autorización explícita con
`REALTIME_SMOKE_ALLOW_EXTERNAL_PROVISION=true`.
