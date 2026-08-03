import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { PrismaService } from '../../infrastructure/database/prisma';
import { TenantExecutionContextService } from '../services';

class RequestRollback extends Error {
  constructor(readonly afterRollback: Array<() => Promise<void>>) {
    super('Request transaction rolled back');
  }
}

@Injectable()
export class TenantTransactionMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TenantTransactionMiddleware.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantExecution: TenantExecutionContextService,
  ) {}

  use(request: Request, response: Response, next: NextFunction): void {
    if (!this.hasBearerToken(request)) {
      next();
      return;
    }

    const completed = new Promise<void>((resolve) => {
      response.once('finish', resolve);
      response.once('close', resolve);
    });

    void this.prisma
      .runInRequestTransaction(() =>
        this.tenantExecution.run(async () => {
          next();
          await completed;
          if (response.statusCode >= 400) {
            throw new RequestRollback(this.tenantExecution.takeAfterRollback());
          }
        }),
      )
      .catch(async (error: unknown) => {
        if (error instanceof RequestRollback) {
          await this.runAfterRollback(error.afterRollback);
          return;
        }
        this.logger.error(
          error instanceof Error ? error.message : 'Request transaction failed',
        );
        if (!response.headersSent) next(error);
      });
  }

  private async runAfterRollback(
    tasks: Array<() => Promise<void>>,
  ): Promise<void> {
    for (const task of tasks) {
      try {
        await task();
      } catch (error) {
        this.logger.error(
          error instanceof Error
            ? `After-rollback task failed: ${error.message}`
            : 'After-rollback task failed',
        );
      }
    }
  }

  private hasBearerToken(request: Request): boolean {
    const authorization = request.headers.authorization;
    return Boolean(authorization && /^Bearer\s+\S+/i.test(authorization));
  }
}
