import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import {
  GetBusinessAnalyticsUseCase,
  GetOperationalOverviewUseCase,
  ListSellerOperationalReportsUseCase,
} from './application';
import { REPORTS_REPOSITORY } from './domain';
import { PrismaReportsRepository } from './infrastructure';
import { ReportsController } from './presentation';

@Module({
  imports: [DatabaseModule],
  controllers: [ReportsController],
  providers: [
    PrismaReportsRepository,
    GetBusinessAnalyticsUseCase,
    GetOperationalOverviewUseCase,
    ListSellerOperationalReportsUseCase,
    {
      provide: REPORTS_REPOSITORY,
      useExisting: PrismaReportsRepository,
    },
  ],
  exports: [
    GetBusinessAnalyticsUseCase,
    GetOperationalOverviewUseCase,
    ListSellerOperationalReportsUseCase,
  ],
})
export class ReportsModule {}
