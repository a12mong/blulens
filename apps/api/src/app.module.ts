import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { CoreModule } from './common/core.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { EnvelopeInterceptor } from './common/interceptors/envelope.interceptor';
import { ZodValidationPipe } from './common/zod/zod';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
    }),
    // เพดานรวมทั้ง API 100 ครั้ง/นาที — DISABLE_RATE_LIMIT=1 ใช้เฉพาะ test
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 100,
        skipIf: () => process.env.DISABLE_RATE_LIMIT === '1',
      },
    ]),
    CoreModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: EnvelopeInterceptor },
    // AuthGuard / RolesGuard มาพร้อมการ์ด auth (บทบาท Admin/Committee/Reviewer/Member/Guest)
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
