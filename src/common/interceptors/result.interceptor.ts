import {
  CallHandler,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { AppError, isFailure, isResult, Result } from '../../shared-kernel';

@Injectable()
export class ResultInterceptor implements NestInterceptor<unknown, unknown> {
  private readonly logger = new Logger(ResultInterceptor.name);

  intercept(
    _context: ExecutionContext,
    next: CallHandler<unknown>,
  ): Observable<unknown> {
    return next
      .handle()
      .pipe(map<unknown, unknown>((payload) => this.unwrap(payload)));
  }

  private unwrap(payload: unknown): unknown {
    if (!isResult(payload)) {
      return payload;
    }

    const result: Result<unknown, AppError> = payload;

    if (isFailure(result)) {
      throw this.toHttpException(result.error);
    }

    return result.value;
  }

  private toHttpException(error: AppError): HttpException {
    const statusCode = error.statusCode || HttpStatus.INTERNAL_SERVER_ERROR;

    if (statusCode === Number(HttpStatus.INTERNAL_SERVER_ERROR)) {
      this.logger.error('An unhandled internal error occurred:', error.stack);
    }

    return new HttpException(
      {
        statusCode,
        message: error.message,
        error: error.code || 'InternalError',
      },
      statusCode,
    );
  }
}
