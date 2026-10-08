PACKET bl-36-2: POST /api/v1/assessments/{assessmentId}/clips/upload-url (member gets a presigned PUT for one clip)

Assignee: whoever frees first (Creed / Angela) · Reviewer: Oscar (oscar-muxt974o) · Senior: Kevin (kevin-muxsqdkp)
GOAL: a Member uploading a clip for their own draft assessment gets a 15-minute presigned PUT URL.
STATE: branch dev/bl-36-upload-url from origin/develop (>= 9440c3c). StorageService is merged and global (inject it):
  apps/api/src/common/storage/storage.service.ts exports StorageService.presignPut(key, contentType, now?) ->
  { url, expiresAt }, assessmentClipKey(assessmentId, clipId, contentType), CLIP_MAX_BYTES (524288000),
  CLIP_CONTENT_TYPES ['video/mp4','video/quicktime'], type ClipContentType. Clip model: { id, assessmentId, objectKey
  unique, status pending_upload|uploaded|rejected, contentType?, sizeBytes BigInt?, uploadExpiresAt?, ... }.
SOURCES: openapi /assessments/{assessmentId}/clips/upload-url (body { fileName, contentType, sizeBytes }; 200
  { clipId, uploadUrl, expiresAt }); summary: draft only, max 3 clips, 500 MB, mp4/mov.
SPEC (files ONLY: assessments.controller.ts, assessments.service.ts, apps/api/test/clip-upload-url.e2e-spec.ts NEW):
  - @Roles('Member') @HttpCode(200) POST ':assessmentId/clips/upload-url', ParseUUIDPipe.
  - zod body { fileName: string 1..255, contentType: enum CLIP_CONTENT_TYPES, sizeBytes: int 1..CLIP_MAX_BYTES } ->
    400 VALIDATION_FAILED on failure (sizeBytes over the limit included).
  - ONE $transaction: lock the assessment row FOR UPDATE; missing OR subjectUserId !== caller -> 404
    ASSESSMENT_NOT_FOUND (do not leak others' ids); status !== 'draft' -> 409 ASSESSMENT_NOT_DRAFT;
    clips of the assessment with status !== 'rejected' >= 3 -> 409 CLIP_LIMIT_REACHED.
    clipId = randomUUID(); objectKey = assessmentClipKey(assessmentId, clipId, contentType);
    presign = await storage.presignPut(objectKey, contentType, now);
    clip.create { id: clipId, assessmentId, objectKey, status 'pending_upload', contentType, sizeBytes: BigInt,
    uploadExpiresAt: presign.expiresAt }.
  - return { clipId, uploadUrl: presign.url, expiresAt: presign.expiresAt }.
  Test (MinIO must be running: docker compose up -d minio; tests use the '<S3_BUCKET>-test' bucket automatically):
    Member creates a draft (POST /assessments) -> upload-url 200; PUT a small Buffer to uploadUrl with fetch and
    the same Content-Type -> 200; the clip row exists pending_upload with objectKey 'clips/<assessmentId>/<clipId>.mp4';
    4th request after 3 clips -> 409 CLIP_LIMIT_REACHED; contentType 'video/avi' -> 400; sizeBytes 524288001 -> 400;
    another Member -> 404 ASSESSMENT_NOT_FOUND; submitted assessment -> 409 ASSESSMENT_NOT_DRAFT; Reviewer -> 403.
TOOLS: pnpm --filter @blulens/api db:generate; pnpm --filter @blulens/shared build; cd apps/api && pnpm build && pnpm lint && TEST_DATABASE_URL=<fresh *_test db> pnpm test
DONE: push, verify on origin, done message to Kevin (sha + test names + FULL pnpm test line on a fresh test DB).
