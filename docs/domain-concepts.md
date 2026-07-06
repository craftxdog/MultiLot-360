# Conceptos e invariantes del dominio

## Mapa funcional

```txt
Identidad y RBAC
  -> configuraciones de sorteo
  -> turnos por fecha
  -> límites y bloqueos
  -> ventas multi-número
  -> matriz y reportes
  -> cierre del turno
  -> resultado
  -> ventas ganadoras
  -> pago de premios
  -> cortes y auditoría
```

PostgreSQL/Supabase es la fuente de verdad. Prisma adapta persistencia al
dominio; Supabase Auth administra identidades y sesiones; MailerSend entrega
mensajes transaccionales; Redis distribuye eventos Socket.IO entre instancias.

## Identidad interna y Supabase Auth

`auth.users.id` identifica la cuenta del proveedor. `public.usuarios.id`
identifica al actor dentro del negocio y `usuarios.auth_user_id` enlaza ambos.
Los roles, módulos y permisos viven en el esquema de negocio; nunca se confía
en `user_metadata` para autorizar.

Un vendedor es una extensión opcional del usuario. Sus endpoints de ventas
aplican ownership aunque el JWT sea técnicamente válido.

## Configuración de sorteo y turno

La configuración expresa una regla recurrente: código, hora, restricciones y
ventanas. El turno expresa la ejecución real para una fecha y pasa por estados
operacionales. Las ventas se vinculan al turno, no solamente al código.

Esta separación evita mezclar reglas futuras con operaciones históricas.

## Dinero en miles

Los nombres `totalMiles`, `prizeMiles`, `limitMiles` y `amountMiles` representan
miles de córdobas. Ejemplos:

| Valor API | Valor monetario |
| ---: | ---: |
| `0.50` | C$500.00 |
| `1.40` | C$1,400.00 |
| `10.00` | C$10,000.00 |

PostgreSQL usa `numeric(14,2)`. Prisma usa `Decimal` y los adaptadores convierten
el valor al borde HTTP. El dominio redondea cada suma con `money.util`; no se
acumulan flotantes sin normalización.

## Venta atómica

Una venta contiene uno o varios detalles `{number, prizeMiles}`. El caso de uso
agrupa números repetidos para validar límites y el repositorio persiste todo en
una transacción. Si falla un ítem, no queda una venta parcial.

Antes de confirmar se validan estas invariantes:

1. El actor puede vender para el vendedor indicado.
2. El turno existe y acepta ventas.
3. Cada número se normaliza a dos dígitos entre `00` y `99`.
4. Cada monto es positivo y tiene máximo dos decimales.
5. El número no está bloqueado para fecha o turno.
6. La suma activa no supera el límite aplicable.

## Límites y anulaciones

Los límites pueden combinar dos dimensiones:

- propietario: global o vendedor;
- alcance: general o configuración de sorteo.

La regla más específica reemplaza a la general. Una venta `ACTIVA` consume
capacidad. Una venta `ANULADA` queda en historial, pero deja de participar en
la suma; por eso la capacidad se recupera sin editar el límite.

La anulación exige ownership para vendedores, turno todavía válido, venta
activa y cumplimiento de la ventana configurada. El administrador puede tener
un alcance más amplio, pero sigue necesitando permiso explícito.

## Matriz `00..99`

La matriz es una proyección administrativa, no una tabla duplicada. Agrega los
detalles de venta en tiempo de consulta y siempre rellena los 100 números. Esto
evita sincronización manual y garantiza que ventas, anulaciones y filtros se
reflejen desde la misma fuente contable.

Su estrategia realtime es `REFETCH`: los eventos avisan que cambió el estado y
la UI vuelve a consultar la proyección.

## Resultado y premio

El resultado pertenece a un turno cerrado. Una venta es ganadora cuando sigue
activa y contiene el número ganador. El pago de premio es una acción separada,
idempotente por venta, que registra monto, resultado y usuario pagador.

Separar detección de ganador y desembolso permite auditar premios pendientes y
evita confundir cálculo con movimiento de caja.

## Cortes y reportes

Un corte captura un período contable de un vendedor. Sus totales derivan de
ventas y premios confirmados. Los reportes son consultas operacionales y no
cambian el estado del negocio.

## Roles, módulos y permisos

Un rol contiene una matriz por módulo con cuatro capacidades: lectura,
creación, actualización y eliminación. La autorización HTTP exige simultáneamente
JWT válido, usuario activo, módulo habilitado y permiso específico. La matriz
se reemplaza de forma atómica para evitar estados parciales y se protege el
acceso mínimo de administración contra bloqueos accidentales.

El rol de vendedor recibe solamente las lecturas operacionales necesarias para
vender de forma segura: turno, bloqueos, límites y resultados, además de crear
sus ventas y administrar la lectura de su propia bandeja.

## Notificaciones y metas

Las notificaciones son proyecciones persistentes de eventos confirmados. Cada
destinatario tiene su propia fila y clave de deduplicación. Socket.IO acelera la
entrega, mientras REST permite recuperar avisos perdidos y marcar su lectura.

La meta de ventas agrega ventas activas por vendedor y turno. Puede configurarse
por monto en miles, cantidad de tickets o ambos. Al alcanzarse se genera un
aviso personalizado para el vendedor y otro para administradores; una misma
meta no vuelve a emitirse para la misma combinación vendedor/turno/umbrales.

## Eventos y consistencia

Los casos de uso publican eventos solamente después de persistir con éxito. El
puerto `IntegrationEventPublisher` mantiene dominio/aplicación independientes
de Socket.IO. REST confirma el comando; realtime acelera la actualización de
clientes.

## Capas por módulo

```txt
domain/
  entidades, invariantes y puertos

application/
  comandos/queries y casos de uso

infrastructure/
  Prisma, Supabase, MailerSend, Redis

presentation/
  DTO, validación, mappers y controladores HTTP
```

El controlador traduce HTTP y delega. No contiene reglas contables. El caso de
uso coordina políticas y puertos. El repositorio traduce entre Prisma y las
entidades de dominio.
