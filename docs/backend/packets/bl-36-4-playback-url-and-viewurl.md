PACKET bl-36-4: GET /api/v1/clips/{clipId}/playback-url + viewUrl via StorageService everywhere

Assignee: whoever frees first, after bl-36-3 · Reviewer: Oscar (oscar-muxt974o) · Senior: Kevin (kevin-muxsqdkp)
GOAL: every Clip viewUrl is a real 15-min presigned GET, and the web can refresh an expired one.
STATE: branch dev/bl-36-playback from origin/develop after bl-36-3 merges. Today assessments.service.ts:321 and
  reviews.service.ts:176 each have a private computeViewUrl that returns null for bucket keys. StorageService.viewUrl
  (status, objectKey) keeps the same pass-through for '/...' and http(s) keys (seeded demo clips) and presigns bucket
  keys; StorageService.presignGet(objectKey) -> { url, expiresAt }.
SOURCES: openapi /clips/{clipId}/playback-url (x-roles Member owner, assigned Reviewer, Committee; 200 { url,
  expiresAt }; 403 CLIP_FORBIDDEN).
SPEC (files ONLY: assessments.service.ts, reviews.service.ts, apps/api/src/modules/assessments/clips.controller.ts
  (from bl-36-3), apps/api/test/clip-playback.e2e-spec.ts NEW):
  - delete both computeViewUrl helpers; map clips with await Promise.all(... storage.viewUrl(c.status, c.objectKey)).
    Response shapes do not change. Reviewer endpoints stay blind (no new fields).
  - GET 'clips/:clipId/playback-url' @Roles('Member','Reviewer','Committee','Admin'): clip missing -> 404
    CLIP_NOT_FOUND; status !== 'uploaded' -> 409 CLIP_NOT_UPLOADED; allowed when caller is Committee/Admin, OR the
    assessment's subjectUserId, OR has a reviewAssignment (kind assessment) on that assessment; else 403
    CLIP_FORBIDDEN. Return presignGet(objectKey).
  Test: existing suites that read viewUrl must stay green (seeded '/e2e/...' keys pass through); new suite: uploaded
    bucket clip (create via upload-url + PUT + complete) -> owner, Committee and the assigned Reviewer get 200 with a
    URL whose fetch returns the bytes; an unrelated Reviewer -> 403 CLIP_FORBIDDEN; pending clip -> 409.
TOOLS: pnpm --filter @blulens/api db:generate; pnpm --filter @blulens/shared build; cd apps/api && pnpm build && pnpm lint && TEST_DATABASE_URL=<fresh *_test db> pnpm test
DONE: push, verify on origin, done message to Kevin (sha + test names + FULL pnpm test line on a fresh test DB).
