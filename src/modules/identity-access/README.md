# Identity access

This bounded context connects Supabase Auth with the internal MultiLot access
model.

## Flow

```txt
Authorization: Bearer <supabase-jwt>
  -> SupabaseAuthGuard
  -> ResolveRequestIdentityUseCase
  -> IdentityAccessRepository port
  -> PrismaIdentityAccessRepository
  -> usuarios + roles + permisos_por_rol + modulos + vendedores
```

The guard attaches this request context:

- `request.user`: internal user, role, modules and permissions.
- `request.seller`: seller profile when the authenticated user has one.

## Swagger smoke test

Use `GET /api/v1/auth/me` to verify the whole auth bridge:

```txt
Swagger Authorize
  -> Bearer <supabase-access-token>
  -> SupabaseAuthGuard
  -> usuarios.auth_user_id
  -> AuthMeController
```

Permission keys are derived from the current schema:

- `modulos.codigo + ".read"` from `puede_leer`.
- `modulos.codigo + ".create"` from `puede_crear`.
- `modulos.codigo + ".update"` from `puede_actualizar`.
- `modulos.codigo + ".delete"` from `puede_borrar`.

Example:

```ts
@RequireModules('ventas')
@Permissions('ventas.create')
```

Domain/application code does not know about JWT, HTTP or Prisma. Those details
stay in presentation and infrastructure adapters.
