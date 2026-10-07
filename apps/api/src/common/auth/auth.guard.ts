import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { roleSchema, type Role } from '@blulens/shared';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ApiException } from '../errors/api.exception';
import { ACCESS_COOKIE, type AuthedRequest } from './auth.types';
import { ROLES_KEY } from './decorators';
import { verifyJwt } from './jwt';

/**
 * Global guard: reads the bl_access cookie, attaches req.user, then enforces @Roles (union).
 * @Public endpoints still get req.user when a valid cookie is present (e.g. visibility rules), but never 401.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const token = (req.cookies as Record<string, string> | undefined)?.[ACCESS_COOKIE];
    const claims = token
      ? verifyJwt(token, this.config.getOrThrow<string>('JWT_ACCESS_SECRET'), Math.floor(Date.now() / 1000))
      : null;
    if (claims) {
      req.user = { id: claims.sub, roles: claims.roles.filter((r): r is Role => roleSchema.safeParse(r).success) };
    }

    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;
    if (!req.user) throw ApiException.unauthorized();

    const allowed = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, targets);
    if (allowed?.length && !allowed.some((r) => req.user!.roles.includes(r))) throw ApiException.forbidden();
    return true;
  }
}
