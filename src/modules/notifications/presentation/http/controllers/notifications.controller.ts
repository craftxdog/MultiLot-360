import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  Permissions,
  RequireModules,
  SYSTEM_MODULES,
} from '../../../../../common';
import { AuthenticatedUserContext } from '../../../../../common/interfaces';
import {
  GetUnreadNotificationCountUseCase,
  ListNotificationsUseCase,
  MarkAllNotificationsReadUseCase,
  MarkNotificationReadUseCase,
} from '../../../application';
import {
  ListNotificationsQueryDto,
  MarkAllNotificationsReadResponseDto,
  NotificationResponseDto,
  NotificationUnreadCountResponseDto,
} from '../dto';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
@RequireModules(SYSTEM_MODULES.notificaciones)
export class NotificationsController {
  constructor(
    private readonly listNotifications: ListNotificationsUseCase,
    private readonly unreadCount: GetUnreadNotificationCountUseCase,
    private readonly markRead: MarkNotificationReadUseCase,
    private readonly markAllRead: MarkAllNotificationsReadUseCase,
  ) {}

  @Get()
  @Permissions('notificaciones.read')
  @ApiOkResponse({ type: [NotificationResponseDto] })
  list(
    @CurrentUser() user: AuthenticatedUserContext,
    @Query() query: ListNotificationsQueryDto,
  ) {
    return this.listNotifications.execute({ userId: user.id, ...query });
  }

  @Get('unread-count')
  @Permissions('notificaciones.read')
  @ApiOkResponse({ type: NotificationUnreadCountResponseDto })
  count(@CurrentUser() user: AuthenticatedUserContext) {
    return this.unreadCount.execute({ userId: user.id });
  }

  @Patch('read-all')
  @Permissions('notificaciones.update')
  @ApiOkResponse({ type: MarkAllNotificationsReadResponseDto })
  readAll(@CurrentUser() user: AuthenticatedUserContext) {
    return this.markAllRead.execute({ userId: user.id });
  }

  @Patch(':notificationId/read')
  @Permissions('notificaciones.update')
  @ApiOkResponse({ type: NotificationResponseDto })
  read(
    @Param('notificationId', new ParseUUIDPipe({ version: '4' }))
    notificationId: string,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.markRead.execute({ notificationId, userId: user.id });
  }
}
