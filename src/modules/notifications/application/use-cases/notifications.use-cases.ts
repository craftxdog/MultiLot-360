import { Inject, Injectable } from '@nestjs/common';
import {
  AppError,
  ErrorFactory,
  PaginatedResult,
  Result,
  UseCase,
} from '../../../../shared-kernel';
import {
  DeleteNotificationResult,
  MarkAllNotificationsReadResult,
  Notification,
  NotificationUnreadCount,
} from '../../domain/entities';
import {
  ListNotificationsQuery,
  NOTIFICATIONS_REPOSITORY,
  NotificationsRepository,
} from '../../domain/ports';

@Injectable()
export class ListNotificationsUseCase extends UseCase<
  ListNotificationsQuery,
  PaginatedResult<Notification>,
  AppError
> {
  constructor(
    @Inject(NOTIFICATIONS_REPOSITORY)
    private readonly repository: NotificationsRepository,
  ) {
    super();
  }

  async execute(
    input: ListNotificationsQuery,
  ): Promise<Result<PaginatedResult<Notification>, AppError>> {
    try {
      return Result.success(await this.repository.list(input));
    } catch (error) {
      return ErrorFactory.useCase('Could not list notifications', error);
    }
  }
}

@Injectable()
export class GetUnreadNotificationCountUseCase extends UseCase<
  { userId: string },
  NotificationUnreadCount,
  AppError
> {
  constructor(
    @Inject(NOTIFICATIONS_REPOSITORY)
    private readonly repository: NotificationsRepository,
  ) {
    super();
  }

  async execute(input: {
    userId: string;
  }): Promise<Result<NotificationUnreadCount, AppError>> {
    try {
      return Result.success(await this.repository.unreadCount(input.userId));
    } catch (error) {
      return ErrorFactory.useCase(
        'Could not count unread notifications',
        error,
      );
    }
  }
}

@Injectable()
export class MarkNotificationReadUseCase extends UseCase<
  { notificationId: string; userId: string },
  Notification,
  AppError
> {
  constructor(
    @Inject(NOTIFICATIONS_REPOSITORY)
    private readonly repository: NotificationsRepository,
  ) {
    super();
  }

  async execute(input: {
    notificationId: string;
    userId: string;
  }): Promise<Result<Notification, AppError>> {
    try {
      const notification = await this.repository.markRead(
        input.notificationId,
        input.userId,
      );
      return notification
        ? Result.success(notification)
        : ErrorFactory.useCase('Notification not found', undefined, 404);
    } catch (error) {
      return ErrorFactory.useCase('Could not mark notification as read', error);
    }
  }
}

@Injectable()
export class MarkAllNotificationsReadUseCase extends UseCase<
  { userId: string },
  MarkAllNotificationsReadResult,
  AppError
> {
  constructor(
    @Inject(NOTIFICATIONS_REPOSITORY)
    private readonly repository: NotificationsRepository,
  ) {
    super();
  }

  async execute(input: {
    userId: string;
  }): Promise<Result<MarkAllNotificationsReadResult, AppError>> {
    try {
      return Result.success(await this.repository.markAllRead(input.userId));
    } catch (error) {
      return ErrorFactory.useCase(
        'Could not mark notifications as read',
        error,
      );
    }
  }
}

@Injectable()
export class DeleteNotificationUseCase extends UseCase<
  { notificationId: string; userId: string },
  DeleteNotificationResult,
  AppError
> {
  constructor(
    @Inject(NOTIFICATIONS_REPOSITORY)
    private readonly repository: NotificationsRepository,
  ) {
    super();
  }

  async execute(input: {
    notificationId: string;
    userId: string;
  }): Promise<Result<DeleteNotificationResult, AppError>> {
    try {
      const deleted = await this.repository.delete(
        input.notificationId,
        input.userId,
      );
      return deleted
        ? Result.success(deleted)
        : ErrorFactory.useCase('Notification not found', undefined, 404);
    } catch (error) {
      return ErrorFactory.useCase('Could not delete notification', error);
    }
  }
}
