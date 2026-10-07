PACKET bl-10-3h: GET /api/v1/reviews/assignments/{assignmentId} (assignment detail for the reviewer)

Assignee: Meredith (meredith-muxtbonw) · Reviewer: Oscar (oscar-muxt974o) · Senior: Kevin (kevin-muxsqdkp)
PRIORITY 1 (slice-2 blocker: the web page /review/tasks/[id] already calls it). Do this BEFORE bl-10-3f/3g.

GOAL:
  The assigned reviewer opens one task: its state, the clips to watch (with a playable URL), the rubric, and their own
  scores after submitting. Blind: nothing about who is being assessed.

STATE:
  Branch dev/bl-10-assignment-detail from origin/develop (b89d691 or later).
  Already exists in apps/api/src/modules/reviews: reviews.controller.ts (GET /reviews/rubric, GET /reviews/my-assignments,
  PUT /reviews/assignments/:id), reviews.service.ts (getActiveRubric(), getMyAssignments(), submit()).
  Prisma: ReviewAssignment { id, kind 'assessment'|'calibration', assessmentId?, calibrationClipId?, reviewerId, state,
  dueAt, review? }, Review { submittedAt, scores: ReviewScore { criterion, gradeIndex|null } }, Clip { id, assessmentId,
  objectKey, status pending_upload|uploaded|rejected, durationSec }, CalibrationClip (calibration tasks), Rubric { criteria json }.

SOURCES (openapi, Jim c1085af, pasted):
  GET /reviews/assignments/{assignmentId}  x-roles [Reviewer]  200 ReviewAssignmentDetail, 404 for anyone except the
    assigned reviewer (do not leak task ids).
  ReviewAssignmentDetail = ReviewAssignment { id, state, dueAt, submittedAt } + required [clips, rubric, myScores]:
    clips: Clip[] = { id, status: pending_upload|uploaded|rejected, viewUrl: string|null, durationSec: int|null }
    rubric: the same object GET /reviews/rubric returns (methodVersion, criteria)
    myScores: CriterionScore[] = { criterion, gradeKey|null }; EMPTY while state is open; the submitted scores after submit
  viewUrl rule v1 (god decision): if status !== 'uploaded' -> null. Else if objectKey starts with '/' or 'http://' or
    'https://' -> the objectKey unchanged (seeded and e2e clips use '/e2e/sample.mp4?c=<clipId>', served by the web app).
    Otherwise (a MinIO key) -> null until the clips module adds presigning.
  Andy's web hook expects exactly: { id, state, dueAt, submittedAt, clips[{id,status,viewUrl,durationSec}], rubric{...}, myScores[] }.

SPEC:
  Files (ONLY these 3): reviews.controller.ts (+ @Roles('Reviewer') @Get('reviews/assignments/:assignmentId') with the
  uuid pipe, matching the existing style), reviews.service.ts (+ getAssignmentDetail(id, actor)),
  apps/api/test/assignment-detail.e2e-spec.ts (new).
  getAssignmentDetail:
    - load the assignment with review.scores and the clips: kind 'assessment' -> Clip where assessmentId (order by createdAt);
      kind 'calibration' -> the calibration clip, mapped to the same Clip shape. Missing, or reviewerId !== actor.id ->
      404 ASSIGNMENT_NOT_FOUND (same message as submit())
    - rubric: the assessment's rubric if set, else the active rubric, in the same shape as GET /reviews/rubric
    - myScores: [] unless state === 'submitted'; then the review scores as { criterion, gradeKey: GRADE_KEYS[gradeIndex] ?? null }
    - NEVER return assessmentId, subject, event, other reviewers or any result
  Test (new e2e): build the fixtures like reviews.e2e-spec.ts (a reviewer, an assessment with 2 clips: one uploaded with
    objectKey '/e2e/sample.mp4?c=<id>', one pending_upload; an open assignment):
    - the assigned reviewer gets 200 with 2 clips (the first viewUrl '/e2e/sample.mp4?c=<id>', the second viewUrl null),
      the rubric criteria, myScores [], and NO key named assessmentId / subjectUserId / eventId anywhere in the JSON
    - another Reviewer -> 404; a Member -> 403; after the reviewer submits -> myScores has the submitted gradeKeys
    - a MinIO-style objectKey ('clips/x/y') with status uploaded -> viewUrl null
  Clean up like reviews.e2e-spec.ts (disable users; results and transitions are append-only).

TOOLS: pnpm --filter @blulens/api db:generate; pnpm --filter @blulens/shared build; cd apps/api && pnpm build && pnpm lint && pnpm test
DONE: push dev/bl-10-assignment-detail, verify on origin, done message to Kevin (sha + build/lint/test result lines).

NOTE for bl-10-3f (seed): Clip.objectKey is UNIQUE, so every seeded clip uses objectKey '/e2e/sample.mp4?c=<clipId>'
  (the same file; the query string keeps the keys unique), status 'uploaded', durationSec 4.
