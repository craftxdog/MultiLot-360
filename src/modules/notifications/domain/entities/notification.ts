export type Notification = {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  data: Record<string, unknown> | null;
  readAt: Date | null;
  createdAt: Date;
};

export type NotificationUnreadCount = {
  unread: number;
};

export type MarkAllNotificationsReadResult = {
  updatedCount: number;
  readAt: Date;
};

export type DeleteNotificationResult = {
  deleted: true;
  notificationId: string;
};
