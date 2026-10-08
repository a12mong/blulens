PACKET bl-26-2: GET /api/v1/assessments/{assessmentId} (detail)

Assignee: Meredith (meredith-muxtbonw) · Reviewer: Oscar (oscar-muxt974o) · Senior: Kevin (kevin-muxsqdkp)
PRIORITY: right after bl-26-1, before bl-25-2 (the web page /committee/assessments/[id] calls this).

GOAL: the subject Member or Committee/Admin opens one assessment: its fields, clips, latest result; Committee/Admin also
  see one row per reviewer.

STATE: branch dev/bl-26-assessment-detail from origin/develop (after bl-26-1 merges; else from develop and keep the
  controller diff small). Reuse: assessments.service mapAssessment(...) (same counts as bl-26-1), toGradeView(result) in
  apps/api/src/common/grades.ts, the viewUrl rule v1 used by reviews.service getAssignmentDetail (copy it into a small
  shared helper only if you touch both files; otherwise duplicate the 3 lines). AssessmentResult.inputs (written in
  reviews.service submit) = { reviewIds[], scores[] (overall per review, same order), excludedIndexes[], ... }.

SOURCES (openapi, pasted):
  GET /assessments/{assessmentId}  x-roles [Member, Committee, Admin]  200 AssessmentDetail, 404 NotFound
  AssessmentDetail = Assessment + { clips: Clip[] {id,status,viewUrl,durationSec}, latestResult: AssessmentResult|null,
    reviewerRows: ReviewerScoreRow[] (Committee only) }
  AssessmentResult = { version, source, status, grade: GradeView, nRaters, nExcluded, spread, flags, methodVersion,
    reason, computedAt, computedBy }
  ReviewerScoreRow = { reviewerId, reviewerName, overall, excluded, robustZ|null, reviewerBias|null, pairKappa|null,
    criteria: [{ criterion, gradeKey|null }] }

SPEC (files ONLY: assessments.controller.ts, assessments.service.ts, apps/api/test/assessment-detail.e2e-spec.ts new):
  - @Roles('Member','Committee','Admin') @Get(':assessmentId') with the uuid pipe. Not found, or a Member who is not the
    subject -> 404 ASSESSMENT_NOT_FOUND (do not leak ids).
  - clips ordered by createdAt, viewUrl rule v1. latestResult = highest version row or null; numbers as JS numbers.
  - reviewerRows: Committee/Admin only (a Member gets []). From latestResult.inputs: for each reviewIds[i] load the
    Review (reviewer displayName, scores) -> { overall: scores[i], excluded: excludedIndexes includes i, robustZ null,
    reviewerBias null, pairKappa null, criteria: gradeKey = GRADE_KEYS[gradeIndex] ?? null }. No result -> [].
  Test: an assessment with 2 clips and 2 submitted reviews that aggregated (build like aggregate-on-submit.e2e-spec.ts):
    Committee gets clips, latestResult.version 1 with grade, 2 reviewerRows with criteria; the subject Member gets 200
    with reviewerRows []; another Member -> 404; Reviewer -> 403; unknown id -> 404. Clean up like that spec.
TOOLS: pnpm --filter @blulens/api db:generate; pnpm --filter @blulens/shared build; cd apps/api && pnpm build && pnpm lint && pnpm test
DONE: push dev/bl-26-assessment-detail, verify on origin, done message to Kevin (sha + result lines).
