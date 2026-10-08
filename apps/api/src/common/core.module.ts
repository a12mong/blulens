import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit/audit.service';
import { PrismaService } from './prisma/prisma.service';
import { RedisService } from './redis/redis.service';
import { StorageService } from './storage/storage.service';

/** Infrastructure กลาง (DB/Redis) — global ให้ทุก module inject ได้โดยไม่ต้อง import */
@Global()
@Module({
  providers: [PrismaService, RedisService, AuditService, StorageService],
  exports: [PrismaService, RedisService, AuditService, StorageService],
})
export class CoreModule {}
