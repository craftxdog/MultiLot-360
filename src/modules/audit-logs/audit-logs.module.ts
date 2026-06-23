import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import {
  GetAuditEventUseCase,
  ListAuditEventsUseCase,
  RecordAuditEventUseCase,
} from './application';
import { AUDIT_EVENTS_REPOSITORY } from './domain';
import {
  AuditHttpInterceptor,
  PrismaAuditEventsRepository,
} from './infrastructure';
import { AuditEventsController } from './presentation';

@Module({
  imports: [DatabaseModule],
  controllers: [AuditEventsController],
  providers: [
    PrismaAuditEventsRepository,
    RecordAuditEventUseCase,
    GetAuditEventUseCase,
    ListAuditEventsUseCase,
    {
      provide: AUDIT_EVENTS_REPOSITORY,
      useExisting: PrismaAuditEventsRepository,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditHttpInterceptor,
    },
  ],
  exports: [
    RecordAuditEventUseCase,
    GetAuditEventUseCase,
    ListAuditEventsUseCase,
  ],
})
export class AuditLogsModule {}
