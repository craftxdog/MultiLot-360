import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ApiRequest } from '../interfaces/request-context.interface';
import { getCurrentUser, getUserId } from '../utils/request-context.util';

export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<ApiRequest>();
    const user = getCurrentUser(request);

    if (data === 'id') {
      return user?.id ?? getUserId(request);
    }

    return data ? (user as Record<string, unknown> | undefined)?.[data] : user;
  },
);
