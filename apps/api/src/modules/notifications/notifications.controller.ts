import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ParseUUIDPipe } from '@nestjs/common';
import { Roles, CurrentUser } from '../../common/auth/decorators';
import { MeNotificationsService } from './me-notifications.service';
import type { AuthUser } from '../../common/auth/auth.types';

@Controller('me/notifications')
export class NotificationsController {
  constructor(private readonly service: MeNotificationsService) {}

  @Get()
  @Roles('Member', 'Reviewer', 'Umpire', 'Committee', 'Admin')
  getNotifications(@Query() query: Record<string, unknown>, @CurrentUser() user: AuthUser) {
    return this.service.getNotifications(user, query);
  }

  @Post(':notificationId/read')
  @HttpCode(204)
  @Roles('Member', 'Reviewer', 'Umpire', 'Committee', 'Admin')
  async readNotification(
    @Param('notificationId', new ParseUUIDPipe()) notificationId: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.service.readNotification(user, notificationId);
  }

  @Post('read-all')
  @HttpCode(200)
  @Roles('Member', 'Reviewer', 'Umpire', 'Committee', 'Admin')
  readAllNotifications(@CurrentUser() user: AuthUser) {
    return this.service.readAllNotifications(user);
  }
}
