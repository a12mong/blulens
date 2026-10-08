import { Injectable } from '@nestjs/common';
import { CalibrationSet, CalibrationClip } from '@prisma/client';
import { GRADES } from '@blulens/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import type { AuthUser } from '../../common/auth/auth.types';

export interface CalibrationSetDto {
  id: string;
  name: string;
  period: string | null;
  createdAt: Date;
  clips: Array<{ clipId: string; referenceKey: string }>;
}

@Injectable()
export class CalibrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
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
}
