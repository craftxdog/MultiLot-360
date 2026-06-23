import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CommonModule } from './common';
import { EnvConfigModule } from './config/config.module';
import { InfrastructureModule } from './infrastructure/infrastructure.module';
import { AuditLogsModule } from './modules/audit-logs';
import { BlockedNumbersModule } from './modules/blocked-numbers';
import { CashCutsModule } from './modules/cash-cuts';
import { DrawsModule } from './modules/draws';
import { HealthModule } from './modules/health';
import { IdentityAccessModule } from './modules/identity-access';
import { NumberLimitsModule } from './modules/number-limits';
import { PrizePaymentsModule } from './modules/prize-payments';
import { ReportsModule } from './modules/reports';
import { ResultsModule } from './modules/results';
import { SalesModule } from './modules/sales';

@Module({
  imports: [
    EnvConfigModule,
    InfrastructureModule,
    CommonModule,
    AuditLogsModule,
    IdentityAccessModule,
    DrawsModule,
    NumberLimitsModule,
    SalesModule,
    BlockedNumbersModule,
    ResultsModule,
    PrizePaymentsModule,
    CashCutsModule,
    ReportsModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
