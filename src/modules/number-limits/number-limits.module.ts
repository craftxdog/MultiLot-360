import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import {
  CreateNumberLimitsUseCase,
  ExpireNumberLimitUseCase,
  GetNumberLimitUseCase,
  ListNumberLimitsUseCase,
  UpdateNumberLimitUseCase,
} from './application';
import { NUMBER_LIMITS_REPOSITORY } from './domain';
import { PrismaNumberLimitsRepository } from './infrastructure';
import { NumberLimitsController } from './presentation';

@Module({
  imports: [DatabaseModule],
  controllers: [NumberLimitsController],
  providers: [
    PrismaNumberLimitsRepository,
    CreateNumberLimitsUseCase,
    ExpireNumberLimitUseCase,
    GetNumberLimitUseCase,
    ListNumberLimitsUseCase,
    UpdateNumberLimitUseCase,
    {
      provide: NUMBER_LIMITS_REPOSITORY,
      useExisting: PrismaNumberLimitsRepository,
    },
  ],
  exports: [
    CreateNumberLimitsUseCase,
    ExpireNumberLimitUseCase,
    GetNumberLimitUseCase,
    ListNumberLimitsUseCase,
    UpdateNumberLimitUseCase,
  ],
})
export class NumberLimitsModule {}
