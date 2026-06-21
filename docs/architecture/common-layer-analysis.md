# Common layer import analysis

Source reviewed: `/Users/craftzdog/Documents/Projects/agoge-api/src/common`.

Target decision: keep `src/common` as an HTTP/application shared layer for
cross-cutting API concerns. Do not place business rules here. Domain modules
should keep their own domain entities, use cases, ports and adapters.

## Integrated now

| Source file                                    | Target decision                                                               |
| ---------------------------------------------- | ----------------------------------------------------------------------------- |
| `constants/auth.constant.ts`                   | Copied. Useful for bearer extraction.                                         |
| `constants/document-id.constant.ts`            | Adapted. Nicaragua document/phone helpers fit sellers and users.              |
| `constants/request-context.constant.ts`        | Adapted. Replaced organization/member headers with user/role/seller context.  |
| `constants/rbac.constant.ts`                   | Adapted. Replaced SaaS modules with lottery modules from the current schema.  |
| `constants/index.ts`                           | Recreated for current exports.                                                |
| `decorators/current-user.decorator.ts`         | Adapted to MultiLot user context.                                             |
| `decorators/current-member.decorator.ts`       | Replaced by `current-seller.decorator.ts`.                                    |
| `decorators/current-organization.decorator.ts` | Not copied. MultiLot is not tenant/organization based right now.              |
| `decorators/current-tenant.decorator.ts`       | Replaced by `current-request-context.decorator.ts`.                           |
| `decorators/modules.decorator.ts`              | Copied concept. Useful for future module guards.                              |
| `decorators/permissions.decorator.ts`          | Copied concept. Useful for future `permisos_por_rol` guards.                  |
| `decorators/public.decorator.ts`               | Copied. Required when auth guards are added.                                  |
| `decorators/roles.decorator.ts`                | Copied concept. Will map to `roles.nombre`.                                   |
| `decorators/skip-tenant.decorator.ts`          | Replaced by `skip-auth-context.decorator.ts`.                                 |
| `dto/pagination-query.dto.ts`                  | Adapted. Default sort changed from `createdAt` to `creado_en`.                |
| `filters/http-exception.filter.ts`             | Adapted. Keeps Prisma error mapping and returns MultiLot response meta.       |
| `interceptors/request-context.interceptor.ts`  | Adapted. Normalizes `x-request-id` and request context.                       |
| `interceptors/transform.interceptor.ts`        | Adapted. Adds standard success envelope and pagination meta.                  |
| `devshop/interceptors/result.interceptor.ts`   | Adapted. Unwraps `shared-kernel` `Result` values before response envelope.    |
| `interfaces/api-response.interface.ts`         | Adapted. Replaced tenant meta with actor meta.                                |
| `interfaces/request-context.interface.ts`      | Adapted. Replaced organization/member with user/seller.                       |
| `middleware/access-log.middleware.ts`          | Adapted. Logs request, status, duration, request id, user, role and seller.   |
| `utils/auth-token.util.ts`                     | Copied. Useful for Supabase JWT extraction.                                   |
| `utils/build-key.util.ts`                      | Copied. Useful later for storage keys, exports or attachments.                |
| `utils/cursor.util.ts`                         | Copied. Useful for cursor pagination.                                         |
| `utils/pagination.util.ts`                     | Copied. Works with the adapted pagination DTO.                                |
| `utils/parse-cors-origins.util.ts`             | Copied, but not wired yet because current env validation already parses CORS. |
| `utils/request-context.util.ts`                | Adapted. Reads user/role/seller context.                                      |
| `utils/request-id.util.ts`                     | Copied. Generates or validates request ids.                                   |

## Not integrated yet

| Source file                          | Reason                                                                                                                                                 |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `constants/access-model.constant.ts` | Domain-specific SaaS catalog with billing, schedules, trainer/customer roles and generated Agoge enums. Needs a MultiLot-specific catalog first.       |
| `constants/realtime.constant.ts`     | Useful later, but no websocket/realtime gateway exists in this API yet.                                                                                |
| `constants/routers.constant.ts`      | Conflicts with config-driven `API_PREFIX`. Keep route constants in config for now.                                                                     |
| `guards/jwt-auth.guard.ts`           | Tightly coupled to Agoge `PrismaService`, JWT config and organization membership. Must be rewritten for Supabase Auth plus `usuarios`.                 |
| `guards/optional-jwt-auth.guard.ts`  | Depends on the JWT guard above.                                                                                                                        |
| `guards/roles.guard.ts`              | Uses Agoge `PlatformRole`. Rewrite after final role model is confirmed.                                                                                |
| `guards/permissions.guard.ts`        | Good idea, but it needs a MultiLot query against `permisos_por_rol`, `roles` and `modulos`.                                                            |
| `guards/modules.guard.ts`            | Needs a confirmed module catalog and access strategy.                                                                                                  |
| `guards/tenant.guard.ts`             | Not applicable unless MultiLot becomes multi-tenant.                                                                                                   |
| `utils/access-context.util.ts`       | Organization/member access lookup is not compatible with current schema.                                                                               |
| `utils/access-model-sync.util.ts`    | Depends on Agoge access catalog and tables not present here.                                                                                           |
| `utils/access-scope.util.ts`         | Optional; useful only after permission naming conventions are final.                                                                                   |
| `utils/billing-catalog-sync.util.ts` | Agoge billing domain, not related to lottery operations.                                                                                               |
| `utils/validate-env.util.ts`         | Not needed because MultiLot already uses `envalid`.                                                                                                    |

## Architecture notes

- `src/common` is not a domain layer. It is shared Nest/HTTP infrastructure.
- Domain modules should import only stable DTOs, decorators or interfaces when
  needed, never business rules from `common`.
- RBAC should be implemented as a separate auth/access adapter once Supabase
  Auth is connected to `usuarios.auth_user_id`.
- Generic repositories now live behind the Prisma infrastructure adapter and
  should be used by concrete repository adapters, not directly by use cases.
- If MultiLot later needs organizations/agencies, create a new bounded context
  instead of reusing Agoge tenant names directly.

## Integrated after Prisma generate

| Source file or folder              | Target decision                                                                 |
| ---------------------------------- | ------------------------------------------------------------------------------- |
| `repository/*`                     | Integrated under `src/infrastructure/database/prisma/repositories`.             |
| `devshop/shared-kernel/result.ts`  | Integrated under `src/shared-kernel/domain/result.ts`.                          |
| `devshop/shared-kernel/exceptions` | Adapted without NestJS imports so the shared kernel stays framework-free.       |
| `devshop/base.usecase.ts`          | Integrated as `src/shared-kernel/domain/interfaces/base-use-case.ts`.           |
| `devshop/value-object/money.ts`    | Adapted with default `NIO` for future prize/payment calculations.               |
| `devshop/value-object/quantity.ts` | Integrated for counts, limits and other non-negative integer domain quantities. |
