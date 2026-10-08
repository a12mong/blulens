PACKET bl-26-3: POST /assessments/{assessmentId}/approve and /return (Committee decisions)

Assignee: Meredith (meredith-muxtbonw) · Reviewer: Oscar (oscar-muxt974o) · Senior: Jim while Kevin is paused (jim-muxspl2j)
Tell on merge: Andy (andy-muxsqkra), because the /committee/assessments/[id] buttons call these.
PRIORITY: right after bl-26-2 (it reuses the bl-26-2 detail builder for the response).

GOAL: the Committee approves a computed result, or sends the request back for more reviewers, with every step
  recorded (result history + transition + audit).

STATE: branch dev/bl-26-approve-return from origin/develop AFTER bl-26-2 merges.
  Exists: assessments.service (bl-26-2 detail builder -> AssessmentDetail), AssessmentTransition (append-only),
  AssessmentResult (append-only: a DB trigger blocks UPDATE/DELETE, so a decision = a NEW row with version + 1),
  AuditService.record(entry, tx), Assessment.version (optimistic lock), the transition write used by the
  bl-10-3e aggregate in reviews.service (copy its shape).

SOURCES (openapi + grading.md §8, pasted):
  POST /assessments/{id}/approve  x-roles [Committee]  body { resultVersion?: int, note?: string <= 1000 }
    200 AssessmentDetail · 409 Conflict
  POST /assessments/{id}/return   x-roles [Committee]  body ReasonInput { reason: 5..2000 } · 200 AssessmentDetail
  State machine: pending_approval -> approved · disputed -> approved (a note is REQUIRED) ·
    pending_approval | disputed -> in_review ("send back to find more reviewers").
  Official grade = the latest result whose status is approved or overridden (officialResults already does this).

SPEC (files ONLY: assessments.controller.ts, assessments.service.ts, apps/api/test/assessment-decisions.e2e-spec.ts new):
  Shared private helper (used again by bl-26-4): `decide(tx, assessmentId, actor, { allowedFrom, toStatus, reason,
    resultVersion, newResult? })`, which does these steps in ONE transaction:
    1. Load the assessment + latest result (highest version). Not found -> 404 ASSESSMENT_NOT_FOUND.
    2. status not in allowedFrom -> 409 ASSESSMENT_INVALID_TRANSITION { from, allowed }.
    3. resultVersion given and != latest.version -> 409 RESULT_VERSION_STALE { latest }.
    4. updateMany({ where: { id, status, version }, data: { status: toStatus, version: { increment: 1 } } });
       count 0 -> 409 ASSESSMENT_STATE_CHANGED (someone else decided first).
    5. If newResult: insert AssessmentResult version = latest.version + 1 (copy score, margin, indexes, kind, label,
       nRaters, nExcluded, spread, flags, methodVersion, inputs from latest unless newResult overrides them;
       computedBy = actor.id, reason = the note/reason).
    6. Insert AssessmentTransition (from, to, actorId, reason) + AuditService.record({ action, entityType:
       'assessment', entityId, before: { status, resultVersion }, after: { status, resultVersion }, reason }).
    Return the bl-26-2 detail for the Committee viewer.
  approve: allowedFrom [pending_approval, disputed] -> approved. newResult = { status: 'approved', source: 'computed' }.
    If the status was disputed, the note (trimmed) must be >= 5 chars, else 422 ASSESSMENT_APPROVE_NOTE_REQUIRED.
    Audit action 'assessment.approve'.
  return: allowedFrom [pending_approval, disputed] -> in_review. No new result row (the computed row stays as
    history). reason required (ReasonInput). Audit action 'assessment.return'. The Committee then assigns more
    reviewers with the existing assign endpoint; the next last-submit re-aggregates over ALL valid reviews.
  provisional is NOT accepted here (409 ASSESSMENT_INVALID_TRANSITION): that is confirm, in bl-26-4.
  Thai messages for every error code (look at the existing ApiException calls for the tone).

TEST (build the assessment like aggregate-on-submit.e2e-spec.ts: 2 reviews that aggregate to pending_approval):
  approve -> 200, status approved, results has version 2 status approved, one transition + one audit row, and
    officialResults returns it (GET /users gradeLabel for the subject is set);
  approve with a stale resultVersion -> 409 RESULT_VERSION_STALE; approve twice -> the 2nd gets 409 INVALID_TRANSITION;
  a disputed case (gap > 2.0) approve without a note -> 422, with a note -> 200;
  return -> in_review, no new result row; return with reason 'abc' -> 422;
  Member/Reviewer -> 403; unknown id -> 404. Clean up like that spec.
TOOLS: pnpm --filter @blulens/api db:generate; pnpm --filter @blulens/shared build; cd apps/api && pnpm build && pnpm lint && pnpm test
DONE: push dev/bl-26-approve-return, verify on origin, done message to Jim (sha + build/lint/test lines).
