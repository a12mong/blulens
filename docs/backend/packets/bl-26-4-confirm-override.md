PACKET bl-26-4: POST /assessments/{assessmentId}/confirm (single-reviewer result) and /override (Super-Committee)

Assignee: Meredith (meredith-muxtbonw) · Reviewer: Oscar (oscar-muxt974o) · Senior: Jim while Kevin is paused (jim-muxspl2j)
Tell on merge: Andy (andy-muxsqkra).
PRIORITY: right after bl-26-3 (reuses its `decide(...)` helper).

GOAL: the Committee confirms a provisional (1-reviewer) result, or sets the grade by hand with a reason (override),
  without ever losing the computed history.

STATE: branch dev/bl-26-confirm-override from origin/develop AFTER bl-26-3 merges. Reuse decide(...) from bl-26-3.
  Reuse the conflict-of-interest check of the assign endpoint (assessments.service: reviewer == subject, or a shared
  CURRENT team membership). Move it into a small private method `hasConflict(userId, subjectUserId)` and call it from
  both places; keep the assign error codes unchanged.
  projectGrade(score, margin) and GRADES / gradeIndex(key) exist in @blulens/shared (grading).

SOURCES (openapi + grading.md §8 + §12.2, pasted):
  POST /assessments/{id}/confirm   x-roles [Committee]  body { resultVersion?: int, note?: <= 1000 }
    200 AssessmentDetail · 409 ASSESSMENT_NOT_PROVISIONAL
  POST /assessments/{id}/override  x-roles [Committee]  body OverrideInput { centerKey: GradeKey (required),
    reason: 20..2000 (required), resultVersion?: int } · 200 AssessmentDetail · 403 OVERRIDE_CONFLICT_OF_INTEREST
  §12.2: provisional -> approved by Committee confirm; the SINGLE_REVIEWER flag stays on the result.
  §8 override: allowed from pending_approval, disputed, approved (and provisional, §12.2) -> overridden.
    The overrider holds Committee and has NO conflict with the player. New result: score = index + 0.5, margin = 0,
    lower = upper = center = index, kind exact, flag OVERRIDE; the computed result stays in the history.
    Audit + notify every Committee member (G7 option a: one Committee + reason + notify all).

SPEC (files ONLY: assessments.controller.ts, assessments.service.ts, apps/api/test/assessment-override.e2e-spec.ts new):
  confirm: status != provisional -> 409 ASSESSMENT_NOT_PROVISIONAL (check before decide). decide(allowedFrom
    [provisional] -> approved, newResult { status: 'approved', source: 'computed' }, flags copied, so SINGLE_REVIEWER
    stays). Audit 'assessment.confirm'.
  override: hasConflict(actor.id, subjectUserId) -> 403 OVERRIDE_CONFLICT_OF_INTEREST (before anything is written).
    reason trimmed < 20 -> 422 (zod). decide(allowedFrom [pending_approval, disputed, approved, provisional] ->
    overridden, newResult { status: 'overridden', source: 'override', score: idx + 0.5, margin: 0, lowerIndex =
    upperIndex = centerIndex = idx, kind: 'exact', label: projectGrade(idx + 0.5, 0).label, flags: ['OVERRIDE'],
    nRaters / nExcluded / spread / methodVersion copied, inputs: { ...latest.inputs, overrideOf: latest.version } }).
    Audit 'assessment.override' with before { status, label, version } and after { status, label, version } + reason.
    Notification to all Committee: there is no notifications module yet, so the audit row is the record. Leave a
    one-line `// TODO(bl-10 jobs): notify all Committee (G7)` and say so in the done message.
  Thai messages for every error code.

TEST:
  provisional (1 review, reviewsRequired 1) -> confirm 200, status approved, the new result keeps SINGLE_REVIEWER;
  confirm on pending_approval -> 409 ASSESSMENT_NOT_PROVISIONAL;
  override an approved result with centerKey 'N' and a 20+ char reason -> 200, status overridden, the latest result
    has source override, kind exact, lower = upper = center = N, flags [OVERRIDE]; the older versions are still
    there; one audit row; officialResults now returns the override;
  override with a 19-char reason -> 422; a Committee member who shares a current team with the subject -> 403;
  Member -> 403. Clean up.
TOOLS: pnpm --filter @blulens/api db:generate; pnpm --filter @blulens/shared build; cd apps/api && pnpm build && pnpm lint && pnpm test
DONE: push dev/bl-26-confirm-override, verify on origin, done message to Jim (sha + result lines + the TODO note).
