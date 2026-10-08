import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit/audit.service';
import { PrismaService } from './prisma/prisma.service';
import { RedisService } from './redis/redis.service';
import { StorageService } from './storage/storage.service';
import { NotificationsService } from './notifications/notifications.service';

/** Infrastructure กลาง (DB/Redis) — global ให้ทุก module inject ได้โดยไม่ต้อง import */
@Global()
@Module({
  providers: [PrismaService, RedisService, AuditService, StorageService, NotificationsService],
  exports: [PrismaService, RedisService, AuditService, StorageService, NotificationsService],
})
export class CoreModule {}
