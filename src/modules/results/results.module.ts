import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import {
  CreateResultUseCase,
  GetResultUseCase,
  ListResultsUseCase,
  ListWinningSalesUseCase,
} from './application';
import { RESULTS_REPOSITORY } from './domain';
import { PrismaResultsRepository } from './infrastructure';
import { ResultsController } from './presentation';

@Module({
  imports: [DatabaseModule],
  controllers: [ResultsController],
  providers: [
    PrismaResultsRepository,
    CreateResultUseCase,
    GetResultUseCase,
    ListResultsUseCase,
    ListWinningSalesUseCase,
    {
      provide: RESULTS_REPOSITORY,
      useExisting: PrismaResultsRepository,
    },
  ],
  exports: [
    CreateResultUseCase,
    GetResultUseCase,
    ListResultsUseCase,
    ListWinningSalesUseCase,
  ],
})
export class ResultsModule {}
