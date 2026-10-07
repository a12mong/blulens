PACKET bl-10-3e: compute the assessment result when the last review of an assessment is submitted

Assignee: Meredith (meredith-muxtbonw) · Reviewer: Oscar (oscar-muxt974o) · Senior: Kevin (kevin-muxsqdkp)

GOAL:
  When a reviewer submits the LAST open review of an assessment, the API computes the grade with the shared
  aggregateAssessment() and stores it as a new AssessmentResult version, moving the assessment to the result status,
  all in the same transaction as the submit. This makes results appear for slice 2 (Andy's /review page).

STATE:
  Your worktree. Branch dev/bl-10-aggregate-on-submit FROM origin/be/bl-10-wave3-base (bf86330). That base is develop
  + dev/bl-19-aggregate + dev/bl-19-reviewer-score + your dev/bl-10-submit-review (all three still in review; they
  merge before yours, so your branch merges cleanly afterwards).
  Already exists:
    apps/api/src/modules/reviews/reviews.service.ts submit(assignmentId, input, actor, ip): ONE prisma.$transaction;
      creates Review { overall (v_j, null when abstained), abstained, scores }, flips the assignment open -> submitted
      (conditional updateMany), audits 'review.submit', returns { id, state, dueAt, submittedAt }.
    packages/shared/src/grading/aggregate.ts:
      aggregateAssessment(scores: number[], minReviewers: number): AggregateResult
      AggregateResult = { status: 'needs_reviewers' | 'provisional' | 'pending_approval' | 'disputed', score: number|null,
        margin: number|null, grade: GradeView|null, nRaters, nExcluded, excludedIndexes: number[], spread: number|null,
        flags: ResultFlag[], suggestThirdReviewer: boolean }
      GradeView = { score, margin, lower, upper, center (GradeKeys), tier, kind: 'exact'|'straddle'|'wide', label }
    GRADE_KEYS (shared): index of a GradeKey = ladder index 0..14.
    Prisma: AssessmentResult (@@unique [assessmentId, version]; fields listed in SPEC), AssessmentTransition
      { assessmentId, fromStatus, toStatus, actorId (null = system), reason }, Assessment.status (AssessmentStatus),
      Assessment.eventId -> Event.minReviewers. assessment_results and assessment_transitions are APPEND-ONLY (triggers):
      only INSERT, never update or delete.

SPEC:
  Files (ONLY these 2): reviews.service.ts, apps/api/test/aggregate-on-submit.e2e-spec.ts (new).
  1. In submit(), after the assignment flip and before the audit, ONLY when assignment.kind === 'assessment':
     a. openLeft = count of ReviewAssignment { assessmentId, state: 'open' } (in tx). If openLeft > 0: do nothing more.
     b. Else load all submitted reviews of this assessment: Review where assignment { assessmentId, state: 'submitted' },
        abstained false, ordered by submittedAt asc, id asc. scores = overall as numbers.
     c. minReviewers = assessment.event?.minReviewers ?? 2.  agg = aggregateAssessment(scores, minReviewers).
     d. version = (max existing AssessmentResult.version for this assessment ?? 0) + 1. Insert AssessmentResult:
          { assessmentId, version, source: 'computed', status: agg.status, score: agg.score, margin: agg.margin,
            lowerIndex/centerIndex/upperIndex: GRADE_KEYS.indexOf(agg.grade.lower/center/upper) (null when grade is null),
            kind: agg.grade?.kind ?? null, label: agg.grade?.label ?? null, nRaters: agg.nRaters, nExcluded: agg.nExcluded,
            spread: agg.spread, flags: agg.flags, methodVersion: 'grading-v2',
            inputs: { reviewIds, scores, excludedIndexes: agg.excludedIndexes, minReviewers, suggestThirdReviewer } ,
            computedBy: null }
     e. Move the assessment: conditional updateMany where { id, status: current } set { status: agg.status }; count 0 ->
        409 ASSESSMENT_STATE_CHANGED 'สถานะการประเมินเปลี่ยนไปแล้ว กรุณาโหลดใหม่'. Insert AssessmentTransition
        { fromStatus: current, toStatus: agg.status, actorId: null, reason: 'aggregate' }.
     f. Audit 'assessment.result' (entityType 'assessment', after: { version, status, label }) in the same tx.
     Nothing changes in the response shape (the reviewer stays blind: never return the result).
  2. Calibration assignments (kind !== 'assessment') never aggregate.
  Test (new e2e file; build fixtures with prisma like apps/api/test/reviews.e2e-spec.ts does: an assessment with an
  event minReviewers 2, two reviewer users with open assignments, the active rubric):
    - first reviewer submits -> no AssessmentResult yet, assessment status unchanged
    - second reviewer submits -> exactly 1 AssessmentResult (version 1, source 'computed', nRaters 2, methodVersion
      'grading-v2'), assessment.status equals the result status, and 1 transition row with reason 'aggregate'
    - both submit responses are { id, state: 'submitted', dueAt, submittedAt } only (no grade leak)
    - with both reviewers abstaining (every criterion null): result status 'needs_reviewers', score null
  Clean up like reviews.e2e-spec.ts (results/transitions are append-only: disable users instead of deleting them).

CONSTRAINTS:
  - Same transaction as the submit; no new endpoint; no schema change.
  - Do not change aggregateAssessment or reviewerScore. Never print .env values.

TOOLS:
  pnpm --filter @blulens/shared build; cd apps/api && pnpm build && pnpm lint && pnpm test (all green; tests use <db>_test)

DONE:
  `git push -u origin dev/bl-10-aggregate-on-submit`, then check `git log origin/dev/bl-10-aggregate-on-submit -1`.
  Done message to Kevin: sha, and the result lines of pnpm build, pnpm lint and pnpm test.
