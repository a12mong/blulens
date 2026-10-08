import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import {
  DRAW_PRNG_ID,
  DRAW_RULESET_VERSION,
  eventFormatSchema,
  planGroups,
  roundRobinSchedule,
  seedKnockout,
  type DrawEntry,
  type Qualifier,
} from '@blulens/shared';
import type { AuthUser } from '../../common/auth/auth.types';
import { NotificationsService } from '../../common/notifications/notifications.service';
import { AuditService } from '../../common/audit/audit.service';
import { ApiException } from '../../common/errors/api.exception';
import { PrismaService } from '../../common/prisma/prisma.service';
import { MatchesService, type EntryRef } from '../matches/matches.service';
import { nextSlot } from './bracket';

export { nextSlot } from './bracket';

export interface CreateGroupPreviewInput {
  seed?: string;
  groupCount?: number;
  reason?: string;
}

export interface CreateKnockoutPreviewInput {
  seed?: string;
  reason?: string;
}

export interface PublishDrawInput {
  acknowledgeConflicts?: boolean;
  reason?: string;
}

/** Thai discipline names for notification titles. */
const DISCIPLINE_TH: Record<string, string> = {
  MS: 'ชายเดี่ยว',
  WS: 'หญิงเดี่ยว',
  MD: 'ชายคู่',
  WD: 'หญิงคู่',
  XD: 'คู่ผสม',
};

@Injectable()
export class DrawsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly matches: MatchesService,
    private readonly notifications: NotificationsService,
  ) {}

  async createGroupPreview(eventId: string, body: CreateGroupPreviewInput, user: AuthUser) {
    if (body.groupCount !== undefined) {
      throw ApiException.badRequest('VALIDATION_FAILED', 'groupCount override not supported yet');
    }

    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });
    if (!event) {
      throw ApiException.notFound('ไม่พบประเภทการแข่งที่ต้องการ', 'EVENT_NOT_FOUND');
    }

    const parsedFormat = eventFormatSchema.safeParse(event.format);
    if (!parsedFormat.success || parsedFormat.data.type !== 'groups_knockout') {
      throw ApiException.conflict(
        'EVENT_NOT_GROUP_FORMAT',
        'ประเภทการแข่งขันนี้ไม่ได้ใช้รูปแบบรอบแบ่งกลุ่ม',
      );
    }

    const existingLockedOrPublished = await this.prisma.draw.findFirst({
      where: {
        eventId,
        kind: 'group',
        status: { in: ['published', 'locked'] },
      },
    });
    if (existingLockedOrPublished) {
      throw ApiException.conflict(
        'DRAW_ALREADY_LOCKED',
        'สายการแข่งขันรอบแบ่งกลุ่มได้รับการเผยแพร่หรือล็อคแล้ว ไม่สามารถสร้างสายใหม่ได้',
      );
    }

    const approvedEntries = await this.prisma.entry.findMany({
      where: {
        eventId,
        status: 'approved',
      },
      include: {
        players: {
          include: {
            gradeResult: true,
          },
        },
      },
      orderBy: { id: 'asc' },
    });

    if (approvedEntries.length < 3) {
      throw ApiException.conflict(
        'NOT_ENOUGH_ENTRIES',
        'จำนวนผู้สมัครที่ได้รับการอนุมัติไม่เพียงพอ (ต้องมีอย่างน้อย 3 คน/คู่)',
      );
    }

    const seedSource: 'committee' | 'server' = body.seed ? 'committee' : 'server';
    const seed = body.seed ?? randomBytes(16).toString('hex');

    const drawEntries: DrawEntry[] = approvedEntries.map((e) => {
      const teamIds = Array.from(
        new Set(
          e.players
            .map((p) => p.teamId)
            .filter((id): id is string => typeof id === 'string' && id.length > 0),
        ),
      );
      const scores = e.players
        .map((p) => (p.gradeResult?.score != null ? Number(p.gradeResult.score) : null))
        .filter((s): s is number => typeof s === 'number');
      const seedScore =
        scores.length > 0 ? scores.reduce((sum, s) => sum + s, 0) / scores.length : 0;

      return {
        id: e.id,
        teamIds,
        seedScore,
      };
    });

    const groupSize = parsedFormat.data.groupSize;
    const plan = planGroups(drawEntries, groupSize, seed);
    if ('error' in plan) {
      throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, 'GROUP_SIZES_IMPOSSIBLE', plan.error);
    }

    const inputHash = this.computeInputHash(approvedEntries.map((e) => e.id));

    try {
      return await this.prisma.$transaction(async (tx) => {
        const lastDraw = await tx.draw.findFirst({
          where: { eventId, kind: 'group' },
          orderBy: { version: 'desc' },
          select: { version: true },
        });
        const version = (lastDraw?.version ?? 0) + 1;

        const trimmedReason = body.reason?.trim();
        if (version >= 2 && !trimmedReason) {
          throw ApiException.badRequest(
            'VALIDATION_FAILED',
            'ต้องระบุเหตุผลเมื่อสุ่มตัวอย่างใหม่',
            { field: 'reason', fieldErrors: { reason: ['ต้องระบุเหตุผลเมื่อสุ่มตัวอย่างใหม่'] } },
          );
        }

        const reasonToStore = trimmedReason || null;

        const conflicts = plan.sameTeamPairs.map(([a, b]) => ({ entryIds: [a, b] }));

        const draw = await tx.draw.create({
          data: {
            eventId,
            kind: 'group',
            version,
            status: 'preview',
            seed,
            seedSource,
            inputHash,
            reason: reasonToStore,
            snapshot: {
              entries: drawEntries.map((d) => ({
                id: d.id,
                teamIds: [...d.teamIds],
                seedScore: d.seedScore,
              })),
            } as Prisma.InputJsonObject,
            rulesetVersion: DRAW_RULESET_VERSION,
            prngId: DRAW_PRNG_ID,
            size: drawEntries.length,
            seedsCount: 0,
            sameTeamR1Count: plan.sameTeamPairs.length,
            minimumPossibleConflicts: plan.sameTeamPairs.length,
            conflicts: conflicts as Prisma.InputJsonValue,
            createdBy: user.id,
          },
        });

        let globalMatchNo = 1;

        for (let i = 0; i < plan.groups.length; i++) {
          const groupEntries = plan.groups[i]!;
          const label = String.fromCharCode(65 + i);

          const group = await tx.group.create({
            data: {
              eventId,
              drawId: draw.id,
              label,
            },
          });

          for (let j = 0; j < groupEntries.length; j++) {
            const entryId = groupEntries[j]!;
            await tx.groupMember.create({
              data: {
                groupId: group.id,
                entryId,
                seedInGroup: j + 1,
                pot: j + 1,
              },
            });
          }

          const schedule = roundRobinSchedule(groupEntries.length);
          for (const roundItem of schedule) {
            for (const [posA, posB] of roundItem.matches) {
              const topEntryId = groupEntries[posA - 1]!;
              const bottomEntryId = groupEntries[posB - 1]!;
              const matchNo = globalMatchNo++;

              await tx.match.create({
                data: {
                  eventId,
                  drawId: draw.id,
                  groupId: group.id,
                  stage: 'group',
                  round: roundItem.round,
                  matchNo,
                  court: null,
                  status: 'scheduled',
                  topEntryId,
                  bottomEntryId,
                },
              });
            }
          }
        }

        await this.audit.record(
          {
            actorId: user.id,
            action: 'draw.preview',
            entityType: 'draw',
            entityId: draw.id,
            reason: reasonToStore ?? undefined,
            after: {
              id: draw.id,
              eventId: draw.eventId,
              version: draw.version,
              status: draw.status,
              kind: draw.kind,
              seed: draw.seed,
              size: draw.size,
            },
          },
          tx,
        );

        return this.toDrawResponse(draw);
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw ApiException.conflict(
          'DRAW_VERSION_CONFLICT',
          'มีการสร้างตัวอย่างการจับสลากพร้อมกัน กรุณาลองใหม่',
        );
      }
      throw err;
    }
  }

  async publishDraw(drawId: string, body: PublishDrawInput, user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Lock draw row FOR UPDATE
      const lockedRows = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM draws WHERE id = ${drawId}::uuid FOR UPDATE
      `;
      if (lockedRows.length === 0) {
        throw ApiException.notFound('ไม่พบสายการแข่งขันที่ต้องการ', 'DRAW_NOT_FOUND');
      }

      // 2. Fetch the draw
      const draw = await tx.draw.findUnique({
        where: { id: drawId },
      });
      if (!draw) {
        throw ApiException.notFound('ไม่พบสายการแข่งขันที่ต้องการ', 'DRAW_NOT_FOUND');
      }

      // 3. Check kind
      if (draw.kind !== 'group' && draw.kind !== 'knockout') {
        throw ApiException.conflict(
          'DRAW_KIND_NOT_SUPPORTED',
          'ระบบยังไม่รองรับการเผยแพร่สายการแข่งขันประเภทนี้',
        );
      }
      if (draw.kind === 'knockout' && !draw.sourceGroupDrawId) {
        throw ApiException.conflict(
          'DRAW_KIND_NOT_SUPPORTED',
          'ระบบยังไม่รองรับการเผยแพร่สายการแข่งขันประเภทนี้',
        );
      }

      // 4. Status must be preview
      if (draw.status !== 'preview') {
        throw ApiException.conflict(
          'DRAW_ALREADY_LOCKED',
          'สายการแข่งขันไม่ได้อยู่ในสถานะพรีวิว หรือถูกล็อค/เผยแพร่แล้ว',
        );
      }

      // 5. Another draw of the same event+kind already published or locked
      const existingPublishedOrLocked = await tx.draw.findFirst({
        where: {
          eventId: draw.eventId,
          kind: draw.kind,
          status: { in: ['published', 'locked'] },
          id: { not: draw.id },
        },
      });
      if (existingPublishedOrLocked) {
        throw ApiException.conflict(
          'DRAW_ALREADY_LOCKED',
          draw.kind === 'group'
            ? 'สายการแข่งขันรอบแบ่งกลุ่มได้รับการเผยแพร่หรือล็อคแล้ว'
            : 'สายการแข่งขันรอบแพ้คัดออกได้รับการเผยแพร่หรือล็อคแล้ว',
        );
      }

      // 6. Input check
      if (draw.kind === 'group') {
        const currentApprovedEntries = await tx.entry.findMany({
          where: {
            eventId: draw.eventId,
            status: 'approved',
          },
          select: { id: true },
        });
        const currentInputHash = this.computeInputHash(currentApprovedEntries.map((e) => e.id));
        if (currentInputHash !== draw.inputHash) {
          throw ApiException.conflict(
            'DRAW_INPUT_CHANGED',
            'ข้อมูลผู้สมัครที่ได้รับอนุมัติมีการเปลี่ยนแปลง โปรดสร้างพรีวิวใหม่ก่อนเผยแพร่',
          );
        }
      } else if (draw.kind === 'knockout') {
        // Input check for knockout: the source group draw must still be 'locked' (else 409 DRAW_INPUT_CHANGED)
        const sourceGroupDraw = await tx.draw.findUnique({
          where: { id: draw.sourceGroupDrawId! },
          select: { status: true },
        });
        if (!sourceGroupDraw || sourceGroupDraw.status !== 'locked') {
          throw ApiException.conflict(
            'DRAW_INPUT_CHANGED',
            'สายการแข่งขันรอบแบ่งกลุ่มต้นทางไม่ได้อยู่ในสถานะล็อคแล้ว',
          );
        }
      }

      // 7. Conflicts check
      const acknowledgeConflicts = body.acknowledgeConflicts === true;
      const hasConflicts =
        draw.sameTeamR1Count > 0 ||
        (Array.isArray(draw.conflicts) && (draw.conflicts as unknown[]).length > 0);
      if (hasConflicts && !acknowledgeConflicts) {
        throw ApiException.conflict(
          'DRAW_CONFLICTS_NOT_ACKNOWLEDGED',
          'มีข้อขัดแย้งในการจับสลาก กรุณายืนยันการรับทราบข้อขัดแย้งก่อนเผยแพร่',
        );
      }

      // 8. Update this draw -> published; other previews of same event+kind -> discarded
      const now = new Date();
      const updatedDraw = await tx.draw.update({
        where: { id: draw.id },
        data: {
          status: 'published',
          reason: body.reason ?? draw.reason,
          ...(acknowledgeConflicts
            ? {
                conflictsAcknowledgedBy: user.id,
                conflictsAcknowledgedAt: now,
              }
            : {}),
        },
      });

      await tx.draw.updateMany({
        where: {
          eventId: draw.eventId,
          kind: draw.kind,
          status: 'preview',
          id: { not: draw.id },
        },
        data: {
          status: 'discarded',
        },
      });

      // 9. Create matches for knockout draws
      let mappedSlots: unknown[] = [];
      if (draw.kind === 'knockout') {
        const slots = await tx.drawSlot.findMany({
          where: { drawId: draw.id },
          orderBy: { position: 'asc' },
        });

        const S = draw.size;
        const R = Math.round(Math.log2(S));

        // Event format check for thirdPlacePlayoff
        const event = await tx.event.findUnique({
          where: { id: draw.eventId },
          select: { format: true, discipline: true },
        });
        const parsedFormat = eventFormatSchema.safeParse(event?.format);
        let thirdPlacePlayoff = true;
        if (parsedFormat.success) {
          thirdPlacePlayoff = parsedFormat.data.thirdPlacePlayoff;
        } else if (event?.format && typeof event.format === 'object') {
          const raw = event.format as Record<string, unknown>;
          if (typeof raw.thirdPlacePlayoff === 'boolean') {
            thirdPlacePlayoff = raw.thirdPlacePlayoff;
          }
        }

        interface MatchDraft {
          eventId: string;
          drawId: string;
          stage: 'knockout' | 'third_place';
          round: number;
          matchNo: number;
          court: null;
          umpireId: null;
          topEntryId: string | null;
          bottomEntryId: string | null;
          status: 'scheduled' | 'bye';
          winnerEntryId: string | null;
          result: null;
        }

        const matchesByRound = new Map<number, MatchDraft[]>();
        for (let r = 1; r <= R; r++) {
          const count = S / Math.pow(2, r);
          const list: MatchDraft[] = [];
          for (let i = 0; i < count; i++) {
            list.push({
              eventId: draw.eventId,
              drawId: draw.id,
              stage: 'knockout',
              round: r,
              matchNo: 0,
              court: null,
              umpireId: null,
              topEntryId: null,
              bottomEntryId: null,
              status: 'scheduled',
              winnerEntryId: null,
              result: null,
            });
          }
          matchesByRound.set(r, list);
        }

        // Round 1
        const slotMap = new Map(slots.map((s) => [s.position, s.entryId]));
        const r1Matches = matchesByRound.get(1)!;
        const r1Count = S / 2;
        for (let i = 0; i < r1Count; i++) {
          const topEntryId = slotMap.get(2 * i + 1) ?? null;
          const bottomEntryId = slotMap.get(2 * i + 2) ?? null;

          const match = r1Matches[i]!;
          match.topEntryId = topEntryId;
          match.bottomEntryId = bottomEntryId;

          const isTopNull = topEntryId === null;
          const isBottomNull = bottomEntryId === null;

          if (isTopNull !== isBottomNull) {
            match.status = 'bye';
            const winner = topEntryId ?? bottomEntryId;
            match.winnerEntryId = winner;

            if (R >= 2) {
              const next = nextSlot(1, i);
              const nextRoundList = matchesByRound.get(next.round)!;
              const targetMatch = nextRoundList[next.index]!;
              if (next.side === 'top') {
                targetMatch.topEntryId = winner;
              } else {
                targetMatch.bottomEntryId = winner;
              }
            }
          } else {
            match.status = 'scheduled';
            match.winnerEntryId = null;
          }
        }

        let currentMatchNo = 1;
        const allMatchesToCreate: MatchDraft[] = [];

        for (let r = 1; r <= R; r++) {
          const roundList = matchesByRound.get(r)!;
          for (const match of roundList) {
            match.matchNo = currentMatchNo++;
            allMatchesToCreate.push(match);
          }
        }

        if (thirdPlacePlayoff && R >= 2) {
          allMatchesToCreate.push({
            eventId: draw.eventId,
            drawId: draw.id,
            stage: 'third_place',
            round: R,
            matchNo: currentMatchNo++,
            court: null,
            umpireId: null,
            topEntryId: null,
            bottomEntryId: null,
            status: 'scheduled',
            winnerEntryId: null,
            result: null,
          });
        }

        for (const matchData of allMatchesToCreate) {
          await tx.match.create({
            data: matchData,
          });
        }

        const nonNullEntryIds = slots
          .map((s) => s.entryId)
          .filter((id): id is string => typeof id === 'string');
        const entryMap = await this.matches.loadEntryMap(tx, nonNullEntryIds);

        // N9 knockout_published (notifications.md; owner D2 default: the players in the bracket)
        const recipients = await this.knockoutPublishedRecipients(tx, nonNullEntryIds);
        await this.notifications.emit(
          tx,
          user.id,
          recipients.map((recipientUserId) => ({
            recipientUserId,
            type: 'knockout_published' as const,
            title: `สายน็อคเอาท์ประเภท${DISCIPLINE_TH[event?.discipline ?? ''] ?? ''} ประกาศแล้ว`,
            link: `/events/${draw.eventId}/bracket`,
          })),
        );

        mappedSlots = slots.map((s) => ({
          position: s.position,
          entryId: s.entryId,
          seedNo: s.seedNo,
          entry: s.entryId ? (entryMap.get(s.entryId) ?? null) : null,
          source: null,
        }));
      }

      // 10. Audit 'draw.publish'
      await this.audit.record(
        {
          actorId: user.id,
          action: 'draw.publish',
          entityType: 'draw',
          entityId: updatedDraw.id,
          reason: body.reason,
          after: {
            id: updatedDraw.id,
            eventId: updatedDraw.eventId,
            version: updatedDraw.version,
            status: updatedDraw.status,
            kind: updatedDraw.kind,
            seed: updatedDraw.seed,
            size: updatedDraw.size,
          },
        },
        tx,
      );

      return this.toDrawResponse(updatedDraw, mappedSlots);
    });
  }

  async createKnockoutPreview(eventId: string, body: CreateKnockoutPreviewInput, user: AuthUser) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });
    if (!event) {
      throw ApiException.notFound('ไม่พบประเภทการแข่งที่ต้องการ', 'EVENT_NOT_FOUND');
    }

    // 1. Check published or locked knockout draw exists -> 409 DRAW_ALREADY_LOCKED
    const existingPublishedOrLockedKnockout = await this.prisma.draw.findFirst({
      where: {
        eventId,
        kind: 'knockout',
        status: { in: ['published', 'locked'] },
      },
    });
    if (existingPublishedOrLockedKnockout) {
      throw ApiException.conflict(
        'DRAW_ALREADY_LOCKED',
        'สายการแข่งขันรอบแพ้คัดออกได้รับการเผยแพร่หรือล็อคแล้ว ไม่สามารถสร้างสายใหม่ได้',
      );
    }

    // 2. The event's group draw must have status 'locked' (groups confirmed) else 409 GROUP_STAGE_NOT_CONFIRMED
    const lockedGroupDraw = await this.prisma.draw.findFirst({
      where: {
        eventId,
        kind: 'group',
        status: 'locked',
      },
      orderBy: { version: 'desc' },
    });
    if (!lockedGroupDraw) {
      throw ApiException.conflict(
        'GROUP_STAGE_NOT_CONFIRMED',
        'รอบแบ่งกลุ่มยังไม่ได้รับการยืนยันผล',
      );
    }

    // 3. Extract advancePerGroup from event format
    const parsedFormat = eventFormatSchema.safeParse(event.format);
    let advancePerGroup = 2;
    if (parsedFormat.success && parsedFormat.data.type === 'groups_knockout') {
      advancePerGroup = parsedFormat.data.advancePerGroup;
    } else if (event.format && typeof event.format === 'object') {
      const raw = event.format as Record<string, unknown>;
      if (typeof raw.advancePerGroup === 'number') advancePerGroup = raw.advancePerGroup;
    }

    // 4. Load GroupStanding rows for lockedGroupDraw
    const standings = await this.prisma.groupStanding.findMany({
      where: {
        group: { drawId: lockedGroupDraw.id },
      },
      include: {
        group: { select: { id: true, label: true } },
      },
      orderBy: [{ group: { label: 'asc' } }, { rank: 'asc' }],
    });

    // Group labels and indices (A = 0, B = 1, etc.)
    const uniqueGroupLabels = Array.from(new Set(standings.map((s) => s.group.label))).sort(
      (a, b) => a.localeCompare(b),
    );
    const groupLabelToIndex = new Map(uniqueGroupLabels.map((label, idx) => [label, idx]));

    interface RawQualifier {
      standing: (typeof standings)[0];
      groupIndex: number;
      tier: 1 | 2 | 3;
      place: 1 | 2 | 3;
    }

    const rawQualifiers: RawQualifier[] = [];
    for (const s of standings) {
      const gIndex = groupLabelToIndex.get(s.group.label) ?? 0;
      if (s.rank === 1 && s.qualification === 'qualified') {
        rawQualifiers.push({ standing: s, groupIndex: gIndex, tier: 1, place: 1 });
      } else if (s.rank === 2 && advancePerGroup >= 2 && s.qualification === 'qualified') {
        rawQualifiers.push({ standing: s, groupIndex: gIndex, tier: 2, place: 2 });
      } else if (s.qualification === 'best_third') {
        rawQualifiers.push({ standing: s, groupIndex: gIndex, tier: 3, place: 3 });
      }
    }

    if (rawQualifiers.length < 2) {
      throw ApiException.conflict(
        'KNOCKOUT_TOO_FEW_QUALIFIERS',
        'จำนวนผู้ผ่านเข้ารอบไม่เพียงพอสำหรับการแข่งขันรอบแพ้คัดออก (ต้องมีอย่างน้อย 2 คน/คู่)',
      );
    }

    // Load active teams for entries
    const qualifierEntryIds = rawQualifiers.map((rq) => rq.standing.entryId);
    const entries = await this.prisma.entry.findMany({
      where: { id: { in: qualifierEntryIds } },
      include: {
        players: {
          select: { teamId: true },
        },
      },
    });
    const entryTeamMap = new Map<string, string[]>();
    for (const e of entries) {
      const teamIds = Array.from(
        new Set(
          e.players
            .map((p) => p.teamId)
            .filter((id): id is string => typeof id === 'string' && id.length > 0),
        ),
      );
      entryTeamMap.set(e.id, teamIds);
    }

    // Compute tierRank inside each tier: points desc, diff desc, pointsFor desc, entryId asc
    const qualifiersByTier = new Map<1 | 2 | 3, RawQualifier[]>([
      [1, []],
      [2, []],
      [3, []],
    ]);
    for (const rq of rawQualifiers) {
      qualifiersByTier.get(rq.tier)!.push(rq);
    }

    const qualifiers: Qualifier[] = [];
    const sourceInfoMap = new Map<string, { groupLabel: string; place: 1 | 2 | 3 }>();

    for (const tier of [1, 2, 3] as const) {
      const items = qualifiersByTier.get(tier)!;
      items.sort((a, b) => {
        if (b.standing.points !== a.standing.points) {
          return b.standing.points - a.standing.points;
        }
        if (b.standing.diff !== a.standing.diff) {
          return b.standing.diff - a.standing.diff;
        }
        if (b.standing.pointsFor !== a.standing.pointsFor) {
          return b.standing.pointsFor - a.standing.pointsFor;
        }
        return a.standing.entryId.localeCompare(b.standing.entryId);
      });

      items.forEach((item, idx) => {
        const entryId = item.standing.entryId;
        qualifiers.push({
          entryId,
          teamIds: entryTeamMap.get(entryId) ?? [],
          groupIndex: item.groupIndex,
          tier: item.tier,
          tierRank: idx + 1,
        });
        sourceInfoMap.set(entryId, {
          groupLabel: item.standing.group.label,
          place: item.place,
        });
      });
    }

    const seedSource: 'committee' | 'server' = body.seed ? 'committee' : 'server';
    const seed = body.seed ?? randomBytes(16).toString('hex');

    // Generate plan
    const plan = seedKnockout(qualifiers, seed);

    // Compute conflicts
    const qualifierMap = new Map(qualifiers.map((q) => [q.entryId, q]));
    interface ConflictItem {
      matchNo: number;
      kind: 'team' | 'group';
      teamId: string | null;
      groupLabel: string | null;
    }
    const conflicts: ConflictItem[] = [];

    for (let m = 0; m < plan.slots.length; m += 2) {
      const aId = plan.slots[m];
      const bId = plan.slots[m + 1];
      const matchNo = Math.floor(m / 2) + 1;

      if (aId && bId) {
        const a = qualifierMap.get(aId)!;
        const b = qualifierMap.get(bId)!;

        // Check same team
        const sharedTeamId = a.teamIds.find((t) => b.teamIds.includes(t)) ?? null;
        if (sharedTeamId !== null) {
          conflicts.push({
            matchNo,
            kind: 'team',
            teamId: sharedTeamId,
            groupLabel: null,
          });
        }

        // Check same group
        if (a.groupIndex === b.groupIndex) {
          conflicts.push({
            matchNo,
            kind: 'group',
            teamId: null,
            groupLabel: uniqueGroupLabels[a.groupIndex] ?? null,
          });
        }
      }
    }

    // Seed map (1-based index in ordered tier list)
    const ordered = [...qualifiers].sort((a, b) => {
      if (a.tier !== b.tier) return a.tier - b.tier;
      if (a.tierRank !== b.tierRank) return a.tierRank - b.tierRank;
      return a.entryId.localeCompare(b.entryId);
    });
    const seedNoMap = new Map(ordered.map((q, idx) => [q.entryId, idx + 1]));

    const inputHash = this.computeInputHash(qualifierEntryIds);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const lastDraw = await tx.draw.findFirst({
          where: { eventId, kind: 'knockout' },
          orderBy: { version: 'desc' },
          select: { version: true },
        });
        const version = (lastDraw?.version ?? 0) + 1;

        const trimmedReason = body.reason?.trim();
        if (version >= 2 && !trimmedReason) {
          throw ApiException.badRequest(
            'VALIDATION_FAILED',
            'ต้องระบุเหตุผลเมื่อสุ่มตัวอย่างใหม่',
            { field: 'reason', fieldErrors: { reason: ['ต้องระบุเหตุผลเมื่อสุ่มตัวอย่างใหม่'] } },
          );
        }

        const reasonToStore = trimmedReason || null;

        const draw = await tx.draw.create({
          data: {
            eventId,
            kind: 'knockout',
            version,
            status: 'preview',
            seed,
            seedSource,
            inputHash,
            reason: reasonToStore,
            sourceGroupDrawId: lockedGroupDraw.id,
            rulesetVersion: DRAW_RULESET_VERSION,
            prngId: DRAW_PRNG_ID,
            size: plan.size,
            seedsCount: qualifiers.length,
            sameTeamR1Count: plan.teamClashes,
            conflicts: conflicts as unknown as Prisma.InputJsonValue,
            snapshot: {
              qualifiers: ordered,
              sourceGroupDrawId: lockedGroupDraw.id,
            } as unknown as Prisma.InputJsonValue,
            createdBy: user.id,
          },
        });

        const slotData = plan.slots.map((entryId, idx) => ({
          drawId: draw.id,
          position: idx + 1,
          entryId: entryId ?? null,
          seedNo: entryId ? (seedNoMap.get(entryId) ?? null) : null,
        }));

        await tx.drawSlot.createMany({
          data: slotData,
        });

        await this.audit.record(
          {
            actorId: user.id,
            action: 'draw.preview',
            entityType: 'draw',
            entityId: draw.id,
            reason: reasonToStore ?? undefined,
            after: {
              id: draw.id,
              eventId: draw.eventId,
              version: draw.version,
              status: draw.status,
              kind: draw.kind,
              seed: draw.seed,
              size: draw.size,
            },
          },
          tx,
        );

        const nonNullEntryIds = plan.slots.filter((id): id is string => typeof id === 'string');
        const entryMap = await this.matches.loadEntryMap(tx, nonNullEntryIds);

        const mappedSlots = slotData.map((slot) => {
          const entryId = slot.entryId;
          const source = entryId ? (sourceInfoMap.get(entryId) ?? null) : null;
          return {
            position: slot.position,
            entryId,
            seedNo: slot.seedNo,
            entry: entryId ? (entryMap.get(entryId) ?? null) : null,
            source,
          };
        });

        return this.toDrawResponse(draw, mappedSlots);
      });
    } catch (err: unknown) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw ApiException.conflict(
          'DRAW_VERSION_CONFLICT',
          'เวอร์ชันของสายการแข่งขันชนกัน กรุณาลองใหม่อีกครั้ง',
        );
      }
      throw err;
    }
  }

  private computeInputHash(entryIds: string[]): string {
    const sorted = [...entryIds].sort();
    return createHash('sha256').update(sorted.join(',')).digest('hex');
  }

  private toDrawResponse(
    draw: {
      id: string;
      eventId: string;
      version: number;
      status: string;
      sameTeamR1Count: number;
      createdAt: Date;
      createdBy: string;
      seed: string;
      inputHash: string;
      kind: string;
      rulesetVersion: string;
      size: number;
      conflicts: Prisma.JsonValue;
      minimumPossibleConflicts: number;
    },
    slots: unknown[] = [],
  ) {
    return {
      id: draw.id,
      eventId: draw.eventId,
      version: draw.version,
      status: draw.status,
      sameTeamR1Count: draw.sameTeamR1Count,
      createdAt: draw.createdAt.toISOString(),
      createdBy: draw.createdBy,
      seed: draw.seed,
      inputHash: draw.inputHash,
      kind: draw.kind,
      rulesetVersion: draw.rulesetVersion,
      size: draw.size,
      slots,
      conflicts: (draw.conflicts as unknown[]) ?? [],
      minimumPossibleConflicts: draw.minimumPossibleConflicts,
    };
  }

  /**
   * Who hears that a knockout draw was published (N9). Owner decision D2, default (a): every player of every entry
   * in the bracket. A D2 change (team members of those players, or nobody) changes only this function.
   */
  private async knockoutPublishedRecipients(
    tx: Prisma.TransactionClient,
    entryIds: string[],
  ): Promise<string[]> {
    if (entryIds.length === 0) return [];
    const players = await tx.entryPlayer.findMany({
      where: { entryId: { in: entryIds } },
      select: { userId: true },
    });
    return [...new Set(players.map((p) => p.userId))];
  }
}
