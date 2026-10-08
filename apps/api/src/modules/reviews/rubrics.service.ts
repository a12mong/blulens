import { Injectable, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthUser } from '../../common/auth/auth.types';
import { ApiException } from '../../common/errors/api.exception';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface RubricResponse {
  id: string;
  status: 'draft' | 'active' | 'retired';
  createdAt: string;
  methodVersion: string;
  criteria: Array<{
    key: string;
    nameTh: string;
    weight: number;
    anchorsTh?: Record<string, string>;
  }>;
}

@Injectable()
export class RubricsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  toRubric(row: any): RubricResponse {
    let status: 'draft' | 'active' | 'retired';
    if (row.active) {
      status = 'active';
    } else if (row.activatedAt) {
      status = 'retired';
    } else {
      status = 'draft';
    }

    return {
      id: row.id,
      status,
      createdAt: row.createdAt.toISOString(),
      methodVersion: row.methodVersion,
      criteria: row.criteria,
    };
  }

  async getRubrics(user: AuthUser): Promise<RubricResponse[]> {
    const rubrics = await this.prisma.rubric.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return rubrics.map((r) => this.toRubric(r));
  }

  async createDraft(user: AuthUser): Promise<RubricResponse> {
    const activeRubric = await this.prisma.rubric.findFirst({
      where: { active: true },
    });

    if (!activeRubric) {
      throw new ApiException(HttpStatus.CONFLICT, 'RUBRIC_NOT_FOUND', 'ไม่พบเวอร์ชันแบบฟอร์มการประเมินทีใช้อยู่');
    }

    // Calculate methodVersion
    const baseName = activeRubric.methodVersion.replace(/-r\d+$/, '');
    const draftRubrics = await this.prisma.rubric.findMany({
      where: { methodVersion: { startsWith: baseName + '-r' } },
    });

    let maxN = 1;
    for (const r of draftRubrics) {
      const match = r.methodVersion.match(/-r(\d+)$/);
      if (match && match[1]) {
        const n = parseInt(match[1], 10);
        if (n > maxN) maxN = n;
      }
    }

    const newMethodVersion = `${baseName}-r${maxN + 1}`;

    // Create draft in transaction
    try {
      const draft = await this.prisma.$transaction(async (tx) => {
        const newDraft = await tx.rubric.create({
          data: {
            methodVersion: newMethodVersion,
            criteria: activeRubric.criteria as Prisma.InputJsonValue,
            params: activeRubric.params as Prisma.InputJsonValue,
            active: false,
            createdBy: user.id,
          },
        });

        await this.audit.record(
          {
            actorId: user.id,
            action: 'rubric.draft.create',
            entityType: 'rubric',
            entityId: newDraft.id,
            after: { methodVersion: newMethodVersion },
          },
          tx,
        );

        return newDraft;
      });

      return this.toRubric(draft);
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new ApiException(HttpStatus.CONFLICT, 'RUBRIC_DRAFT_EXISTS', 'มีแบบฟอร์มร่างอยู่แล้ว');
      }
      throw error;
    }
  }
}
