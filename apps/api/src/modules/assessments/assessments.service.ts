import { Injectable, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { ApiException } from '../../common/errors/api.exception';
import type { AuthUser } from '../../common/auth/auth.types';

const DEFAULT_MIN_REVIEWERS = 2; // system default (G3'); becomes a system setting later

@Injectable()
export class AssessmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

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
      throw new ApiException(
        HttpStatus.CONFLICT,
        'RUBRIC_MISSING',
        'ไม่พบแบบประเมิน',
      );
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
