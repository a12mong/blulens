import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { CookieOptions, Response } from 'express';
import { loginInputSchema, registerInputSchema, type Me } from '@blulens/shared';
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  REFRESH_COOKIE_PATH,
  SESSION_COOKIE,
  type AuthUser,
  type AuthedRequest,
} from '../../common/auth/auth.types';
import { CurrentUser } from '../../common/auth/decorators';
import { Public } from '../../common/decorators/public.decorator';
import { createZodDto } from '../../common/zod/zod';
import { AuthService, type SessionTokens } from './auth.service';

class RegisterDto extends createZodDto(registerInputSchema) {}
class LoginDto extends createZodDto(loginInputSchema) {}

/** Reference controller for Dev packets: thin, zod DTOs, service does the work, cookies set here. */
@Controller('auth')
export class AuthController {
  private readonly secure: boolean;

  constructor(
    private readonly auth: AuthService,
    config: ConfigService,
  ) {
    this.secure = String(config.get('COOKIE_SECURE') ?? 'false') === 'true';
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('register')
  async register(@Body() body: RegisterDto, @Req() req: AuthedRequest, @Res({ passthrough: true }) res: Response): Promise<Me> {
    const { me, tokens } = await this.auth.register(body, req.ip);
    this.setSessionCookies(res, tokens);
    return me;
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  async login(@Body() body: LoginDto, @Req() req: AuthedRequest, @Res({ passthrough: true }) res: Response): Promise<Me> {
    const { me, tokens } = await this.auth.login(body, req.ip);
    this.setSessionCookies(res, tokens);
    return me;
  }

  /** Public: the access cookie may already be expired; the refresh cookie is the credential. */
  @Public()
  @Post('refresh')
  @HttpCode(204)
  async refresh(@Req() req: AuthedRequest, @Res({ passthrough: true }) res: Response): Promise<void> {
    try {
      this.setSessionCookies(res, await this.auth.refresh(this.refreshCookie(req), req.ip));
    } catch (err) {
      this.clearSessionCookies(res);
      throw err;
    }
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: AuthedRequest, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.auth.logout(this.refreshCookie(req));
    this.clearSessionCookies(res);
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser): Promise<Me> {
    return this.auth.me(user.id);
  }

  private refreshCookie(req: AuthedRequest): string | undefined {
    return (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];
  }

  private base(path: string, maxAgeSec: number, httpOnly = true): CookieOptions {
    return { httpOnly, secure: this.secure, sameSite: 'lax', path, maxAge: maxAgeSec * 1000 };
  }

  private setSessionCookies(res: Response, t: SessionTokens) {
    res.cookie(ACCESS_COOKIE, t.accessToken, this.base('/', t.accessTtlSec));
    res.cookie(REFRESH_COOKIE, t.refreshToken, this.base(REFRESH_COOKIE_PATH, t.refreshTtlSec));
    // non-secret marker so Next middleware can redirect without reading the httpOnly cookies
    res.cookie(SESSION_COOKIE, '1', this.base('/', t.refreshTtlSec, false));
  }

  private clearSessionCookies(res: Response) {
    res.clearCookie(ACCESS_COOKIE, { path: '/' });
    res.clearCookie(REFRESH_COOKIE, { path: REFRESH_COOKIE_PATH });
    res.clearCookie(SESSION_COOKIE, { path: '/' });
  }
}
