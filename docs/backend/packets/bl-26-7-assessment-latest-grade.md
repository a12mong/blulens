PACKET bl-26-7: Assessment.latestGrade + latestResultVersion (member "my results", S11), member-safe results

Assignee: whoever lands bl-26-6 (same file) · Reviewer: Oscar (oscar-muxt974o) · Senior: Kevin (kevin-muxsqdkp)
GOAL: GET /assessments (already scoped to the caller for Members, bl-26-1) shows each row's grade; a Member never sees a
  result the Committee has not approved yet.
STATE: branch dev/bl-26-latest-grade from origin/develop AFTER bl-26-6 merges. assessments.service: mapAssessment,
  list(), detail (latestResult = highest version, any status). toGradeView(result) in apps/api/src/common/grades.ts.
  AssessmentResult { version, status pending|approved|superseded, ... }.
SOURCES (openapi Assessment, pasted): latestGrade: GradeView|null ('grade of the latest result version, list rows show
  its label'), latestResultVersion: int|null.
SPEC (files ONLY: assessments.service.ts, apps/api/test/assessment-latest-grade.e2e-spec.ts new):
  - visible result for a caller = Committee/Admin: the highest version (any status); Member (the subject): the highest
    version with status 'approved' (else none).
  - list + detail items: latestGrade = toGradeView(visible) or null; latestResultVersion = visible.version or null.
    Load the results for the whole page in ONE query (no N+1).
  - detail latestResult: apply the SAME visibility (a Member gets null while the result is pending). reviewerRows stay
    Committee-only.
  Test: a computed pending result -> Committee list row has latestGrade, the subject Member's row has null and detail
    latestResult null; after approval (POST approve, bl-26-3) the Member sees latestGrade + latestResult. Clean up.
TOOLS: pnpm --filter @blulens/api db:generate; pnpm --filter @blulens/shared build; cd apps/api && pnpm build && pnpm lint && pnpm test
DONE: push dev/bl-26-latest-grade, verify on origin, done message to Kevin (sha + spec line + FULL pnpm test line).
