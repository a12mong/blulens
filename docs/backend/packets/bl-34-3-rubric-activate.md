PACKET bl-34-3: POST /api/v1/rubrics/{rubricId}/activate (draft becomes active, old active becomes retired)

Assignee: Angela (angela-muxswccx), after bl-34-1 · Reviewer: Oscar (oscar-muxt974o) · Senior: Kevin (kevin-muxsqdkp)
GOAL: one call switches the active rubric, with a reason in the audit log.
STATE: branch dev/bl-34-rubric-activate from origin/develop after bl-34-1 merges. rubrics.service.ts/controller.ts
  exist with toRubric(row). DB: unique index rubrics_one_active; a trigger sets activated_at when a row becomes
  active, so you never write activatedAt yourself. Assessments keep their own rubricId: nothing else changes.
SOURCES: openapi /rubrics/{rubricId}/activate, body ReasonInput { reason 5..2000 }.
SPEC (files ONLY: rubrics.controller.ts, rubrics.service.ts, apps/api/test/rubric-activate.e2e-spec.ts NEW):
  - @Roles('Committee','Admin') @HttpCode(200). Body zod { reason: string trim min 5 max 2000 } else 400 VALIDATION_FAILED.
  - ONE $transaction: SELECT ... FROM rubrics WHERE id = target OR active FOR UPDATE; target missing -> 404
    RUBRIC_NOT_FOUND; target not a draft -> 409 RUBRIC_NOT_DRAFT.
    ORDER MATTERS (one-active index): first update the current active row to active=false, then the target to
    active=true. audit 'rubric.activate', entityId target, before { methodVersion of the old active },
    after { methodVersion of the target }, reason.
  - return toRubric(target re-read) -> status 'active'.
  Test: POST /rubrics (draft) then activate with reason -> 200 status 'active'; GET /rubric (public) returns the new
    methodVersion; GET /rubrics shows the old one as 'retired'; activating the retired one -> 409 RUBRIC_NOT_DRAFT;
    reason 'abc' -> 400; Member -> 403; audit row with the reason exists. Clean up: re-activate the ORIGINAL active
    rubric is not possible (retired is immutable), so instead run your suite last-safe: other suites read
    findFirst({ where: { active: true } }) and only need *an* active rubric, which still holds. Do not delete rubrics.
TOOLS: pnpm --filter @blulens/api db:generate; pnpm --filter @blulens/shared build; cd apps/api && pnpm build && pnpm lint && TEST_DATABASE_URL=<fresh *_test db> pnpm test
  (fresh test DB: DATABASE_URL from the repo .env with ONLY the db name changed to blulens_angela_<ms>_test.)
DONE: push, verify on origin, done message to Kevin (sha + test names + FULL pnpm test line on a fresh test DB).
