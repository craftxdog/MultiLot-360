import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { GetSalesMatrixUseCase } from './application';
import { SALES_MATRIX_REPOSITORY } from './domain';
import { PrismaSalesMatrixRepository } from './infrastructure';
import { SalesMatrixController } from './presentation';

@Module({
  imports: [DatabaseModule],
  controllers: [SalesMatrixController],
  providers: [
    PrismaSalesMatrixRepository,
    GetSalesMatrixUseCase,
    {
      provide: SALES_MATRIX_REPOSITORY,
      useExisting: PrismaSalesMatrixRepository,
    },
  ],
  exports: [GetSalesMatrixUseCase],
})
export class SalesMatrixModule {}
