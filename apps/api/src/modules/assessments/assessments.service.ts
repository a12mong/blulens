import { Injectable, HttpStatus } from '@nestjs/common';
import { AssessmentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { ApiException } from '../../common/errors/api.exception';
import type { AuthUser } from '../../common/auth/auth.types';

const DEFAULT_MIN_REVIEWERS = 2; // system default (G3'); becomes a system setting later

export interface ListAssessmentsParams {
  cursor?: string;
  limit: number;
  status?: AssessmentStatus;
  subjectUserId?: string;
  sort?: string;
}

@Injectable()
export class AssessmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(actor: AuthUser, query: ListAssessmentsParams) {
    const isStaff = actor.roles.some((r) => r === 'Committee' || r === 'Admin');
    const where: Prisma.AssessmentWhereInput = {
      subjectUserId: isStaff ? query.subjectUserId : actor.id,
      ...(query.status ? { status: query.status } : {}),
    };

    const sort = query.sort || 'createdAt:desc';
    const [sortField, dir] = sort.split(':') as [
      'createdAt' | 'updatedAt' | 'status',
      'asc' | 'desc',
    ];
    const orderBy: Prisma.AssessmentOrderByWithRelationInput[] = [
      { [sortField]: dir },
      { id: dir },
    ];

    const rows = await this.prisma.assessment.findMany({
      where,
      orderBy,
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });

    const hasMore = rows.length > query.limit;
    const items = hasMore ? rows.slice(0, query.limit) : rows;
    const nextCursor = hasMore ? items[items.length - 1]!.id : null;

    const pageIds = items.map((a) => a.id);
    const submittedCounts =
      pageIds.length > 0
        ? await this.prisma.reviewAssignment.groupBy({
            by: ['assessmentId'],
            where: {
              assessmentId: { in: pageIds },
              state: 'submitted',
            },
            _count: { _all: true },
          })
        : [];

    const submittedMap = new Map<string, number>();
    for (const c of submittedCounts) {
      if (c.assessmentId) {
        submittedMap.set(c.assessmentId, c._count._all);
      }
    }

    return {
      items: items.map((a) =>
        this.mapAssessment(a, submittedMap.get(a.id) ?? 0, a.reviewsRequired),
      ),
      nextCursor,
    };
  }

  async create(
    actor: AuthUser,
    body: {
      note?: string;
      eventId?: string;
    },
  ) {
    // Check if event exists if provided
    if (body.eventId) {
      const event = await this.prisma.event.findUnique({
        where: { id: body.eventId },
      });
      if (!event) {
        throw ApiException.notFound('ไม่พบรายการแข่ง', 'EVENT_NOT_FOUND');
      }
    }

    // Create assessment
    const assessment = await this.prisma.assessment.create({
      data: {
        subjectUserId: actor.id,
        eventId: body.eventId || null,
        status: 'draft',
        note: body.note || null,
      },
    });

    // Audit
    await this.audit.record({
      actorId: actor.id,
      action: 'assessment.create',
      entityType: 'assessment',
      entityId: assessment.id,
      after: { status: assessment.status },
    });

    return this.mapAssessment(assessment, 0, DEFAULT_MIN_REVIEWERS);
  }

  async submit(assessmentId: string, actor: AuthUser) {
    // Load assessment
    const assessment = await this.prisma.assessment.findUnique({
      where: { id: assessmentId },
    });

    if (!assessment || assessment.subjectUserId !== actor.id) {
      throw ApiException.notFound('ไม่พบคำขอประเมิน', 'ASSESSMENT_NOT_FOUND');
    }

    // Check status is draft
    if (assessment.status !== 'draft') {
      throw new ApiException(
        HttpStatus.CONFLICT,
        'ASSESSMENT_NOT_DRAFT',
        'ส่งได้เฉพาะคำขอที่เป็นร่าง',
      );
    }

    // Check at least one uploaded clip
    const clipCount = await this.prisma.clip.count({
      where: {
        assessmentId,
        status: 'uploaded',
      },
    });

    if (clipCount === 0) {
      throw new ApiException(
        HttpStatus.CONFLICT,
        'ASSESSMENT_NO_CLIP',
        'ต้องอัปโหลดคลิปอย่างน้อย 1 คลิปก่อนส่ง',
      );
    }

    // Check active rubric exists
    const activeRubric = await this.prisma.rubric.findFirst({
      where: { active: true },
    });

    if (!activeRubric) {
      throw new ApiException(HttpStatus.CONFLICT, 'RUBRIC_MISSING', 'ไม่พบแบบประเมิน');
    }

    // Get reviewsRequired from event or default
    let reviewsRequired = DEFAULT_MIN_REVIEWERS;
    if (assessment.eventId) {
      const event = await this.prisma.event.findUnique({
        where: { id: assessment.eventId },
      });
      if (event?.minReviewers) {
        reviewsRequired = event.minReviewers;
      }
    }

    // Submit in transaction
    const updated = await this.prisma.$transaction(async (tx) => {
      // Update assessment
      const result = await tx.assessment.updateMany({
        where: { id: assessmentId, status: 'draft' },
        data: {
          status: 'submitted',
          submittedAt: new Date(),
          rubricId: activeRubric.id,
          reviewsRequired,
          version: { increment: 1 },
        },
      });

      if (result.count === 0) {
        throw new ApiException(
          HttpStatus.CONFLICT,
          'ASSESSMENT_NOT_DRAFT',
          'ส่งได้เฉพาะคำขอที่เป็นร่าง',
        );
      }

      // Insert transition
      await tx.assessmentTransition.create({
        data: {
          assessmentId,
          fromStatus: 'draft',
          toStatus: 'submitted',
          actorId: actor.id,
        },
      });

      // Audit
      await this.audit.record(
        {
          actorId: actor.id,
          action: 'assessment.submit',
          entityType: 'assessment',
          entityId: assessmentId,
          after: { status: 'submitted' },
        },
        tx,
      );

      return tx.assessment.findUniqueOrThrow({
        where: { id: assessmentId },
      });
    });

    return this.mapAssessment(updated, 0, updated.reviewsRequired);
  }

  async assign(
    assessmentId: string,
    actor: AuthUser,
    body: {
      reviewerIds: string[];
      dueAt?: string;
    },
  ) {
    // Load assessment
    const assessment = await this.prisma.assessment.findUnique({
      where: { id: assessmentId },
      include: { subject: true },
    });

    if (!assessment) {
      throw ApiException.notFound('ไม่พบคำขอประเมิน', 'ASSESSMENT_NOT_FOUND');
    }

    // Check status is assignable
    const assignableStatuses = ['submitted', 'in_review', 'needs_reviewers'];
    if (!assignableStatuses.includes(assessment.status)) {
      throw new ApiException(
        HttpStatus.CONFLICT,
        'ASSESSMENT_NOT_ASSIGNABLE',
        'มอบหมายกรรมการได้เฉพาะคำขอที่ส่งแล้วหรือกำลังประเมิน',
      );
    }

    // Set default dueAt (now + 72 hours)
    const dueAt = body.dueAt ? new Date(body.dueAt) : new Date(Date.now() + 72 * 60 * 60 * 1000);

    // Validate reviewers and check conflicts
    for (const reviewerId of body.reviewerIds) {
      // Check reviewer exists and has Reviewer role
      const reviewer = await this.prisma.user.findUnique({
        where: { id: reviewerId },
        include: { roles: true },
      });

      if (!reviewer || !reviewer.roles.some((r) => r.role === 'Reviewer')) {
        throw new ApiException(
          HttpStatus.CONFLICT,
          'REVIEWER_NOT_ELIGIBLE',
          'ผู้ใช้นี้ไม่ใช่กรรมการ',
          { reviewerId },
        );
      }

      // Check for conflict of interest
      if (reviewerId === assessment.subjectUserId) {
        throw new ApiException(
          HttpStatus.CONFLICT,
          'REVIEWER_CONFLICT_OF_INTEREST',
          'กรรมการติดส่วนได้เสียกับผู้เล่น',
          { reviewerId, teamIds: [] },
        );
      }

      // Check shared teams (current memberships)
      const now = new Date();
      const sharedTeams = await this.prisma.teamMembership.findMany({
        where: {
          teamId: {
            in: (
              await this.prisma.teamMembership.findMany({
                where: {
                  userId: assessment.subjectUserId,
                  validFrom: { lte: now },
                  OR: [{ validTo: null }, { validTo: { gt: now } }],
                },
                select: { teamId: true },
              })
            ).map((m) => m.teamId),
          },
          userId: reviewerId,
          validFrom: { lte: now },
          OR: [{ validTo: null }, { validTo: { gt: now } }],
        },
        select: { teamId: true },
      });

      if (sharedTeams.length > 0) {
        throw new ApiException(
          HttpStatus.CONFLICT,
          'REVIEWER_CONFLICT_OF_INTEREST',
          'กรรมการติดส่วนได้เสียกับผู้เล่น',
          { reviewerId, teamIds: sharedTeams.map((t) => t.teamId) },
        );
      }
    }

    // Assign in transaction
    const updated = await this.prisma.$transaction(async (tx) => {
      // Create review assignments
      for (const reviewerId of body.reviewerIds) {
        try {
          await tx.reviewAssignment.create({
            data: {
              kind: 'assessment',
              assessmentId,
              reviewerId,
              dueAt,
              assignedBy: actor.id,
            },
          });
        } catch (error: any) {
          if (error.code === 'P2002') {
            throw new ApiException(
              HttpStatus.CONFLICT,
              'REVIEWER_ALREADY_ASSIGNED',
              'กรรมการนี้ได้รับมอบหมายแล้ว',
              { reviewerId },
            );
          }
          throw error;
        }
      }

      // Update assessment status if needed
      if (['submitted', 'needs_reviewers'].includes(assessment.status)) {
        const result = await tx.assessment.updateMany({
          where: { id: assessmentId, status: { in: ['submitted', 'needs_reviewers'] } },
          data: {
            status: 'in_review',
            version: { increment: 1 },
          },
        });

        if (result.count === 0) {
          throw new ApiException(
            HttpStatus.CONFLICT,
            'ASSESSMENT_NOT_ASSIGNABLE',
            'มอบหมายกรรมการได้เฉพาะคำขอที่ส่งแล้วหรือกำลังประเมิน',
          );
        }

        // Insert transition
        await tx.assessmentTransition.create({
          data: {
            assessmentId,
            fromStatus: assessment.status,
            toStatus: 'in_review',
            actorId: actor.id,
          },
        });
      }

      // Audit
      await this.audit.record(
        {
          actorId: actor.id,
          action: 'assessment.assign',
          entityType: 'assessment',
          entityId: assessmentId,
          after: { reviewerIds: body.reviewerIds, dueAt },
        },
        tx,
      );

      return tx.assessment.findUniqueOrThrow({
        where: { id: assessmentId },
      });
    });

    return this.mapAssessment(updated, 0, updated.reviewsRequired);
  }

  private mapAssessment(assessment: any, reviewsSubmitted: number, reviewsRequired: number) {
    return {
      id: assessment.id,
      subjectUserId: assessment.subjectUserId,
      eventId: assessment.eventId,
      status: assessment.status,
      note: assessment.note,
      reviewsSubmitted,
      reviewsRequired,
      createdAt: assessment.createdAt,
      updatedAt: assessment.updatedAt,
    };
  }
}
