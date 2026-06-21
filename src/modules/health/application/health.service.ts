import { Injectable } from '@nestjs/common';
import { createConnection } from 'node:net';
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
    const missing = [
      ['SUPABASE_JWT_SECRET', this.envConfig.supabase.jwtSecret],
      ['DATABASE_URL', this.envConfig.database.url],
    ].filter(([, value]) => !value);

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
      return {
        status: 'error',
        details:
          error instanceof Error ? error.message : 'Database unavailable',
      };
    }
  }

  private async checkRedis(): Promise<HealthCheck> {
    return new Promise((resolve) => {
      const socket = createConnection({
        host: this.envConfig.redis.host,
        port: this.envConfig.redis.port,
      });
      const timeout = setTimeout(() => {
        socket.destroy();
        resolve({ status: 'error', details: 'Redis connection timed out' });
      }, 1500);

      socket.once('connect', () => {
        clearTimeout(timeout);
        socket.end();
        resolve({ status: 'ok' });
      });

      socket.once('error', (error: Error) => {
        clearTimeout(timeout);
        socket.destroy();
        resolve({ status: 'error', details: error.message });
      });
    });
  }
}
