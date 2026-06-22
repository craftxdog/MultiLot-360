import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CommonModule } from './common';
import { EnvConfigModule } from './config/config.module';
import { InfrastructureModule } from './infrastructure/infrastructure.module';
import { BlockedNumbersModule } from './modules/blocked-numbers';
import { DrawsModule } from './modules/draws';
import { HealthModule } from './modules/health';
import { IdentityAccessModule } from './modules/identity-access';
import { NumberLimitsModule } from './modules/number-limits';
import { ResultsModule } from './modules/results';
import { SalesModule } from './modules/sales';

@Module({
  imports: [
    EnvConfigModule,
    InfrastructureModule,
    CommonModule,
    IdentityAccessModule,
    DrawsModule,
    NumberLimitsModule,
    SalesModule,
    BlockedNumbersModule,
    ResultsModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
