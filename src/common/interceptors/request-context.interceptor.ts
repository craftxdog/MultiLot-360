import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { REQUEST_ID_HEADER } from '../constants/request-context.constant';
import { ApiRequest } from '../interfaces/request-context.interface';
import {
  getCurrentSeller,
  getCurrentUser,
  getRequestId,
} from '../utils/request-context.util';
import { resolveRequestId } from '../utils/request-id.util';

@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<ApiRequest>();
    const response = http.getResponse<{
      setHeader: (key: string, value: string) => void;
    }>();
    const requestId = resolveRequestId(
      getRequestId(request) ?? request.headers[REQUEST_ID_HEADER],
    );

    request.requestId = requestId;
    request.context = {
      requestId,
      user: getCurrentUser(request),
      seller: getCurrentSeller(request),
    };

    response.setHeader(REQUEST_ID_HEADER, requestId);

    return next.handle();
  }
}
