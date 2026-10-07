import { Injectable, HttpStatus } from '@nestjs/common';
import { normalizeTeamName } from '@blulens/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { ApiException } from '../../common/errors/api.exception';
import type { AuthUser } from '../../common/auth/auth.types';

@Injectable()
export class TeamRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async createTeamRequest(name: string, user: AuthUser) {
    const text = name.trim();
    const textKey = normalizeTeamName(text);

    if (!textKey) {
      throw ApiException.badRequest(
        'VALIDATION_FAILED',
        'ชื่อทีมต้องมีอักขระสำคัญอย่างน้อย 1 ตัว',
      );
    }

    // Check if an active team with this name exists
    const existingTeam = await this.prisma.team.findFirst({
      where: {
        nameKey: textKey,
        status: 'active',
      },
    });
    if (existingTeam) {
      throw new ApiException(
        HttpStatus.CONFLICT,
        'TEAM_EXISTS',
        'มีทีมนี้อยู่แล้ว กรุณาเลือกจากรายการ',
        { teamId: existingTeam.id, name: existingTeam.name },
      );
    }

    // Check if an active team has an alias with this name
    const existingAlias = await this.prisma.teamAlias.findFirst({
      where: {
        aliasKey: textKey,
        team: { status: 'active' },
      },
      include: { team: true },
    });
    if (existingAlias) {
      throw new ApiException(
        HttpStatus.CONFLICT,
        'TEAM_EXISTS',
        'มีทีมนี้อยู่แล้ว กรุณาเลือกจากรายการ',
        { teamId: existingAlias.team.id, name: existingAlias.team.name },
      );
    }

    // Check if a pending request with this name exists
    const existingRequest = await this.prisma.teamRequest.findFirst({
      where: {
        textKey,
        status: 'pending',
      },
    });
    if (existingRequest) {
      throw new ApiException(
        HttpStatus.CONFLICT,
        'TEAM_REQUEST_PENDING',
        'มีคำขอเพิ่มทีมนี้รออยู่แล้ว',
        { requestId: existingRequest.id },
      );
    }

    // Create the request in a transaction
    const request = await this.prisma.$transaction(async (tx) => {
      const created = await tx.teamRequest.create({
        data: {
          requestedBy: user.id,
          text,
          textKey,
          status: 'pending',
        },
      });

      // Audit the creation
      await this.audit.record(
        {
          actorId: user.id,
          action: 'team_request.create',
          entityType: 'team_request',
          entityId: created.id,
          after: { name: created.text },
        },
        tx,
      );

      return created;
    });

    return {
      id: request.id,
      name: request.text,
      requestedBy: request.requestedBy,
      status: request.status,
      teamId: request.resolvedTeamId,
      createdAt: request.createdAt,
    };
  }

  async getPendingRequests() {
    const requests = await this.prisma.teamRequest.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'asc' },
    });

    return requests.map((r) => ({
      id: r.id,
      name: r.text,
      requestedBy: r.requestedBy,
      status: r.status,
      teamId: r.resolvedTeamId,
      createdAt: r.createdAt,
    }));
  }
}
