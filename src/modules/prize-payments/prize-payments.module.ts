import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import {
  GetPrizePaymentUseCase,
  ListPrizePaymentsUseCase,
  PayPrizeUseCase,
} from './application';
import { PRIZE_PAYMENTS_REPOSITORY } from './domain';
import { PrismaPrizePaymentsRepository } from './infrastructure';
import { PrizePaymentsController } from './presentation';

@Module({
  imports: [DatabaseModule],
  controllers: [PrizePaymentsController],
  providers: [
    PrismaPrizePaymentsRepository,
    PayPrizeUseCase,
    GetPrizePaymentUseCase,
    ListPrizePaymentsUseCase,
    {
      provide: PRIZE_PAYMENTS_REPOSITORY,
      useExisting: PrismaPrizePaymentsRepository,
    },
  ],
  exports: [PayPrizeUseCase, GetPrizePaymentUseCase, ListPrizePaymentsUseCase],
})
export class PrizePaymentsModule {}
