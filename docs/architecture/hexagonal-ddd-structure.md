# MultiLot 360 API architecture

MultiLot 360 is organized as a modular NestJS monolith with DDD boundaries and
hexagonal architecture.

## Folder map

```txt
src/
  app.module.ts
  main.ts
  common/
  config/
  infrastructure/
  modules/
  shared-kernel/
```

## Layer rules

### `src/modules`

Business bounded contexts live here. Each future module should keep this shape:

```txt
src/modules/<context>/
  domain/
    entities/
    value-objects/
    events/
    ports/
  application/
    use-cases/
    dto/
  infrastructure/
    persistence/
    providers/
  presentation/
    http/
```

Examples of contexts for the current schema:

- `identity-access`: `usuarios`, `roles`, `modulos`, `permisos_por_rol`.
- `sales`: `ventas`, `venta_detalle`.
- `draws`: `sorteos_config`, `turnos`, `resultados`.
- `seller-limits`: `vendedores`, `limites_numero_vendedor`, `numeros_bloqueados`.
- `payouts`: `pagos_premios`.
- `audit`: `auditoria_eventos`, `cortes`, `parametros`.

### `src/shared-kernel`

Framework-free building blocks shared by multiple bounded contexts:

- `Result<T, E>` for explicit use-case results.
- `AppError` and typed errors.
- `UseCase<Input, Output>`.
- generic value objects such as `Money` and `Quantity`.

This layer must not import NestJS, Prisma, Express or Supabase clients.

### `src/infrastructure`

Technical adapters and external systems:

- database connection modules.
- Prisma service and repository base classes.
- Redis, mailer, Supabase adapters, queues or storage clients.

Infrastructure may depend on `shared-kernel`, but domain code must not depend on
infrastructure.

### `src/common`

NestJS HTTP cross-cutting layer:

- request context.
- access logs.
- exception filters.
- response envelopes.
- decorators.
- pagination DTOs.

This is not the domain shared kernel. Keep business rules out of this folder.

## Request flow

```txt
HTTP controller
  -> application use case
  -> domain model / domain services
  -> domain port
  -> infrastructure adapter
  -> Prisma repository / external client
```

Response flow:

```txt
Use case returns Result
  -> ResultInterceptor unwraps success or throws AppError
  -> HttpExceptionFilter formats errors
  -> TransformInterceptor formats successful responses
```

## Repository rule

The generic Prisma repositories are adapter helpers. A domain module should not
inject `GenericRepository` directly into use cases. Instead:

```txt
domain/ports/sales.repository.ts
application/use-cases/create-sale.use-case.ts
infrastructure/persistence/prisma/prisma-sales.repository.ts
```

The Prisma repository implements the domain port and may extend a base Prisma
repository when that removes duplication.

## Supabase Auth rule

Supabase Auth should be mapped at the infrastructure/presentation boundary:

1. Validate the Supabase JWT in an auth guard.
2. Resolve `auth.users.id` against `usuarios.auth_user_id`.
3. Attach `user`, `role` and optional `seller` context to the request.
4. Let use cases receive explicit input, not raw HTTP requests.
