import { NotificationsRepository } from '../../domain';
import {
  GetUnreadNotificationCountUseCase,
  MarkAllNotificationsReadUseCase,
  MarkNotificationReadUseCase,
} from './notifications.use-cases';

describe('Notification use cases', () => {
  const unreadCount = jest.fn();
  const repository = {
    list: jest.fn(),
    unreadCount,
    markRead: jest.fn(),
    markAllRead: jest.fn(),
  } as jest.Mocked<NotificationsRepository>;

  beforeEach(() => jest.clearAllMocks());

  it('returns the unread count for the authenticated user', async () => {
    repository.unreadCount.mockResolvedValue({ unread: 3 });
    const result = await new GetUnreadNotificationCountUseCase(
      repository,
    ).execute({ userId: 'user-id' });

    if (result.isFailure) throw result.error;
    expect(result.value).toEqual({ unread: 3 });
    expect(unreadCount).toHaveBeenCalledWith('user-id');
  });

  it('does not expose notifications owned by another user', async () => {
    repository.markRead.mockResolvedValue(null);
    const result = await new MarkNotificationReadUseCase(repository).execute({
      notificationId: 'notification-id',
      userId: 'user-id',
    });

    expect(result.isFailure).toBe(true);
    expect(result.isFailure && result.error.message).toBe(
      'Notification not found',
    );
  });

  it('marks every unread notification for the user', async () => {
    const readAt = new Date('2026-07-06T00:00:00.000Z');
    repository.markAllRead.mockResolvedValue({ updatedCount: 4, readAt });
    const result = await new MarkAllNotificationsReadUseCase(
      repository,
    ).execute({ userId: 'user-id' });

    if (result.isFailure) throw result.error;
    expect(result.value).toEqual({ updatedCount: 4, readAt });
  });
});
