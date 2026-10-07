import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { ApiException } from '../errors/api.exception';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * CSRF defence without tokens (architecture §6.2): a mutating request that carries an Origin header must come
 * from the web origin (WEB_URL). Browsers always send Origin on cross-site POSTs, so a forged form post fails.
 * Requests without Origin (server-to-server, curl, tests) carry no ambient browser cookies and are allowed.
 */
@Injectable()
export class OriginGuard implements CanActivate {
  private readonly allowed: string;

  constructor(config: ConfigService) {
    this.allowed = new URL(config.get<string>('WEB_URL') ?? 'http://localhost:3100').origin;
  }

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();
    const origin = req.headers.origin;
    if (!MUTATING.has(req.method) || origin === undefined || origin === this.allowed) return true;
    throw new ApiException(HttpStatus.FORBIDDEN, 'ORIGIN_FORBIDDEN', 'คำขอนี้ไม่ได้มาจากหน้าเว็บของระบบ');
  }
}
