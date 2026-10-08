import { Injectable, HttpStatus } from '@nestjs/common';
import { Prisma, Rubric } from '@prisma/client';
import { z } from 'zod';
import { TIERS } from '@blulens/shared';
import type { AuthUser } from '../../common/auth/auth.types';
import { ApiException } from '../../common/errors/api.exception';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';

const rubricCriteriaInputSchema = z.object({
  criteria: z
    .array(
      z.object({
        key: z
          .string()
          .regex(/^[a-z][a-z_]{1,31}$/, 'Invalid key format')
          .describe(
            'Key must start with lowercase letter, contain only lowercase and underscores, 2-32 chars',
          ),
        nameTh: z.string().min(1).max(80).describe('Thai name 1-80 chars'),
        weight: z.number().gt(0).lte(10).describe('Weight must be > 0 and <= 10'),
        anchorsTh: z
          .record(z.enum(TIERS), z.string().max(500))
          .optional()
          .describe('Optional object with tier keys and text <= 500 chars'),
      }),
      { required_error: 'Criteria required', invalid_type_error: 'Criteria must be an array' },
    )
    .min(1)
    .max(12)
    .refine((items) => new Set(items.map((i) => i.key)).size === items.length, {
      message: 'Duplicate criterion key',
    })
    .describe('1-12 items with unique keys'),
});

export type RubricCriteriaInput = z.infer<typeof rubricCriteriaInputSchema>;

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

  toRubric(row: Rubric): RubricResponse {
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
      criteria: row.criteria as RubricResponse['criteria'],
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
      throw new ApiException(
        HttpStatus.CONFLICT,
        'RUBRIC_NOT_FOUND',
        'ไม่พบเวอร์ชันแบบฟอร์มการประเมินทีใช้อยู่',
      );
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
        const openDraft = await tx.rubric.findFirst({
          where: { active: false, activatedAt: null },
        });
        if (openDraft) {
          throw new ApiException(
            HttpStatus.CONFLICT,
            'RUBRIC_DRAFT_EXISTS',
            'มีแบบฟอร์มร่างอยู่แล้ว',
          );
        }
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
    } catch (error) {
      // a concurrent POST hit the rubrics_one_draft index
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ApiException(
          HttpStatus.CONFLICT,
          'RUBRIC_DRAFT_EXISTS',
          'มีแบบฟอร์มร่างอยู่แล้ว',
        );
      }
      throw error;
    }
  }

  async updateDraft(rubricId: string, input: unknown, user: AuthUser): Promise<RubricResponse> {
    // Validate input
    const parseResult = rubricCriteriaInputSchema.safeParse(input);
    if (!parseResult.success) {
      const message = parseResult.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง';
      throw new ApiException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', message);
    }

    const { criteria } = parseResult.data;

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM rubrics WHERE id = ${rubricId}::uuid FOR UPDATE`;
      const rubric = await tx.rubric.findUnique({
        where: { id: rubricId },
      });

      if (!rubric) {
        throw new ApiException(HttpStatus.NOT_FOUND, 'RUBRIC_NOT_FOUND', 'ไม่พบแบบฟอร์มการประเมิน');
      }

      // Check that it's a draft (not active, not activated)
      if (rubric.active || rubric.activatedAt) {
        throw new ApiException(HttpStatus.CONFLICT, 'RUBRIC_NOT_DRAFT', 'แบบฟอร์มนี้ไม่ใช่ร่าง');
      }

      const before = rubric.criteria;
      const updated = await tx.rubric.update({
        where: { id: rubricId },
        data: {
          criteria: criteria as Prisma.InputJsonValue,
        },
      });

      await this.audit.record(
        {
          actorId: user.id,
          action: 'rubric.draft.update',
          entityType: 'rubric',
          entityId: updated.id,
          before: { criteria: before },
          after: { criteria },
        },
        tx,
      );

      return updated;
    });

    return this.toRubric(updated);
  }

  async deleteDraft(rubricId: string, user: AuthUser): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM rubrics WHERE id = ${rubricId}::uuid FOR UPDATE`;
      const rubric = await tx.rubric.findUnique({
        where: { id: rubricId },
      });

      if (!rubric) {
        throw new ApiException(HttpStatus.NOT_FOUND, 'RUBRIC_NOT_FOUND', 'ไม่พบแบบฟอร์มการประเมิน');
      }

      // Check that it's a draft (not active, not activated)
      if (rubric.active || rubric.activatedAt) {
        throw new ApiException(HttpStatus.CONFLICT, 'RUBRIC_NOT_DRAFT', 'แบบฟอร์มนี้ไม่ใช่ร่าง');
      }

      await tx.rubric.delete({
        where: { id: rubricId },
      });

      await this.audit.record(
        {
          actorId: user.id,
          action: 'rubric.draft.delete',
          entityType: 'rubric',
          entityId: rubric.id,
          before: { methodVersion: rubric.methodVersion },
        },
        tx,
      );
    });
  }
}
