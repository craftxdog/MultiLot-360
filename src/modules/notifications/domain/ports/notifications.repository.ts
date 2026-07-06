import { PaginatedResult } from '../../../../shared-kernel';
import {
  MarkAllNotificationsReadResult,
  Notification,
  NotificationUnreadCount,
} from '../entities';

export const NOTIFICATIONS_REPOSITORY = Symbol('NOTIFICATIONS_REPOSITORY');

export type ListNotificationsQuery = {
  userId: string;
  type?: string;
  unread?: boolean;
  page: number;
  limit: number;
  sortBy: string;
  sortDirection: 'asc' | 'desc';
};

export interface NotificationsRepository {
  list(query: ListNotificationsQuery): Promise<PaginatedResult<Notification>>;
  unreadCount(userId: string): Promise<NotificationUnreadCount>;
  markRead(
    notificationId: string,
    userId: string,
  ): Promise<Notification | null>;
  markAllRead(userId: string): Promise<MarkAllNotificationsReadResult>;
}
