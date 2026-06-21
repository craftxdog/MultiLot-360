import {
  CallHandler,
  ExecutionContext,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Response } from 'express';
import { Observable, map } from 'rxjs';
import {
  ApiResponseMeta,
  ApiSuccessResponse,
  PaginatedResult,
} from '../interfaces';
import { ApiRequest } from '../interfaces/request-context.interface';
import { isPaginatedResult } from '../utils/pagination.util';
import {
  getAuthUserId,
  getRequestId,
  getRoleId,
  getRoleName,
  getSellerId,
  getUserId,
} from '../utils/request-context.util';

const DEFAULT_SUCCESS_MESSAGE = 'Request completed successfully';

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T | PaginatedResult<T>,
  ApiSuccessResponse<T | T[]>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T | PaginatedResult<T>>,
  ): Observable<ApiSuccessResponse<T | T[]>> {
    const http = context.switchToHttp();
    const request = http.getRequest<ApiRequest>();
    const response = http.getResponse<Response>();

    return next.handle().pipe(
      map((payload) => {
        const paginated = isPaginatedResult<T>(payload);
        const data = paginated ? payload.items : payload;
        const message = paginated
          ? (payload.message ?? DEFAULT_SUCCESS_MESSAGE)
          : DEFAULT_SUCCESS_MESSAGE;

        return {
          success: true,
          statusCode: response.statusCode || HttpStatus.OK,
          message,
          data,
          meta: this.buildMeta(request, paginated ? payload : undefined),
        };
      }),
    );
  }

  private buildMeta(
    request: ApiRequest,
    paginated?: PaginatedResult<T>,
  ): ApiResponseMeta {
    const userId = getUserId(request);
    const authUserId = getAuthUserId(request);
    const roleId = getRoleId(request);
    const roleName = getRoleName(request);
    const sellerId = getSellerId(request);
    const username = request.user?.username ?? request.context?.user?.username;
    const actor =
      userId || authUserId || username || roleId || roleName || sellerId
        ? { userId, authUserId, username, roleId, roleName, sellerId }
        : undefined;

    return {
      request: {
        requestId: getRequestId(request),
        method: request.method,
        path: request.url,
        timestamp: new Date().toISOString(),
      },
      actor,
      ...(paginated && { pagination: paginated.pagination }),
    };
  }
}
