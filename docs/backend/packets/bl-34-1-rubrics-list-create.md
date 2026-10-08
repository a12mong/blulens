PACKET bl-34-1: GET /api/v1/rubrics + POST /api/v1/rubrics (rubric editor S12: list versions, start a draft)

Assignee: Creed (creed-muxswjfu) · Reviewer: Oscar (oscar-muxt974o) · Senior: Kevin (kevin-muxsqdkp)
GOAL: the Committee sees every rubric version and can open ONE draft copied from the active rubric.
STATE: branch dev/bl-34-rubrics from origin/develop (>= 1f44b62). Migration bl-34 is merged: rubrics.activated_at
  (nullable) + trigger (activation stamps it) + unique index rubrics_one_draft (at most one row with active=false AND
  activated_at IS NULL) + existing rubrics_one_active. Status is DERIVED, there is no status column:
  active=true -> 'active'; activated_at not null -> 'retired'; else 'draft'.
  Today only GET /rubric (singular, @Public, active one) exists in apps/api/src/modules/reviews (do not change it).
SOURCES: docs/api/openapi.yaml paths /rubrics (GET, POST) and schema Rubric { id, status, createdAt, methodVersion,
  criteria[{ key, nameTh, weight, anchorsTh? }] }. Rubric.params (grading parameters) is owner-approved math and is
  NEVER returned or written by any rubric endpoint (copied unchanged only).
SPEC (files ONLY: apps/api/src/modules/reviews/rubrics.controller.ts NEW, apps/api/src/modules/reviews/rubrics.service.ts
  NEW, apps/api/src/modules/reviews/reviews.module.ts (register both), apps/api/test/rubrics.e2e-spec.ts NEW):
  - shared mapper toRubric(row) -> { id, status, createdAt, methodVersion, criteria } (status derived as above). Later
    packets bl-34-2/3 reuse it, so export it from rubrics.service.ts.
  - GET /rubrics @Roles('Committee','Admin'): all rows ordered createdAt desc, mapped. 200 array.
  - POST /rubrics @Roles('Committee','Admin'), no body, @HttpCode 201: in ONE $transaction:
      existing draft -> 409 RUBRIC_DRAFT_EXISTS (Thai message). No active rubric -> 409 RUBRIC_NOT_FOUND.
      methodVersion = base + '-r' + N where base = active.methodVersion with a trailing /-r\d+$/ removed and
      N = 1 + the highest N among rows whose methodVersion is base + '-r<digits>' (none -> 2). Example: active
      'grading-v1' -> 'grading-v1-r2'; then 'grading-v1-r3'.
      create { methodVersion, criteria: active.criteria, params: active.params, active: false, createdBy: user.id }
      (do NOT set activatedAt). A Prisma P2002 on rubrics_one_draft (race) -> 409 RUBRIC_DRAFT_EXISTS.
      audit.record({ actorId, action: 'rubric.draft.create', entityType: 'rubric', entityId, after: { methodVersion } }, tx).
    Return toRubric(created) with status 'draft'.
  Test (Committee cookie; Member -> 403 on both; Guest -> 401): GET lists the active rubric with status 'active' and
    no 'params' key; POST -> 201 draft, criteria equal to the active one's, methodVersion '<active>-r<N>'; second
    POST -> 409 RUBRIC_DRAFT_EXISTS; GET now shows the draft first. Clean up: delete the draft row you created
    (drafts are deletable; never touch the active row).
TOOLS: pnpm --filter @blulens/api db:generate; pnpm --filter @blulens/shared build; cd apps/api && pnpm build && pnpm lint && TEST_DATABASE_URL=<fresh *_test db> pnpm test
  (fresh test DB: take DATABASE_URL from the repo .env, change ONLY the db name to blulens_<you>_<ms>_test.)
DONE: push, verify on origin, done message to Kevin (sha + test names + FULL pnpm test line on a fresh test DB).
  No expect(true), no conditional asserts, no `any`.
