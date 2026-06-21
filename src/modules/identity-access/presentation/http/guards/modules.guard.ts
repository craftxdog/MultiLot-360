import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY, MODULES_KEY } from '../../../../../common';
import { ApiRequest } from '../../../../../common/interfaces';

@Injectable()
export class ModulesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (this.isPublic(context)) {
      return true;
    }

    const requiredModules = this.reflector.getAllAndOverride<string[]>(
      MODULES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredModules?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<ApiRequest>();
    const modules = new Set(request.user?.modules ?? []);
    const hasAllModules = requiredModules.every((module) =>
      modules.has(module),
    );

    if (!hasAllModules) {
      throw new ForbiddenException('Required module is not enabled');
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
