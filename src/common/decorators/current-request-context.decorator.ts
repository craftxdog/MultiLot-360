import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ApiRequest } from '../interfaces/request-context.interface';
import {
  getCurrentSeller,
  getCurrentUser,
  getRequestId,
} from '../utils/request-context.util';

export const CurrentRequestContext = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<ApiRequest>();
    const context = {
      requestId: getRequestId(request),
      user: getCurrentUser(request),
      seller: getCurrentSeller(request),
    };

    return data ? (context as Record<string, unknown>)[data] : context;
  },
);
