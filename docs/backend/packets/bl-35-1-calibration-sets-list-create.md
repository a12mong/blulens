PACKET bl-35-1: GET /api/v1/calibration-sets + POST /api/v1/calibration-sets (new calibration module)

Assignee: Angela (angela-muxswccx) · Reviewer: Oscar (oscar-muxt974o) · Senior: Kevin (kevin-muxsqdkp)
GOAL: the Committee lists calibration sets and creates an empty one (clips come later).
STATE: branch dev/bl-35-calibration-sets from origin/develop (>= 1f44b62). No calibration routes exist yet.
  Prisma: CalibrationSet { id, name varchar(120), description?, period? varchar(16) (NEW), active, assignedAt? (NEW),
  createdBy, createdAt, clips CalibrationClip[] }; CalibrationClip { id, setId, objectKey, referenceIndex 0..14,
  status, durationSec?, createdAt }. Ladder keys: GRADES from @blulens/shared (packages/shared/src/grading/grades.ts),
  key = GRADES[referenceIndex].
SOURCES: openapi /calibration-sets GET/POST and schema CalibrationSet { id, name, period, clips[{ clipId, referenceKey }], createdAt }.
SPEC (files ONLY, all NEW unless noted: apps/api/src/modules/calibration/calibration.module.ts, calibration.controller.ts,
  calibration.service.ts; apps/api/src/app.module.ts (import CalibrationModule, one line); apps/api/test/calibration-sets.e2e-spec.ts):
  - module provides CalibrationService, imports what AuditService/PrismaService need (copy the pattern of
    apps/api/src/modules/rater-stats/rater-stats.module.ts).
  - export toCalibrationSet(set with clips) -> { id, name, period: period ?? null, createdAt,
    clips: clips ordered by createdAt asc mapped { clipId: id, referenceKey: GRADES[referenceIndex] } } (later packets reuse it).
  - GET @Roles('Committee','Admin'): all sets ordered createdAt desc, include clips, mapped (one findMany with include).
  - POST @Roles('Committee','Admin') @HttpCode(201): zod { name: trim 1..120, period?: trim 1..16 } else 400
    VALIDATION_FAILED; create with createdBy = user.id; audit 'calibration_set.create' (entityType 'calibration_set')
    inside a $transaction; return toCalibrationSet with clips [].
  Test: POST { name, period: '2026-Q4' } -> 201 shape; POST {} -> 400 VALIDATION_FAILED; GET contains the new set
    first among this suite's sets, with a clip you insert via prisma (referenceIndex 7 -> referenceKey 'S');
    Reviewer -> 403; Guest -> 401. Calibration rows reference assignments, so cleanup only deletes clips/sets you
    created that have no assignments.
TOOLS: pnpm --filter @blulens/api db:generate; pnpm --filter @blulens/shared build; cd apps/api && pnpm build && pnpm lint && TEST_DATABASE_URL=<fresh *_test db> pnpm test
  (fresh test DB: DATABASE_URL from the repo .env with ONLY the db name changed to blulens_angela_<ms>_test.)
DONE: push, verify on origin, done message to Kevin (sha + test names + FULL pnpm test line on a fresh test DB).
