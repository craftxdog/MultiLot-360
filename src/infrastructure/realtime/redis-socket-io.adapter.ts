import { INestApplicationContext, Logger } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { Server, ServerOptions } from 'socket.io';
import { EnvConfigService } from '../../config/env-config.service';

export class RedisSocketIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisSocketIoAdapter.name);
  private redisAdapter?: ReturnType<typeof createAdapter>;
  private publisher?: Redis;
  private subscriber?: Redis;

  constructor(
    app: INestApplicationContext,
    private readonly envConfig: EnvConfigService,
  ) {
    super(app);
  }

  async connectToRedis(): Promise<void> {
    if (!this.envConfig.realtime.redisEnabled) return;

    const redis = this.envConfig.redis;
    const options = {
      host: redis.host,
      port: redis.port,
      password: redis.password || undefined,
      db: redis.db,
      lazyConnect: true,
      connectTimeout: this.envConfig.realtime.connectTimeoutMs,
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
    };

    this.publisher = new Redis(options);
    this.subscriber = this.publisher.duplicate();
    this.publisher.on('error', (error) =>
      this.logRedisError('publisher', error),
    );
    this.subscriber.on('error', (error) =>
      this.logRedisError('subscriber', error),
    );

    try {
      await Promise.all([this.publisher.connect(), this.subscriber.connect()]);
    } catch (error) {
      this.publisher.disconnect();
      this.subscriber.disconnect();
      throw new Error(
        `Could not connect Socket.IO Redis adapter: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }

    this.redisAdapter = createAdapter(this.publisher, this.subscriber, {
      key: this.envConfig.realtime.redisKey,
      publishOnSpecificResponseChannel: true,
    });
    this.logger.log('Socket.IO Redis adapter connected');
  }

  createIOServer(port: number, options?: Partial<ServerOptions>): Server {
    const realtime = this.envConfig.realtime;
    const socketOptions: Partial<ServerOptions> = {
      ...options,
      path: realtime.path,
      serveClient: false,
      connectTimeout: realtime.connectTimeoutMs,
      maxHttpBufferSize: realtime.maxPayloadBytes,
      cors: {
        origin: this.envConfig.app.corsOrigins,
        credentials: true,
        methods: ['GET', 'POST'],
      },
      allowRequest: (_request, callback) => {
        callback(null, realtime.enabled);
      },
      ...(!realtime.redisEnabled && {
        connectionStateRecovery: {
          maxDisconnectionDuration: realtime.recoveryWindowMs,
          skipMiddlewares: false,
        },
      }),
    };
    const server = super.createIOServer(port, socketOptions) as Server;

    if (this.redisAdapter) {
      server.adapter(this.redisAdapter);
    }

    return server;
  }

  async close(server: Server): Promise<void> {
    await super.close(server);
    await Promise.all([
      this.closeRedisClient(this.publisher),
      this.closeRedisClient(this.subscriber),
    ]);
  }

  private async closeRedisClient(client?: Redis): Promise<void> {
    if (!client) return;

    if (client.status === 'ready') {
      await client.quit();
      return;
    }

    client.disconnect();
  }

  private logRedisError(client: string, error: Error): void {
    this.logger.error(`Socket.IO Redis ${client} error: ${error.message}`);
  }
}
