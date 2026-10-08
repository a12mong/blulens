import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { MeNotificationsService } from './me-notifications.service';
import { NotificationsService } from './notifications.service';

@Module({
  controllers: [NotificationsController],
  providers: [MeNotificationsService, NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
