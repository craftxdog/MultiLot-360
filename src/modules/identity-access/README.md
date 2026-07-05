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

## Password recovery

Requesting recovery is public, rate limited and does not disclose whether the
email exists:

```txt
POST /api/v1/auth/password/reset/request
  -> Supabase admin.generateLink(type=recovery) creates a one-time OTP
  -> MailerSend delivers the code and a link to the reset form
  -> always returns 202 for an accepted request
```

```json
{
  "email": "user@example.com"
}
```

The email button opens `PASSWORD_RESET_URL` with only the normalized email
preloaded. The recovery code is deliberately kept out of the URL. The user
types the code and the new password:

```txt
POST /api/v1/auth/password/reset/confirm
  -> verifies email + one-time code with Supabase type=recovery
  -> updates the password and revokes every Supabase refresh session
```

```json
{
  "email": "user@example.com",
  "code": "123456",
  "newPassword": "NewSup3rSecret2026!",
  "confirmPassword": "NewSup3rSecret2026!"
}
```

An authenticated administrator can reset an active linked account directly:

```txt
POST /api/v1/auth/password/reset/admin
  -> requires role ADMIN, module usuarios and usuarios.update
  -> generates and consumes a server-side recovery OTP; no email is sent
  -> updates the target password and revokes all target refresh sessions
```

```json
{
  "targetUserId": "0196fd44-a005-722d-8ca2-a3de51c391a0",
  "newPassword": "NewSup3rSecret2026!",
  "confirmPassword": "NewSup3rSecret2026!"
}
```

Every request also has the generic HTTP audit event. The recovery use cases add
semantic events for code dispatch, failures, successful user resets and direct
admin resets. Passwords and OTP values are always redacted or omitted.

Supabase cannot invalidate an already-issued access JWT immediately. Global
sign-out removes refresh sessions, while an access token may remain usable until
its `exp`. Keep JWT lifetime short and treat `sessionsRevoked` as refresh-session
revocation, not instant access-token revocation.

Presentation mappers translate HTTP DTOs and request context into application
commands or queries. This keeps controllers thin and avoids leaking controller
shape into use cases.

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
  -> includes an activation button with email and code preloaded
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

Admin lists seller invitations:

```txt
GET /api/v1/identity-access/sellers/invitations
  -> requires usuarios.read
  -> filters by email, username, sellerName or status
  -> returns paginated invitation read models
  -> status=EXPIRADO includes pending codes whose expiration date already passed
```

Example query:

```txt
GET /api/v1/identity-access/sellers/invitations?status=PENDIENTE&page=1&limit=25
```

Seller confirms the code and sets a password:

```txt
POST /api/v1/identity-access/sellers/access-code/confirm
  -> validates email + accessCode
  -> creates a Supabase Auth user with the provided password
  -> links usuarios.auth_user_id to the Supabase user id
  -> activates usuarios and vendedores
```

The activation email points to `SELLER_ACTIVATION_URL` and adds `email` and
`code` query parameters. The frontend reads those values and submits them,
together with the password chosen by the seller, to the public confirmation
endpoint. The link does not activate the account automatically.

Seller signs in normally:

```txt
POST /api/v1/auth/login
  -> Supabase signInWithPassword
  -> internal user lookup by auth_user_id
  -> returns accessToken + refreshToken
```
