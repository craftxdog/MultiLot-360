import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import {
  HttpExceptionFilter,
  RequestContextInterceptor,
  ResultInterceptor,
  TransformInterceptor,
} from './common';
import { AppLoggerService } from './config/app-logger.service';
import { EnvConfigService } from './config/env-config.service';
import { RedisSocketIoAdapter } from './infrastructure/realtime';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const env = app.get(EnvConfigService);
  const logger = app.get(AppLoggerService);

  app.useLogger(logger);
  app.enableShutdownHooks();
  app.setGlobalPrefix(env.app.apiPrefix);

  app.enableCors({
    credentials: true,
    origin: env.app.corsOrigins,
  });
  app.use(helmet());
  app.use(cookieParser());
  app.useGlobalFilters(app.get(HttpExceptionFilter));
  app.useGlobalInterceptors(
    app.get(RequestContextInterceptor),
    app.get(TransformInterceptor),
    app.get(ResultInterceptor),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      whitelist: true,
    }),
  );

  const socketAdapter = new RedisSocketIoAdapter(app, env);
  await socketAdapter.connectToRedis();
  app.useWebSocketAdapter(socketAdapter);

  if (env.swagger.enabled) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle(env.app.name)
        .setDescription('API backend para MultiLot 360.')
        .setVersion('1.0.0')
        .addBearerAuth()
        .build(),
    );

    SwaggerModule.setup(env.swagger.path, app, document, {
      swaggerOptions: {
        persistAuthorization: true,
      },
    });
  }

  await app.listen(env.app.port);

  Logger.log(
    `${env.app.name} running on port ${env.app.port} with prefix /${env.app.apiPrefix}`,
    'Bootstrap',
  );
}
void bootstrap();
