import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import {
  GRADE_KEYS,
  permissionsFor,
  roleSchema,
  type LoginInput,
  type Me,
  type RegisterInput,
  type Role,
} from '@blulens/shared';
import { AuditService } from '../../common/audit/audit.service';
import { signJwt } from '../../common/auth/jwt';
import { hashPassword, verifyPassword } from '../../common/crypto/password';
import { ApiException } from '../../common/errors/api.exception';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  accessTtlSec: number;
  refreshTtlSec: number;
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
const INVALID_LOGIN = 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';

@Injectable()
export class AuthService {
  private readonly accessSecret: string;
  private readonly accessTtl: number;
  private readonly refreshTtl: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    config: ConfigService,
  ) {
    this.accessSecret = config.getOrThrow<string>('JWT_ACCESS_SECRET');
    this.accessTtl = Number(config.get('JWT_ACCESS_TTL_SEC') ?? 900);
    this.refreshTtl = Number(config.get('JWT_REFRESH_TTL_SEC') ?? 604800);
  }

  /** New Member account; the caller is logged in right away. */
  async register(input: RegisterInput, ip?: string): Promise<{ me: Me; tokens: SessionTokens }> {
    if (await this.prisma.user.findUnique({ where: { email: input.email } })) {
      throw ApiException.conflict('EMAIL_TAKEN', 'อีเมลนี้ถูกใช้สมัครแล้ว');
    }
    const passwordHash = await hashPassword(input.password);
    const user = await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: { email: input.email, passwordHash, displayName: input.displayName, roles: { create: { role: 'Member' } } },
      });
      await this.audit.record({ actorId: u.id, action: 'user.register', entityType: 'user', entityId: u.id, ip }, tx);
      return u;
    });
    return { me: await this.me(user.id), tokens: await this.issueSession(user.id, ['Member'], randomUUID()) };
  }

  async login(input: LoginInput, ip?: string): Promise<{ me: Me; tokens: SessionTokens }> {
    const user = await this.prisma.user.findUnique({ where: { email: input.identifier }, include: { roles: true } });
    const ok = user && user.status === 'active' && !user.deletedAt && (await verifyPassword(input.password, user.passwordHash));
    if (!ok) throw ApiException.unauthorized(INVALID_LOGIN);
    await this.audit.record({ actorId: user.id, action: 'auth.login', entityType: 'user', entityId: user.id, ip });
    const roles = user.roles.map((r) => r.role);
    return { me: await this.me(user.id), tokens: await this.issueSession(user.id, roles, randomUUID()) };
  }

  /**
   * Refresh rotation with reuse detection: a refresh token works once. Presenting an already-rotated token
   * means it leaked, so the whole family (every token descended from that login) is revoked.
   */
  async refresh(rawRefresh: string | undefined, ip?: string): Promise<SessionTokens> {
    if (!rawRefresh) throw ApiException.unauthorized();
    const now = new Date();
    const token = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: sha256(rawRefresh) },
      include: { user: { include: { roles: true } } },
    });
    if (!token) throw ApiException.unauthorized();
    if (token.revokedAt) {
      await this.prisma.refreshToken.updateMany({ where: { familyId: token.familyId, revokedAt: null }, data: { revokedAt: now } });
      await this.audit.record({
        actorId: token.userId, action: 'auth.refresh_reuse', entityType: 'user', entityId: token.userId,
        after: { familyId: token.familyId }, ip,
      });
      throw ApiException.unauthorized();
    }
    if (token.expiresAt <= now || token.user.status !== 'active' || token.user.deletedAt) throw ApiException.unauthorized();

    // revoke-then-issue; the conditional update makes a concurrent second use of the same token lose the race
    const { count } = await this.prisma.refreshToken.updateMany({ where: { id: token.id, revokedAt: null }, data: { revokedAt: now } });
    if (count === 0) throw ApiException.unauthorized();
    return this.issueSession(token.userId, token.user.roles.map((r) => r.role), token.familyId);
  }

  /** Revokes the whole session family. Always succeeds (logout must work with a stale cookie too). */
  async logout(rawRefresh: string | undefined): Promise<void> {
    if (!rawRefresh) return;
    const token = await this.prisma.refreshToken.findUnique({ where: { tokenHash: sha256(rawRefresh) } });
    if (!token) return;
    await this.prisma.refreshToken.updateMany({
      where: { familyId: token.familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async me(userId: string): Promise<Me> {
    const now = new Date();
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: true,
        memberships: { where: { validFrom: { lte: now }, OR: [{ validTo: null }, { validTo: { gt: now } }] } },
      },
    });
    if (!user || user.deletedAt) throw ApiException.unauthorized();
    const roles = user.roles.map((r) => r.role).filter((r): r is Role => roleSchema.safeParse(r).success);

    // official grade = latest approved/overridden result of the player (grading §8)
    const official = await this.prisma.assessmentResult.findFirst({
      where: { status: { in: ['approved', 'overridden'] }, assessment: { subjectUserId: userId } },
      orderBy: { computedAt: 'desc' },
    });
    const key = (i: number | null) => GRADE_KEYS[i ?? 0]!;
    const currentGrade =
      official && official.score !== null && official.kind && official.label
        ? {
            score: Number(official.score),
            margin: Number(official.margin),
            lower: key(official.lowerIndex),
            upper: key(official.upperIndex),
            center: key(official.centerIndex),
            kind: official.kind,
            label: official.label,
          }
        : null;

    return {
      id: user.id,
      displayName: user.displayName,
      email: user.email,
      roles,
      teamIds: user.memberships.map((m) => m.teamId),
      permissions: permissionsFor(roles),
      currentGrade,
    };
  }

  private async issueSession(userId: string, roles: string[], familyId: string): Promise<SessionTokens> {
    const refreshToken = randomBytes(32).toString('base64url');
    await this.prisma.refreshToken.create({
      data: {
        userId,
        familyId,
        tokenHash: sha256(refreshToken),
        expiresAt: new Date(Date.now() + this.refreshTtl * 1000),
      },
    });
    const accessToken = signJwt({ sub: userId, roles }, this.accessSecret, this.accessTtl, Math.floor(Date.now() / 1000));
    return { accessToken, refreshToken, accessTtlSec: this.accessTtl, refreshTtlSec: this.refreshTtl };
  }
}

