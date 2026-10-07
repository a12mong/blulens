PACKET bl-10-3d: PUT /api/v1/reviews/assignments/{assignmentId} — submit a review (wave 3)

Assignee: Meredith (meredith-muxtbonw) · Reviewer: Oscar (oscar-muxt974o) · Senior: Kevin (kevin-muxsqdkp)

GOAL:
  A reviewer submits their rubric scores once; the review is immutable afterwards (blind review, grading §7).
  Aggregation into a result is the NEXT packet (not here).

STATE:
  Your worktree. Branch dev/bl-10-submit-review from origin/develop, then merge origin/dev/bl-19-reviewer-score (Creed's
  reviewerScore, in review; merge order: his first, then yours):
    git fetch origin && git switch -c dev/bl-10-submit-review origin/develop && git merge origin/dev/bl-19-reviewer-score
    pnpm install --frozen-lockfile && pnpm --filter @blulens/shared build && pnpm --filter @blulens/api db:generate
  Exists: your ReviewsModule (reviews.{controller,service}.ts); Prisma ReviewAssignment (kind, assessmentId?, calibrationClipId?,
  reviewerId, state, dueAt), Review (assignmentId unique, comment, overall Decimal?, abstained, submittedAt), ReviewScore
  (reviewId, criterion, gradeIndex smallint? CHECK 0..14), Assessment.rubricId, Rubric.criteria [{key, nameTh, weight}];
  shared GRADE_KEYS (schemas/auth.ts) and reviewerScore (grading/reviewer-score.ts).

SOURCES (openapi + grading §7, pasted):
  PUT /reviews/assignments/{assignmentId}  x-roles [Reviewer]
    body ReviewInput { scores: [{ criterion: string, gradeKey: GradeKey | null }] (min 1), comment?: string <= 2000 }
    200 ReviewAssignment (blind: { id, state, dueAt, submittedAt })   409 REVIEW_ALREADY_SUBMITTED | ASSIGNMENT_EXPIRED
  §7: "submitted reviews cannot be edited"; gradeKey null = "cannot assess from the clip".

SPEC:
  Files (ONLY these 3): reviews.controller.ts (+ @Roles('Reviewer') @Put('reviews/assignments/:assignmentId')),
    reviews.service.ts (+ submit()), apps/api/test/review-submit.e2e-spec.ts (new)
  Input zod (controller): { scores: z.array(z.object({ criterion: z.string().min(1).max(40), gradeKey: gradeKeySchema.nullable() })).min(1),
    comment: z.string().trim().max(2000).optional() }
  submit(assignmentId, input, actor), ONE transaction:
    1. assignment exists AND reviewerId === actor.id, else 404 ASSIGNMENT_NOT_FOUND (never reveal others' tasks).
    2. state 'submitted' -> 409 REVIEW_ALREADY_SUBMITTED; state 'expired' or 'declined', or dueAt < now -> 409 ASSIGNMENT_EXPIRED.
    3. rubric: for kind 'assessment' the assessment's rubricId (locked at submit); for kind 'calibration' the active rubric.
    4. scores -> { criterion, gradeIndex: gradeKey === null ? null : GRADE_KEYS.indexOf(gradeKey) }; r = reviewerScore(scores, rubric.criteria).
       A RangeError from reviewerScore -> 400 VALIDATION_FAILED with message = the error message (e.g. 'REVIEW_MISSING_CRITERION').
    5. create Review { assignmentId, comment, overall: r.abstained ? null : r.overall, abstained: r.abstained } + its ReviewScore rows.
    6. conditional updateMany WHERE id AND state 'open' -> 'submitted'; count 0 -> 409 REVIEW_ALREADY_SUBMITTED (lost race).
    7. audit 'review.submit' { entityType 'review_assignment', entityId, after: { abstained } } (no scores in the audit row).
    8. return the blind ReviewAssignment (same mapper as getMyAssignments).
  Edge cases (e2e): 6 criteria all 'S' -> 200 state 'submitted'; Review.overall 7.5, abstained false, 6 ReviewScore rows ·
    4 of 6 null -> 200, abstained true, overall null · second PUT -> 409 REVIEW_ALREADY_SUBMITTED · another reviewer's task -> 404 ·
    dueAt in the past -> 409 ASSIGNMENT_EXPIRED · missing one criterion -> 400 VALIDATION_FAILED · unknown gradeKey 'Z' -> 400 ·
    Member cookie -> 403.
  Fixtures via prisma (assessment with rubricId of the active 'grading-v1' rubric; assignment state 'open', dueAt future).
    Cleanup: delete review_scores, reviews, assignments, assessments (no transitions created), users.
CONSTRAINTS: only the 3 files; no new deps; no `any`; no aggregation here; conventional commits; push. ENGINE NOTE: reply JSON into your outbox.
TOOLS: pnpm --filter @blulens/shared build · pnpm --filter @blulens/api test · pnpm --filter @blulens/api lint
DONE (single proving test): review-submit.e2e-spec.ts, "stores a reviewer's rubric scores once and computes their overall score"
  (first three edge cases). Report: branch, commit, diff --stat, real output.
