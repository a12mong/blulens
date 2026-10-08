import { Injectable, HttpStatus } from '@nestjs/common';
import { CalibrationSet, CalibrationClip, Prisma } from '@prisma/client';
import { z } from 'zod';
import { GRADES } from '@blulens/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { StorageService } from '../../common/storage/storage.service';
import { ApiException } from '../../common/errors/api.exception';
import type { AuthUser } from '../../common/auth/auth.types';

const assignCalibrationSetSchema = z.object({
  reviewerIds: z
    .array(z.string().uuid())
    .min(1, 'At least one reviewer required')
    .max(50)
    .refine((ids) => new Set(ids).size === ids.length, 'Duplicate reviewer IDs'),
  dueAt: z
    .string()
    .datetime()
    .optional()
    .transform((val) =>
      val ? new Date(val) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    )
    .refine((date) => date > new Date(), 'Due date must be in the future'),
});

export type AssignCalibrationSetInput = z.infer<typeof assignCalibrationSetSchema>;

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

  async assignCalibrationSet(
    setId: string,
    input: unknown,
    user: AuthUser,
  ): Promise<void> {
    // Validate input
    const parseResult = assignCalibrationSetSchema.safeParse(input);
    if (!parseResult.success) {
      const issue = parseResult.error.issues[0];
      throw new ApiException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', issue?.message ?? 'Invalid request');
    }

    const { reviewerIds, dueAt } = parseResult.data;

    // Transaction with FOR UPDATE lock
    await this.prisma.$transaction(async (tx) => {
      // Lock the set row
      const set = await tx.calibrationSet.findUnique({
        where: { id: setId },
        include: { clips: true },
      });

      if (!set) {
        throw new ApiException(
          HttpStatus.NOT_FOUND,
          'CALIBRATION_SET_NOT_FOUND',
          'ไม่พบชุดการสอบเทียม',
        );
      }

      // Check all clips are uploaded
      if (set.clips.length === 0) {
        throw new ApiException(
          HttpStatus.CONFLICT,
          'CALIBRATION_CLIPS_NOT_READY',
          'ชุดการสอบเทียมไม่มีคลิปหรือคลิปยังไม่พร้อม',
        );
      }

      for (const clip of set.clips) {
        if (clip.status !== 'uploaded') {
          throw new ApiException(
            HttpStatus.CONFLICT,
            'CALIBRATION_CLIPS_NOT_READY',
            'ชุดการสอบเทียมไม่มีคลิปหรือคลิปยังไม่พร้อม',
          );
        }
      }

      // Fetch and validate reviewers
      const reviewers = await tx.user.findMany({
        where: { id: { in: reviewerIds } },
        include: { roles: true },
      });

      if (reviewers.length !== reviewerIds.length) {
        // Find missing user
        const foundIds = new Set(reviewers.map((r) => r.id));
        const missingId = reviewerIds.find((id) => !foundIds.has(id));
        throw new ApiException(
          HttpStatus.CONFLICT,
          'REVIEWER_NOT_ELIGIBLE',
          'ผู้ประเมินไม่พบหรือไม่มีสิทธิ์',
          { userId: missingId },
        );
      }

      // Check all reviewers have Reviewer role and are enabled
      for (const reviewer of reviewers) {
        if (reviewer.status === 'disabled') {
          throw new ApiException(
            HttpStatus.CONFLICT,
            'REVIEWER_NOT_ELIGIBLE',
            'ผู้ประเมินไม่พบหรือไม่มีสิทธิ์',
            { userId: reviewer.id },
          );
        }

        const hasReviewerRole = reviewer.roles.some((r) => r.role === 'Reviewer');
        if (!hasReviewerRole) {
          throw new ApiException(
            HttpStatus.CONFLICT,
            'REVIEWER_NOT_ELIGIBLE',
            'ผู้ประเมินไม่พบหรือไม่มีสิทธิ์',
            { userId: reviewer.id },
          );
        }
      }

      // Create assignments for each reviewer-clip pair
      const assignments = set.clips.flatMap((clip) =>
        reviewerIds.map((reviewerId) => ({
          kind: 'calibration' as const,
          calibrationClipId: clip.id,
          reviewerId,
          dueAt,
          state: 'open' as const,
        })),
      );

      await tx.reviewAssignment.createMany({
        data: assignments,
        skipDuplicates: true,
      });

      // Set assignedAt if not already set
      if (!set.assignedAt) {
        await tx.calibrationSet.update({
          where: { id: setId },
          data: { assignedAt: new Date() },
        });
      }

      // Audit
      await this.audit.record(
        {
          actorId: user.id,
          action: 'calibration_set.assign',
          entityType: 'calibration_set',
          entityId: setId,
          after: {
            reviewerIds,
            clipCount: set.clips.length,
            dueAt: dueAt.toISOString(),
          },
        },
        tx,
      );
    });
  }
}
