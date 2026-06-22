import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import {
  BlockDrawShiftUseCase,
  CloseDrawShiftUseCase,
  CreateDrawConfigurationUseCase,
  GetDrawConfigurationUseCase,
  ListActiveDrawShiftsUseCase,
  ListDrawConfigurationsUseCase,
  ListDrawShiftsUseCase,
  OpenDrawShiftUseCase,
  ReopenDrawShiftUseCase,
  UpdateDrawConfigurationUseCase,
} from './application';
import { DRAWS_REPOSITORY } from './domain';
import { PrismaDrawsRepository } from './infrastructure';
import { DrawsController } from './presentation';

@Module({
  imports: [DatabaseModule],
  controllers: [DrawsController],
  providers: [
    PrismaDrawsRepository,
    BlockDrawShiftUseCase,
    CloseDrawShiftUseCase,
    CreateDrawConfigurationUseCase,
    GetDrawConfigurationUseCase,
    ListActiveDrawShiftsUseCase,
    ListDrawConfigurationsUseCase,
    ListDrawShiftsUseCase,
    OpenDrawShiftUseCase,
    ReopenDrawShiftUseCase,
    UpdateDrawConfigurationUseCase,
    {
      provide: DRAWS_REPOSITORY,
      useExisting: PrismaDrawsRepository,
    },
  ],
  exports: [
    BlockDrawShiftUseCase,
    CloseDrawShiftUseCase,
    CreateDrawConfigurationUseCase,
    GetDrawConfigurationUseCase,
    ListActiveDrawShiftsUseCase,
    ListDrawConfigurationsUseCase,
    ListDrawShiftsUseCase,
    OpenDrawShiftUseCase,
    ReopenDrawShiftUseCase,
    UpdateDrawConfigurationUseCase,
  ],
})
export class DrawsModule {}
