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

Use `POST /api/v1/auth/login` to obtain a Supabase-backed session:

```json
{
  "email": "admin@example.com",
  "password": "Sup3rSecret2026!"
}
```

The response includes `accessToken`; paste it in Swagger `Authorize`.

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

## Seller onboarding

Create the first admin:

```txt
POST /api/v1/auth/signup
  -> creates a Supabase Auth user
  -> creates an active internal usuarios record
  -> assigns AUTH_ADMIN_ROLE_NAME
  -> returns accessToken + refreshToken
```

```json
{
  "email": "admin@example.com",
  "username": "admin",
  "name": "Admin Principal",
  "password": "Sup3rSecret2026!"
}
```

Admin creates the seller:

```txt
POST /api/v1/identity-access/sellers/invitations
  -> requires usuarios.create
  -> creates inactive usuarios + vendedores
  -> revokes previous pending codes for the same seller/email
  -> stores a new hashed access code with expiration
  -> sends the code by email
```

```json
{
  "email": "seller@example.com",
  "username": "seller.01",
  "sellerName": "Seller One",
  "documentId": "001-010190-0001A"
}
```

Admin resends a fresh seller code:

```txt
POST /api/v1/identity-access/sellers/access-code/resend
  -> requires usuarios.create
  -> finds the latest invitation by email
  -> rejects when the seller account is already active
  -> revokes previous pending codes
  -> stores a new hashed code with a new expiration
  -> sends the fresh code by email
```

```json
{
  "email": "seller@example.com"
}
```

Seller confirms the code and sets a password:

```txt
POST /api/v1/identity-access/sellers/access-code/confirm
  -> validates email + accessCode
  -> creates a Supabase Auth user with the provided password
  -> links usuarios.auth_user_id to the Supabase user id
  -> activates usuarios and vendedores
```

Seller signs in normally:

```txt
POST /api/v1/auth/login
  -> Supabase signInWithPassword
  -> internal user lookup by auth_user_id
  -> returns accessToken + refreshToken
```
