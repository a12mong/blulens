PACKET bl-35-4: PATCH + DELETE /api/v1/calibration-sets/{setId}/clips/{clipId} (only before the set is assigned)

Assignee: Angela (angela-muxswccx), after bl-35-3 · Reviewer: Oscar (oscar-muxt974o) · Senior: Kevin (kevin-muxsqdkp)
GOAL: the Committee fixes a clip's reference grade or removes a clip while the set is still unassigned.
STATE: branch dev/bl-35-clip-edit from origin/develop after bl-35-3 merges (CalibrationService.getSetDetail(setId, db)).
  calibration_sets.assigned_at is set by POST .../assign (bl-35-5); once set, clips are frozen.
SOURCES: openapi /calibration-sets/{setId}/clips/{clipId} PATCH (body { referenceKey: GradeKey }, 200
  CalibrationSetDetail) and DELETE (204). gradeKeySchema + gradeIndex from @blulens/shared.
SPEC (files ONLY: calibration.controller.ts, calibration.service.ts, apps/api/test/calibration-clip-edit.e2e-spec.ts NEW):
  - both @Roles('Committee','Admin'), ParseUUIDPipe on both ids; ONE $transaction:
    SELECT id, assigned_at FROM calibration_sets WHERE id = $1::uuid FOR UPDATE; missing -> 404 CALIBRATION_SET_NOT_FOUND;
    clip missing or clip.setId !== setId -> 404 CLIP_NOT_FOUND; assigned_at not null -> 409 CALIBRATION_SET_ASSIGNED.
  - PATCH: zod { referenceKey: gradeKeySchema } else 400 VALIDATION_FAILED; update referenceIndex = gradeIndex(key);
    audit 'calibration_clip.update' before/after { referenceKey }; return getSetDetail(setId, tx).
  - DELETE: delete the clip row (no assignments can exist before assign); audit 'calibration_clip.delete';
    @HttpCode(204).
  Test: PATCH 'N' -> 200 and clipDetails shows 'N'; PATCH 'XX' -> 400; set assignedAt via prisma, then PATCH and
    DELETE -> 409 CALIBRATION_SET_ASSIGNED; on an unassigned set DELETE -> 204 and the clip is gone; clip of another
    set -> 404 CLIP_NOT_FOUND; Reviewer -> 403.
TOOLS: pnpm --filter @blulens/api db:generate; pnpm --filter @blulens/shared build; cd apps/api && pnpm build && pnpm lint && TEST_DATABASE_URL=<fresh *_test db> pnpm test
DONE: push, verify on origin, done message to Kevin (sha + test names + FULL pnpm test line on a fresh test DB).
