import { HttpStatus, Injectable } from '@nestjs/common';
import { Match, Prisma } from '@prisma/client';
import type { AuthUser } from '../../common/auth/auth.types';
import { AuditService } from '../../common/audit/audit.service';
import { ApiException } from '../../common/errors/api.exception';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  matchResultTransition,
  resolveMatchFormat,
  validateMatchScore,
  walkoverGames,
  type MatchFlag,
  type MatchFormat,
  type ResultAction,
  type ResultActor,
  type ResultMatch,
} from '@blulens/shared';

export interface EntryRef {
  entryId: string;
  displayName: string;
  players: { userId: string; displayName: string }[];
  teamNames: string[];
  gradeLabel: string | null;
}

export interface EventMatchesQuery {
  status?: 'scheduled' | 'bye' | 'reported' | 'confirmed' | 'walkover' | 'void';
  stage?: 'group' | 'knockout' | 'third_place';
  round?: number;
}

export interface PutMatchResultInput {
  outcome: 'played' | 'walkover_a' | 'walkover_b';
  games?: { a: number; b: number }[];
  reason?: string;
}

const isStaff = (u?: AuthUser) => !!u?.roles.some((r) => r === 'Committee' || r === 'Admin');

@Injectable()
export class MatchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private async loadEntryMap(
    client: Prisma.TransactionClient | PrismaService,
    entryIds: string[],
  ): Promise<Map<string, EntryRef>> {
    if (entryIds.length === 0) {
      return new Map();
    }

    const entries = await client.entry.findMany({
      where: { id: { in: entryIds } },
      include: {
        players: {
          include: {
            user: { select: { displayName: true } },
            team: { select: { name: true } },
          },
          orderBy: { userId: 'asc' },
        },
      },
    });

    const entryMap = new Map<string, EntryRef>();
    for (const entry of entries) {
      const players = entry.players.map((p) => ({
        userId: p.userId,
        displayName: p.user.displayName,
      }));

      const displayName = entry.name?.trim()
        ? entry.name.trim()
        : players.map((p) => p.displayName).join(' / ');

      const teamNames = Array.from(
        new Set(
          entry.players
            .map((p) => p.team?.name)
            .filter((name): name is string => typeof name === 'string' && name.length > 0),
        ),
      );

      entryMap.set(entry.id, {
        entryId: entry.id,
        displayName,
        players,
        teamNames,
        gradeLabel: null,
      });
    }

    return entryMap;
  }

  private mapMatch(m: Match, entryMap: Map<string, EntryRef>, format: MatchFormat) {
    return {
      id: m.id,
      stage: m.stage,
      groupId: m.groupId,
      round: m.round,
      a: m.topEntryId,
      b: m.bottomEntryId,
      aEntry: m.topEntryId ? (entryMap.get(m.topEntryId) ?? null) : null,
      bEntry: m.bottomEntryId ? (entryMap.get(m.bottomEntryId) ?? null) : null,
      games: (m.games as { a: number; b: number }[] | null) ?? [],
      result: m.result ?? null,
      status: m.status,
      court: m.court ?? null,
      umpireId: m.umpireId ?? null,
      reportedBy: m.reportedBy ?? null,
      reportedAt: m.reportedAt ? m.reportedAt.toISOString() : null,
      confirmedBy: m.confirmedBy ?? null,
      confirmedAt: m.confirmedAt ? m.confirmedAt.toISOString() : null,
      flags: m.flags ?? [],
      format,
    };
  }

  async getEventMatches(eventId: string, query: EventMatchesQuery, user?: AuthUser) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: { tournament: { select: { status: true } } },
    });

    if (!event || (event.tournament.status === 'draft' && !isStaff(user))) {
      throw ApiException.notFound('ไม่พบประเภทการแข่งที่ต้องการ', 'EVENT_NOT_FOUND');
    }

    const where: Prisma.MatchWhereInput = {
      eventId,
      draw: { status: 'published' },
      ...(query.status ? { status: query.status } : {}),
      ...(query.stage ? { stage: query.stage } : {}),
      ...(query.round !== undefined ? { round: query.round } : {}),
    };

    const matches = await this.prisma.match.findMany({
      where,
      orderBy: [{ stage: 'asc' }, { groupId: 'asc' }, { round: 'asc' }, { matchNo: 'asc' }],
    });

    if (matches.length === 0) {
      return [];
    }

    const entryIds = Array.from(
      new Set(
        matches
          .flatMap((m) => [m.topEntryId, m.bottomEntryId])
          .filter((id): id is string => typeof id === 'string' && id.length > 0),
      ),
    );

    const entryMap = await this.loadEntryMap(this.prisma, entryIds);

    const groupFormat = resolveMatchFormat(event.format, 'group');
    const knockoutFormat = resolveMatchFormat(event.format, 'knockout');
    const formats: Record<string, MatchFormat> = {
      group: groupFormat,
      knockout: knockoutFormat,
      third_place: knockoutFormat,
    };

    return matches.map((m) => this.mapMatch(m, entryMap, formats[m.stage] ?? knockoutFormat));
  }

  async putMatchResult(matchId: string, body: PutMatchResultInput, caller: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      // 1. SELECT the match FOR UPDATE (raw query)
      const lockedRows = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM matches WHERE id = ${matchId}::uuid FOR UPDATE
      `;
      if (lockedRows.length === 0) {
        throw ApiException.notFound('ไม่พบแมตช์ที่ต้องการ', 'MATCH_NOT_FOUND');
      }

      // 2. Load match with event
      const match = await tx.match.findUnique({
        where: { id: matchId },
        include: {
          event: { select: { id: true, format: true } },
        },
      });
      if (!match) {
        throw ApiException.notFound('ไม่พบแมตช์ที่ต้องการ', 'MATCH_NOT_FOUND');
      }

      // 3. Resolve stage format
      const format = resolveMatchFormat(match.event.format, match.stage);

      // 4. Validate outcome and games
      let targetGames: [number, number][];
      if (body.outcome === 'walkover_a') {
        targetGames = walkoverGames(format, 'a');
      } else if (body.outcome === 'walkover_b') {
        targetGames = walkoverGames(format, 'b');
      } else if (body.outcome === 'played') {
        if (!body.games || body.games.length === 0) {
          throw ApiException.badRequest('VALIDATION_FAILED', 'ต้องระบุผลเกม');
        }
        targetGames = body.games.map((g) => [g.a, g.b]);
      } else {
        throw ApiException.badRequest('VALIDATION_FAILED', 'ประเภทผลการแข่งไม่ถูกต้อง');
      }

      // 5. Load entries, players, and active team memberships
      const entryIds = [match.topEntryId, match.bottomEntryId].filter(
        (id): id is string => typeof id === 'string' && id.length > 0,
      );

      const entryPlayers =
        entryIds.length > 0
          ? await tx.entryPlayer.findMany({
              where: { entryId: { in: entryIds } },
              select: { userId: true, teamId: true },
            })
          : [];

      const playerUserIds = Array.from(new Set(entryPlayers.map((p) => p.userId)));

      const now = new Date();
      const playerMemberships =
        playerUserIds.length > 0
          ? await tx.teamMembership.findMany({
              where: {
                userId: { in: playerUserIds },
                validFrom: { lte: now },
                OR: [{ validTo: null }, { validTo: { gt: now } }],
              },
              select: { teamId: true },
            })
          : [];

      const playerTeamIds = Array.from(
        new Set([
          ...entryPlayers
            .map((p) => p.teamId)
            .filter((t): t is string => typeof t === 'string' && t.length > 0),
          ...playerMemberships.map((m) => m.teamId),
        ]),
      );

      // 6. Check lock state (GroupStanding for match.groupId)
      let isLocked = false;
      if (match.groupId) {
        const standingsCount = await tx.groupStanding.count({
          where: { groupId: match.groupId },
        });
        isLocked = standingsCount > 0;
      }

      // 7. Determine actor
      const isCommittee = caller.roles.some((r) => r === 'Committee' || r === 'Admin');
      let actor: ResultActor;

      if (isCommittee) {
        actor = { kind: 'committee', userId: caller.id };
      } else {
        const eventUmpire = await tx.eventUmpire.findUnique({
          where: {
            eventId_userId: {
              eventId: match.eventId,
              userId: caller.id,
            },
          },
        });

        const callerMemberships = await tx.teamMembership.findMany({
          where: {
            userId: caller.id,
            validFrom: { lte: now },
            OR: [{ validTo: null }, { validTo: { gt: now } }],
          },
          select: { teamId: true },
        });
        const callerTeamIds = Array.from(new Set(callerMemberships.map((m) => m.teamId)));

        // courts: EventUmpire.courts, or [match.court] when courts is empty; no EventUmpire row -> courts []
        let courts: string[] = [];
        if (eventUmpire) {
          if (eventUmpire.courts.length > 0) {
            courts = eventUmpire.courts;
          } else {
            courts = match.court ? [match.court] : [];
          }
        }

        actor = {
          kind: 'umpire',
          userId: caller.id,
          teamIds: callerTeamIds,
          courts,
        };
      }

      // 8. Determine action
      let action: ResultAction;
      let actionType: 'report' | 'enter' | 'correct';

      if (!isCommittee) {
        actionType = 'report';
        action = { type: 'report', games: targetGames };
      } else {
        if (match.status === 'confirmed') {
          actionType = 'correct';
          action = { type: 'correct', games: targetGames, reason: body.reason ?? '' };
        } else {
          actionType = 'enter';
          action = { type: 'enter', games: targetGames };
        }
      }

      // 9. Build ResultMatch
      const currentGames = Array.isArray(match.games)
        ? (match.games as Array<{ a: number; b: number }>).map(
            (g) => [g.a, g.b] as [number, number],
          )
        : null;

      const resultMatch: ResultMatch = {
        status:
          match.status === 'confirmed'
            ? 'confirmed'
            : match.status === 'reported'
              ? 'reported'
              : 'scheduled',
        games: currentGames,
        playerIds: playerUserIds,
        playerTeamIds,
        umpireId: match.umpireId,
        court: match.court,
        reportedBy: match.reportedBy,
        version: match.resultVersion,
        flags: (match.flags as MatchFlag[]) ?? [],
        locked: isLocked,
      };

      // 10. Execute matchResultTransition
      const transition = matchResultTransition(resultMatch, actor, action, format);

      if (!transition.ok) {
        if (
          transition.code === 'GAME_SCORE_INVALID' ||
          transition.code === 'GAMES_INCOMPLETE' ||
          transition.code === 'GAMES_EXTRA' ||
          transition.code === 'DRAW_NOT_ALLOWED'
        ) {
          const scoreCheck = validateMatchScore(targetGames, format);
          const details = !scoreCheck.ok
            ? {
                code: scoreCheck.code,
                ...(scoreCheck.gameIndex !== undefined ? { gameIndex: scoreCheck.gameIndex } : {}),
              }
            : { code: transition.code };
          throw new ApiException(
            HttpStatus.UNPROCESSABLE_ENTITY,
            'MATCH_SCORE_INVALID',
            transition.message,
            details,
          );
        }

        if (transition.code === 'MATCH_LOCKED') {
          throw ApiException.conflict('STAGE_CONFIRMED', transition.message);
        }

        if (
          (transition.code === 'MATCH_NOT_REPORTABLE' ||
            transition.code === 'MATCH_NOT_SCHEDULED') &&
          match.status === 'confirmed'
        ) {
          throw ApiException.conflict('MATCH_ALREADY_CONFIRMED', transition.message);
        }

        if (transition.code === 'UMPIRE_IS_PLAYER') {
          throw ApiException.forbidden(transition.message, 'UMPIRE_OWN_MATCH');
        }

        if (transition.code === 'UMPIRE_NOT_ASSIGNED') {
          throw ApiException.forbidden(transition.message, 'UMPIRE_NOT_ASSIGNED');
        }

        if (transition.code === 'REASON_REQUIRED') {
          throw ApiException.badRequest('VALIDATION_FAILED', transition.message);
        }

        if (transition.code === 'FORBIDDEN') {
          throw ApiException.forbidden(transition.message, 'FORBIDDEN');
        }

        throw ApiException.conflict(transition.code, transition.message);
      }

      // 11. Determine winner and result enum
      let result: 'a_win' | 'b_win' | 'draw' | 'walkover_a' | 'walkover_b';
      let winnerEntryId: string | null = null;

      if (body.outcome === 'walkover_a') {
        result = 'walkover_a';
        winnerEntryId = match.topEntryId;
      } else if (body.outcome === 'walkover_b') {
        result = 'walkover_b';
        winnerEntryId = match.bottomEntryId;
      } else {
        const scoreVal = validateMatchScore(targetGames, format);
        if (scoreVal.ok) {
          if (scoreVal.winner === 'a') {
            result = 'a_win';
            winnerEntryId = match.topEntryId;
          } else if (scoreVal.winner === 'b') {
            result = 'b_win';
            winnerEntryId = match.bottomEntryId;
          } else {
            result = 'draw';
            winnerEntryId = null;
          }
        } else {
          throw new ApiException(
            HttpStatus.UNPROCESSABLE_ENTITY,
            'MATCH_SCORE_INVALID',
            scoreVal.message,
          );
        }
      }

      // 12. Write back
      const nextMatch = transition.match;
      const gamesJson = targetGames.map(([a, b]) => ({ a, b }));

      const updateData: Prisma.MatchUpdateInput = {
        games: gamesJson,
        result,
        winnerEntryId,
        status: nextMatch.status,
        resultVersion: nextMatch.version,
        flags: nextMatch.flags,
        ...(nextMatch.status === 'reported' ? { reportedBy: caller.id, reportedAt: now } : {}),
        ...(nextMatch.status === 'confirmed' ? { confirmedBy: caller.id, confirmedAt: now } : {}),
      };

      const updated = await tx.match.update({
        where: { id: matchId },
        data: updateData,
      });

      // 13. Audit record
      await this.audit.record(
        {
          actorId: caller.id,
          action: `match.result.${actionType}`,
          entityType: 'match',
          entityId: match.id,
          before: {
            games: match.games,
            result: match.result,
            status: match.status,
            flags: match.flags,
            resultVersion: match.resultVersion,
            reportedBy: match.reportedBy,
            confirmedBy: match.confirmedBy,
          },
          after: {
            games: updated.games,
            result: updated.result,
            status: updated.status,
            flags: updated.flags,
            resultVersion: updated.resultVersion,
            reportedBy: updated.reportedBy,
            confirmedBy: updated.confirmedBy,
          },
          reason: body.reason,
        },
        tx,
      );

      // 14. Return mapped Match
      const entryMap = await this.loadEntryMap(tx, entryIds);
      return this.mapMatch(updated, entryMap, format);
    });
  }
}
