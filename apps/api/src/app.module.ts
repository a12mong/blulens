import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthGuard } from './common/auth/auth.guard';
import { OriginGuard } from './common/auth/origin.guard';
import { CoreModule } from './common/core.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { EnvelopeInterceptor } from './common/interceptors/envelope.interceptor';
import { ZodValidationPipe } from './common/zod/zod';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { TeamsModule } from './modules/teams/teams.module';
import { TournamentsModule } from './modules/tournaments/tournaments.module';
import { UsersModule } from './modules/users/users.module';

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
    AuthModule,
    TeamsModule,
    TournamentsModule,
    UsersModule,
  ],
  providers: [
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: EnvelopeInterceptor },
    // order matters: rate limit -> Origin (CSRF) -> session cookie + @Roles
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: OriginGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}
