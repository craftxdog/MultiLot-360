import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  IS_PUBLIC_KEY,
  BILLING_AUTH_MODE_KEY,
  BillingAuthMode,
  TENANT_ID_HEADER,
  TenantContextService,
  extractBearerToken,
} from '../../../../../common';
import { ApiRequest } from '../../../../../common/interfaces';
import { isFailure } from '../../../../../shared-kernel';
import {
  AccessTokenVerifierService,
  ResolveRequestIdentityUseCase,
} from '../../../application';
import { IdentityUser, SupabaseJwtPayload } from '../../../domain';

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly accessTokenVerifier: AccessTokenVerifierService,
    private readonly resolveRequestIdentity: ResolveRequestIdentityUseCase,
    private readonly tenantContext: TenantContextService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.isPublic(context)) {
      return true;
    }

    const request = context.switchToHttp().getRequest<ApiRequest>();
    const token = extractBearerToken(request);

    if (!token) {
      throw new UnauthorizedException('Bearer token is required');
    }

    const payload = await this.verifyToken(token);
    if (!payload.sub) {
      throw new UnauthorizedException('Supabase subject claim is required');
    }
    const selectorHeader = request.headers[TENANT_ID_HEADER];
    const tenantSelector = Array.isArray(selectorHeader)
      ? selectorHeader[0]
      : selectorHeader;
    const billingMode = this.reflector.getAllAndOverride<BillingAuthMode>(
      BILLING_AUTH_MODE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (billingMode === 'platform') {
      const platform = await this.tenantContext.activatePlatformBilling(
        payload.sub,
      );
      request.user = {
        id: platform.profileId,
        authUserId: payload.sub,
        email: payload.email,
        active: true,
        platformAdminId: platform.platformAdminId,
      };
      return true;
    }
    const tenant = billingMode
      ? await this.tenantContext.activateBilling(payload.sub, tenantSelector)
      : await this.tenantContext.activate(payload.sub, tenantSelector);
    const result = await this.resolveRequestIdentity.execute(payload);

    if (isFailure(result)) {
      if (result.error.statusCode === 403) {
        throw new ForbiddenException(result.error.message);
      }

      throw new UnauthorizedException(result.error.message);
    }

    this.attachIdentity(request, result.value.user, payload);
    request.context = {
      ...request.context,
      tenantId: tenant.id,
    };

    return true;
  }

  private attachIdentity(
    request: ApiRequest,
    identity: IdentityUser,
    payload: SupabaseJwtPayload,
  ): void {
    request.user = {
      id: identity.id,
      authUserId: identity.authUserId,
      email: payload.email,
      username: identity.username,
      roleId: identity.role.id,
      roleName: identity.role.name,
      active: identity.active,
      modules: identity.modules,
      permissions: identity.permissions,
      tenantId: identity.tenant?.id,
      tenantSlug: identity.tenant?.slug,
      membershipId: identity.tenant?.membershipId,
      isOwner: identity.tenant?.isOwner,
    };

    if (identity.seller) {
      request.seller = {
        id: identity.seller.id,
        userId: identity.seller.userId,
        name: identity.seller.name,
        active: identity.seller.active,
      };
    }
  }

  private async verifyToken(token: string): Promise<SupabaseJwtPayload> {
    try {
      return await this.accessTokenVerifier.verify(token);
    } catch (error) {
      throw new UnauthorizedException(
        error instanceof Error ? error.message : 'Invalid or expired token',
      );
    }
  }

  private isPublic(context: ExecutionContext): boolean {
    return (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? false
    );
  }
}
