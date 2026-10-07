import { Injectable } from '@nestjs/common';
import {
  aggregateAssessment,
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

      if (assignment.kind === 'assessment' && assignment.assessmentId) {
        const openLeft = await tx.reviewAssignment.count({
          where: {
            assessmentId: assignment.assessmentId,
            state: 'open',
          },
        });

        if (openLeft === 0) {
          const submittedReviews = await tx.review.findMany({
            where: {
              assignment: {
                assessmentId: assignment.assessmentId,
                state: 'submitted',
              },
              abstained: false,
            },
            orderBy: [{ submittedAt: 'asc' }, { id: 'asc' }],
          });

          const reviewIds = submittedReviews.map((rev) => rev.id);
          const scores = submittedReviews.map((rev) => Number(rev.overall));

          const assessment = await tx.assessment.findUnique({
            where: { id: assignment.assessmentId },
            include: {
              event: {
                select: { minReviewers: true },
              },
            },
          });

          if (!assessment) {
            throw ApiException.notFound('ไม่พบการประเมินที่ต้องการ', 'ASSESSMENT_NOT_FOUND');
          }

          const minReviewers = assessment.event?.minReviewers ?? 2;
          const agg = aggregateAssessment(scores, minReviewers);

          const maxResult = await tx.assessmentResult.findFirst({
            where: { assessmentId: assessment.id },
            orderBy: { version: 'desc' },
            select: { version: true },
          });
          const version = (maxResult?.version ?? 0) + 1;

          await tx.assessmentResult.create({
            data: {
              assessmentId: assessment.id,
              version,
              source: 'computed',
              status: agg.status,
              score: agg.score,
              margin: agg.margin,
              lowerIndex: agg.grade ? GRADE_KEYS.indexOf(agg.grade.lower) : null,
              centerIndex: agg.grade ? GRADE_KEYS.indexOf(agg.grade.center) : null,
              upperIndex: agg.grade ? GRADE_KEYS.indexOf(agg.grade.upper) : null,
              kind: agg.grade?.kind ?? null,
              label: agg.grade?.label ?? null,
              nRaters: agg.nRaters,
              nExcluded: agg.nExcluded,
              spread: agg.spread,
              flags: agg.flags,
              methodVersion: 'grading-v2',
              inputs: {
                reviewIds,
                scores,
                excludedIndexes: agg.excludedIndexes,
                minReviewers,
                suggestThirdReviewer: agg.suggestThirdReviewer,
              },
              computedBy: null,
            },
          });

          const { count: assessmentCount } = await tx.assessment.updateMany({
            where: {
              id: assessment.id,
              status: assessment.status,
            },
            data: {
              status: agg.status,
            },
          });

          if (assessmentCount === 0) {
            throw ApiException.conflict(
              'ASSESSMENT_STATE_CHANGED',
              'สถานะการประเมินเปลี่ยนไปแล้ว กรุณาโหลดใหม่',
            );
          }

          await tx.assessmentTransition.create({
            data: {
              assessmentId: assessment.id,
              fromStatus: assessment.status,
              toStatus: agg.status,
              actorId: null,
              reason: 'aggregate',
            },
          });

          await this.audit.record(
            {
              actorId: actor.id,
              action: 'assessment.result',
              entityType: 'assessment',
              entityId: assessment.id,
              after: {
                version,
                status: agg.status,
                label: agg.grade?.label ?? null,
              },
              ip,
            },
            tx,
          );
        }
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
