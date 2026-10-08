PACKET bl-35-5: POST /api/v1/calibration-sets/{setId}/assign (blind review tasks for reviewers)

Assignee: Creed (creed-muxswjfu), after bl-35-3 · Reviewer: Oscar (oscar-muxt974o) · Senior: Kevin (kevin-muxsqdkp)
GOAL: each chosen reviewer gets one calibration review task per clip; the set freezes.
STATE: branch dev/bl-35-calibration-assign from origin/develop after bl-35-3 merges. ReviewAssignment has
  kind 'calibration' + calibrationClipId (CHECK: kind and target agree) and a unique (calibrationClipId, reviewerId).
  Reviewer endpoints already show calibration tasks blindly (reviews.service), nothing to change there.
SOURCES: openapi /calibration-sets/{setId}/assign: body { reviewerIds: uuid[], dueAt?: date-time }, 204.
SPEC (files ONLY: calibration.controller.ts, calibration.service.ts, apps/api/test/calibration-assign.e2e-spec.ts NEW):
  - @Roles('Committee','Admin') @HttpCode(204); zod { reviewerIds: array of uuid, 1..50, unique (dupes -> 400),
    dueAt?: ISO datetime in the future } else 400 VALIDATION_FAILED. Default dueAt = now + 7 days.
  - ONE $transaction: lock the set row FOR UPDATE (missing -> 404 CALIBRATION_SET_NOT_FOUND); clips of the set:
    none, or any status !== 'uploaded' -> 409 CALIBRATION_CLIPS_NOT_READY.
    Reviewers: ONE user.findMany with roles; missing, disabled, or without role 'Reviewer' -> 409
    REVIEWER_NOT_ELIGIBLE with details { userId } (first offender).
    reviewAssignment.createMany({ data: every (reviewer, clip) pair with kind 'calibration', calibrationClipId,
    reviewerId, dueAt }, skipDuplicates: true) so re-assigning adds new reviewers only.
    If assignedAt is null set it to now. audit 'calibration_set.assign' after { reviewerIds, clipCount, dueAt }.
  Test: set with 2 uploaded clips, assign 2 reviewers -> 204, 4 assignments, set.assignedAt set; assign again with
    one old + one new reviewer -> 204 and 6 assignments total (no duplicates); a pending_upload clip -> 409
    CALIBRATION_CLIPS_NOT_READY; a Member userId -> 409 REVIEWER_NOT_ELIGIBLE details.userId; empty reviewerIds -> 400;
    Reviewer caller -> 403. Calibration rows stay (assignments reference them); disable the users you created.
TOOLS: pnpm --filter @blulens/api db:generate; pnpm --filter @blulens/shared build; cd apps/api && pnpm build && pnpm lint && TEST_DATABASE_URL=<fresh *_test db> pnpm test
DONE: push, verify on origin, done message to Kevin (sha + test names + FULL pnpm test line on a fresh test DB).
