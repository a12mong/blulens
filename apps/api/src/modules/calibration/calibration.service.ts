import { Injectable, HttpStatus } from '@nestjs/common';
import { CalibrationSet, CalibrationClip } from '@prisma/client';
import { GRADES } from '@blulens/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { StorageService } from '../../common/storage/storage.service';
import { ApiException } from '../../common/errors/api.exception';
import type { AuthUser } from '../../common/auth/auth.types';

export interface CalibrationSetDto {
  id: string;
  name: string;
  period: string | null;
  createdAt: Date;
  clips: Array<{ clipId: string; referenceKey: string }>;
}

export interface CalibrationSetDetail extends Omit<CalibrationSetDto, 'clips' | 'createdAt'> {
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
    const sortedClips = [...set.clips].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
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

  async getSetDetail(setId: string, db = this.prisma): Promise<CalibrationSetDetail> {
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
      include: { reviewer: true, calibrationClip: true },
    });

    // Build clipDetails with viewUrl
    const clipDetails = await Promise.all(
      set.clips.map(async (clip) => {
        let viewUrl: string | null = null;

        // Check if status is 'uploaded' and objectKey is a path or URL
        if (clip.status === 'uploaded') {
          const isPath = clip.objectKey.startsWith('/');
          const isUrl = clip.objectKey.startsWith('http://') || clip.objectKey.startsWith('https://');

          if (isPath || isUrl) {
            viewUrl = clip.objectKey;
          } else {
            // Use StorageService.viewUrl for MinIO keys
            viewUrl = await this.storage.viewUrl('calibration', clip.objectKey);
          }
        }

        return {
          clipId: clip.id,
          referenceKey: GRADES[clip.referenceIndex] ?? '',
          status: clip.status,
          viewUrl,
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
      assignedAt: set.assignedAt?.toISOString() ?? null,
      createdAt: set.createdAt.toISOString(),
      clipDetails,
      reviewers,
    };
  }
}
