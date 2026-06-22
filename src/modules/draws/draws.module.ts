import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import {
  CloseDrawShiftUseCase,
  CreateDrawConfigurationUseCase,
  ListDrawConfigurationsUseCase,
  ListDrawShiftsUseCase,
  OpenDrawShiftUseCase,
} from './application';
import { DRAWS_REPOSITORY } from './domain';
import { PrismaDrawsRepository } from './infrastructure';
import { DrawsController } from './presentation';

@Module({
  imports: [DatabaseModule],
  controllers: [DrawsController],
  providers: [
    PrismaDrawsRepository,
    CloseDrawShiftUseCase,
    CreateDrawConfigurationUseCase,
    ListDrawConfigurationsUseCase,
    ListDrawShiftsUseCase,
    OpenDrawShiftUseCase,
    {
      provide: DRAWS_REPOSITORY,
      useExisting: PrismaDrawsRepository,
    },
  ],
  exports: [
    CloseDrawShiftUseCase,
    CreateDrawConfigurationUseCase,
    ListDrawConfigurationsUseCase,
    ListDrawShiftsUseCase,
    OpenDrawShiftUseCase,
  ],
})
export class DrawsModule {}
