import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../../common/audit/audit.service';
import type { AuthUser } from '../../common/auth/auth.types';
import { ApiException } from '../../common/errors/api.exception';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface AddTeamMemberInput {
  userId: string;
  validFrom: string;
}

export interface TeamMemberResult {
  id: string;
  userId: string;
  teamId: string;
  validFrom: string;
  teamCount: number;
}

@Injectable()
export class TeamMembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async addMember(
    teamId: string,
    input: AddTeamMemberInput,
    actor?: AuthUser,
    ip?: string,
  ): Promise<TeamMemberResult> {
    return this.prisma.$transaction(async (tx) => {
      // 1. team must exist with status 'active' -> else 404 TEAM_NOT_FOUND "ไม่พบทีมที่ต้องการ".
      const team = await tx.team.findUnique({
        where: { id: teamId },
      });
      if (!team || team.status !== 'active') {
        throw ApiException.notFound('ไม่พบทีมที่ต้องการ', 'TEAM_NOT_FOUND');
      }

      // 2. user must exist, not deleted, status 'active' -> else 404 USER_NOT_FOUND "ไม่พบผู้ใช้ที่ต้องการ".
      const user = await tx.user.findUnique({
        where: { id: input.userId },
      });
      if (!user || user.deletedAt !== null || user.status !== 'active') {
        throw ApiException.notFound('ไม่พบผู้ใช้ที่ต้องการ', 'USER_NOT_FOUND');
      }

      // 3. create TeamMembership { userId, teamId, validFrom: new Date(`${validFrom}T00:00:00Z`) };
      //    Prisma P2002 (already an open membership in this team) -> 409 MEMBERSHIP_EXISTS "ผู้เล่นอยู่ในทีมนี้แล้ว".
      let membership: { id: string; userId: string; teamId: string; validFrom: Date };
      try {
        membership = await tx.teamMembership.create({
          data: {
            userId: input.userId,
            teamId,
            validFrom: new Date(`${input.validFrom}T00:00:00Z`),
          },
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          throw ApiException.conflict('MEMBERSHIP_EXISTS', 'ผู้เล่นอยู่ในทีมนี้แล้ว');
        }
        throw err;
      }

      // 4. audit { action: 'team.member_add', entityType: 'team', entityId: teamId, after: { userId, validFrom } }.
      await this.audit.record(
        {
          actorId: actor?.id ?? null,
          action: 'team.member_add',
          entityType: 'team',
          entityId: teamId,
          after: { userId: input.userId, validFrom: input.validFrom },
          ip,
        },
        tx,
      );

      // 5. return 201 { id, userId, teamId, validFrom: 'YYYY-MM-DD', teamCount } where teamCount = the user's memberships current
      //    at now after the insert (A11: the web shows a MULTI_TEAM warning when > 1).
      const now = new Date();
      const teamCount = await tx.teamMembership.count({
        where: {
          userId: input.userId,
          validFrom: { lte: now },
          OR: [{ validTo: null }, { validTo: { gt: now } }],
        },
      });

      return {
        id: membership.id,
        userId: membership.userId,
        teamId: membership.teamId,
        validFrom: input.validFrom,
        teamCount,
      };
    });
  }
}
