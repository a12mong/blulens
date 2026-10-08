PACKET bl-34-2: PUT /api/v1/rubrics/{rubricId} + DELETE /api/v1/rubrics/{rubricId} (edit / delete the draft)

Assignee: Creed (creed-muxswjfu), after bl-34-1 · Reviewer: Oscar (oscar-muxt974o) · Senior: Kevin (kevin-muxsqdkp)
GOAL: the Committee edits the open draft's criteria, or throws the draft away.
STATE: branch dev/bl-34-rubric-draft from origin/develop after bl-34-1 merges. rubrics.service.ts/controller.ts exist
  with toRubric(row). Status derived: active -> active; activatedAt set -> retired; else draft.
SOURCES: openapi /rubrics/{rubricId} PUT (body RubricCriteriaInput) and DELETE. RubricCriteriaInput: criteria 1..12
  items { key /^[a-z][a-z_]{1,31}$/, nameTh 1..80, weight > 0 and <= 10, anchorsTh? object whose keys are tiers
  (TIERS from @blulens/shared: Rookie, Beginner, Standard, Neutral, Professional), values <= 500 chars }; keys unique.
SPEC (files ONLY: rubrics.controller.ts, rubrics.service.ts, apps/api/test/rubric-draft.e2e-spec.ts NEW):
  - zod schema for RubricCriteriaInput in rubrics.service.ts; failure -> 400 VALIDATION_FAILED (first issue message).
    Duplicate key -> 400 VALIDATION_FAILED. Unknown anchorsTh tier -> 400 VALIDATION_FAILED.
  - both routes @Roles('Committee','Admin'), ParseUUIDPipe; one $transaction with
    SELECT id FROM rubrics WHERE id = $1::uuid FOR UPDATE; missing -> 404 RUBRIC_NOT_FOUND;
    not a draft (active or activatedAt set) -> 409 RUBRIC_NOT_DRAFT.
  - PUT updates ONLY criteria (params, methodVersion untouched); audit 'rubric.draft.update' with before/after
    criteria; 200 toRubric(updated).
  - DELETE deletes the row; audit 'rubric.draft.delete' with before { methodVersion }; @HttpCode 204, empty body.
  Test: create a draft via POST /rubrics; PUT valid criteria -> 200 and GET /rubrics shows them; PUT with weight 0,
    duplicate keys, 13 items, anchorsTh { Expert: 'x' } -> each 400 VALIDATION_FAILED; PUT and DELETE on the active
    rubric id -> 409 RUBRIC_NOT_DRAFT; DELETE draft -> 204 and a second POST /rubrics now succeeds (201); unknown id
    -> 404; Member -> 403. Clean up the drafts you created.
TOOLS: pnpm --filter @blulens/api db:generate; pnpm --filter @blulens/shared build; cd apps/api && pnpm build && pnpm lint && TEST_DATABASE_URL=<fresh *_test db> pnpm test
DONE: push, verify on origin, done message to Kevin (sha + test names + FULL pnpm test line on a fresh test DB).
