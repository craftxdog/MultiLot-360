import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import {
  GetSystemParameterUseCase,
  ListSystemParametersUseCase,
  UpsertSystemParameterUseCase,
} from './application';
import { SYSTEM_PARAMETERS_REPOSITORY } from './domain';
import { PrismaSystemParametersRepository } from './infrastructure';
import { SystemParametersController } from './presentation';

@Module({
  imports: [DatabaseModule],
  controllers: [SystemParametersController],
  providers: [
    PrismaSystemParametersRepository,
    GetSystemParameterUseCase,
    ListSystemParametersUseCase,
    UpsertSystemParameterUseCase,
    {
      provide: SYSTEM_PARAMETERS_REPOSITORY,
      useExisting: PrismaSystemParametersRepository,
    },
  ],
  exports: [
    GetSystemParameterUseCase,
    ListSystemParametersUseCase,
    UpsertSystemParameterUseCase,
  ],
})
export class SystemParametersModule {}
