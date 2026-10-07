import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, type EntryStatus } from '@prisma/client';
import { DOUBLES_DISCIPLINES, type EntryInput, type EntryWarning } from '@blulens/shared';
import { AuditService } from '../../common/audit/audit.service';
import type { AuthUser } from '../../common/auth/auth.types';
import { ApiException } from '../../common/errors/api.exception';
import { officialResults, toGradeView } from '../../common/grades';
import { PrismaService } from '../../common/prisma/prisma.service';

type Tx = Prisma.TransactionClient;

const ENTRY_INCLUDE = {
  players: { include: { user: { select: { displayName: true } } }, orderBy: { userId: 'asc' } },
  event: { include: { tournament: { select: { status: true } } } },
} satisfies Prisma.EntryInclude;
type EntryRow = Prisma.EntryGetPayload<{ include: typeof ENTRY_INCLUDE }>;

const isStaff = (u?: AuthUser) => !!u?.roles.some((r) => r === 'Committee' || r === 'Admin');
const notFound = () => ApiException.notFound('ไม่พบรายการสมัครที่ต้องการ', 'ENTRY_NOT_FOUND');
const conflict = (code: string, message: string, details?: unknown) =>
  new ApiException(HttpStatus.CONFLICT, code, message, details);

/** architecture §6.10: Admin/Committee create on behalf -> forward -> Committee approves or rejects. */
@Injectable()
export class EntriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(eventId: string, input: EntryInput, actor: AuthUser, ip?: string) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId }, include: { tournament: true } });
    if (!event) throw ApiException.notFound('ไม่พบประเภทการแข่งที่ต้องการ', 'EVENT_NOT_FOUND');
    if (event.tournament.status !== 'open') {
      throw conflict('ENTRIES_CLOSED', 'รายการแข่งนี้ไม่ได้เปิดรับสมัคร', { tournamentStatus: event.tournament.status });
    }
    const expected = DOUBLES_DISCIPLINES.includes(event.discipline) ? 2 : 1;
    if (input.players.length !== expected) {
      throw conflict('ENTRY_PLAYER_COUNT', `ประเภทนี้ต้องมีผู้เล่น ${expected} คน`, { expected });
    }
    const userIds = input.players.map((p) => p.userId);
    if (new Set(userIds).size !== userIds.length) throw conflict('ENTRY_DUPLICATE_PLAYER', 'เลือกผู้เล่นซ้ำกัน');

    const users = await this.prisma.user.findMany({ where: { id: { in: userIds }, deletedAt: null, status: 'active' } });
    if (users.length !== userIds.length) throw ApiException.notFound('ไม่พบผู้เล่นบางคน', 'USER_NOT_FOUND');
    const teamIds = input.players.flatMap((p) => (p.teamId ? [p.teamId] : []));
    const teams = await this.prisma.team.count({ where: { id: { in: teamIds }, status: 'active' } });
    if (teams !== new Set(teamIds).size) throw ApiException.notFound('ไม่พบทีมที่เลือก', 'TEAM_NOT_FOUND');

    try {
      const id = await this.prisma.$transaction(async (tx) => {
        const official = await officialResults(tx, userIds);
        const now = new Date();
        for (const p of input.players) {
          if (!p.teamId) continue;
          // A8/A11: a club picked for the entry becomes a dated membership if the player is not in it yet
          const open = await tx.teamMembership.findFirst({
            where: { userId: p.userId, teamId: p.teamId, validFrom: { lte: now }, OR: [{ validTo: null }, { validTo: { gt: now } }] },
          });
          if (!open) {
            const m = await tx.teamMembership.create({ data: { userId: p.userId, teamId: p.teamId, validFrom: now } });
            await this.audit.record(
              { actorId: actor.id, action: 'team.member_add', entityType: 'team', entityId: p.teamId, after: { membershipId: m.id, userId: p.userId }, ip },
              tx,
            );
          }
        }
        const entry = await tx.entry.create({
          data: {
            eventId,
            name: input.name,
            createdBy: actor.id,
            players: {
              create: input.players.map((p) => ({
                userId: p.userId,
                eventId,
                teamId: p.teamId,
                gradeResultId: official.get(p.userId)?.id,
              })),
            },
          },
        });
        await this.audit.record(
          { actorId: actor.id, action: 'entry.create', entityType: 'entry', entityId: entry.id, after: { eventId, players: input.players, name: input.name ?? null }, ip },
          tx,
        );
        return entry.id;
      });
      return this.get(id, actor);
    } catch (err) {
      // unique (event_id, user_id): the player already has an entry in this event
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw conflict('ENTRY_DUPLICATE_PLAYER', 'ผู้เล่นมีรายการสมัครในประเภทนี้อยู่แล้ว');
      }
      throw err;
    }
  }

  async listForEvent(eventId: string, status: EntryStatus | undefined, viewer?: AuthUser) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId }, include: { tournament: true } });
    if (!event || (event.tournament.status === 'draft' && !isStaff(viewer))) {
      throw ApiException.notFound('ไม่พบประเภทการแข่งที่ต้องการ', 'EVENT_NOT_FOUND');
    }
    // Guest/Member/Reviewer/Umpire see approved entries only
    const where: Prisma.EntryWhereInput = { eventId, status: isStaff(viewer) ? status : 'approved' };
    const rows = await this.prisma.entry.findMany({ where, include: ENTRY_INCLUDE, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
    return this.present(rows, viewer);
  }

  async queue(status: EntryStatus | undefined, eventId: string | undefined, cursor: string | undefined, limit: number, viewer: AuthUser) {
    const rows = await this.prisma.entry.findMany({
      where: { status, eventId },
      include: ENTRY_INCLUDE,
      orderBy: [{ forwardedAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const page = rows.slice(0, limit);
    return { items: await this.present(page, viewer), nextCursor: rows.length > limit ? page[page.length - 1]!.id : null };
  }

  async forward(id: string, actor: AuthUser, ip?: string) {
    return this.transition(id, 'draft', 'pending_committee', 'ENTRY_NOT_DRAFT', 'ส่งต่อได้เฉพาะรายการที่เป็นร่าง', actor, ip, {
      forwardedAt: new Date(),
    });
  }

  async approve(id: string, reason: string | undefined, actor: AuthUser, ip?: string) {
    const [entry] = await this.present([await this.load(id)], actor);
    if (entry!.status !== 'pending_committee') throw conflict('ENTRY_NOT_PENDING', 'อนุมัติได้เฉพาะรายการที่รอคณะกรรมการ');
    if (entry!.warnings.includes('NO_APPROVED_GRADE')) {
      throw conflict('ENTRY_PLAYER_UNGRADED', 'มีผู้เล่นที่ยังไม่มีเกรดที่อนุมัติแล้ว กรุณาสั่งประเมินก่อน');
    }
    // A13 (owner-approved): an event that requires a fresh assessment needs an approved event-bound result
    if (entry!.warnings.includes('FRESH_ASSESSMENT_REQUIRED')) {
      throw conflict('ENTRY_FRESH_ASSESSMENT_MISSING', 'ประเภทนี้ต้องมีผลประเมินใหม่ที่ผูกกับรายการแข่งนี้ก่อนอนุมัติ');
    }
    if (entry!.warnings.includes('GRADE_OUT_OF_BAND') && !reason) {
      throw conflict('ENTRY_OUT_OF_BAND_REASON_REQUIRED', 'เกรดอยู่นอกช่วงของประเภทนี้ ต้องระบุเหตุผลอย่างน้อย 20 ตัวอักษร');
    }
    return this.transition(id, 'pending_committee', 'approved', 'ENTRY_NOT_PENDING', 'อนุมัติได้เฉพาะรายการที่รอคณะกรรมการ', actor, ip, {
      decidedBy: actor.id,
      decidedAt: new Date(),
      decisionReason: reason ?? null,
    }, reason);
  }

  async reject(id: string, reason: string, actor: AuthUser, ip?: string) {
    return this.transition(id, 'pending_committee', 'rejected', 'ENTRY_NOT_PENDING', 'ปฏิเสธได้เฉพาะรายการที่รอคณะกรรมการ', actor, ip, {
      decidedBy: actor.id,
      decidedAt: new Date(),
      decisionReason: reason,
    }, reason);
  }

  async get(id: string, viewer?: AuthUser) {
    const [entry] = await this.present([await this.load(id)], viewer);
    return entry!;
  }

  private async load(id: string): Promise<EntryRow> {
    const row = await this.prisma.entry.findUnique({ where: { id }, include: ENTRY_INCLUDE });
    if (!row) throw notFound();
    return row;
  }

  /** Conditional status move (lost race = 409), audited in the same transaction. */
  private async transition(
    id: string,
    from: EntryStatus,
    to: EntryStatus,
    code: string,
    message: string,
    actor: AuthUser,
    ip: string | undefined,
    data: Prisma.EntryUpdateManyMutationInput,
    reason?: string,
  ) {
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.entry.updateMany({ where: { id, status: from }, data: { ...data, status: to } });
      if (count === 0) {
        if (!(await tx.entry.findUnique({ where: { id } }))) throw notFound();
        throw conflict(code, message);
      }
      await this.audit.record(
        { actorId: actor.id, action: `entry.${to === 'pending_committee' ? 'forward' : to === 'approved' ? 'approve' : 'reject'}`, entityType: 'entry', entityId: id, before: { status: from }, after: { status: to }, reason, ip },
        tx,
      );
    });
    return this.get(id, actor);
  }

  /** openapi Entry with derived warnings, team counts, grades and A14 visibility for this viewer. */
  private async present(rows: EntryRow[], viewer?: AuthUser) {
    const userIds = [...new Set(rows.flatMap((r) => r.players.map((p) => p.userId)))];
    const now = new Date();
    const [official, memberships, eventBound] = await Promise.all([
      officialResults(this.prisma, userIds),
      this.prisma.teamMembership.findMany({
        where: { userId: { in: userIds }, validFrom: { lte: now }, OR: [{ validTo: null }, { validTo: { gt: now } }] },
        select: { userId: true, teamId: true },
      }),
      this.prisma.assessmentResult.findMany({
        where: {
          status: { in: ['approved', 'overridden'] },
          assessment: { subjectUserId: { in: userIds }, eventId: { in: [...new Set(rows.map((r) => r.eventId))] } },
        },
        select: { assessment: { select: { subjectUserId: true, eventId: true } } },
      }),
    ]);
    const teamsOf = new Map<string, string[]>();
    for (const m of memberships) teamsOf.set(m.userId, [...(teamsOf.get(m.userId) ?? []), m.teamId]);
    const fresh = new Set(eventBound.map((r) => `${r.assessment.eventId}:${r.assessment.subjectUserId}`));

    return rows.map((r) => {
      const visibility = r.event.gradesDisclosedAt ? 'disclosed' : r.players.every((p) => p.gradeConsent) ? 'public' : 'hidden';
      const showGrades = isStaff(viewer) || visibility !== 'hidden';
      const warnings = new Set<EntryWarning>();
      const players = r.players.map((p) => {
        const teamIds = (teamsOf.get(p.userId) ?? []).sort();
        const result = official.get(p.userId);
        if (teamIds.length > 1) warnings.add('MULTI_TEAM');
        if (!result) warnings.add('NO_APPROVED_GRADE');
        else if (result.centerIndex !== null && (result.centerIndex < r.event.gradeMinIndex || result.centerIndex > r.event.gradeMaxIndex)) {
          warnings.add('GRADE_OUT_OF_BAND');
        }
        if (r.event.requiresFreshAssessment && !fresh.has(`${r.eventId}:${p.userId}`)) warnings.add('FRESH_ASSESSMENT_REQUIRED');
        return {
          userId: p.userId,
          displayName: p.user.displayName,
          teamId: p.teamId,
          teamIds,
          teamCount: teamIds.length,
          gradeConsent: p.gradeConsent,
          grade: showGrades && result ? toGradeView(result) : null,
        };
      });
      const scores = r.players.map((p) => official.get(p.userId)?.score);
      const seedScore =
        showGrades && scores.every((s) => s !== null && s !== undefined)
          ? scores.reduce((a, s) => a + Number(s), 0) / scores.length
          : null;
      return {
        id: r.id,
        eventId: r.eventId,
        status: r.status,
        name: r.name,
        createdBy: r.createdBy,
        forwardedAt: r.forwardedAt?.toISOString() ?? null,
        decidedBy: r.decidedBy,
        decidedAt: r.decidedAt?.toISOString() ?? null,
        decisionReason: r.decisionReason,
        players,
        seedScore,
        gradeVisibility: visibility,
        // warnings are Committee information; others get none
        warnings: isStaff(viewer) ? [...warnings].sort() : [],
      };
    });
  }
}
