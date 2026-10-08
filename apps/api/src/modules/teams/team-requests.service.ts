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

    if (requests.length === 0) {
      return [];
    }

    // Collect all request textKeys and requester IDs for batch loading
    const requestTextKeys = requests.map((r) => r.textKey);
    const requesterIds = new Set(requests.map((r) => r.requestedBy));

    // Load all users in one query (batch loading requester names)
    const users = await this.prisma.user.findMany({
      where: { id: { in: Array.from(requesterIds) } },
      select: { id: true, displayName: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u.displayName]));

    // Load ONLY candidate teams that match request keys
    // a) Forward: nameKey contains or has aliases with aliasKey contains
    const forwardTeams = await this.prisma.team.findMany({
      where: {
        status: 'active',
        OR: requestTextKeys.flatMap((k) => [
          { nameKey: { contains: k } },
          { aliases: { some: { aliasKey: { contains: k } } } },
        ]),
      },
      select: { id: true, name: true, nameKey: true, aliases: { select: { aliasKey: true } } },
    });

    // b) Reverse: request key contains team key (via raw SQL)
    const reverseIds =
      requestTextKeys.length > 0
        ? await this.prisma.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM teams WHERE status = 'active' AND EXISTS (
            SELECT 1 FROM unnest(${requestTextKeys}::text[]) AS k WHERE position(name_key in k) > 0
          )
        `
        : [];

    const reverseIdSet = new Set(reverseIds.map((r) => r.id));
    const forwardIdSet = new Set(forwardTeams.map((t) => t.id));

    // Load reverse teams (exclude already loaded forward teams)
    const reverseTeams =
      reverseIdSet.size > reverseIds.filter((r) => !forwardIdSet.has(r.id)).length
        ? await this.prisma.team.findMany({
            where: {
              id: { in: reverseIds.map((r) => r.id).filter((id) => !forwardIdSet.has(id)) },
            },
            select: { id: true, name: true, nameKey: true, aliases: { select: { aliasKey: true } } },
          })
        : [];

    // Combine forward and reverse teams
    const teams = [...forwardTeams, ...reverseTeams];

    // Find similar teams for each request (in memory)
    const similarTeamsMap = this.computeSimilarTeams(requestTextKeys, teams);

    return requests.map((r) => ({
      id: r.id,
      name: r.text,
      requestedBy: r.requestedBy,
      requestedByName: userMap.get(r.requestedBy) ?? null,
      status: r.status,
      teamId: r.resolvedTeamId,
      similarTeams: similarTeamsMap.get(r.textKey) ?? [],
      createdAt: r.createdAt,
    }));
  }

  private computeSimilarTeams(
    requestTextKeys: string[],
    teams: Array<{ id: string; name: string; nameKey: string; aliases: Array<{ aliasKey: string }> }>,
  ): Map<string, Array<{ id: string; name: string }>> {
    const result = new Map<string, Array<{ id: string; name: string }>>();

    for (const requestKey of requestTextKeys) {
      const similar: Array<{ id: string; name: string }> = [];

      for (const team of teams) {
        // Check if nameKey contains requestKey, or requestKey contains nameKey, or an alias matches
        const nameKeyMatch =
          team.nameKey.includes(requestKey) || requestKey.includes(team.nameKey);

        const aliasMatch = team.aliases.some((alias) =>
          alias.aliasKey.includes(requestKey) || requestKey.includes(alias.aliasKey),
        );

        if (nameKeyMatch || aliasMatch) {
          similar.push({ id: team.id, name: team.name });
        }
      }

      // Sort by name, limit to 5
      similar.sort((a, b) => a.name.localeCompare(b.name));
      result.set(requestKey, similar.slice(0, 5));
    }

    return result;
  }

  async resolveTeamRequest(
    requestId: string,
    body: {
      action: 'create_team' | 'alias_to_team' | 'reject';
      teamId?: string;
      reason?: string;
    },
    user: AuthUser,
  ) {
    // Load the request
    const request = await this.prisma.teamRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw ApiException.notFound('ไม่พบคำขอเพิ่มทีม', 'TEAM_REQUEST_NOT_FOUND');
    }

    if (request.status !== 'pending') {
      throw new ApiException(
        HttpStatus.CONFLICT,
        'TEAM_REQUEST_NOT_PENDING',
        'คำขอนี้ถูกดำเนินการแล้ว',
      );
    }

    // Handle resolution in a transaction
    let resolvedTeamId: string | null = null;
    let status: 'created' | 'aliased' | 'rejected' = 'created';
    let reason: string | undefined;

    if (body.action === 'create_team') {
      status = 'created';
      try {
        const newTeam = await this.prisma.team.create({
          data: {
            name: request.text,
            nameKey: request.textKey,
            status: 'active',
          },
        });
        resolvedTeamId = newTeam.id;
      } catch (err) {
        if ((err as any).code === 'P2002') {
          throw new ApiException(
            HttpStatus.CONFLICT,
            'TEAM_EXISTS',
            'มีทีมนี้อยู่แล้ว กรุณาเลือกจากรายการ',
          );
        }
        throw err;
      }
    } else if (body.action === 'alias_to_team') {
      status = 'aliased';
      const targetTeam = await this.prisma.team.findUnique({
        where: { id: body.teamId! },
      });

      if (!targetTeam || targetTeam.status !== 'active') {
        throw ApiException.notFound('ไม่พบทีม', 'TEAM_NOT_FOUND');
      }

      try {
        await this.prisma.teamAlias.create({
          data: {
            teamId: body.teamId!,
            alias: request.text,
            aliasKey: request.textKey,
          },
        });
      } catch (err) {
        if ((err as any).code === 'P2002') {
          throw new ApiException(
            HttpStatus.CONFLICT,
            'TEAM_EXISTS',
            'มีทีมนี้อยู่แล้ว กรุณาเลือกจากรายการ',
          );
        }
        throw err;
      }

      resolvedTeamId = body.teamId!;
    } else {
      status = 'rejected';
      reason = body.reason;
    }

    // Update the request
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.teamRequest.updateMany({
        where: { id: requestId, status: 'pending' },
        data: {
          status,
          resolvedTeamId,
          resolvedBy: user.id,
          resolvedAt: new Date(),
          reason,
        },
      });

      if (result.count === 0) {
        throw new ApiException(
          HttpStatus.CONFLICT,
          'TEAM_REQUEST_NOT_PENDING',
          'คำขอนี้ถูกดำเนินการแล้ว',
        );
      }

      // Audit the resolution
      await this.audit.record(
        {
          actorId: user.id,
          action: 'team_request.resolve',
          entityType: 'team_request',
          entityId: requestId,
          before: { status: 'pending' },
          after: { status, teamId: resolvedTeamId },
          reason,
        },
        tx,
      );

      return tx.teamRequest.findUniqueOrThrow({
        where: { id: requestId },
      });
    });

    return {
      id: updated.id,
      name: updated.text,
      requestedBy: updated.requestedBy,
      status: updated.status,
      teamId: updated.resolvedTeamId,
      createdAt: updated.createdAt,
    };
  }
}
