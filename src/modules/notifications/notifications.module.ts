import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import {
  DeleteNotificationUseCase,
  GetUnreadNotificationCountUseCase,
  ListNotificationsUseCase,
  MarkAllNotificationsReadUseCase,
  MarkNotificationReadUseCase,
} from './application';
import { NOTIFICATION_PROJECTOR, NOTIFICATIONS_REPOSITORY } from './domain';
import {
  PrismaNotificationProjector,
  PrismaNotificationsRepository,
} from './infrastructure';
import { NotificationsController } from './presentation';

@Module({
  imports: [DatabaseModule],
  controllers: [NotificationsController],
  providers: [
    PrismaNotificationsRepository,
    PrismaNotificationProjector,
    GetUnreadNotificationCountUseCase,
    ListNotificationsUseCase,
    MarkAllNotificationsReadUseCase,
    MarkNotificationReadUseCase,
    DeleteNotificationUseCase,
    {
      provide: NOTIFICATIONS_REPOSITORY,
      useExisting: PrismaNotificationsRepository,
    },
    {
      provide: NOTIFICATION_PROJECTOR,
      useExisting: PrismaNotificationProjector,
    },
  ],
  exports: [NOTIFICATION_PROJECTOR, NOTIFICATIONS_REPOSITORY],
})
export class NotificationsModule {}
