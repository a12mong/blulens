import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthUser } from '../../common/auth/auth.types';
import { ApiException } from '../../common/errors/api.exception';
import { PrismaService } from '../../common/prisma/prisma.service';
import { resolveMatchFormat, type MatchFormat } from '@blulens/shared';

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

const isStaff = (u?: AuthUser) => !!u?.roles.some((r) => r === 'Committee' || r === 'Admin');

@Injectable()
export class MatchesService {
  constructor(private readonly prisma: PrismaService) {}

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

    const entries =
      entryIds.length > 0
        ? await this.prisma.entry.findMany({
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
          })
        : [];

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

    const groupFormat = resolveMatchFormat(event.format, 'group');
    const knockoutFormat = resolveMatchFormat(event.format, 'knockout');
    const formats: Record<string, MatchFormat> = {
      group: groupFormat,
      knockout: knockoutFormat,
      third_place: knockoutFormat,
    };

    return matches.map((m) => ({
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
      format: formats[m.stage] ?? knockoutFormat,
    }));
  }
}
