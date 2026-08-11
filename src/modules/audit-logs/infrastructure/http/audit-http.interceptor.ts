import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, catchError, from, map, mergeMap, throwError } from 'rxjs';
import { ApiRequest } from '../../../../common';
import { RecordAuditEventUseCase } from '../../application';

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const SENSITIVE_KEYS = new Set([
  'authorization',
  'password',
  'newPassword',
  'confirmPassword',
  'token',
  'accessToken',
  'actionToken',
  'tokenHash',
  'recoveryToken',
  'recovery_token',
  'refreshToken',
  'apiKey',
  'secret',
  'code',
  'accessCode',
  'codigo',
  'codigoHash',
]);

@Injectable()
export class AuditHttpInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditHttpInterceptor.name);

  constructor(private readonly recordAuditEvent: RecordAuditEventUseCase) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<ApiRequest>();

    if (!MUTATION_METHODS.has(request.method)) {
      return next.handle();
    }

    // Platform finance mutations write their own immutable reviewer ledger.
    // A tenant audit insert has no valid tenant context and would abort the
    // surrounding PostgreSQL transaction even if its application error were
    // caught, silently rolling back the financial decision.
    if (request.user?.platformAdminId) {
      return next.handle();
    }

    return next.handle().pipe(
      mergeMap((value: unknown) =>
        from(this.record(request, 'http.request.completed')).pipe(
          map((): unknown => value),
        ),
      ),
      catchError((error: unknown) =>
        from(this.record(request, 'http.request.failed', error)).pipe(
          mergeMap(() => throwError(() => error)),
        ),
      ),
    );
  }

  private async record(
    request: ApiRequest,
    event: string,
    error?: unknown,
  ): Promise<void> {
    const result = await this.recordAuditEvent.execute({
      userId: request.user?.id,
      event,
      payload: {
        requestId: request.context?.requestId ?? request.requestId,
        method: request.method,
        path: request.originalUrl ?? request.url,
        params: this.redact(request.params),
        query: this.redact(request.query),
        body: this.redact(request.body),
        actor: request.user
          ? {
              id: request.user.id,
              username: request.user.username,
              roleName: request.user.roleName,
            }
          : null,
        error: this.toErrorPayload(error),
      },
    });

    if (result.isFailure) {
      this.logger.warn(`Could not record audit event: ${result.error.message}`);
    }
  }

  private redact(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.redact(item));
    }

    if (!value || typeof value !== 'object') {
      return value;
    }

    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        SENSITIVE_KEYS.has(key) ? '[REDACTED]' : this.redact(item),
      ]),
    );
  }

  private toErrorPayload(error: unknown): Record<string, unknown> | null {
    if (!error) return null;

    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
      };
    }

    return {
      message: typeof error === 'string' ? error : 'Unknown non-error thrown',
    };
  }
}
