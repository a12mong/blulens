import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import {
  DRAW_PRNG_ID,
  DRAW_RULESET_VERSION,
  eventFormatSchema,
  planGroups,
  roundRobinSchedule,
  type DrawEntry,
} from '@blulens/shared';
import type { AuthUser } from '../../common/auth/auth.types';
import { AuditService } from '../../common/audit/audit.service';
import { ApiException } from '../../common/errors/api.exception';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface CreateGroupPreviewInput {
  seed?: string;
  groupCount?: number;
}

export interface PublishDrawInput {
  acknowledgeConflicts?: boolean;
  reason?: string;
}

@Injectable()
export class DrawsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
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

      // 3. Check kind (knockout publish is not supported yet)
      if (draw.kind !== 'group') {
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
          'สายการแข่งขันรอบแบ่งกลุ่มได้รับการเผยแพร่หรือล็อคแล้ว',
        );
      }

      // 6. Recompute inputHash from the event's current approved entries
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

      // 7. Conflicts check
      const acknowledgeConflicts = body.acknowledgeConflicts === true;
      if (draw.sameTeamR1Count > 0 && !acknowledgeConflicts) {
        throw ApiException.conflict(
          'DRAW_CONFLICTS_NOT_ACKNOWLEDGED',
          'มีทีมเดียวกันอยู่ในกลุ่มเดียวกัน กรุณายืนยันการรับทราบข้อขัดแย้งก่อนเผยแพร่',
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

      // 9. Audit 'draw.publish'
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

      return this.toDrawResponse(updatedDraw);
    });
  }

  private computeInputHash(entryIds: string[]): string {
    const sorted = [...entryIds].sort();
    return createHash('sha256').update(sorted.join(',')).digest('hex');
  }

  private toDrawResponse(draw: {
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
  }) {
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
      slots: [],
      conflicts: (draw.conflicts as unknown[]) ?? [],
      minimumPossibleConflicts: draw.minimumPossibleConflicts,
    };
  }
}
