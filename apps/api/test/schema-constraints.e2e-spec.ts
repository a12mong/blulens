import { Prisma, PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';

/**
 * Proves the raw-SQL constraints of the init migration (bl-07).
 * Needs the local compose postgres with migrations applied (pnpm db:migrate).
 * Every test runs in a transaction that is rolled back, so nothing is left behind
 * (append-only rows could not be deleted otherwise).
 */

const prisma = new PrismaClient();

class Rollback extends Error {}

type Tx = Prisma.TransactionClient;

async function inRollback(fn: (tx: Tx) => Promise<void>): Promise<void> {
  try {
    await prisma.$transaction(
      async (tx) => {
        await fn(tx);
        throw new Rollback();
      },
      { timeout: 20_000 },
    );
  } catch (err) {
    if (!(err instanceof Rollback)) throw err;
  }
}

/** Runs one statement inside a savepoint and returns its error message (fails the test if it succeeds). */
async function violation(tx: Tx, op: () => Promise<unknown>): Promise<string> {
  await tx.$executeRawUnsafe('SAVEPOINT expect_violation');
  try {
    await op();
  } catch (err) {
    await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT expect_violation');
    return err instanceof Error ? err.message : String(err);
  }
  throw new Error('expected a constraint violation, but the statement succeeded');
}

async function makeUser(tx: Tx) {
  return tx.user.create({
    data: { email: `t-${randomUUID()}@test.local`, passwordHash: 'x', displayName: 'test' },
  });
}

async function makeAssessment(tx: Tx) {
  const user = await makeUser(tx);
  return tx.assessment.create({ data: { subjectUserId: user.id } });
}

const result = (assessmentId: string, version: number, over: Partial<Prisma.AssessmentResultUncheckedCreateInput> = {}) =>
  ({
    assessmentId,
    version,
    source: 'computed',
    status: 'pending_approval',
    score: 7.61,
    margin: 0.25,
    lowerIndex: 7,
    centerIndex: 7,
    upperIndex: 7,
    kind: 'exact',
    label: 'S',
    nRaters: 3,
    methodVersion: 'grading-v1',
    inputs: {},
    ...over,
  }) satisfies Prisma.AssessmentResultUncheckedCreateInput;

async function makeEvent(tx: Tx) {
  const t = await tx.tournament.create({
    data: { name: 'test', startsOn: new Date('2026-12-01'), entriesCloseAt: new Date('2026-11-20') },
  });
  return tx.event.create({
    data: { tournamentId: t.id, discipline: 'MS', gradeMinIndex: 6, gradeMaxIndex: 8 },
  });
}

const draw = (eventId: string, createdBy: string, version: number, status: 'preview' | 'published') => ({
  eventId,
  version,
  status,
  seed: 's',
  seedSource: 'server' as const,
  inputHash: 'a'.repeat(64),
  snapshot: {},
  rulesetVersion: 'draw-v1',
  prngId: 'xoshiro128**/cyrb128-v1',
  size: 8,
  seedsCount: 2,
  createdBy,
});

afterAll(() => prisma.$disconnect());

describe('bl-07 schema constraints', () => {
  it('assessment_results: ladder CHECK enforces lower <= center <= upper within 0..14 (INV-2)', async () => {
    await inRollback(async (tx) => {
      const a = await makeAssessment(tx);
      await tx.assessmentResult.create({ data: result(a.id, 1) });
      expect(
        await violation(tx, () => tx.assessmentResult.create({ data: result(a.id, 2, { lowerIndex: 8 }) })),
      ).toMatch(/assessment_results_ladder_chk/);
      expect(
        await violation(tx, () => tx.assessmentResult.create({ data: result(a.id, 3, { upperIndex: 15 }) })),
      ).toMatch(/assessment_results_ladder_chk/);
    });
  });

  it('assessment_results: numbers are all-or-nothing, and only needs_reviewers may be empty (G15)', async () => {
    await inRollback(async (tx) => {
      const a = await makeAssessment(tx);
      const empty = {
        score: null, margin: null, lowerIndex: null, centerIndex: null, upperIndex: null, kind: null, label: null,
      };
      await tx.assessmentResult.create({ data: result(a.id, 1, { ...empty, status: 'needs_reviewers', nRaters: 2 }) });
      expect(
        await violation(tx, () => tx.assessmentResult.create({ data: result(a.id, 2, { ...empty }) })),
      ).toMatch(/assessment_results_shape_chk/);
      expect(
        await violation(tx, () => tx.assessmentResult.create({ data: result(a.id, 3, { label: null }) })),
      ).toMatch(/assessment_results_shape_chk/);
    });
  });

  it('assessment_results: an override needs a reason of at least 20 characters', async () => {
    await inRollback(async (tx) => {
      const a = await makeAssessment(tx);
      const override = { source: 'override' as const, status: 'overridden' as const, margin: 0, score: 7.5, flags: ['OVERRIDE'] };
      expect(
        await violation(tx, () => tx.assessmentResult.create({ data: result(a.id, 1, { ...override, reason: 'too short' }) })),
      ).toMatch(/assessment_results_override_reason_chk/);
      await tx.assessmentResult.create({
        data: result(a.id, 2, { ...override, reason: 'clip shows clear P- footwork' }),
      });
    });
  });

  it('append-only tables reject UPDATE and DELETE', async () => {
    await inRollback(async (tx) => {
      const a = await makeAssessment(tx);
      const r = await tx.assessmentResult.create({ data: result(a.id, 1) });
      expect(
        await violation(tx, () => tx.assessmentResult.update({ where: { id: r.id }, data: { label: 'S+' } })),
      ).toMatch(/APPEND_ONLY: UPDATE on assessment_results/);
      expect(await violation(tx, () => tx.assessmentResult.delete({ where: { id: r.id } }))).toMatch(
        /APPEND_ONLY: DELETE on assessment_results/,
      );

      const log = await tx.auditLog.create({
        data: { action: 'test.write', entityType: 'test', entityId: 'x' },
      });
      expect(
        await violation(tx, () => tx.auditLog.update({ where: { id: log.id }, data: { reason: 'edit' } })),
      ).toMatch(/APPEND_ONLY: UPDATE on audit_logs/);

      const t = await tx.assessmentTransition.create({
        data: { assessmentId: a.id, fromStatus: 'draft', toStatus: 'submitted' },
      });
      expect(await violation(tx, () => tx.assessmentTransition.delete({ where: { id: t.id } }))).toMatch(
        /APPEND_ONLY: DELETE on assessment_transitions/,
      );
    });
  });

  it('draws: at most one published draw per event and kind (DR-14)', async () => {
    await inRollback(async (tx) => {
      const ev = await makeEvent(tx);
      const u = await makeUser(tx);
      await tx.draw.create({ data: draw(ev.id, u.id, 1, 'published') });
      await tx.draw.create({ data: draw(ev.id, u.id, 2, 'preview') });
      expect(await violation(tx, () => tx.draw.create({ data: draw(ev.id, u.id, 3, 'published') }))).toMatch(
        /Unique constraint failed/,
      );
      // a group draw of the same event is a different kind and may be published alongside
      await tx.draw.create({ data: { ...draw(ev.id, u.id, 1, 'published'), kind: 'group' } });
    });
  });

  it('review_assignments: one live assignment per reviewer and assessment', async () => {
    await inRollback(async (tx) => {
      const a = await makeAssessment(tx);
      const reviewer = await makeUser(tx);
      const base = { assessmentId: a.id, reviewerId: reviewer.id, dueAt: new Date('2026-12-01') };
      await tx.reviewAssignment.create({ data: { ...base, state: 'declined' } });
      await tx.reviewAssignment.create({ data: { ...base, state: 'open' } });
      expect(await violation(tx, () => tx.reviewAssignment.create({ data: { ...base, state: 'open' } }))).toMatch(
        /Unique constraint failed/,
      );
    });
  });

  it('team_memberships: concurrent teams allowed (A11), but one open membership per team', async () => {
    await inRollback(async (tx) => {
      const u = await makeUser(tx);
      const [t1, t2] = await Promise.all(
        ['A', 'B'].map((n) => tx.team.create({ data: { name: n, nameKey: `${n}-${randomUUID()}` } })),
      );
      await tx.teamMembership.create({ data: { userId: u.id, teamId: t1!.id } });
      await tx.teamMembership.create({ data: { userId: u.id, teamId: t2!.id } });
      expect(
        await violation(tx, () => tx.teamMembership.create({ data: { userId: u.id, teamId: t1!.id } })),
      ).toMatch(/Unique constraint failed/);
    });
  });

  it('rubrics: exactly one active version; review_scores: grade index 0..14', async () => {
    await inRollback(async (tx) => {
      await tx.rubric.updateMany({ data: { active: false } });
      await tx.rubric.create({ data: { methodVersion: `t-${randomUUID()}`, criteria: [], params: {}, active: true } });
      expect(
        await violation(tx, () =>
          tx.rubric.create({ data: { methodVersion: `t-${randomUUID()}`, criteria: [], params: {}, active: true } }),
        ),
      ).toMatch(/Unique constraint failed/);

      const a = await makeAssessment(tx);
      const reviewer = await makeUser(tx);
      const asg = await tx.reviewAssignment.create({
        data: { assessmentId: a.id, reviewerId: reviewer.id, dueAt: new Date('2026-12-01') },
      });
      const review = await tx.review.create({ data: { assignmentId: asg.id } });
      await tx.reviewScore.create({ data: { reviewId: review.id, criterion: 'net', gradeIndex: null } });
      expect(
        await violation(tx, () => tx.reviewScore.create({ data: { reviewId: review.id, criterion: 'defense', gradeIndex: 15 } })),
      ).toMatch(/review_scores_grade_index_chk/);
    });
  });
});
