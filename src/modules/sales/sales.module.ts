import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import {
  CreateSaleUseCase,
  GetSaleUseCase,
  GetSalesVoidPolicyUseCase,
  ListSalesUseCase,
  UpdateSalesVoidPolicyUseCase,
  VoidSaleUseCase,
} from './application';
import { SALES_REPOSITORY } from './domain';
import { PrismaSalesRepository } from './infrastructure';
import { SalesController } from './presentation';

@Module({
  imports: [DatabaseModule],
  controllers: [SalesController],
  providers: [
    PrismaSalesRepository,
    CreateSaleUseCase,
    GetSaleUseCase,
    GetSalesVoidPolicyUseCase,
    ListSalesUseCase,
    UpdateSalesVoidPolicyUseCase,
    VoidSaleUseCase,
    {
      provide: SALES_REPOSITORY,
      useExisting: PrismaSalesRepository,
    },
  ],
  exports: [
    CreateSaleUseCase,
    GetSaleUseCase,
    GetSalesVoidPolicyUseCase,
    ListSalesUseCase,
    UpdateSalesVoidPolicyUseCase,
    VoidSaleUseCase,
  ],
})
export class SalesModule {}
