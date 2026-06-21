import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppLoggerService } from './app-logger.service';
import configuration from './configuration';
import { EnvConfigService } from './env-config.service';

const nodeEnv = process.env.NODE_ENV ?? 'development';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      envFilePath: [`.env.${nodeEnv}`, '.env'],
      expandVariables: true,
      isGlobal: true,
      load: [configuration],
    }),
  ],
  providers: [EnvConfigService, AppLoggerService],
  exports: [EnvConfigService, AppLoggerService],
})
export class EnvConfigModule {}
