import { Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { EnvConfigService } from '../../../config/env-config.service';
import { PrismaService } from '../../../infrastructure/database/prisma';

export type HealthCheckStatus = 'ok' | 'error';

export type HealthCheck = {
  status: HealthCheckStatus;
  details?: string;
};

export type HealthResponse = {
  status: HealthCheckStatus;
  service: string;
  timestamp: string;
  checks?: Record<string, HealthCheck>;
};

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly envConfig: EnvConfigService,
    private readonly prisma: PrismaService,
  ) {}

  liveness(): HealthResponse {
    return {
      status: 'ok',
      service: this.envConfig.app.name,
      timestamp: new Date().toISOString(),
    };
  }

  async readiness(): Promise<HealthResponse> {
    const checks: Record<string, HealthCheck> = {
      config: this.checkConfig(),
      database: await this.checkDatabase(),
      redis: await this.checkRedis(),
    };
    const status = Object.values(checks).every((check) => check.status === 'ok')
      ? 'ok'
      : 'error';

    return {
      status,
      service: this.envConfig.app.name,
      timestamp: new Date().toISOString(),
      checks,
    };
  }

  private checkConfig(): HealthCheck {
    const missing = [['DATABASE_URL', this.envConfig.database.url]].filter(
      ([, value]) => !value,
    );

    if (missing.length > 0) {
      return {
        status: 'error',
        details: `Missing config: ${missing.map(([key]) => key).join(', ')}`,
      };
    }

    return { status: 'ok' };
  }

  private async checkDatabase(): Promise<HealthCheck> {
    if (this.envConfig.app.env === 'test') {
      return { status: 'ok', details: 'Skipped in test environment' };
    }

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok' };
    } catch (error) {
      this.logger.warn(
        `Database readiness check failed: ${this.errorMessage(error)}`,
      );
      return {
        status: 'error',
        details: this.publicDependencyError('Database', error),
      };
    }
  }

  private async checkRedis(): Promise<HealthCheck> {
    const redis = new Redis({
      host: this.envConfig.redis.host,
      port: this.envConfig.redis.port,
      password: this.envConfig.redis.password || undefined,
      db: this.envConfig.redis.db,
      connectTimeout: 1500,
      enableOfflineQueue: false,
      lazyConnect: true,
      maxRetriesPerRequest: 0,
    });

    try {
      await redis.connect();
      const response = await redis.ping();
      return response === 'PONG'
        ? { status: 'ok' }
        : { status: 'error', details: 'Redis did not respond with PONG' };
    } catch (error) {
      this.logger.warn(
        `Redis readiness check failed: ${this.errorMessage(error)}`,
      );
      return {
        status: 'error',
        details: this.publicDependencyError('Redis', error),
      };
    } finally {
      redis.disconnect();
    }
  }

  private publicDependencyError(dependency: string, error: unknown): string {
    return this.envConfig.app.env === 'production'
      ? `${dependency} unavailable`
      : this.errorMessage(error);
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Unknown dependency error';
  }
}
