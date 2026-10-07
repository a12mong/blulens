import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { RedisService } from './redis/redis.service';

/** Infrastructure กลาง (DB/Redis) — global ให้ทุก module inject ได้โดยไม่ต้อง import */
@Global()
@Module({
  providers: [PrismaService, RedisService],
  exports: [PrismaService, RedisService],
})
export class CoreModule {}
