import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  ANY_PERMISSIONS_KEY,
  IS_PUBLIC_KEY,
  PERMISSIONS_KEY,
} from '../../../../../common';
import { ApiRequest } from '../../../../../common/interfaces';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (this.isPublic(context)) {
      return true;
    }

    const request = context.switchToHttp().getRequest<ApiRequest>();
    const permissions = new Set(
      (request.user?.permissions ?? []).map((permission) =>
        permission.toLowerCase(),
      ),
    );
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (requiredPermissions?.length) {
      const hasAllRequired = requiredPermissions.every((permission) =>
        permissions.has(permission.toLowerCase()),
      );

      if (!hasAllRequired) {
        throw new ForbiddenException(
          'Insufficient permissions for this endpoint',
        );
      }
    }

    const anyPermissions = this.reflector.getAllAndOverride<string[]>(
      ANY_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!anyPermissions?.length) {
      return true;
    }

    const hasAnyPermission = anyPermissions.some((permission) =>
      permissions.has(permission.toLowerCase()),
    );

    if (!hasAnyPermission) {
      throw new ForbiddenException(
        'Insufficient permissions for this endpoint',
      );
    }

    return true;
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
