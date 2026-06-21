import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ApiRequest } from '../interfaces/request-context.interface';
import { getCurrentSeller, getSellerId } from '../utils/request-context.util';

export const CurrentSeller = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<ApiRequest>();
    const seller = getCurrentSeller(request);

    if (data === 'id') {
      return seller?.id ?? getSellerId(request);
    }

    return data
      ? (seller as Record<string, unknown> | undefined)?.[data]
      : seller;
  },
);
