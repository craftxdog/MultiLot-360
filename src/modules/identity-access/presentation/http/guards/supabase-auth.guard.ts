import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY, extractBearerToken } from '../../../../../common';
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
    const result = await this.resolveRequestIdentity.execute(payload);

    if (isFailure(result)) {
      if (result.error.statusCode === 403) {
        throw new ForbiddenException(result.error.message);
      }

      throw new UnauthorizedException(result.error.message);
    }

    this.attachIdentity(request, result.value.user);

    return true;
  }

  private attachIdentity(request: ApiRequest, identity: IdentityUser): void {
    request.user = {
      id: identity.id,
      authUserId: identity.authUserId,
      username: identity.username,
      roleId: identity.role.id,
      roleName: identity.role.name,
      active: identity.active,
      modules: identity.modules,
      permissions: identity.permissions,
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
