import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, type Event as EventRow, type Tournament as TournamentRow } from '@prisma/client';
import {
  GRADE_KEYS,
  TOURNAMENT_TRANSITIONS,
  type EventFormat,
  type EventInput,
  type TournamentInput,
  type TournamentStatus,
} from '@blulens/shared';
import { AuditService } from '../../common/audit/audit.service';
import type { AuthUser } from '../../common/auth/auth.types';
import { ApiException } from '../../common/errors/api.exception';
import { PrismaService } from '../../common/prisma/prisma.service';

const NOT_FOUND = () => ApiException.notFound('ไม่พบรายการแข่งที่ต้องการ', 'TOURNAMENT_NOT_FOUND');

/** Committee/Admin see draft tournaments; everyone else never does (openapi: Guest/Member see non-draft only). */
const canSeeDrafts = (user?: AuthUser) => !!user?.roles.some((r) => r === 'Committee' || r === 'Admin');

export function toTournament(t: TournamentRow) {
  return {
    id: t.id,
    name: t.name,
    venue: t.venue ?? undefined,
    startsOn: t.startsOn.toISOString().slice(0, 10),
    entriesCloseAt: t.entriesCloseAt.toISOString(),
    status: t.status,
  };
}

export function toEvent(e: EventRow) {
  return {
    id: e.id,
    tournamentId: e.tournamentId,
    discipline: e.discipline,
    gradeMin: GRADE_KEYS[e.gradeMinIndex]!,
    gradeMax: GRADE_KEYS[e.gradeMaxIndex]!,
    maxEntries: e.maxEntries ?? undefined,
    requiresFreshAssessment: e.requiresFreshAssessment,
    minReviewers: e.minReviewers,
    gradesDisclosedAt: e.gradesDisclosedAt?.toISOString() ?? null,
    gradesDisclosedReason: e.gradesDisclosedReason ?? null,
  };
}

@Injectable()
export class TournamentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(user: AuthUser | undefined, cursor: string | undefined, limit: number) {
    const rows = await this.prisma.tournament.findMany({
      where: canSeeDrafts(user) ? {} : { status: { not: 'draft' } },
      orderBy: [{ startsOn: 'desc' }, { id: 'asc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const items = rows.slice(0, limit);
    return { items: items.map(toTournament), nextCursor: rows.length > limit ? items[items.length - 1]!.id : null };
  }

  async create(input: TournamentInput, actor: AuthUser, ip?: string) {
    return this.prisma.$transaction(async (tx) => {
      const t = await tx.tournament.create({
        data: {
          name: input.name,
          venue: input.venue,
          startsOn: new Date(`${input.startsOn}T00:00:00Z`),
          entriesCloseAt: new Date(input.entriesCloseAt),
          createdBy: actor.id,
        },
      });
      await this.audit.record(
        { actorId: actor.id, action: 'tournament.create', entityType: 'tournament', entityId: t.id, after: toTournament(t), ip },
        tx,
      );
      return toTournament(t);
    });
  }

  async detail(id: string, user?: AuthUser) {
    const t = await this.findVisible(id, user);
    const events = await this.prisma.event.findMany({ where: { tournamentId: id }, orderBy: [{ discipline: 'asc' }, { gradeMinIndex: 'asc' }] });
    return { ...toTournament(t), events: events.map(toEvent) };
  }

  async changeStatus(id: string, to: TournamentStatus, actor: AuthUser, reason?: string, ip?: string) {
    return this.prisma.$transaction(async (tx) => {
      const t = await tx.tournament.findUnique({ where: { id } });
      if (!t) throw NOT_FOUND();
      if (!TOURNAMENT_TRANSITIONS[t.status].includes(to)) {
        throw new ApiException(
          HttpStatus.CONFLICT,
          'TOURNAMENT_INVALID_TRANSITION',
          `เปลี่ยนสถานะจาก ${t.status} เป็น ${to} ไม่ได้`,
          { from: t.status, to, allowed: TOURNAMENT_TRANSITIONS[t.status] },
        );
      }
      // conditional update: a concurrent change of the same tournament loses instead of skipping a state
      const { count } = await tx.tournament.updateMany({ where: { id, status: t.status }, data: { status: to } });
      if (count === 0) throw ApiException.conflict('TOURNAMENT_INVALID_TRANSITION', 'สถานะถูกเปลี่ยนไปแล้ว กรุณาโหลดใหม่');
      await this.audit.record(
        { actorId: actor.id, action: 'tournament.status', entityType: 'tournament', entityId: id, before: { status: t.status }, after: { status: to }, reason, ip },
        tx,
      );
    }).then(() => this.detail(id, actor));
  }

  async events(tournamentId: string, user?: AuthUser) {
    await this.findVisible(tournamentId, user);
    const rows = await this.prisma.event.findMany({ where: { tournamentId }, orderBy: [{ discipline: 'asc' }, { gradeMinIndex: 'asc' }] });
    return rows.map(toEvent);
  }

  async createEvent(tournamentId: string, input: EventInput, actor: AuthUser, ip?: string) {
    const t = await this.prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!t) throw NOT_FOUND();
    if (t.status !== 'draft' && t.status !== 'open') {
      throw ApiException.conflict('TOURNAMENT_LOCKED', 'เพิ่มประเภทการแข่งได้เฉพาะตอนร่างหรือเปิดรับสมัคร');
    }
    try {
      return await this.prisma.$transaction(async (tx) => {
        const e = await tx.event.create({
          data: {
            tournamentId,
            discipline: input.discipline,
            gradeMinIndex: GRADE_KEYS.indexOf(input.gradeMin),
            gradeMaxIndex: GRADE_KEYS.indexOf(input.gradeMax),
            maxEntries: input.maxEntries,
            requiresFreshAssessment: input.requiresFreshAssessment ?? false,
            minReviewers: input.minReviewers ?? 2,
          },
        });
        await this.audit.record(
          { actorId: actor.id, action: 'event.create', entityType: 'event', entityId: e.id, after: toEvent(e), ip },
          tx,
        );
        return toEvent(e);
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw ApiException.conflict('EVENT_DUPLICATE', 'มีประเภทการแข่งนี้ในช่วงเกรดเดียวกันอยู่แล้ว');
      }
      throw err;
    }
  }

  async setFormat(eventId: string, format: EventFormat, actor: AuthUser, ip?: string) {
    return this.prisma.$transaction(async (tx) => {
      const e = await tx.event.findUnique({ where: { id: eventId } });
      if (!e) throw ApiException.notFound('ไม่พบประเภทการแข่งที่ต้องการ', 'EVENT_NOT_FOUND');
      // conditional update: a draw that locks the format concurrently wins
      const { count } = await tx.event.updateMany({
        where: { id: eventId, formatLockedAt: null },
        data: { format: format as Prisma.InputJsonValue },
      });
      if (count === 0) throw ApiException.conflict('FORMAT_LOCKED', 'รูปแบบการแข่งถูกล็อกแล้วหลังจับกลุ่ม/จับสาย');
      await this.audit.record(
        { actorId: actor.id, action: 'event.format', entityType: 'event', entityId: eventId, before: (e.format ?? null) as Prisma.InputJsonValue, after: format as Prisma.InputJsonValue, ip },
        tx,
      );
      return { ...format, lockedAt: null };
    });
  }

  async eventDetail(eventId: string, user?: AuthUser) {
    const e = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: { tournament: true, _count: { select: { entries: { where: { status: { not: 'withdrawn' } } } } } },
    });
    if (!e || (e.tournament.status === 'draft' && !canSeeDrafts(user))) {
      throw ApiException.notFound('ไม่พบประเภทการแข่งที่ต้องการ', 'EVENT_NOT_FOUND');
    }
    return { ...toEvent(e), tournamentName: e.tournament.name, tournamentStatus: e.tournament.status, entryCount: e._count.entries };
  }

  private async findVisible(id: string, user?: AuthUser) {
    const t = await this.prisma.tournament.findUnique({ where: { id } });
    if (!t || (t.status === 'draft' && !canSeeDrafts(user))) throw NOT_FOUND();
    return t;
  }
}
