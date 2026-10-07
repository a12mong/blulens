import { Injectable } from '@nestjs/common';
import { ApiException } from '../../common/errors/api.exception';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

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
}
