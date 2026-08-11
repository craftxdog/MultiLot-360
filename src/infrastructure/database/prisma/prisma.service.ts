import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '@prisma/client';
import { AsyncLocalStorage } from 'node:async_hooks';
import { EnvConfigService } from '../../../config/env-config.service';

export type IndependentTenantContext = {
  authUserId: string;
  tenantId: string;
  profileId: string;
  membershipId: string;
};

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private readonly shouldConnect: boolean;
  private readonly transactionStorage =
    new AsyncLocalStorage<Prisma.TransactionClient>();

  constructor(envConfig: EnvConfigService) {
    const database = envConfig.database;
    const adapter = new PrismaPg({
      connectionString: database.url,
      max: database.poolMax,
      idleTimeoutMillis: database.poolIdleTimeoutMs,
      connectionTimeoutMillis: database.poolConnectionTimeoutMs,
      ...(database.ssl && { ssl: { rejectUnauthorized: false } }),
    });

    super({
      adapter,
      log:
        envConfig.app.logLevel === 'debug'
          ? ['query', 'info', 'warn', 'error']
          : ['warn', 'error'],
    });
    this.shouldConnect = envConfig.app.env !== 'test';

    return new Proxy(this, {
      get: (target, property, receiver) => {
        const transaction = target.transactionStorage.getStore();

        if (transaction && property === '$transaction') {
          return async (
            input:
              | Array<Promise<unknown>>
              | ((client: Prisma.TransactionClient) => Promise<unknown>),
          ) => (Array.isArray(input) ? Promise.all(input) : input(transaction));
        }

        if (transaction && property in transaction) {
          const value = Reflect.get(transaction, property) as unknown;
          return typeof value === 'function'
            ? (...args: unknown[]) =>
                Reflect.apply(value, transaction, args) as unknown
            : value;
        }

        return Reflect.get(target, property, receiver) as unknown;
      },
    });
  }

  hasRequestTransaction(): boolean {
    return Boolean(this.transactionStorage.getStore());
  }

  async runInRequestTransaction<T>(work: () => Promise<T>): Promise<T> {
    return super.$transaction(
      async (transaction) =>
        this.transactionStorage.run(transaction, async () => {
          await transaction.$executeRawUnsafe('SET LOCAL ROLE multilot_app');
          return work();
        }),
      { maxWait: 5000, timeout: 30000 },
    );
  }

  async runInBillingTransaction<T>(work: () => Promise<T>): Promise<T> {
    if (this.hasRequestTransaction()) {
      throw new Error(
        'Billing worker cannot run inside a tenant request transaction',
      );
    }
    return super.$transaction(
      async (transaction) =>
        this.transactionStorage.run(transaction, async () => {
          await transaction.$executeRawUnsafe(
            'SET LOCAL ROLE multilot_billing_worker',
          );
          return work();
        }),
      { maxWait: 5000, timeout: 10000 },
    );
  }

  async runInIndependentTenantTransaction<T>(
    context: IndependentTenantContext,
    work: (transaction: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return super.$transaction(
      async (transaction) => {
        await transaction.$executeRawUnsafe('SET LOCAL ROLE multilot_app');
        await transaction.$executeRaw(
          Prisma.sql`SELECT app_private.set_request_context(
            ${context.authUserId}::uuid,
            ${context.tenantId}::uuid,
            ${context.profileId}::uuid,
            ${context.membershipId}::uuid
          )`,
        );
        return work(transaction);
      },
      { maxWait: 5000, timeout: 10000 },
    );
  }

  async onModuleInit(): Promise<void> {
    if (!this.shouldConnect) {
      return;
    }

    await this.$connect();
    this.logger.log('Prisma database connection established');
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.shouldConnect) {
      return;
    }

    await this.$disconnect();
    this.logger.log('Prisma database connection closed');
  }
}
