PACKET bl-35-3: GET /api/v1/calibration-sets/{setId} (CalibrationSetDetail, S16)

Assignee: Creed (creed-muxswjfu), after bl-35-1 · Reviewer: Oscar (oscar-muxt974o) · Senior: Kevin (kevin-muxsqdkp)
GOAL: the Committee opens one set: clips with status/play URL/reference grade, and per-reviewer progress.
STATE: branch dev/bl-35-calibration-detail from origin/develop after bl-35-1 merges (module calibration/* with
  toCalibrationSet). ReviewAssignment { kind 'calibration', calibrationClipId, reviewerId, state open|submitted|expired|declined }.
SOURCES: openapi /calibration-sets/{setId} GET and schema CalibrationSetDetail = CalibrationSet + { assignedAt|null,
  clipDetails[{ clipId, referenceKey, status, viewUrl|null, durationSec|null }], reviewers[{ reviewerId, reviewerName,
  assigned, submitted }] }.
SPEC (files ONLY: calibration.controller.ts, calibration.service.ts, apps/api/test/calibration-detail.e2e-spec.ts NEW):
  - export async getSetDetail(setId, db = this.prisma) (bl-35-4 calls it with tx) returning the shape above:
    toCalibrationSet(...) fields + assignedAt + clipDetails (clips ordered createdAt asc; viewUrl: the SAME rule as
    ReviewsService.computeViewUrl in apps/api/src/modules/reviews/reviews.service.ts, copy it as a private helper:
    null unless status 'uploaded' and objectKey is a '/' path or http(s) URL) + reviewers.
  - reviewers: ONE reviewAssignment.groupBy or findMany where { kind: 'calibration', calibrationClip: { setId } }
    -> per reviewerId: assigned = all rows, submitted = rows with state 'submitted'; names via ONE user.findMany;
    order by reviewerName. Fixed number of queries (no N+1).
  - @Roles('Committee','Admin'), ParseUUIDPipe; missing set -> 404 CALIBRATION_SET_NOT_FOUND.
  Test: set with 2 clips (one 'uploaded' objectKey '/e2e/sample.mp4' -> viewUrl '/e2e/sample.mp4', one pending_upload
    -> viewUrl null), 2 reviewers with assignments on both clips, one assignment submitted -> reviewers
    [{ assigned 2, submitted 1 }, { assigned 2, submitted 0 }]; assignedAt null; unknown id -> 404; Reviewer -> 403.
TOOLS: pnpm --filter @blulens/api db:generate; pnpm --filter @blulens/shared build; cd apps/api && pnpm build && pnpm lint && TEST_DATABASE_URL=<fresh *_test db> pnpm test
DONE: push, verify on origin, done message to Kevin (sha + test names + FULL pnpm test line on a fresh test DB).
