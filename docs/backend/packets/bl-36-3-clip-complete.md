PACKET bl-36-3: POST /api/v1/clips/{clipId}/complete (member's upload finished -> clip uploaded)

Assignee: whoever frees first, after bl-36-2 · Reviewer: Oscar (oscar-muxt974o) · Senior: Kevin (kevin-muxsqdkp)
GOAL: after the browser's PUT, the server checks the object in MinIO and marks the clip uploaded (playable).
STATE: branch dev/bl-36-clip-complete from origin/develop after bl-36-2 merges. StorageService (global):
  head(objectKey) -> { sizeBytes, contentType } | null; viewUrl(status, objectKey) -> string | null;
  CLIP_MAX_DURATION_SEC = 300. bl-36-2 stores the declared contentType + sizeBytes on the Clip row.
SOURCES: openapi POST /clips/{clipId}/complete (Jim adds it per Kevin k201; if not yet on develop, build to this text):
  x-roles Member (owner of the DRAFT assessment); body { durationSec: integer 1..300 } (client-measured);
  200 -> Clip { id, status, viewUrl, durationSec, ... as the Clip schema }; idempotent when already uploaded.
SPEC (files ONLY: apps/api/src/modules/assessments/clips.controller.ts NEW (@Controller() with route
  'clips/:clipId/complete'; AssessmentsController is mounted at 'assessments', so it cannot host this path),
  assessments.module.ts (register it), assessments.service.ts, apps/api/test/clip-complete.e2e-spec.ts NEW):
  - @Roles('Member') @HttpCode(200). zod { durationSec: int 1..100000 } -> 400 VALIDATION_FAILED; then
    durationSec > CLIP_MAX_DURATION_SEC -> 422 CLIP_TOO_LONG (ApiException with HttpStatus.UNPROCESSABLE_ENTITY).
  - ONE $transaction: lock the clip FOR UPDATE; clip missing, or its assessment's subjectUserId !== caller -> 404
    CLIP_NOT_FOUND; assessment status !== 'draft' -> 409 ASSESSMENT_NOT_DRAFT; status 'uploaded' -> return it
    unchanged (idempotent); status 'rejected' -> 409 CLIP_REJECTED.
    obj = await storage.head(objectKey): null -> 409 CLIP_NOT_UPLOADED; obj.sizeBytes !== Number(clip.sizeBytes) or
    obj.contentType !== clip.contentType -> 422 CLIP_MISMATCH.
    update { status 'uploaded', durationSec, uploadExpiresAt: null }; audit 'clip.complete'.
  - return the Clip mapping the assessment detail already uses, with viewUrl = await storage.viewUrl(...).
  Test (MinIO running): upload-url -> PUT bytes -> complete { durationSec: 42 } -> 200 status 'uploaded', viewUrl a
    URL whose fetch returns the same bytes; second complete -> 200 same clip; complete before any PUT -> 409
    CLIP_NOT_UPLOADED; PUT fewer bytes than declared -> 422 CLIP_MISMATCH; durationSec 301 -> 422 CLIP_TOO_LONG;
    other Member -> 404; Reviewer -> 403.
TOOLS: pnpm --filter @blulens/api db:generate; pnpm --filter @blulens/shared build; cd apps/api && pnpm build && pnpm lint && TEST_DATABASE_URL=<fresh *_test db> pnpm test
DONE: push, verify on origin, done message to Kevin (sha + test names + FULL pnpm test line on a fresh test DB).
