import { HttpStatus, Injectable } from '@nestjs/common';
import { Match, Prisma } from '@prisma/client';
import type { AuthUser } from '../../common/auth/auth.types';
import { AuditService } from '../../common/audit/audit.service';
import { ApiException } from '../../common/errors/api.exception';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  computeGroupStandings,
  eventFormatSchema,
  matchResultTransition,
  rankBestThirds,
  resolveMatchFormat,
  validateMatchScore,
  walkoverGames,
  type GroupInput,
  type GroupMatch,
  type MatchFlag,
  type MatchFormat,
  type ResultAction,
  type ResultActor,
  type ResultMatch,
  type StandingRow,
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

export interface EventGroupsQuery {
  draw?: 'published' | 'preview';
}

export interface EventGroupMember {
  entryId: string;
  seedInGroup: number;
  pot: number;
  entry: EntryRef | null;
}

export interface MappedMatch {
  id: string;
  stage: string;
  groupId: string | null;
  round: number;
  a: string | null;
  b: string | null;
  aEntry: EntryRef | null;
  bEntry: EntryRef | null;
  games: { a: number; b: number }[];
  result: string | null;
  status: string;
  court: string | null;
  umpireId: string | null;
  reportedBy: string | null;
  reportedByName: string | null;
  reportedAt: string | null;
  confirmedBy: string | null;
  confirmedAt: string | null;
  flags: unknown[];
  format: MatchFormat;
}

export interface EventGroup {
  id: string;
  label: string;
  members: EventGroupMember[];
  matches: MappedMatch[];
}

export interface UmpireMatchesQuery {
  status?: 'scheduled' | 'reported' | 'confirmed';
}

export interface EventGroupStanding {
  groupId: string;
  entryId: string;
  entry: EntryRef | null;
  rank: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
  pointsFor: number;
  pointsAgainst: number;
  diff: number;
  tiebreakNote: string | null;
  qualification: 'qualified' | 'best_third' | 'best_third_contender' | 'out';
  confirmed: boolean;
}

export interface PutMatchResultInput {
  outcome: 'played' | 'walkover_a' | 'walkover_b';
  games?: { a: number; b: number }[];
  reason?: string;
}

export interface PatchMatchAssignmentInput {
  court?: string | null;
  umpireId?: string | null;
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

  private async loadUserNames(
    userIds: string[],
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<Map<string, string>> {
    const validIds = Array.from(
      new Set(userIds.filter((id): id is string => typeof id === 'string' && id.length > 0)),
    );
    if (validIds.length === 0) {
      return new Map();
    }

    const users = await client.user.findMany({
      where: { id: { in: validIds } },
      select: { id: true, displayName: true },
    });

    const userMap = new Map<string, string>();
    for (const u of users) {
      userMap.set(u.id, u.displayName);
    }
    return userMap;
  }

  private mapMatch(
    m: Match,
    entryMap: Map<string, EntryRef>,
    format: MatchFormat,
    userNames?: Map<string, string>,
  ): MappedMatch {
    const reportedByName = m.reportedBy && userNames ? (userNames.get(m.reportedBy) ?? null) : null;
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
      reportedByName,
      reportedAt: m.reportedAt ? m.reportedAt.toISOString() : null,
      confirmedBy: m.confirmedBy ?? null,
      confirmedAt: m.confirmedAt ? m.confirmedAt.toISOString() : null,
      flags: m.flags ?? [],
      format,
    };
  }

  private parseGames(raw: unknown): [number, number][] {
    if (!Array.isArray(raw)) return [];
    return raw.map((item) => {
      if (Array.isArray(item) && item.length >= 2) {
        return [Number(item[0]), Number(item[1])] as [number, number];
      }
      if (item && typeof item === 'object') {
        const g = item as { a?: unknown; b?: unknown };
        return [Number(g.a ?? 0), Number(g.b ?? 0)] as [number, number];
      }
      return [0, 0] as [number, number];
    });
  }

  private computeGroupLiveRows(
    group: {
      members: Array<{ entryId: string }>;
      matches: Array<{
        topEntryId: string | null;
        bottomEntryId: string | null;
        status: string;
        games: unknown;
      }>;
    },
    pointsCfg: { win: number; draw: number; loss: number },
    seed: string,
  ): StandingRow[] {
    const entryIds = group.members.map((m) => m.entryId);
    const groupMatches: GroupMatch[] = group.matches.map((m) => ({
      a: m.topEntryId ?? '',
      b: m.bottomEntryId ?? '',
      status: m.status as GroupMatch['status'],
      games: this.parseGames(m.games),
    }));

    return computeGroupStandings(entryIds, groupMatches, pointsCfg, seed);
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
      draw: { status: { in: ['published', 'locked'] } },
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
    const userNames = await this.loadUserNames(
      matches
        .map((m) => m.reportedBy)
        .filter((id): id is string => typeof id === 'string' && id.length > 0),
    );

    const groupFormat = resolveMatchFormat(event.format, 'group');
    const knockoutFormat = resolveMatchFormat(event.format, 'knockout');
    const formats: Record<string, MatchFormat> = {
      group: groupFormat,
      knockout: knockoutFormat,
      third_place: knockoutFormat,
    };

    return matches.map((m) =>
      this.mapMatch(m, entryMap, formats[m.stage] ?? knockoutFormat, userNames),
    );
  }

  async getEventStandings(eventId: string, user?: AuthUser): Promise<EventGroupStanding[]> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: { tournament: { select: { status: true } } },
    });

    if (!event || (event.tournament.status === 'draft' && !isStaff(user))) {
      throw ApiException.notFound('ไม่พบประเภทการแข่งที่ต้องการ', 'EVENT_NOT_FOUND');
    }

    const draw = await this.prisma.draw.findFirst({
      where: { eventId, kind: 'group', status: { in: ['published', 'locked'] } },
      orderBy: { version: 'desc' },
    });

    if (!draw) {
      return [];
    }

    // Parse format once with defaults on failure
    let advancePerGroup = 2;
    let bestThirds = 0;
    let pointsCfg = { win: 3, draw: 1, loss: 0 };

    const parsed = eventFormatSchema.safeParse(event.format);
    if (parsed.success) {
      advancePerGroup = parsed.data.advancePerGroup;
      bestThirds = parsed.data.bestThirds;
      if (parsed.data.points) {
        pointsCfg = parsed.data.points;
      }
    } else if (event.format && typeof event.format === 'object') {
      const raw = event.format as Record<string, unknown>;
      if (typeof raw.advancePerGroup === 'number') advancePerGroup = raw.advancePerGroup;
      if (typeof raw.bestThirds === 'number') bestThirds = raw.bestThirds;
      if (raw.points && typeof raw.points === 'object') {
        const rawPts = raw.points as Record<string, unknown>;
        pointsCfg = {
          win: typeof rawPts.win === 'number' ? rawPts.win : 3,
          draw: typeof rawPts.draw === 'number' ? rawPts.draw : 1,
          loss: typeof rawPts.loss === 'number' ? rawPts.loss : 0,
        };
      }
    }

    // Query groups ordered by label
    const groups = await this.prisma.group.findMany({
      where: { drawId: draw.id },
      orderBy: { label: 'asc' },
      include: {
        members: { select: { entryId: true } },
        standings: { orderBy: { rank: 'asc' } },
        matches: {
          select: {
            id: true,
            topEntryId: true,
            bottomEntryId: true,
            status: true,
            games: true,
          },
        },
      },
    });

    if (groups.length === 0) {
      return [];
    }

    // Load all entry IDs in one query (no N+1)
    const allEntryIds = Array.from(
      new Set(
        groups.flatMap((g) => [
          ...g.members.map((m) => m.entryId),
          ...g.standings.map((s) => s.entryId),
        ]),
      ),
    );
    const entryMap = await this.loadEntryMap(this.prisma, allEntryIds);

    const result: EventGroupStanding[] = [];

    for (const group of groups) {
      if (group.standings.length > 0) {
        // Snapshot exists: map confirmed standings
        for (const s of group.standings) {
          result.push({
            groupId: group.id,
            entryId: s.entryId,
            entry: entryMap.get(s.entryId) ?? null,
            rank: s.rank,
            played: s.played,
            won: s.won,
            drawn: s.drawn,
            lost: s.lost,
            points: s.points,
            pointsFor: s.pointsFor,
            pointsAgainst: s.pointsAgainst,
            diff: s.diff,
            tiebreakNote: s.tiebreakNote,
            qualification: s.qualification,
            confirmed: true,
          });
        }
      } else {
        // Live calculation: compute live standings from matches
        const liveRows = this.computeGroupLiveRows(group, pointsCfg, draw.seed);

        for (const row of liveRows) {
          let qualification: 'qualified' | 'best_third_contender' | 'out';
          if (row.rank <= advancePerGroup) {
            qualification = 'qualified';
          } else if (row.rank === advancePerGroup + 1 && bestThirds > 0) {
            qualification = 'best_third_contender';
          } else {
            qualification = 'out';
          }

          const tiebreakNote = row.decidedBy === 'points' || !row.decidedBy ? null : row.decidedBy;

          result.push({
            groupId: group.id,
            entryId: row.entryId,
            entry: entryMap.get(row.entryId) ?? null,
            rank: row.rank,
            played: row.played,
            won: row.won,
            drawn: row.drawn,
            lost: row.lost,
            points: row.points,
            pointsFor: row.pointsFor,
            pointsAgainst: row.pointsAgainst,
            diff: row.diff,
            tiebreakNote,
            qualification,
            confirmed: false,
          });
        }
      }
    }

    return result;
  }

  async getEventGroups(
    eventId: string,
    query: EventGroupsQuery,
    user?: AuthUser,
  ): Promise<EventGroup[]> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: { tournament: { select: { status: true } } },
    });

    if (!event || (event.tournament.status === 'draft' && !isStaff(user))) {
      throw ApiException.notFound('ไม่พบประเภทการแข่งที่ต้องการ', 'EVENT_NOT_FOUND');
    }

    if (query.draw === 'preview' && !isStaff(user)) {
      throw ApiException.forbidden('ไม่อนุญาตให้ดูตัวอย่างผลการจับสลาก', 'FORBIDDEN');
    }

    const isPreview = query.draw === 'preview';
    const draw = await this.prisma.draw.findFirst({
      where: {
        eventId,
        kind: 'group',
        status: isPreview ? 'preview' : { in: ['published', 'locked'] },
      },
      orderBy: { version: 'desc' },
    });

    if (!draw) {
      return [];
    }

    const groups = await this.prisma.group.findMany({
      where: { drawId: draw.id },
      orderBy: { label: 'asc' },
      include: {
        members: {
          orderBy: { seedInGroup: 'asc' },
        },
        matches: {
          orderBy: [{ round: 'asc' }, { matchNo: 'asc' }],
        },
      },
    });

    if (groups.length === 0) {
      return [];
    }

    const allEntryIds = Array.from(
      new Set(
        [
          ...groups.flatMap((g) => g.members.map((m) => m.entryId)),
          ...groups.flatMap((g) => g.matches.flatMap((m) => [m.topEntryId, m.bottomEntryId])),
        ].filter((id): id is string => typeof id === 'string' && id.length > 0),
      ),
    );

    const entryMap = await this.loadEntryMap(this.prisma, allEntryIds);
    const userNames = await this.loadUserNames(
      groups.flatMap((g) =>
        g.matches
          .map((m) => m.reportedBy)
          .filter((id): id is string => typeof id === 'string' && id.length > 0),
      ),
    );
    const groupFormat = resolveMatchFormat(event.format, 'group');

    return groups.map((g) => ({
      id: g.id,
      label: g.label,
      members: g.members.map((m) => ({
        entryId: m.entryId,
        seedInGroup: m.seedInGroup,
        pot: m.pot,
        entry: entryMap.get(m.entryId) ?? null,
      })),
      matches: g.matches.map((m) => this.mapMatch(m, entryMap, groupFormat, userNames)),
    }));
  }

  async confirmEventGroups(eventId: string, user: AuthUser): Promise<EventGroupStanding[]> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: { tournament: { select: { status: true } } },
    });

    if (!event) {
      throw ApiException.notFound('ไม่พบประเภทการแข่งที่ต้องการ', 'EVENT_NOT_FOUND');
    }

    const existingDraw = await this.prisma.draw.findFirst({
      where: {
        eventId,
        kind: 'group',
        status: { in: ['published', 'locked'] },
      },
      orderBy: { version: 'desc' },
    });

    if (!existingDraw) {
      throw ApiException.conflict(
        'NO_PUBLISHED_GROUP_DRAW',
        'ยังไม่มีการเผยแพร่สายการแข่งขันรอบแบ่งกลุ่ม',
      );
    }

    if (existingDraw.status === 'locked') {
      throw ApiException.conflict(
        'DRAW_ALREADY_LOCKED',
        'ผลรอบแบ่งกลุ่มได้รับการยืนยันและล็อคแล้ว',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Lock the draw row FOR UPDATE
      const lockedRows = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM draws WHERE id = ${existingDraw.id}::uuid FOR UPDATE
      `;
      if (lockedRows.length === 0) {
        throw ApiException.conflict(
          'NO_PUBLISHED_GROUP_DRAW',
          'ยังไม่มีการเผยแพร่สายการแข่งขันรอบแบ่งกลุ่ม',
        );
      }

      const draw = await tx.draw.findUnique({
        where: { id: existingDraw.id },
      });

      if (!draw || draw.status !== 'published') {
        if (draw?.status === 'locked') {
          throw ApiException.conflict(
            'DRAW_ALREADY_LOCKED',
            'ผลรอบแบ่งกลุ่มได้รับการยืนยันและล็อคแล้ว',
          );
        }
        throw ApiException.conflict(
          'NO_PUBLISHED_GROUP_DRAW',
          'ยังไม่มีการเผยแพร่สายการแข่งขันรอบแบ่งกลุ่ม',
        );
      }

      // 2. Check for incomplete matches (scheduled or reported)
      const incompleteCount = await tx.match.count({
        where: {
          drawId: draw.id,
          status: { in: ['scheduled', 'reported'] },
        },
      });

      if (incompleteCount > 0) {
        throw new ApiException(
          HttpStatus.CONFLICT,
          'GROUP_MATCHES_INCOMPLETE',
          `ยังมีแมตช์ในรอบแบ่งกลุ่มที่ยังไม่เสร็จสิ้น (${incompleteCount} แมตช์)`,
          { count: incompleteCount, incompleteCount },
        );
      }

      // 3. Parse event format
      let advancePerGroup = 2;
      let bestThirds = 0;
      let pointsCfg = { win: 3, draw: 1, loss: 0 };

      const parsed = eventFormatSchema.safeParse(event.format);
      if (parsed.success) {
        advancePerGroup = parsed.data.advancePerGroup;
        bestThirds = parsed.data.bestThirds;
        if (parsed.data.points) {
          pointsCfg = parsed.data.points;
        }
      } else if (event.format && typeof event.format === 'object') {
        const raw = event.format as Record<string, unknown>;
        if (typeof raw.advancePerGroup === 'number') advancePerGroup = raw.advancePerGroup;
        if (typeof raw.bestThirds === 'number') bestThirds = raw.bestThirds;
        if (raw.points && typeof raw.points === 'object') {
          const rawPts = raw.points as Record<string, unknown>;
          pointsCfg = {
            win: typeof rawPts.win === 'number' ? rawPts.win : 3,
            draw: typeof rawPts.draw === 'number' ? rawPts.draw : 1,
            loss: typeof rawPts.loss === 'number' ? rawPts.loss : 0,
          };
        }
      }

      // 4. Fetch groups with members and matches
      const groups = await tx.group.findMany({
        where: { drawId: draw.id },
        orderBy: { label: 'asc' },
        include: {
          members: { select: { entryId: true } },
          matches: {
            select: {
              topEntryId: true,
              bottomEntryId: true,
              status: true,
              games: true,
            },
          },
        },
      });

      let bestThirdEntryIds = new Set<string>();
      if (bestThirds > 0) {
        const groupInputs: GroupInput[] = groups.map((g, idx) => ({
          groupIndex: idx,
          entryIds: g.members.map((m) => m.entryId),
          matches: g.matches.map((m) => ({
            a: m.topEntryId ?? '',
            b: m.bottomEntryId ?? '',
            status: m.status as GroupMatch['status'],
            games: this.parseGames(m.games),
          })),
        }));

        const bestThirdRows = rankBestThirds(groupInputs, pointsCfg, draw.seed);
        bestThirdEntryIds = new Set(bestThirdRows.slice(0, bestThirds).map((r) => r.entryId));
      }

      const now = new Date();
      interface StandingsRecordToCreate {
        groupId: string;
        entryId: string;
        rank: number;
        played: number;
        won: number;
        drawn: number;
        lost: number;
        points: number;
        pointsFor: number;
        pointsAgainst: number;
        diff: number;
        tiebreakNote: string | null;
        qualification: 'qualified' | 'best_third' | 'out';
      }

      const rowsToCreate: StandingsRecordToCreate[] = [];

      for (const group of groups) {
        const liveRows = this.computeGroupLiveRows(group, pointsCfg, draw.seed);

        for (const row of liveRows) {
          let qualification: 'qualified' | 'best_third' | 'out';
          if (row.rank <= advancePerGroup) {
            qualification = 'qualified';
          } else if (bestThirdEntryIds.has(row.entryId)) {
            qualification = 'best_third';
          } else {
            qualification = 'out';
          }

          const tiebreakNote = row.decidedBy === 'points' || !row.decidedBy ? null : row.decidedBy;

          rowsToCreate.push({
            groupId: group.id,
            entryId: row.entryId,
            rank: row.rank,
            played: row.played,
            won: row.won,
            drawn: row.drawn,
            lost: row.lost,
            points: row.points,
            pointsFor: row.pointsFor,
            pointsAgainst: row.pointsAgainst,
            diff: row.diff,
            tiebreakNote,
            qualification,
          });
        }
      }

      // 5. Create GroupStanding rows in DB
      if (rowsToCreate.length > 0) {
        await tx.groupStanding.createMany({
          data: rowsToCreate.map((r) => ({
            groupId: r.groupId,
            entryId: r.entryId,
            rank: r.rank,
            played: r.played,
            won: r.won,
            drawn: r.drawn,
            lost: r.lost,
            points: r.points,
            pointsFor: r.pointsFor,
            pointsAgainst: r.pointsAgainst,
            diff: r.diff,
            tiebreakNote: r.tiebreakNote,
            qualification: r.qualification,
            confirmedBy: user.id,
            confirmedAt: now,
          })),
        });
      }

      // 6. Update draw status to 'locked'
      await tx.draw.update({
        where: { id: draw.id },
        data: { status: 'locked' },
      });

      // 7. Audit log 'groups.confirm'
      await this.audit.record(
        {
          actorId: user.id,
          action: 'groups.confirm',
          entityType: 'draw',
          entityId: draw.id,
          before: { status: draw.status },
          after: { status: 'locked' },
        },
        tx,
      );

      // 8. Return mapped rows with entry details and confirmed: true
      const allEntryIds = rowsToCreate.map((r) => r.entryId);
      const entryMap = await this.loadEntryMap(tx, allEntryIds);

      return rowsToCreate.map((r) => ({
        groupId: r.groupId,
        entryId: r.entryId,
        entry: entryMap.get(r.entryId) ?? null,
        rank: r.rank,
        played: r.played,
        won: r.won,
        drawn: r.drawn,
        lost: r.lost,
        points: r.points,
        pointsFor: r.pointsFor,
        pointsAgainst: r.pointsAgainst,
        diff: r.diff,
        tiebreakNote: r.tiebreakNote,
        qualification: r.qualification,
        confirmed: true,
      }));
    });
  }

  async getUmpireMatches(query: UmpireMatchesQuery, caller: AuthUser) {
    // 1. Fetch caller's EventUmpire rows
    const eventUmpires = await this.prisma.eventUmpire.findMany({
      where: { userId: caller.id },
    });

    // 2. Build assignment OR conditions
    const assignmentConditions: Prisma.MatchWhereInput[] = [{ umpireId: caller.id }];

    const allCourtsEventIds = eventUmpires
      .filter((eu) => eu.courts.length === 0)
      .map((eu) => eu.eventId);

    if (allCourtsEventIds.length > 0) {
      assignmentConditions.push({ eventId: { in: allCourtsEventIds } });
    }

    for (const eu of eventUmpires) {
      if (eu.courts.length > 0) {
        assignmentConditions.push({
          eventId: eu.eventId,
          court: { in: eu.courts },
        });
      }
    }

    // 3. Exclude matches where caller is one of the players
    const playerEntries = await this.prisma.entryPlayer.findMany({
      where: { userId: caller.id },
      select: { entryId: true },
    });
    const playerEntryIds = Array.from(new Set(playerEntries.map((e) => e.entryId)));

    const playerExclusion: Prisma.MatchWhereInput =
      playerEntryIds.length > 0
        ? {
            NOT: [
              { topEntryId: { in: playerEntryIds } },
              { bottomEntryId: { in: playerEntryIds } },
            ],
          }
        : {};

    // 4. Query matches
    const where: Prisma.MatchWhereInput = {
      draw: { status: { in: ['published', 'locked'] } },
      OR: assignmentConditions,
      ...(query.status ? { status: query.status } : {}),
      ...playerExclusion,
    };

    const matches = await this.prisma.match.findMany({
      where,
      orderBy: [{ eventId: 'asc' }, { stage: 'asc' }, { round: 'asc' }, { matchNo: 'asc' }],
    });

    if (matches.length === 0) {
      return [];
    }

    // Double-check player exclusion in memory
    const eligibleMatches =
      playerEntryIds.length > 0
        ? matches.filter(
            (m) =>
              !(m.topEntryId && playerEntryIds.includes(m.topEntryId)) &&
              !(m.bottomEntryId && playerEntryIds.includes(m.bottomEntryId)),
          )
        : matches;

    if (eligibleMatches.length === 0) {
      return [];
    }

    // 5. Load formats once per event (no N+1)
    const eventIds = Array.from(new Set(eligibleMatches.map((m) => m.eventId)));
    const events = await this.prisma.event.findMany({
      where: { id: { in: eventIds } },
      select: { id: true, format: true },
    });

    const eventFormatMap = new Map<
      string,
      { group: MatchFormat; knockout: MatchFormat; third_place: MatchFormat }
    >();
    for (const ev of events) {
      const groupFormat = resolveMatchFormat(ev.format, 'group');
      const knockoutFormat = resolveMatchFormat(ev.format, 'knockout');
      eventFormatMap.set(ev.id, {
        group: groupFormat,
        knockout: knockoutFormat,
        third_place: knockoutFormat,
      });
    }

    // 6. Load entries in single query
    const entryIds = Array.from(
      new Set(
        eligibleMatches
          .flatMap((m) => [m.topEntryId, m.bottomEntryId])
          .filter((id): id is string => typeof id === 'string' && id.length > 0),
      ),
    );
    const entryMap = await this.loadEntryMap(this.prisma, entryIds);
    const userNames = await this.loadUserNames(
      eligibleMatches
        .map((m) => m.reportedBy)
        .filter((id): id is string => typeof id === 'string' && id.length > 0),
    );

    // 7. Map and return
    return eligibleMatches.map((m) => {
      const formats = eventFormatMap.get(m.eventId);
      let format: MatchFormat;
      if (formats) {
        format = m.stage === 'group' ? formats.group : formats.knockout;
      } else {
        format = resolveMatchFormat(null, m.stage);
      }
      return this.mapMatch(m, entryMap, format, userNames);
    });
  }

  private handleTransitionError(
    transition: { ok: false; code: string; message: string },
    match: Match,
    targetGames?: [number, number][],
    format?: MatchFormat,
  ): never {
    if (
      transition.code === 'GAME_SCORE_INVALID' ||
      transition.code === 'GAMES_INCOMPLETE' ||
      transition.code === 'GAMES_EXTRA' ||
      transition.code === 'DRAW_NOT_ALLOWED'
    ) {
      const scoreCheck = targetGames && format ? validateMatchScore(targetGames, format) : null;
      const details =
        scoreCheck && !scoreCheck.ok
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

    if (transition.code === 'MATCH_NOT_REPORTED') {
      throw ApiException.conflict('MATCH_NOT_REPORTED', transition.message);
    }

    if (
      (transition.code === 'MATCH_NOT_REPORTABLE' || transition.code === 'MATCH_NOT_SCHEDULED') &&
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

  private async applyResultAction(
    matchId: string,
    caller: AuthUser,
    executeAction: (ctx: {
      match: Match & { event: { id: string; format: unknown } };
      format: MatchFormat;
      entryIds: string[];
      isLocked: boolean;
      actor: ResultActor;
      resultMatch: ResultMatch;
      now: Date;
    }) => {
      updateData: Prisma.MatchUpdateInput;
      auditAction: string;
      reason?: string;
    },
  ) {
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

      // 4. Load entries, players, and active team memberships
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

      // 5. Check lock state (GroupStanding for match.groupId)
      let isLocked = false;
      if (match.groupId) {
        const standingsCount = await tx.groupStanding.count({
          where: { groupId: match.groupId },
        });
        isLocked = standingsCount > 0;
      }

      // 6. Determine actor
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

      // 7. Build ResultMatch
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

      // 8. Execute action-specific handler
      const { updateData, auditAction, reason } = executeAction({
        match,
        format,
        entryIds,
        isLocked,
        actor,
        resultMatch,
        now,
      });

      // 9. Update match in DB
      const updated = await tx.match.update({
        where: { id: matchId },
        data: updateData,
      });

      // 10. Record audit entry
      await this.audit.record(
        {
          actorId: caller.id,
          action: auditAction,
          entityType: 'match',
          entityId: match.id,
          before: {
            games: match.games,
            result: match.result,
            status: match.status,
            flags: match.flags,
            resultVersion: match.resultVersion,
            reportedBy: match.reportedBy,
            reportedAt: match.reportedAt,
            confirmedBy: match.confirmedBy,
            confirmedAt: match.confirmedAt,
          },
          after: {
            games: updated.games,
            result: updated.result,
            status: updated.status,
            flags: updated.flags,
            resultVersion: updated.resultVersion,
            reportedBy: updated.reportedBy,
            reportedAt: updated.reportedAt,
            confirmedBy: updated.confirmedBy,
            confirmedAt: updated.confirmedAt,
          },
          reason,
        },
        tx,
      );

      // 11. Return mapped Match
      const entryMap = await this.loadEntryMap(tx, entryIds);
      const userNames = await this.loadUserNames(
        updated.reportedBy ? [updated.reportedBy] : [],
        tx,
      );
      return this.mapMatch(updated, entryMap, format, userNames);
    });
  }

  async putMatchResult(matchId: string, body: PutMatchResultInput, caller: AuthUser) {
    return this.applyResultAction(matchId, caller, ({ match, format, actor, resultMatch, now }) => {
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

      const isCommittee = actor.kind === 'committee';
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

      const transition = matchResultTransition(resultMatch, actor, action, format);
      if (!transition.ok) {
        this.handleTransitionError(transition, match, targetGames, format);
      }

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

      return {
        updateData,
        auditAction: `match.result.${actionType}`,
        reason: body.reason,
      };
    });
  }

  async approveMatchResult(matchId: string, caller: AuthUser) {
    return this.applyResultAction(
      matchId,
      caller,
      ({ match, format, isLocked, actor, resultMatch, now }) => {
        if (isLocked) {
          throw ApiException.conflict(
            'STAGE_CONFIRMED',
            'รอบแบ่งกลุ่มได้รับการยืนยันผลแล้ว ไม่สามารถแก้ไขได้',
          );
        }

        const transition = matchResultTransition(resultMatch, actor, { type: 'confirm' }, format);
        if (!transition.ok) {
          this.handleTransitionError(transition, match);
        }

        const nextMatch = transition.match;
        const updateData: Prisma.MatchUpdateInput = {
          status: nextMatch.status,
          confirmedBy: caller.id,
          confirmedAt: now,
        };

        return {
          updateData,
          auditAction: 'match.result.approve',
        };
      },
    );
  }

  async rejectMatchResult(matchId: string, reason: string, caller: AuthUser) {
    return this.applyResultAction(
      matchId,
      caller,
      ({ match, format, isLocked, actor, resultMatch }) => {
        if (isLocked) {
          throw ApiException.conflict(
            'STAGE_CONFIRMED',
            'รอบแบ่งกลุ่มได้รับการยืนยันผลแล้ว ไม่สามารถแก้ไขได้',
          );
        }

        const transition = matchResultTransition(
          resultMatch,
          actor,
          { type: 'reject', reason },
          format,
        );
        if (!transition.ok) {
          this.handleTransitionError(transition, match);
        }

        const nextMatch = transition.match;
        const updateData: Prisma.MatchUpdateInput = {
          status: nextMatch.status,
          games: Prisma.DbNull,
          result: null,
          winnerEntryId: null,
          reportedBy: null,
          reportedAt: null,
          flags: nextMatch.flags,
        };

        return {
          updateData,
          auditAction: 'match.result.reject',
          reason,
        };
      },
    );
  }

  async patchMatchAssignment(
    matchId: string,
    body: PatchMatchAssignmentInput,
    caller: AuthUser,
  ): Promise<MappedMatch> {
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

      // 3. Check stage confirmed or result confirmed -> 409 MATCH_LOCKED
      if (match.status === 'confirmed') {
        throw ApiException.conflict(
          'MATCH_LOCKED',
          'ผลการแข่งขันได้รับการยืนยันแล้ว ไม่สามารถแก้ไขได้',
        );
      }
      if (match.groupId) {
        const standingsCount = await tx.groupStanding.count({
          where: { groupId: match.groupId },
        });
        if (standingsCount > 0) {
          throw ApiException.conflict(
            'MATCH_LOCKED',
            'รอบแบ่งกลุ่มได้รับการยืนยันผลแล้ว ไม่สามารถแก้ไขได้',
          );
        }
      }

      // 4. Validate umpireId if set
      if (body.umpireId !== undefined && body.umpireId !== null) {
        const umpireUser = await tx.user.findUnique({
          where: { id: body.umpireId },
          include: {
            roles: { select: { role: true } },
          },
        });

        if (
          !umpireUser ||
          umpireUser.status === 'disabled' ||
          umpireUser.deletedAt !== null ||
          !umpireUser.roles.some((r) => r.role === 'Umpire')
        ) {
          throw ApiException.conflict(
            'UMPIRE_NOT_ELIGIBLE',
            'กรรมการไม่ถูกต้อง หรือไม่มีสิทธิ์ทำหน้าที่กรรมการ',
          );
        }

        // Check if umpire is a player of either entry
        const entryIds = [match.topEntryId, match.bottomEntryId].filter(
          (id): id is string => typeof id === 'string' && id.length > 0,
        );

        if (entryIds.length > 0) {
          const isPlayer = await tx.entryPlayer.findFirst({
            where: {
              entryId: { in: entryIds },
              userId: body.umpireId,
            },
          });
          if (isPlayer) {
            throw ApiException.conflict(
              'UMPIRE_IS_PLAYER',
              'กรรมการเป็นผู้เล่นในแมตช์นี้ ไม่สามารถทำหน้าที่ได้',
            );
          }
        }
      }

      // 5. Update only the given fields
      const updateData: Prisma.MatchUpdateInput = {};
      if (body.court !== undefined) {
        updateData.court = body.court;
      }
      if (body.umpireId !== undefined) {
        updateData.umpireId = body.umpireId;
      }

      const updated = await tx.match.update({
        where: { id: matchId },
        data: updateData,
      });

      // 6. Record audit log
      await this.audit.record(
        {
          actorId: caller.id,
          action: 'match.assign',
          entityType: 'match',
          entityId: match.id,
          before: {
            court: match.court,
            umpireId: match.umpireId,
          },
          after: {
            court: updated.court,
            umpireId: updated.umpireId,
          },
        },
        tx,
      );

      // 7. Map and return Match
      const entryIds = [updated.topEntryId, updated.bottomEntryId].filter(
        (id): id is string => typeof id === 'string' && id.length > 0,
      );
      const entryMap = await this.loadEntryMap(tx, entryIds);
      const userNames = await this.loadUserNames(
        updated.reportedBy ? [updated.reportedBy] : [],
        tx,
      );
      const format = resolveMatchFormat(match.event.format, match.stage);

      return this.mapMatch(updated, entryMap, format, userNames);
    });
  }
}
