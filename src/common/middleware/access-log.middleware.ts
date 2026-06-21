import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Response } from 'express';
import { REQUEST_ID_HEADER } from '../constants';
import { ApiRequest } from '../interfaces';
import { resolveRequestId } from '../utils/request-id.util';
import {
  getCurrentUser,
  getRequestId,
  getRoleName,
  getSellerId,
} from '../utils/request-context.util';

const SKIPPED_PATHS = ['/docs', '/api/v1/docs', '/favicon.ico'];

@Injectable()
export class AccessLogMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(request: ApiRequest, response: Response, next: NextFunction): void {
    const requestId = resolveRequestId(
      getRequestId(request) ?? request.headers[REQUEST_ID_HEADER],
    );
    const startedAt = Date.now();

    request.requestId = requestId;
    request.context = {
      ...request.context,
      requestId,
    };
    response.setHeader(REQUEST_ID_HEADER, requestId);

    response.on('finish', () => {
      this.logRequest(request, response, startedAt);
    });

    next();
  }

  private logRequest(
    request: ApiRequest,
    response: Response,
    startedAt: number,
  ): void {
    if (this.shouldSkip(request.path ?? request.url)) {
      return;
    }

    const statusCode = response.statusCode;
    const durationMs = Date.now() - startedAt;
    const message = [
      `${request.method} ${request.originalUrl ?? request.url}`,
      `status=${statusCode}`,
      `durationMs=${durationMs}`,
      `requestId=${getRequestId(request) ?? 'unknown'}`,
      `userId=${getCurrentUser(request)?.id ?? 'anonymous'}`,
      `role=${getRoleName(request) ?? 'none'}`,
      `sellerId=${getSellerId(request) ?? 'none'}`,
    ].join(' ');

    if (statusCode >= 500) {
      this.logger.error(message);
      return;
    }

    if (statusCode >= 400) {
      this.logger.warn(message);
      return;
    }

    this.logger.log(message);
  }

  private shouldSkip(path: string): boolean {
    return SKIPPED_PATHS.some((skippedPath) => path.startsWith(skippedPath));
  }
}
