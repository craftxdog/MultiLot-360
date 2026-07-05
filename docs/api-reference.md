# Referencia de API

Esta referencia describe las rutas HTTP registradas por los controladores de
MultiLot 360. Swagger sigue siendo la fuente ejecutable de los esquemas DTO:

- Base local: `http://localhost:3000/api/v1`
- Swagger UI: `http://localhost:3000/docs`
- Bearer: access token emitido por Supabase Auth
- Socket.IO: namespace `/realtime`, path `/socket.io`

## Convenciones HTTP

Las rutas privadas pasan por cuatro controles independientes:

1. JWT válido de Supabase.
2. Usuario interno activo y enlazado mediante `usuarios.auth_user_id`.
3. Módulo habilitado para su rol.
4. Permiso RBAC requerido por el endpoint.

`@Public()` omite estos controles. El rol `ADMIN` aparece explícitamente donde
no basta con poseer un permiso.

Las respuestas exitosas usan este sobre:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Request completed successfully",
  "data": {},
  "meta": {
    "request": {
      "requestId": "uuid",
      "method": "GET",
      "path": "/api/v1/example",
      "timestamp": "2026-07-04T20:00:00.000Z"
    },
    "actor": {},
    "pagination": {}
  }
}
```

Los errores conservan `success=false`, código HTTP, mensaje, tipo de error y el
mismo contexto de request. El header `x-request-id` permite correlacionar el
cliente con logs y auditoría.

Los listados paginados usan `page`, `limit`, `sortBy` y `sortDirection`. El
límite máximo común es 100. Cada DTO restringe los campos de orden válidos y
puede añadir filtros específicos.

## Sistema y salud

| Método | Ruta | Acceso | Propósito |
| --- | --- | --- | --- |
| GET | `/` | Público | Identifica la API y confirma que responde. |
| GET | `/health` | Público | Liveness del proceso; no garantiza dependencias externas. |
| GET | `/health/ready` | Público | Readiness de base de datos, configuración y Redis. |

## Autenticación

| Método | Ruta | Acceso | Propósito |
| --- | --- | --- | --- |
| POST | `/auth/signup` | Público, sujeto a `AUTH_SIGNUP_ENABLED` | Crea el administrador inicial y una sesión. |
| POST | `/auth/login` | Público | Inicia sesión con correo y contraseña. |
| POST | `/auth/refresh` | Público | Intercambia un refresh token por una sesión renovada. |
| POST | `/auth/password/reset/request` | Público, 3/minuto | Genera un OTP de recovery y lo envía con MailerSend. Siempre responde de forma genérica para evitar enumeración de cuentas. |
| POST | `/auth/password/reset/confirm` | Público, 5/minuto | Verifica correo + OTP, actualiza contraseña y revoca refresh sessions. |
| POST | `/auth/password/reset/admin` | ADMIN, módulo `USUARIOS`, `usuarios.update` | Restablece la contraseña de un usuario activo sin enviar correo. |
| POST | `/auth/logout` | Bearer | Revoca las sesiones de refresh asociadas al token. |
| GET | `/auth/me` | Bearer | Devuelve identidad interna, rol, permisos, módulos y vendedor asociado. |

### Cuerpos principales de Auth

```json
// POST /auth/login
{ "email": "admin@example.com", "password": "secret" }

// POST /auth/refresh
{ "refreshToken": "supabase-refresh-token" }

// POST /auth/password/reset/request
{ "email": "usuario@example.com" }

// POST /auth/password/reset/confirm
{
  "email": "usuario@example.com",
  "code": "123456",
  "newPassword": "NuevaClave2026!",
  "confirmPassword": "NuevaClave2026!"
}

// POST /auth/password/reset/admin
{
  "targetUserId": "uuid-de-usuarios",
  "newPassword": "NuevaClave2026!",
  "confirmPassword": "NuevaClave2026!"
}
```

Supabase invalida refresh tokens durante un cierre global, pero un access JWT
ya emitido puede permanecer válido hasta su expiración. No se registran OTP,
contraseñas, service role keys ni tokens completos.

## Vendedores e invitaciones

| Método | Ruta | Acceso | Propósito |
| --- | --- | --- | --- |
| GET | `/identity-access/sellers/invitations` | `usuarios.read` | Lista invitaciones con filtros y paginación. |
| POST | `/identity-access/sellers/invitations` | `usuarios.create` | Crea usuario/vendedor, emite código temporal y envía invitación. |
| POST | `/identity-access/sellers/access-code/confirm` | Público | Consume el código, establece contraseña y activa la cuenta. |
| POST | `/identity-access/sellers/access-code/resend` | `usuarios.create` | Invalida el código anterior y envía uno nuevo. |
| PATCH | `/identity-access/sellers/invitations/:invitationId/revoke` | `usuarios.update` o `usuarios.create` | Revoca una invitación pendiente. |

El código de acceso es de un solo uso, cambia al reenviarse y tiene vencimiento.
La confirmación pública exige correo, código y contraseña; no acepta un JWT de
administrador como sustituto.

## Sorteos y turnos

Una configuración define el sorteo recurrente; un turno es su instancia
operacional para una fecha determinada.

| Método | Ruta | Acceso | Propósito |
| --- | --- | --- | --- |
| GET | `/draws/configurations` | `sorteos.read` | Lista configuraciones; filtra por `active`. |
| POST | `/draws/configurations` | `sorteos.create` | Crea código, hora y ventanas operativas. |
| GET | `/draws/configurations/:configurationId` | `sorteos.read` | Obtiene una configuración. |
| PATCH | `/draws/configurations/:configurationId` | `sorteos.update` | Modifica una configuración existente. |
| GET | `/draws/shifts/active` | `turnos.read` | Lista turnos actualmente operables. |
| GET | `/draws/shifts` | `turnos.read` | Lista turnos por fecha/estado con paginación. |
| POST | `/draws/shifts` | `turnos.create` | Abre un turno para configuración y fecha. |
| PATCH | `/draws/shifts/:shiftId/block` | `turnos.update` | Bloquea nuevas ventas del turno. |
| PATCH | `/draws/shifts/:shiftId/reopen` | `turnos.update` | Reabre un turno dentro de su ventana permitida. |
| PATCH | `/draws/shifts/:shiftId/close` | `turnos.update` | Cierra definitivamente el turno. |

## Límites por número

| Método | Ruta | Acceso | Propósito |
| --- | --- | --- | --- |
| GET | `/number-limits` | `limites_numero.read` | Lista límites por número, alcance, vigencia y estado. |
| POST | `/number-limits` | `limites_numero.create` | Crea límites para uno o varios números. |
| GET | `/number-limits/:limitId` | `limites_numero.read` | Obtiene un límite. |
| PATCH | `/number-limits/:limitId` | `limites_numero.update` | Actualiza monto o período de vigencia. |
| PATCH | `/number-limits/:limitId/expire` | `limites_numero.update` | Expira el límite sin borrar trazabilidad. |

Un límite puede ser global o de un vendedor y puede aplicar a todos los
sorteos o a una configuración específica. La precedencia es:

1. Sorteo + vendedor.
2. Sorteo + global.
3. General + vendedor.
4. General + global.

El límite específico sustituye al general para ese contexto. Las ventas
`ANULADA` no consumen límite; al anular una venta su monto vuelve a quedar
disponible.

## Números bloqueados

| Método | Ruta | Acceso | Propósito |
| --- | --- | --- | --- |
| GET | `/blocked-numbers` | `numeros_bloqueados.read` | Lista bloqueos por número, fecha o turno. |
| POST | `/blocked-numbers` | `numeros_bloqueados.create` | Bloquea uno o varios números. |
| GET | `/blocked-numbers/:blockId` | `numeros_bloqueados.read` | Obtiene un bloqueo. |
| DELETE | `/blocked-numbers/:blockId` | `numeros_bloqueados.delete` | Retira el bloqueo. |

Los bloqueos se validan en la misma transacción que crea el detalle de venta.
Así, una comprobación previa del frontend nunca puede saltarse la regla.

## Ventas

| Método | Ruta | Acceso | Propósito |
| --- | --- | --- | --- |
| GET | `/sales` | `ventas.read` | Lista ventas; un vendedor queda limitado a las propias. |
| POST | `/sales` | `ventas.create` | Crea una venta atómica con uno o varios números. |
| GET | `/sales/settings/void-policy` | ADMIN, `ventas.read` | Obtiene la ventana de anulación. |
| PATCH | `/sales/settings/void-policy` | ADMIN, `ventas.update` | Cambia los minutos permitidos para anular. |
| GET | `/sales/:saleId` | `ventas.read` | Obtiene una venta respetando ownership. |
| PATCH | `/sales/:saleId/void` | `ventas.update` | Anula una venta válida y libera sus límites. |

Ejemplo de venta multi-número:

```json
{
  "shiftId": "uuid-del-turno",
  "items": [
    { "number": "20", "prizeMiles": 10.5 },
    { "number": "30", "prizeMiles": 40 },
    { "number": "00", "prizeMiles": 30.25 }
  ]
}
```

Los campos terminados en `Miles` representan miles de córdobas y admiten dos
decimales: `1.40` equivale a C$1,400.00. Nunca se usa punto flotante en
PostgreSQL; se almacena `numeric(14,2)` y la aplicación redondea a centavos de
la unidad `Miles`.

Una venta se persiste completa o no se persiste. Debe tener turno operable,
números válidos, montos positivos, ausencia de bloqueos y capacidad en todos
los límites aplicables.

## Matriz de ventas

| Método | Ruta | Acceso | Propósito |
| --- | --- | --- | --- |
| GET | `/sales-matrix` | ADMIN, módulo `MATRIZ_VENTAS`, `matriz_ventas.read` | Devuelve las 100 posiciones `00..99`, totales y conteos. |

Query:

```txt
date=YYYY-MM-DD                 requerido
shiftId=uuid                    opcional
drawCode=nacional-11am          opcional
sellerId=uuid                   opcional
status=ACTIVA|ANULADA|TODAS     default ACTIVA
```

La respuesta siempre tiene diez filas de diez celdas. `summary` incluye total
en miles, ventas distintas, ítems y cantidad de números vendidos. Al recibir
`sales.created` o `sales.voided`, el cliente debe volver a consultar esta ruta.

## Resultados

| Método | Ruta | Acceso | Propósito |
| --- | --- | --- | --- |
| GET | `/results` | `resultados.read` | Lista resultados por turno/fecha/número. |
| POST | `/results` | `resultados.create` | Registra el número ganador de un turno cerrado. |
| GET | `/results/:resultId` | `resultados.read` | Obtiene un resultado. |
| GET | `/results/:resultId/winning-sales` | `resultados.read` | Lista ventas activas que contienen el número ganador. |

El resultado no paga automáticamente. Primero determina ganadores; el pago se
registra explícitamente para conservar control contable y auditoría.

## Pago de premios

| Método | Ruta | Acceso | Propósito |
| --- | --- | --- | --- |
| GET | `/prize-payments` | `pagos_premios.read` | Lista pagos con filtros y paginación. |
| POST | `/prize-payments` | `pagos_premios.create` | Marca una venta ganadora como pagada. |
| GET | `/prize-payments/:saleId` | `pagos_premios.read` | Consulta el pago por venta. |

El monto pagado se expresa en `Miles`, usa precisión decimal y se vincula a la
venta, resultado y usuario que confirmó el pago.

## Cortes de caja

| Método | Ruta | Acceso | Propósito |
| --- | --- | --- | --- |
| GET | `/cash-cuts` | `cortes.read` | Lista cortes por vendedor y período. |
| POST | `/cash-cuts` | `cortes.create` | Crea un corte a partir de ventas confirmadas. |
| GET | `/cash-cuts/:cutId` | `cortes.read` | Obtiene el encabezado del corte. |
| GET | `/cash-cuts/:cutId/summary` | `cortes.read` | Devuelve ventas, premios y saldo del corte. |

## Reportes

| Método | Ruta | Acceso | Propósito |
| --- | --- | --- | --- |
| GET | `/reports/overview` | `ventas.read` | Totales operacionales para fecha, turno o vendedor. |
| GET | `/reports/sellers` | `ventas.read` | Desglose comparativo por vendedor. |

Los reportes son proyecciones de lectura. No modifican ventas ni reemplazan
los cortes contables.

## Parámetros del sistema

| Método | Ruta | Acceso | Propósito |
| --- | --- | --- | --- |
| GET | `/parameters` | `parametros.read` | Lista parámetros administrables. |
| GET | `/parameters/:key` | `parametros.read` | Obtiene un valor por clave. |
| PUT | `/parameters/:key` | `parametros.update` | Crea o reemplaza el valor de la clave. |

Los parámetros cambian reglas operacionales sin desplegar código. Las claves
reconocidas se validan en aplicación; no son un almacén arbitrario de secretos.

## Auditoría

| Método | Ruta | Acceso | Propósito |
| --- | --- | --- | --- |
| GET | `/audit-events` | `auditoria.read` | Lista eventos por actor, tipo, recurso y fecha. |
| GET | `/audit-events/:eventId` | `auditoria.read` | Obtiene el evento con su contexto. |

La auditoría HTTP captura actor, request ID, método, ruta y resultado. Los casos
de uso críticos agregan eventos semánticos. Se omiten contraseñas, OTP, tokens
y cabeceras sensibles.

## Tiempo real

Socket.IO es una salida de integración, no otra vía para ejecutar comandos.
Después del handshake autenticado, el servidor asigna salas por usuario, rol,
vendedor y módulos. Los eventos más importantes son:

```txt
draws.configuration.created|updated
draws.shift.opened|blocked|reopened|closed
number-limits.created|updated|expired
blocked-numbers.created|deleted
sales.created|voided
results.created
prize-payments.created
cash-cuts.created
parameters.upserted
```

El cliente debe invalidar/refrescar su consulta REST. Al reconectar también
debe hacer refetch, porque Socket.IO no sustituye un log durable.
