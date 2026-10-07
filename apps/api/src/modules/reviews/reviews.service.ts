import { Injectable } from '@nestjs/common';
import {
  GRADE_KEYS,
  reviewerScore,
  type CriterionScore,
  type ReviewerScore,
  type RubricCriterion,
} from '@blulens/shared';
import { AuditService } from '../../common/audit/audit.service';
import type { AuthUser } from '../../common/auth/auth.types';
import { ApiException } from '../../common/errors/api.exception';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { ReviewInputDto } from './reviews.controller';

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getActiveRubric() {
    const rubric = await this.prisma.rubric.findFirst({
      where: { active: true },
      select: {
        methodVersion: true,
        criteria: true,
      },
    });

    if (!rubric) {
      throw ApiException.notFound('ไม่พบเกณฑ์การประเมิน', 'RUBRIC_NOT_FOUND');
    }

    return {
      methodVersion: rubric.methodVersion,
      criteria: rubric.criteria,
    };
  }

  async getMyAssignments(reviewerId: string, state?: 'open' | 'submitted' | 'expired') {
    const rows = await this.prisma.reviewAssignment.findMany({
      where: {
        reviewerId,
        ...(state ? { state } : {}),
      },
      orderBy: [{ dueAt: 'asc' }, { id: 'asc' }],
      include: {
        review: {
          select: {
            submittedAt: true,
          },
        },
      },
    });

    return rows.map((r) => ({
      id: r.id,
      state: r.state,
      dueAt: r.dueAt.toISOString(),
      submittedAt: r.review?.submittedAt ? r.review.submittedAt.toISOString() : null,
    }));
  }

  async submit(assignmentId: string, input: ReviewInputDto, actor: AuthUser, ip?: string) {
    return this.prisma.$transaction(async (tx) => {
      const assignment = await tx.reviewAssignment.findUnique({
        where: { id: assignmentId },
        include: {
          assessment: { select: { rubricId: true } },
        },
      });

      if (!assignment || assignment.reviewerId !== actor.id) {
        throw ApiException.notFound('ไม่พบงานตรวจที่ต้องการ', 'ASSIGNMENT_NOT_FOUND');
      }

      if (assignment.state === 'submitted') {
        throw ApiException.conflict(
          'REVIEW_ALREADY_SUBMITTED',
          'ส่งผลการประเมินแล้ว ไม่สามารถแก้ไขได้',
        );
      }

      const now = new Date();
      if (
        assignment.state === 'expired' ||
        assignment.state === 'declined' ||
        assignment.dueAt < now
      ) {
        throw ApiException.conflict('ASSIGNMENT_EXPIRED', 'งานตรวจนี้หมดเวลาแล้ว');
      }

      let rubric = null;
      if (assignment.kind === 'assessment') {
        if (assignment.assessment?.rubricId) {
          rubric = await tx.rubric.findUnique({
            where: { id: assignment.assessment.rubricId },
          });
        }
        if (!rubric) {
          rubric = await tx.rubric.findFirst({ where: { active: true } });
        }
      } else {
        rubric = await tx.rubric.findFirst({ where: { active: true } });
      }

      if (!rubric) {
        throw ApiException.notFound('ไม่พบเกณฑ์การประเมิน', 'RUBRIC_NOT_FOUND');
      }

      const mappedScores: CriterionScore[] = input.scores.map((s) => ({
        criterion: s.criterion,
        gradeIndex: s.gradeKey === null ? null : GRADE_KEYS.indexOf(s.gradeKey),
      }));

      let r: ReviewerScore;
      try {
        r = reviewerScore(mappedScores, rubric.criteria as unknown as RubricCriterion[]);
      } catch (err) {
        if (err instanceof RangeError) {
          throw ApiException.badRequest('VALIDATION_FAILED', err.message);
        }
        throw err;
      }

      const submittedAt = new Date();
      await tx.review.create({
        data: {
          assignmentId,
          comment: input.comment ? input.comment.trim() : null,
          overall: r.abstained ? null : r.overall,
          abstained: r.abstained,
          submittedAt,
          scores: {
            create: mappedScores.map((s) => ({
              criterion: s.criterion,
              gradeIndex: s.gradeIndex,
            })),
          },
        },
      });

      const { count } = await tx.reviewAssignment.updateMany({
        where: {
          id: assignmentId,
          state: 'open',
        },
        data: {
          state: 'submitted',
        },
      });

      if (count === 0) {
        throw ApiException.conflict(
          'REVIEW_ALREADY_SUBMITTED',
          'ส่งผลการประเมินแล้ว ไม่สามารถแก้ไขได้',
        );
      }

      await this.audit.record(
        {
          actorId: actor.id,
          action: 'review.submit',
          entityType: 'review_assignment',
          entityId: assignmentId,
          after: { abstained: r.abstained },
          ip,
        },
        tx,
      );

      return {
        id: assignment.id,
        state: 'submitted' as const,
        dueAt: assignment.dueAt.toISOString(),
        submittedAt: submittedAt.toISOString(),
      };
    });
  }
}
