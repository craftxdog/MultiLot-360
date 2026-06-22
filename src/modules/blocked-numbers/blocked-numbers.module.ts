import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import {
  CreateBlockedNumbersUseCase,
  DeleteBlockedNumberUseCase,
  GetBlockedNumberUseCase,
  ListBlockedNumbersUseCase,
} from './application';
import { BLOCKED_NUMBERS_REPOSITORY } from './domain';
import { PrismaBlockedNumbersRepository } from './infrastructure';
import { BlockedNumbersController } from './presentation';

@Module({
  imports: [DatabaseModule],
  controllers: [BlockedNumbersController],
  providers: [
    PrismaBlockedNumbersRepository,
    CreateBlockedNumbersUseCase,
    DeleteBlockedNumberUseCase,
    GetBlockedNumberUseCase,
    ListBlockedNumbersUseCase,
    {
      provide: BLOCKED_NUMBERS_REPOSITORY,
      useExisting: PrismaBlockedNumbersRepository,
    },
  ],
  exports: [
    CreateBlockedNumbersUseCase,
    DeleteBlockedNumberUseCase,
    GetBlockedNumberUseCase,
    ListBlockedNumbersUseCase,
  ],
})
export class BlockedNumbersModule {}
