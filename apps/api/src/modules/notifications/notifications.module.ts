import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { MeNotificationsService } from './me-notifications.service';

@Module({
  controllers: [NotificationsController],
  providers: [MeNotificationsService],
})
export class NotificationsModule {}
