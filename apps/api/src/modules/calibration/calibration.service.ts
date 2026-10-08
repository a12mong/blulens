import { Injectable, HttpStatus } from '@nestjs/common';
import { CalibrationSet, CalibrationClip, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { GRADES, gradeIndex, type GradeKey } from '@blulens/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import {
  CLIP_MAX_DURATION_SEC,
  StorageService,
  calibrationClipKey,
  type ClipContentType,
} from '../../common/storage/storage.service';
import { ApiException } from '../../common/errors/api.exception';
import type { AuthUser } from '../../common/auth/auth.types';

export interface CalibrationSetDto {
  id: string;
  name: string;
  period: string | null;
  createdAt: Date;
  clips: Array<{ clipId: string; referenceKey: string }>;
}

export interface CalibrationSetDetail extends Omit<CalibrationSetDto, 'createdAt'> {
  assignedAt: string | null;
  createdAt: string;
  clipDetails: Array<{
    clipId: string;
    referenceKey: string;
    status: string;
    viewUrl: string | null;
    durationSec: number | null;
  }>;
  reviewers: Array<{
    reviewerId: string;
    reviewerName: string;
    assigned: number;
    submitted: number;
  }>;
}

@Injectable()
export class CalibrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
  ) {}

  toCalibrationSet(set: CalibrationSet & { clips: CalibrationClip[] }): CalibrationSetDto {
    const sortedClips = [...set.clips].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );
    return {
      id: set.id,
      name: set.name,
      period: set.period ?? null,
      createdAt: set.createdAt,
      clips: sortedClips.map((clip) => ({
        clipId: clip.id,
        referenceKey: GRADES[clip.referenceIndex] ?? '',
      })),
    };
  }

  async listCalibrationSets(): Promise<CalibrationSetDto[]> {
    const sets = await this.prisma.calibrationSet.findMany({
      include: { clips: true },
      orderBy: { createdAt: 'desc' },
    });
    return sets.map((set) => this.toCalibrationSet(set));
  }

  async createCalibrationSet(
    name: string,
    period: string | undefined,
    user: AuthUser,
  ): Promise<CalibrationSetDto> {
    return this.prisma.$transaction(async (tx) => {
      const set = await tx.calibrationSet.create({
        data: {
          name,
          period: period || null,
          createdBy: user.id,
        },
        include: { clips: true },
      });

      await this.audit.record(
        {
          actorId: user.id,
          action: 'calibration_set.create',
          entityType: 'calibration_set',
          entityId: set.id,
          after: { id: set.id, name: set.name, period: set.period },
        },
        tx,
      );

      return this.toCalibrationSet(set);
    });
  }

  async getSetDetail(
    setId: string,
    db: Prisma.TransactionClient = this.prisma,
  ): Promise<CalibrationSetDetail> {
    // Fetch set with clips
    const set = await db.calibrationSet.findUnique({
      where: { id: setId },
      include: { clips: { orderBy: { createdAt: 'asc' } } },
    });

    if (!set) {
      throw new ApiException(
        HttpStatus.NOT_FOUND,
        'CALIBRATION_SET_NOT_FOUND',
        'ไม่พบชุดการสอบเทียม',
      );
    }

    // Fetch all review assignments for calibration clips in this set
    const assignments = await db.reviewAssignment.findMany({
      where: {
        kind: 'calibration',
        calibrationClip: { setId },
      },
      select: { reviewerId: true, state: true, reviewer: { select: { displayName: true } } },
    });

    // Build clipDetails with viewUrl
    const clipDetails = await Promise.all(
      set.clips.map(async (clip) => {
        return {
          clipId: clip.id,
          referenceKey: GRADES[clip.referenceIndex] ?? '',
          status: clip.status,
          // bucket keys get a presigned GET; seeded '/...' and http(s) keys pass through
          viewUrl: await this.storage.viewUrl(clip.status, clip.objectKey),
          durationSec: clip.durationSec,
        };
      }),
    );

    // Group assignments by reviewer
    const reviewerMap = new Map<
      string,
      {
        reviewerId: string;
        reviewerName: string;
        assigned: number;
        submitted: number;
      }
    >();

    for (const assignment of assignments) {
      if (!reviewerMap.has(assignment.reviewerId)) {
        reviewerMap.set(assignment.reviewerId, {
          reviewerId: assignment.reviewerId,
          reviewerName: assignment.reviewer.displayName,
          assigned: 0,
          submitted: 0,
        });
      }

      const reviewer = reviewerMap.get(assignment.reviewerId)!;
      reviewer.assigned++;
      if (assignment.state === 'submitted') {
        reviewer.submitted++;
      }
    }

    const reviewers = Array.from(reviewerMap.values()).sort((a, b) =>
      a.reviewerName < b.reviewerName ? -1 : a.reviewerName > b.reviewerName ? 1 : 0,
    );

    return {
      id: set.id,
      name: set.name,
      period: set.period ?? null,
      clips: set.clips.map((clip) => ({
        clipId: clip.id,
        referenceKey: GRADES[clip.referenceIndex] ?? '',
      })),
      assignedAt: set.assignedAt?.toISOString() ?? null,
      createdAt: set.createdAt.toISOString(),
      clipDetails,
      reviewers,
    };
  }

  /** Locks the set; its clips can change only while it is not yet assigned. */
  private async lockUnassignedSet(tx: Prisma.TransactionClient, setId: string) {
    const rows = await tx.$queryRaw<Array<{ assigned_at: Date | null }>>`
      SELECT assigned_at FROM calibration_sets WHERE id = ${setId}::uuid FOR UPDATE
    `;
    const row = rows[0];
    if (!row) {
      throw new ApiException(
        HttpStatus.NOT_FOUND,
        'CALIBRATION_SET_NOT_FOUND',
        'ไม่พบชุดคลิปปรับมาตรฐาน',
      );
    }
    if (row.assigned_at) {
      throw new ApiException(
        HttpStatus.CONFLICT,
        'CALIBRATION_SET_ASSIGNED',
        'ชุดนี้มอบหมายผู้ประเมินแล้ว แก้ไขคลิปไม่ได้',
      );
    }
  }

  private async clipOfSet(tx: Prisma.TransactionClient, setId: string, clipId: string) {
    const clip = await tx.calibrationClip.findUnique({ where: { id: clipId } });
    if (!clip || clip.setId !== setId) {
      throw new ApiException(HttpStatus.NOT_FOUND, 'CLIP_NOT_FOUND', 'ไม่พบคลิปในชุดนี้');
    }
    return clip;
  }

  async updateClipReference(setId: string, clipId: string, referenceKey: GradeKey, user: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockUnassignedSet(tx, setId);
      const clip = await this.clipOfSet(tx, setId, clipId);
      await tx.calibrationClip.update({
        where: { id: clipId },
        data: { referenceIndex: gradeIndex(referenceKey) },
      });
      await this.audit.record(
        {
          actorId: user.id,
          action: 'calibration_clip.update',
          entityType: 'calibration_clip',
          entityId: clipId,
          before: { referenceKey: GRADES[clip.referenceIndex] },
          after: { referenceKey },
        },
        tx,
      );
      return this.getSetDetail(setId, tx);
    });
  }

  async deleteClip(setId: string, clipId: string, user: AuthUser): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.lockUnassignedSet(tx, setId);
      const clip = await this.clipOfSet(tx, setId, clipId);
      await tx.calibrationClip.delete({ where: { id: clipId } });
      await this.audit.record(
        {
          actorId: user.id,
          action: 'calibration_clip.delete',
          entityType: 'calibration_clip',
          entityId: clipId,
          before: { referenceKey: GRADES[clip.referenceIndex], objectKey: clip.objectKey },
        },
        tx,
      );
    });
  }

  /** Presign flow step 1 for a calibration clip (same storage rules as member clips). */
  async createClipUpload(
    setId: string,
    body: { contentType: ClipContentType; sizeBytes: number; referenceKey: GradeKey },
    user: AuthUser,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockUnassignedSet(tx, setId);
      const clipId = randomUUID();
      const objectKey = calibrationClipKey(setId, clipId, body.contentType);
      const presign = await this.storage.presignPut(objectKey, body.contentType);
      await tx.calibrationClip.create({
        data: {
          id: clipId,
          setId,
          objectKey,
          referenceIndex: gradeIndex(body.referenceKey),
          status: 'pending_upload',
          contentType: body.contentType,
          sizeBytes: BigInt(body.sizeBytes),
        },
      });
      await this.audit.record(
        {
          actorId: user.id,
          action: 'calibration_clip.create',
          entityType: 'calibration_clip',
          entityId: clipId,
          after: { setId, referenceKey: body.referenceKey, objectKey },
        },
        tx,
      );
      return { clipId, uploadUrl: presign.url, expiresAt: presign.expiresAt };
    });
  }

  /** Presign flow step 3: verify the object and mark the clip uploaded. Idempotent. */
  async completeClip(setId: string, clipId: string, durationSec: number, user: AuthUser) {
    if (durationSec > CLIP_MAX_DURATION_SEC) {
      throw new ApiException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'CLIP_TOO_LONG',
        'คลิปยาวได้ไม่เกิน 5 นาที',
      );
    }
    return this.prisma.$transaction(async (tx) => {
      await this.lockUnassignedSet(tx, setId);
      const clip = await this.clipOfSet(tx, setId, clipId);
      if (clip.status !== 'uploaded') {
        const stored = await this.storage.head(clip.objectKey);
        if (!stored) {
          throw new ApiException(
            HttpStatus.CONFLICT,
            'CLIP_NOT_UPLOADED',
            'ยังไม่พบไฟล์คลิปที่อัปโหลด',
          );
        }
        if (
          stored.sizeBytes !== Number(clip.sizeBytes) ||
          stored.contentType !== clip.contentType
        ) {
          throw new ApiException(
            HttpStatus.UNPROCESSABLE_ENTITY,
            'CLIP_MISMATCH',
            'ไฟล์ที่อัปโหลดไม่ตรงกับขนาดหรือชนิดที่แจ้งไว้',
          );
        }
        await tx.calibrationClip.update({
          where: { id: clipId },
          data: { status: 'uploaded', durationSec },
        });
        await this.audit.record(
          {
            actorId: user.id,
            action: 'calibration_clip.complete',
            entityType: 'calibration_clip',
            entityId: clipId,
            after: { status: 'uploaded', durationSec, sizeBytes: stored.sizeBytes },
          },
          tx,
        );
      }
      return this.getSetDetail(setId, tx);
    });
  }

  /**
   * Bias of each reviewer against the Committee reference grades (grading.md 12.4):
   * d = overall - (referenceIndex + 0.5) in ladder units; abstained or unscored reviews are skipped.
   */
  async getResults(setId: string) {
    const set = await this.prisma.calibrationSet.findUnique({
      where: { id: setId },
      select: { id: true },
    });
    if (!set) {
      throw new ApiException(
        HttpStatus.NOT_FOUND,
        'CALIBRATION_SET_NOT_FOUND',
        'ไม่พบชุดคลิปปรับมาตรฐาน',
      );
    }
    const reviews = await this.prisma.review.findMany({
      where: {
        abstained: false,
        overall: { not: null },
        assignment: { kind: 'calibration', calibrationClip: { setId } },
      },
      select: {
        overall: true,
        assignment: {
          select: { reviewerId: true, calibrationClip: { select: { referenceIndex: true } } },
        },
      },
    });

    const diffs = new Map<string, number[]>();
    for (const r of reviews) {
      const ref = r.assignment.calibrationClip?.referenceIndex;
      if (ref === undefined || r.overall === null) continue;
      const list = diffs.get(r.assignment.reviewerId) ?? [];
      list.push(Number(r.overall) - (ref + 0.5));
      diffs.set(r.assignment.reviewerId, list);
    }

    const round3 = (x: number) => Math.round(x * 1000) / 1000;
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    return [...diffs.entries()]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([reviewerId, d]) => ({
        reviewerId,
        clipsScored: d.length,
        biasVsReference: round3(mean(d)),
        meanAbsError: round3(mean(d.map(Math.abs))),
      }));
  }
}
