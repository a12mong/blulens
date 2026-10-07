import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { ApiException } from '../errors/api.exception';
import { allowedOrigins, isAllowedOrigin } from './allowed-origins';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * CSRF defence without tokens (architecture §6.2): a mutating request that carries an Origin header must come
 * from an allowed web origin (WEB_URL or WEB_URLS). In development, any http://localhost:<port> is also allowed.
 * Browsers always send Origin on cross-site POSTs, so a forged form post fails.
 * Requests without Origin (server-to-server, curl, tests) carry no ambient browser cookies and are allowed.
 */
@Injectable()
export class OriginGuard implements CanActivate {
  private readonly allowed: string[];
  private readonly nodeEnv: string | undefined;

  constructor(config: ConfigService) {
    this.allowed = allowedOrigins({
      WEB_URLS: config.get<string>('WEB_URLS'),
      WEB_URL: config.get<string>('WEB_URL'),
    });
    this.nodeEnv = config.get<string>('NODE_ENV');
  }

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();
    const origin = req.headers.origin;
    if (!MUTATING.has(req.method) || origin === undefined || isAllowedOrigin(origin, this.allowed, this.nodeEnv)) {
      return true;
    }
    throw new ApiException(HttpStatus.FORBIDDEN, 'ORIGIN_FORBIDDEN', 'คำขอนี้ไม่ได้มาจากหน้าเว็บของระบบ');
  }
}
