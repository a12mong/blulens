PACKET bl-33-5: GET and PUT /api/v1/events/{eventId}/umpires (S15 umpire assignment)

Assignee: Creed (creed-muxswjfu) · Reviewer: Oscar (oscar-muxt974o) · Senior: Kevin (kevin-muxsqdkp)
STATE: branch dev/bl-33-event-umpires from origin/develop. matches module (controller/service); Prisma EventUmpire
  { eventId, userId, courts String[] (empty = every court, incl. court-null matches), createdAt } @@id(eventId,userId);
  UserRole (role 'Umpire'), User { displayName, disabled flag }. AuditService.record(entry, tx).
SOURCES (openapi b4261af): GET /events/{eventId}/umpires x-roles [Committee, Umpire] -> 200 EventUmpire[];
  PUT same path x-roles [Committee] body EventUmpire[] -> 200 EventUmpire[] (REPLACES the whole assignment);
  409 UMPIRE_NOT_ELIGIBLE (user lacks the Umpire role; details { userId }).
  EventUmpire = { userId, displayName (readOnly), courts: string[] (contract maxLength 32; the DB court column is 20: validate 20) }
SPEC (files ONLY: matches.controller.ts, matches.service.ts, apps/api/test/event-umpires.e2e-spec.ts new):
  - GET: 404 EVENT_NOT_FOUND if missing; rows ordered by displayName, courts sorted.
  - PUT: zod body (array; unique userIds else 400; courts trimmed, de-duplicated, 1..20 chars). Every userId must have
    role Umpire and not be disabled, else 409 UMPIRE_NOT_ELIGIBLE with details { userId } (first offender). ONE
    transaction: delete the event's EventUmpire rows not in the body, upsert the rest; audit 'event.umpires' with
    before/after arrays. Return the new list (same shape as GET).
  Test: PUT two umpires (one courts [], one ['สนาม 2', 'สนาม 2 ']) -> 200, courts de-duplicated; GET returns both with
    displayName; PUT with only one -> the other is removed; PUT a Member without the Umpire role -> 409
    UMPIRE_NOT_ELIGIBLE + details.userId; duplicate userIds -> 400; Umpire GET -> 200; Umpire PUT -> 403; unknown
    event -> 404. Clean up.
TOOLS: pnpm --filter @blulens/api db:generate; pnpm --filter @blulens/shared build; cd apps/api && pnpm build && pnpm lint && pnpm test
DONE: push, verify on origin, done message to Kevin: sha + test names + the WHOLE suite Tests: line. No placeholder tests.
