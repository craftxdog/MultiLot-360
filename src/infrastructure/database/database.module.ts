import { Module } from '@nestjs/common';
import { EnvConfigModule } from '../../config/config.module';
import { EnvConfigService } from '../../config/env-config.service';

export const DATABASE_CONFIG = Symbol('DATABASE_CONFIG');

@Module({
  imports: [EnvConfigModule],
  providers: [
    {
      provide: DATABASE_CONFIG,
      inject: [EnvConfigService],
      useFactory: (config: EnvConfigService) => config.database,
    },
  ],
  exports: [DATABASE_CONFIG],
})
export class DatabaseModule {}
