import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CommonModule } from './common';
import { EnvConfigModule } from './config/config.module';
import { InfrastructureModule } from './infrastructure/infrastructure.module';
import { RealtimeModule } from './infrastructure/realtime';
import { AuditLogsModule } from './modules/audit-logs';
import { BlockedNumbersModule } from './modules/blocked-numbers';
import { CashCutsModule } from './modules/cash-cuts';
import { DrawsModule } from './modules/draws';
import { HealthModule } from './modules/health';
import { IdentityAccessModule } from './modules/identity-access';
import { NumberLimitsModule } from './modules/number-limits';
import { NotificationsModule } from './modules/notifications';
import { PrizePaymentsModule } from './modules/prize-payments';
import { ReportsModule } from './modules/reports';
import { ResultsModule } from './modules/results';
import { SalesModule } from './modules/sales';
import { SalesMatrixModule } from './modules/sales-matrix';
import { SaasBillingModule } from './modules/saas-billing';
import { SystemParametersModule } from './modules/system-parameters';

@Module({
  imports: [
    EnvConfigModule,
    InfrastructureModule,
    CommonModule,
    AuditLogsModule,
    IdentityAccessModule,
    SaasBillingModule,
    RealtimeModule,
    DrawsModule,
    NumberLimitsModule,
    NotificationsModule,
    SalesModule,
    SalesMatrixModule,
    BlockedNumbersModule,
    ResultsModule,
    PrizePaymentsModule,
    CashCutsModule,
    ReportsModule,
    SystemParametersModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
