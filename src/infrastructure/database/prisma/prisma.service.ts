import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { EnvConfigService } from '../../../config/env-config.service';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private readonly shouldConnect: boolean;

  constructor(envConfig: EnvConfigService) {
    const database = envConfig.database;
    const adapter = new PrismaPg({
      connectionString: database.url,
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
