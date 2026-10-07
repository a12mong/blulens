import type { AssessmentResult, Prisma } from '@prisma/client';
import { GRADE_KEYS } from '@blulens/shared';

/** openapi GradeView from a stored result snapshot (G9: lower/upper/kind/label are stored, never re-projected). */
export function toGradeView(r: AssessmentResult) {
  if (r.score === null || r.kind === null || r.label === null) return null;
  const key = (i: number | null) => GRADE_KEYS[i ?? 0]!;
  return {
    score: Number(r.score),
    margin: Number(r.margin),
    lower: key(r.lowerIndex),
    upper: key(r.upperIndex),
    center: key(r.centerIndex),
    kind: r.kind,
    label: r.label,
  };
}

/**
 * Official grade per player = latest result with status approved or overridden (grading §8). An approved
 * event-bound (A13) result is included too, so it also becomes the standing grade.
 */
export async function officialResults(
  db: Prisma.TransactionClient,
  userIds: readonly string[],
): Promise<Map<string, AssessmentResult & { assessment: { subjectUserId: string; eventId: string | null } }>> {
  const rows = await db.assessmentResult.findMany({
    where: { status: { in: ['approved', 'overridden'] }, assessment: { subjectUserId: { in: [...userIds] } } },
    include: { assessment: { select: { subjectUserId: true, eventId: true } } },
    orderBy: { computedAt: 'desc' },
  });
  const out = new Map<string, (typeof rows)[number]>();
  for (const r of rows) if (!out.has(r.assessment.subjectUserId)) out.set(r.assessment.subjectUserId, r);
  return out;
}
