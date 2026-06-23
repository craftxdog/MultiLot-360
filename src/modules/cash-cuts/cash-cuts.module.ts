import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import {
  CreateCashCutUseCase,
  GetCashCutSummaryUseCase,
  GetCashCutUseCase,
  ListCashCutsUseCase,
} from './application';
import { CASH_CUTS_REPOSITORY } from './domain';
import { PrismaCashCutsRepository } from './infrastructure';
import { CashCutsController } from './presentation';

@Module({
  imports: [DatabaseModule],
  controllers: [CashCutsController],
  providers: [
    PrismaCashCutsRepository,
    CreateCashCutUseCase,
    GetCashCutUseCase,
    ListCashCutsUseCase,
    GetCashCutSummaryUseCase,
    {
      provide: CASH_CUTS_REPOSITORY,
      useExisting: PrismaCashCutsRepository,
    },
  ],
  exports: [
    CreateCashCutUseCase,
    GetCashCutUseCase,
    ListCashCutsUseCase,
    GetCashCutSummaryUseCase,
  ],
})
export class CashCutsModule {}
