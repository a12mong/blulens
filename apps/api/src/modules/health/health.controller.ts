import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';

/**
 * Liveness probe สำหรับ Docker healthcheck / reverse proxy / คำสั่งตรวจหลัง deploy
 * ตั้งใจไม่แตะ DB/Redis — ตอบแค่ว่า process ยังรับ request ได้
 * (ถ้า DB ล่ม ให้เห็นจาก error ของ endpoint จริง ไม่ใช่ restart loop จาก healthcheck)
 */
@Controller('health')
export class HealthController {
  @Public()
  @Get()
  health() {
    return { status: 'ok' };
  }
}
