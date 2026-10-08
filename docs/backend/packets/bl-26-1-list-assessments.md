PACKET bl-26-1: GET /api/v1/assessments (list, cursor page)

Assignee: Meredith (meredith-muxtbonw) · Reviewer: Oscar (oscar-muxt974o) · Senior: Kevin (kevin-muxsqdkp)
PRIORITY: before bl-25-2 (the web page /committee/assessments is merged and calls this).

GOAL: Committee/Admin list all assessments (filter by status / subjectUserId); a Member lists only their own.

STATE: branch dev/bl-26-list-assessments from origin/develop (cc8a1fb or later). assessments.controller.ts has only
  @Post routes. assessments.service.ts has private mapAssessment(assessment, reviewsSubmitted, reviewsRequired): reuse it
  for every item (read how POST/submit compute the two counts and do the same). Cursor pattern to copy:
  tournaments.service.ts list (take limit+1, cursor = id of the last item, nextCursor null when no more).

SOURCES (openapi, pasted):
  GET /assessments  x-roles [Member, Committee, Admin]
    query: cursor? (uuid), limit? (1..100, default 20), status? (AssessmentStatus enum), subjectUserId? (uuid),
      sort? default 'createdAt:desc', allowed fields createdAt|updatedAt|status, direction asc|desc
    200 AssessmentPage = { items: Assessment[] (same shape POST /assessments returns), nextCursor: string|null }

SPEC (files ONLY: assessments.controller.ts, assessments.service.ts, apps/api/test/list-assessments.e2e-spec.ts new):
  - @Roles('Member','Committee','Admin') @Get() list(@Query() q, @CurrentUser() actor), zod query DTO; bad value -> 400 VALIDATION_FAILED
  - actor without Committee/Admin: force where.subjectUserId = actor.id (ignore a different subjectUserId, no error)
  - orderBy [{ <sortField>: dir }, { id: dir }]; cursor via Prisma cursor + skip 1
  - batch the counts (no N+1): one groupBy on ReviewAssignment / Review for the page ids
  Test: Committee sees assessments of 2 members; ?status=in_review filters; limit=1 gives nextCursor and page 2 differs;
    a Member sees only own (even with ?subjectUserId=<other>); Guest -> 401; ?limit=0 -> 400. Clean up in afterAll.
TOOLS: pnpm --filter @blulens/api db:generate; pnpm --filter @blulens/shared build; cd apps/api && pnpm build && pnpm lint && pnpm test
DONE: push dev/bl-26-list-assessments, verify on origin, done message to Kevin (sha + result lines).
