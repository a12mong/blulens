PACKET bl-35-2: POST /calibration-sets/{setId}/clips/upload-url + POST /calibration-sets/{setId}/clips/{clipId}/complete

Assignee: whoever frees first, after bl-35-3 and bl-36-3 · Reviewer: Oscar (oscar-muxt974o) · Senior: Kevin (kevin-muxsqdkp)
GOAL: the Committee uploads a calibration clip with its reference grade, using the same storage flow as members.
STATE: branch dev/bl-35-calibration-upload from origin/develop after bl-35-3 and bl-36-3 merge. StorageService
  (global): presignPut, head, calibrationClipKey(setId, clipId, contentType), CLIP_* limits. CalibrationService has
  getSetDetail(setId, db) (bl-35-3). bl-36-3 shows the complete-step checks to mirror.
SOURCES: openapi /calibration-sets/{setId}/clips/upload-url (body { fileName, contentType, sizeBytes, referenceKey })
  and /calibration-sets/{setId}/clips/{clipId}/complete (Jim adds it per k201: body { durationSec 1..300 }, 200
  CalibrationSetDetail).
SPEC (files ONLY: calibration.controller.ts, calibration.service.ts, apps/api/test/calibration-upload.e2e-spec.ts NEW):
  - both @Roles('Committee','Admin') @HttpCode(200); lock the set FOR UPDATE; missing -> 404
    CALIBRATION_SET_NOT_FOUND; assignedAt set -> 409 CALIBRATION_SET_ASSIGNED.
  - upload-url: zod { fileName 1..255, contentType enum, sizeBytes 1..CLIP_MAX_BYTES, referenceKey gradeKeySchema }
    -> 400 VALIDATION_FAILED; create CalibrationClip { id, setId, objectKey calibrationClipKey(...), referenceIndex
    gradeIndex(referenceKey), status pending_upload, contentType, sizeBytes }; audit 'calibration_clip.create';
    return { clipId, uploadUrl, expiresAt }.
  - complete: same rules as bl-36-3 (CLIP_NOT_FOUND if the clip is not in this set, CLIP_NOT_UPLOADED, CLIP_MISMATCH,
    CLIP_TOO_LONG, idempotent when uploaded); update status uploaded + durationSec; audit 'calibration_clip.complete';
    return getSetDetail(setId, tx).
  Test (MinIO running): upload-url -> PUT -> complete -> clipDetails shows the clip uploaded with its referenceKey
    and a fetchable viewUrl; assigned set -> 409 on both; bad referenceKey -> 400; Reviewer -> 403.
TOOLS: pnpm --filter @blulens/api db:generate; pnpm --filter @blulens/shared build; cd apps/api && pnpm build && pnpm lint && TEST_DATABASE_URL=<fresh *_test db> pnpm test
DONE: push, verify on origin, done message to Kevin (sha + test names + FULL pnpm test line on a fresh test DB).
