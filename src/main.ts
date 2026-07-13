import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
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
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  const env = app.get(EnvConfigService);
  const logger = app.get(AppLoggerService);

  app.useLogger(logger);
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
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
        .setDescription(
          'API operacional de MultiLot 360. PostgreSQL es la fuente de verdad; Socket.IO solo notifica cambios confirmados. Todas las rutas privadas requieren un access token de Supabase y pueden exigir módulo, rol y permiso RBAC.',
        )
        .setVersion('1.0.0')
        .addBearerAuth()
        .addTag('Health', 'Estado del proceso y sus dependencias.')
        .addTag('Auth', 'Sesiones, identidad y recuperación de contraseña.')
        .addTag(
          'Seller onboarding',
          'Invitación, activación y administración de vendedores.',
        )
        .addTag(
          'Draws',
          'Configuraciones recurrentes y turnos operacionales de sorteos.',
        )
        .addTag(
          'Number limits',
          'Topes globales o por vendedor, con alcance general o por sorteo.',
        )
        .addTag(
          'Blocked numbers',
          'Bloqueos temporales de números por fecha o turno.',
        )
        .addTag('Sales', 'Ventas multi-número, consulta, política y anulación.')
        .addTag(
          'Sales Matrix',
          'Vista administrativa 00-99 de la exposición vendida.',
        )
        .addTag('Results', 'Resultados y ventas ganadoras por turno.')
        .addTag('Prize payments', 'Registro de premios efectivamente pagados.')
        .addTag('Cash cuts', 'Cierres contables por vendedor y período.')
        .addTag('Reports', 'Resumen operacional y desempeño por vendedor.')
        .addTag('System parameters', 'Configuración operacional administrable.')
        .addTag(
          'Audit events',
          'Trazabilidad técnica y de acciones de negocio.',
        )
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
