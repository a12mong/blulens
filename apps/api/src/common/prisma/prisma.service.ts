import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Prisma client กลาง — ต่อ DB แบบ lazy (query แรก) เพื่อให้ API บูตได้แม้ DB ยังไม่ขึ้น
 * (health ไม่แตะ DB ตั้งใจให้เป็น liveness probe ล้วน)
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('ปิดการเชื่อมต่อ PostgreSQL แล้ว');
  }
}
