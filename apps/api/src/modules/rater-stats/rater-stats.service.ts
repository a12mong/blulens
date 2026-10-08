import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { AuthUser } from '../../common/auth/auth.types';
import { computeRaterStats, type RaterCase } from '@blulens/shared';

export type RaterStatsWindow = '30d' | '90d' | '365d' | 'all';

function getWindowStartDate(window: RaterStatsWindow): Date | null {
  if (window === 'all') return null;
  const days = window === '30d' ? 30 : window === '90d' ? 90 : 365;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

@Injectable()
export class RaterStatsService {
  constructor(private readonly prisma: PrismaService) {}

  async getRaterStats(window: RaterStatsWindow, user: AuthUser) {
    const startDate = getWindowStartDate(window);

    // 1. Query submitted reviews inside the window for kind 'assessment' only
    const reviews = await this.prisma.review.findMany({
      where: {
        assignment: {
          kind: 'assessment',
          assessmentId: { not: null },
        },
        abstained: false,
        overall: { not: null },
        ...(startDate ? { submittedAt: { gte: startDate } } : {}),
      },
      select: {
        id: true,
        overall: true,
        submittedAt: true,
        assignment: {
          select: {
            assessmentId: true,
            reviewerId: true,
          },
        },
      },
    });

    const assessmentIds = Array.from(
      new Set(
        reviews
          .map((r) => r.assignment.assessmentId)
          .filter((id): id is string => typeof id === 'string' && id.length > 0),
      ),
    );

    // 2. Query latest computed AssessmentResult per assessment in one batch query (no N+1)
    const latestResultByAssessmentId = new Map<string, { inputs: unknown }>();
    if (assessmentIds.length > 0) {
      const results = await this.prisma.assessmentResult.findMany({
        where: { assessmentId: { in: assessmentIds } },
        orderBy: { version: 'desc' },
        select: {
          assessmentId: true,
          version: true,
          inputs: true,
        },
      });

      for (const res of results) {
        if (!latestResultByAssessmentId.has(res.assessmentId)) {
          latestResultByAssessmentId.set(res.assessmentId, res);
        }
      }
    }

    // 3. Group reviews by assessmentId into RaterCase[]
    const casesMap = new Map<string, { reviewerId: string; value: number; excluded: boolean }[]>();

    for (const r of reviews) {
      const assessmentId = r.assignment.assessmentId!;
      const latestRes = latestResultByAssessmentId.get(assessmentId);
      const inputs = (latestRes?.inputs as Record<string, unknown> | null) ?? {};
      const reviewIds: string[] = Array.isArray(inputs['reviewIds'])
        ? (inputs['reviewIds'] as string[])
        : [];
      const excludedIndexes: number[] = Array.isArray(inputs['excludedIndexes'])
        ? (inputs['excludedIndexes'] as number[])
        : [];
      const reviewIdx = reviewIds.indexOf(r.id);
      const excluded = reviewIdx !== -1 && excludedIndexes.includes(reviewIdx);

      if (!casesMap.has(assessmentId)) {
        casesMap.set(assessmentId, []);
      }

      casesMap.get(assessmentId)!.push({
        reviewerId: r.assignment.reviewerId,
        value: Number(r.overall),
        excluded,
      });
    }

    const cases: RaterCase[] = Array.from(casesMap.entries()).map(([caseId, caseReviews]) => ({
      caseId,
      reviews: caseReviews,
    }));

    // 4. Compute rater agreement stats using pure domain logic
    const statsCore = computeRaterStats(cases);

    // 5. Visibility filtering by role:
    // Committee / Admin sees all raters + pairs. Reviewer sees only their own row and pairs = [].
    const isCommittee = user.roles.some((role) => role === 'Committee' || role === 'Admin');

    const raters = isCommittee
      ? statsCore.raters
      : statsCore.raters.filter((r) => r.reviewerId === user.id);

    const pairs = isCommittee ? statsCore.pairs : [];

    return {
      window,
      methodVersion: 'grading-v2',
      panel: statsCore.panel,
      raters,
      pairs,
    };
  }
}
