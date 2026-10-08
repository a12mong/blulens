import { Injectable, HttpStatus } from '@nestjs/common';
import { AssessmentStatus, ResultStatus, ResultSource, GradeKind, Prisma } from '@prisma/client';
import type { Assessment, AssessmentResult } from '@prisma/client';
import { GRADE_KEYS, GRADES, gradeIndex, projectGrade, type GradeKey } from '@blulens/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { ApiException } from '../../common/errors/api.exception';
import { toGradeView } from '../../common/grades';
import type { AuthUser } from '../../common/auth/auth.types';

export interface DecideOptions {
  allowedFrom: AssessmentStatus[];
  toStatus: AssessmentStatus;
  reason?: string;
  resultVersion?: number;
  newResult?: {
    status: ResultStatus;
    source: ResultSource;
    score?: Prisma.Decimal | number | null;
    margin?: Prisma.Decimal | number | null;
    lowerIndex?: number | null;
    centerIndex?: number | null;
    upperIndex?: number | null;
    kind?: GradeKind | null;
    label?: string | null;
    nRaters?: number;
    nExcluded?: number;
    spread?: Prisma.Decimal | number | null;
    flags?: string[];
    methodVersion?: string;
    inputs?: Prisma.InputJsonValue;
  };
  action: 'assessment.approve' | 'assessment.return' | 'assessment.confirm' | 'assessment.override';
  validateBeforeTransition?: (
    assessment: Assessment,
    latestResult: AssessmentResult | null,
  ) => void | Promise<void>;
  computeInputs?: (latestInputs: Prisma.JsonValue, latestVersion: number) => Prisma.InputJsonValue;
  buildAuditPayloads?: (
    assessment: Assessment,
    latestResult: AssessmentResult | null,
    newResultVersion: number | null,
  ) => { before: Prisma.InputJsonValue; after: Prisma.InputJsonValue };
  auditBefore?: Prisma.InputJsonValue;
  auditAfter?: Prisma.InputJsonValue;
}

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
      include: {
        subject: {
          select: {
            id: true,
            displayName: true,
            memberships: {
              where: {
                OR: [{ validTo: null }, { validTo: { gt: new Date() } }],
              },
              select: {
                team: { select: { name: true } },
              },
            },
          },
        },
        event: {
          select: {
            id: true,
            discipline: true,
            tournament: { select: { name: true } },
          },
        },
      },
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

    // Batch-load all assessment results for the page
    const allResults =
      pageIds.length > 0
        ? await this.prisma.assessmentResult.findMany({
            where: {
              assessmentId: { in: pageIds },
              ...(isStaff ? {} : { status: 'approved' }),
            },
            orderBy: { version: 'desc' },
            select: {
              id: true,
              assessmentId: true,
              version: true,
              status: true,
              score: true,
              margin: true,
              lowerIndex: true,
              centerIndex: true,
              upperIndex: true,
              kind: true,
              label: true,
            },
          })
        : [];

    // Group results by assessment and determine visible result for each
    const resultsByAssessment = new Map<string, typeof allResults>();
    for (const result of allResults) {
      if (!resultsByAssessment.has(result.assessmentId)) {
        resultsByAssessment.set(result.assessmentId, []);
      }
      resultsByAssessment.get(result.assessmentId)!.push(result);
    }

    const visibleResultMap = new Map<string, (typeof allResults)[0] | null>();
    for (const [assessmentId, results] of resultsByAssessment) {
      // Staff sees latest any status; Members see latest approved only
      const visibleResult = isStaff
        ? (results[0] ?? null)
        : results.find((r) => r.status === 'approved') || null;
      visibleResultMap.set(assessmentId, visibleResult);
    }

    return {
      items: items.map((a) =>
        this.mapAssessment(
          a,
          submittedMap.get(a.id) ?? 0,
          a.reviewsRequired,
          actor,
          visibleResultMap.get(a.id) ?? null,
        ),
      ),
      nextCursor,
    };
  }

  async getDetail(assessmentId: string, actor: AuthUser) {
    const isStaff = actor.roles.some((r) => r === 'Committee' || r === 'Admin');

    const assessment = await this.prisma.assessment.findUnique({
      where: { id: assessmentId },
      include: {
        clips: {
          orderBy: { createdAt: 'asc' },
        },
        subject: {
          select: {
            id: true,
            displayName: true,
            memberships: {
              where: {
                OR: [{ validTo: null }, { validTo: { gt: new Date() } }],
              },
              select: {
                team: { select: { name: true } },
              },
            },
          },
        },
        event: {
          select: {
            id: true,
            discipline: true,
            tournament: { select: { name: true } },
          },
        },
        assignments: {
          include: {
            review: {
              select: { submittedAt: true },
            },
            reviewer: {
              select: { id: true, displayName: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!assessment) {
      throw ApiException.notFound('ไม่พบคำขอประเมิน', 'ASSESSMENT_NOT_FOUND');
    }

    if (!isStaff && assessment.subjectUserId !== actor.id) {
      throw ApiException.notFound('ไม่พบคำขอประเมิน', 'ASSESSMENT_NOT_FOUND');
    }

    const reviewsSubmitted = await this.prisma.reviewAssignment.count({
      where: {
        assessmentId,
        state: 'submitted',
      },
    });

    const clips = assessment.clips.map((c) => ({
      id: c.id,
      status: c.status,
      viewUrl: this.computeViewUrl(c.status, c.objectKey),
      durationSec: c.durationSec,
    }));

    const visibleResultRow = await this.prisma.assessmentResult.findFirst({
      where: {
        assessmentId,
        ...(isStaff ? {} : { status: 'approved' }),
      },
      orderBy: { version: 'desc' },
    });

    let latestResult = null;
    let reviewerRows: any[] = [];

    if (visibleResultRow) {
      latestResult = {
        version: visibleResultRow.version,
        source: visibleResultRow.source,
        status: visibleResultRow.status,
        grade: toGradeView(visibleResultRow),
        nRaters: visibleResultRow.nRaters,
        nExcluded: visibleResultRow.nExcluded,
        spread: visibleResultRow.spread !== null ? Number(visibleResultRow.spread) : null,
        flags: visibleResultRow.flags,
        methodVersion: visibleResultRow.methodVersion,
        reason: visibleResultRow.reason,
        computedAt: visibleResultRow.computedAt.toISOString(),
        computedBy: visibleResultRow.computedBy,
      };

      if (isStaff) {
        const inputs = (visibleResultRow.inputs as any) ?? {};
        const reviewIds: string[] = Array.isArray(inputs.reviewIds) ? inputs.reviewIds : [];
        const scores: (number | null)[] = Array.isArray(inputs.scores) ? inputs.scores : [];
        const excludedIndexes: number[] = Array.isArray(inputs.excludedIndexes)
          ? inputs.excludedIndexes
          : [];

        if (reviewIds.length > 0) {
          const reviews = await this.prisma.review.findMany({
            where: { id: { in: reviewIds } },
            include: {
              assignment: {
                include: {
                  reviewer: {
                    select: { id: true, displayName: true },
                  },
                },
              },
              scores: {
                select: { criterion: true, gradeIndex: true },
              },
            },
          });

          let rubricCriteriaKeys: string[] = [];
          if (assessment.rubricId) {
            const rubric = await this.prisma.rubric.findUnique({
              where: { id: assessment.rubricId },
            });
            if (rubric && Array.isArray(rubric.criteria)) {
              rubricCriteriaKeys = (rubric.criteria as any[]).map((c) => c.key);
            }
          }

          const reviewMap = new Map(reviews.map((r) => [r.id, r]));

          reviewerRows = reviewIds.map((reviewId, i) => {
            const r = reviewMap.get(reviewId);
            const reviewerId = r?.assignment?.reviewer?.id ?? '';
            const reviewerName = r?.assignment?.reviewer?.displayName ?? '';
            const criteria = (r?.scores ?? []).map((s) => ({
              criterion: s.criterion,
              gradeKey:
                s.gradeIndex !== null && s.gradeIndex !== undefined
                  ? (GRADE_KEYS[s.gradeIndex] ?? null)
                  : null,
            }));

            if (rubricCriteriaKeys.length > 0) {
              criteria.sort((a, b) => {
                const ia = rubricCriteriaKeys.indexOf(a.criterion);
                const ib = rubricCriteriaKeys.indexOf(b.criterion);
                return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
              });
            }

            return {
              reviewerId,
              reviewerName,
              overall:
                typeof scores[i] === 'number' ? scores[i] : r?.overall ? Number(r.overall) : null,
              excluded: excludedIndexes.includes(i),
              robustZ: null,
              reviewerBias: null,
              pairKappa: null,
              criteria,
            };
          });
        }
      }
    }

    return {
      ...this.mapAssessment(
        assessment,
        reviewsSubmitted,
        assessment.reviewsRequired,
        actor,
        visibleResultRow ?? null,
      ),
      clips,
      latestResult,
      reviewerRows,
    };
  }

  private computeViewUrl(status: string, objectKey: string): string | null {
    if (status !== 'uploaded') {
      return null;
    }
    if (
      objectKey.startsWith('/') ||
      objectKey.startsWith('http://') ||
      objectKey.startsWith('https://')
    ) {
      return objectKey;
    }
    return null;
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
      const conflict = await this.hasConflict(reviewerId, assessment.subjectUserId);
      if (conflict.hasConflict) {
        throw new ApiException(
          HttpStatus.CONFLICT,
          'REVIEWER_CONFLICT_OF_INTEREST',
          'กรรมการติดส่วนได้เสียกับผู้เล่น',
          { reviewerId, teamIds: conflict.teamIds },
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

  private async hasConflict(
    userId: string,
    subjectUserId: string,
  ): Promise<{ hasConflict: boolean; teamIds: string[] }> {
    if (userId === subjectUserId) {
      return { hasConflict: true, teamIds: [] };
    }

    const now = new Date();
    const sharedTeams = await this.prisma.teamMembership.findMany({
      where: {
        teamId: {
          in: (
            await this.prisma.teamMembership.findMany({
              where: {
                userId: subjectUserId,
                validFrom: { lte: now },
                OR: [{ validTo: null }, { validTo: { gt: now } }],
              },
              select: { teamId: true },
            })
          ).map((m) => m.teamId),
        },
        userId,
        validFrom: { lte: now },
        OR: [{ validTo: null }, { validTo: { gt: now } }],
      },
      select: { teamId: true },
    });

    if (sharedTeams.length > 0) {
      return { hasConflict: true, teamIds: sharedTeams.map((t) => t.teamId) };
    }

    return { hasConflict: false, teamIds: [] };
  }

  async approve(
    assessmentId: string,
    actor: AuthUser,
    body: { resultVersion?: number; note?: string },
  ) {
    const trimmedNote = body?.note?.trim();
    return this.decide(assessmentId, actor, {
      allowedFrom: [AssessmentStatus.pending_approval, AssessmentStatus.disputed],
      toStatus: AssessmentStatus.approved,
      reason: trimmedNote || undefined,
      resultVersion: body?.resultVersion,
      newResult: {
        status: ResultStatus.approved,
        source: ResultSource.computed,
      },
      action: 'assessment.approve',
      validateBeforeTransition: (assessment) => {
        if (assessment.status === AssessmentStatus.disputed) {
          if (!trimmedNote || trimmedNote.length < 5) {
            throw new ApiException(
              HttpStatus.UNPROCESSABLE_ENTITY,
              'ASSESSMENT_APPROVE_NOTE_REQUIRED',
              'ต้องระบุเหตุผลในการอนุมัติผลที่ข้อพิพาทอย่างน้อย 5 ตัวอักษร',
            );
          }
        }
      },
    });
  }

  async return(
    assessmentId: string,
    actor: AuthUser,
    body: { reason?: string; resultVersion?: number },
  ) {
    const trimmedReason = (body?.reason ?? '').trim();
    if (trimmedReason.length < 5 || trimmedReason.length > 2000) {
      throw new ApiException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'REASON_REQUIRED',
        'ต้องระบุเหตุผลความยาวระหว่าง 5 ถึง 2,000 ตัวอักษร',
      );
    }

    return this.decide(assessmentId, actor, {
      allowedFrom: [AssessmentStatus.pending_approval, AssessmentStatus.disputed],
      toStatus: AssessmentStatus.in_review,
      reason: trimmedReason,
      resultVersion: body?.resultVersion,
      action: 'assessment.return',
    });
  }

  async confirm(
    assessmentId: string,
    actor: AuthUser,
    body: { resultVersion?: number; note?: string },
  ) {
    const assessment = await this.prisma.assessment.findUnique({
      where: { id: assessmentId },
    });
    if (!assessment) {
      throw ApiException.notFound('ไม่พบคำขอประเมิน', 'ASSESSMENT_NOT_FOUND');
    }

    if (assessment.status !== AssessmentStatus.provisional) {
      throw new ApiException(
        HttpStatus.CONFLICT,
        'ASSESSMENT_NOT_PROVISIONAL',
        'ยืนยันได้เฉพาะผลการประเมินชั่วคราว',
      );
    }

    const trimmedNote = body?.note?.trim();
    return this.decide(assessmentId, actor, {
      allowedFrom: [AssessmentStatus.provisional],
      toStatus: AssessmentStatus.approved,
      reason: trimmedNote || undefined,
      resultVersion: body?.resultVersion,
      newResult: {
        status: ResultStatus.approved,
        source: ResultSource.computed,
      },
      action: 'assessment.confirm',
    });
  }

  async override(
    assessmentId: string,
    actor: AuthUser,
    body: { centerKey: GradeKey; reason?: string; resultVersion?: number },
  ) {
    const assessment = await this.prisma.assessment.findUnique({
      where: { id: assessmentId },
    });
    if (!assessment) {
      throw ApiException.notFound('ไม่พบคำขอประเมิน', 'ASSESSMENT_NOT_FOUND');
    }

    const conflict = await this.hasConflict(actor.id, assessment.subjectUserId);
    if (conflict.hasConflict) {
      throw new ApiException(
        HttpStatus.FORBIDDEN,
        'OVERRIDE_CONFLICT_OF_INTEREST',
        'กรรมการติดส่วนได้เสียกับผู้เล่น ไม่สามารถกำหนดเกรดเองได้',
        { teamIds: conflict.teamIds },
      );
    }

    const trimmedReason = (body?.reason ?? '').trim();
    if (trimmedReason.length < 20 || trimmedReason.length > 2000) {
      throw new ApiException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'REASON_TOO_SHORT',
        'ต้องระบุเหตุผลความยาวระหว่าง 20 ถึง 2,000 ตัวอักษร',
      );
    }

    const idx = gradeIndex(body.centerKey);
    const score = idx + 0.5;
    const margin = 0;
    const gradeView = projectGrade(score, margin);

    // TODO(bl-10 jobs): notify all Committee (G7)

    return this.decide(assessmentId, actor, {
      allowedFrom: [
        AssessmentStatus.pending_approval,
        AssessmentStatus.disputed,
        AssessmentStatus.approved,
        AssessmentStatus.provisional,
      ],
      toStatus: AssessmentStatus.overridden,
      reason: trimmedReason,
      resultVersion: body.resultVersion,
      newResult: {
        status: ResultStatus.overridden,
        source: ResultSource.override,
        score,
        margin,
        lowerIndex: idx,
        centerIndex: idx,
        upperIndex: idx,
        kind: 'exact',
        label: gradeView.label,
        flags: ['OVERRIDE'],
      },
      action: 'assessment.override',
      computeInputs: (latestInputs, latestVersion) => ({
        ...(latestInputs as any),
        overrideOf: latestVersion,
      }),
      buildAuditPayloads: (assess, latest, newResultVersion) => ({
        before: {
          status: assess.status,
          label: latest?.label ?? null,
          version: latest?.version ?? null,
        },
        after: {
          status: AssessmentStatus.overridden,
          label: gradeView.label,
          version: newResultVersion,
        },
      }),
    });
  }

  private async decide(assessmentId: string, actor: AuthUser, opts: DecideOptions) {
    await this.prisma.$transaction(async (tx) => {
      // 1. Load the assessment + latest result (highest version). Not found -> 404 ASSESSMENT_NOT_FOUND.
      const assessment = await tx.assessment.findUnique({
        where: { id: assessmentId },
      });
      if (!assessment) {
        throw ApiException.notFound('ไม่พบคำขอประเมิน', 'ASSESSMENT_NOT_FOUND');
      }

      const latest = await tx.assessmentResult.findFirst({
        where: { assessmentId },
        orderBy: { version: 'desc' },
      });

      // 2. status not in allowedFrom -> 409 ASSESSMENT_INVALID_TRANSITION { from, allowed }.
      if (!opts.allowedFrom.includes(assessment.status)) {
        throw new ApiException(
          HttpStatus.CONFLICT,
          'ASSESSMENT_INVALID_TRANSITION',
          'สถานะไม่อยู่ในเงื่อนไขที่เปลี่ยนได้',
          { from: assessment.status, allowed: opts.allowedFrom },
        );
      }

      if (opts.validateBeforeTransition) {
        await opts.validateBeforeTransition(assessment, latest);
      }

      // 3. resultVersion given and != latest.version -> 409 RESULT_VERSION_STALE { latest }.
      if (opts.resultVersion !== undefined && latest && latest.version !== opts.resultVersion) {
        throw new ApiException(
          HttpStatus.CONFLICT,
          'RESULT_VERSION_STALE',
          'ผลการประเมินมีการเปลี่ยนแปลงแล้ว',
          { latest: latest.version },
        );
      }

      // 4. updateMany optimistic locking
      const updateRes = await tx.assessment.updateMany({
        where: {
          id: assessmentId,
          status: assessment.status,
          version: assessment.version,
        },
        data: {
          status: opts.toStatus,
          version: { increment: 1 },
        },
      });

      if (updateRes.count === 0) {
        throw new ApiException(
          HttpStatus.CONFLICT,
          'ASSESSMENT_STATE_CHANGED',
          'สถานะการประเมินถูกเปลี่ยนไปก่อนหน้าแล้ว',
        );
      }

      // 5. If newResult: insert AssessmentResult version = latest.version + 1
      let newResultVersion = latest?.version ?? null;
      if (opts.newResult) {
        if (!latest) {
          throw new ApiException(
            HttpStatus.CONFLICT,
            'ASSESSMENT_RESULT_MISSING',
            'ไม่พบผลการประเมินเดิมเพื่อต่อยอด',
          );
        }
        newResultVersion = latest.version + 1;
        await tx.assessmentResult.create({
          data: {
            assessmentId,
            version: newResultVersion,
            source: opts.newResult.source,
            status: opts.newResult.status,
            score: opts.newResult.score !== undefined ? opts.newResult.score : latest.score,
            margin: opts.newResult.margin !== undefined ? opts.newResult.margin : latest.margin,
            lowerIndex:
              opts.newResult.lowerIndex !== undefined
                ? opts.newResult.lowerIndex
                : latest.lowerIndex,
            centerIndex:
              opts.newResult.centerIndex !== undefined
                ? opts.newResult.centerIndex
                : latest.centerIndex,
            upperIndex:
              opts.newResult.upperIndex !== undefined
                ? opts.newResult.upperIndex
                : latest.upperIndex,
            kind: opts.newResult.kind !== undefined ? opts.newResult.kind : latest.kind,
            label: opts.newResult.label !== undefined ? opts.newResult.label : latest.label,
            nRaters: opts.newResult.nRaters !== undefined ? opts.newResult.nRaters : latest.nRaters,
            nExcluded:
              opts.newResult.nExcluded !== undefined ? opts.newResult.nExcluded : latest.nExcluded,
            spread: opts.newResult.spread !== undefined ? opts.newResult.spread : latest.spread,
            flags: opts.newResult.flags !== undefined ? opts.newResult.flags : latest.flags,
            methodVersion:
              opts.newResult.methodVersion !== undefined
                ? opts.newResult.methodVersion
                : latest.methodVersion,
            inputs:
              opts.computeInputs && latest
                ? opts.computeInputs(latest.inputs, latest.version)
                : opts.newResult.inputs !== undefined
                  ? (opts.newResult.inputs as Prisma.InputJsonValue)
                  : (latest.inputs as Prisma.InputJsonValue),
            reason: opts.reason ?? null,
            computedBy: actor.id,
          },
        });
      }

      // 6. Insert AssessmentTransition + AuditService.record
      await tx.assessmentTransition.create({
        data: {
          assessmentId,
          fromStatus: assessment.status,
          toStatus: opts.toStatus,
          actorId: actor.id,
          reason: opts.reason ?? null,
        },
      });

      let auditBefore: Prisma.InputJsonValue = opts.auditBefore ?? {
        status: assessment.status,
        resultVersion: latest?.version ?? null,
      };
      let auditAfter: Prisma.InputJsonValue = opts.auditAfter ?? {
        status: opts.toStatus,
        resultVersion: newResultVersion,
      };

      if (opts.buildAuditPayloads) {
        const custom = opts.buildAuditPayloads(assessment, latest, newResultVersion);
        auditBefore = custom.before;
        auditAfter = custom.after;
      }

      await this.audit.record(
        {
          actorId: actor.id,
          action: opts.action,
          entityType: 'assessment',
          entityId: assessmentId,
          before: auditBefore,
          after: auditAfter,
          reason: opts.reason ?? undefined,
        },
        tx,
      );
    });

    return this.getDetail(assessmentId, actor);
  }

  private mapAssessment(
    assessment: any,
    reviewsSubmitted: number,
    reviewsRequired: number,
    actor?: AuthUser,
    visibleResult?: any,
  ) {
    const isStaff = actor ? actor.roles.some((r) => r === 'Committee' || r === 'Admin') : false;

    const clubNames = assessment.subject?.memberships
      ? Array.from(new Set(assessment.subject.memberships.map((m: any) => m.team.name))).sort()
      : [];

    const subject = assessment.subject
      ? {
          userId: assessment.subject.id,
          displayName: assessment.subject.displayName,
          clubNames,
        }
      : null;

    const event = assessment.event
      ? {
          id: assessment.event.id,
          discipline: assessment.event.discipline,
          tournamentName: assessment.event.tournament?.name ?? null,
        }
      : null;

    const assignments =
      isStaff && assessment.assignments
        ? assessment.assignments.map((a: any) => ({
            id: a.id,
            state: a.state,
            dueAt: a.dueAt,
            submittedAt: a.review?.submittedAt ?? null,
            reviewerId: a.reviewer.id,
            reviewerName: a.reviewer.displayName,
          }))
        : [];

    // Calculate latestGrade and latestResultVersion based on visible result
    const latestGrade = visibleResult ? toGradeView(visibleResult) : null;
    const latestResultVersion = visibleResult?.version ?? null;

    return {
      id: assessment.id,
      subjectUserId: assessment.subjectUserId,
      eventId: assessment.eventId,
      status: assessment.status,
      note: assessment.note,
      subject,
      event,
      reviewsSubmitted,
      reviewsRequired,
      ...(assessment.assignments ? { assignments } : {}),
      latestGrade,
      latestResultVersion,
      createdAt: assessment.createdAt,
      updatedAt: assessment.updatedAt,
    };
  }
}
