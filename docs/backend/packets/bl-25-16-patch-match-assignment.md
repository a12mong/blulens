PACKET bl-25-16: PATCH /api/v1/matches/{matchId}/assignment (Committee sets court and/or umpire)

Assignee: Meredith (meredith-muxtbonw) · Reviewer: Oscar (oscar-muxt974o) · Senior: Kevin (kevin-muxsqdkp)
Follow-up to bl-25-15 (court-null matches): the Committee assigns courts/umpires after publishing a draw.
STATE: branch dev/bl-25-match-assignment from origin/develop. matches.controller/service (mapMatch + loadEntryMap +
  loadUserNames, applyResultAction lock pattern), AuditService. Prisma Match { court VarChar(20)?, umpireId?, groupId },
  GroupStanding (exists for match.groupId = stage confirmed), UserRole (role 'Umpire').
SOURCES (openapi, pasted): PATCH /matches/{matchId}/assignment  x-roles [Committee]
  body { court?: string|null (maxLength 32 in the contract; the DB column is 20: validate max 20), umpireId?: uuid|null }
  200 Match
SPEC (files ONLY: matches.controller.ts, matches.service.ts, apps/api/test/match-assignment.e2e-spec.ts new):
  - @Roles('Committee','Admin'), uuid pipe, zod body; at least one of court/umpireId present, else 400 VALIDATION_FAILED.
    court trimmed; '' -> null.
  - ONE $transaction with the match row FOR UPDATE. 404 MATCH_NOT_FOUND; stage confirmed -> 409 STAGE_CONFIRMED;
    umpireId set and the user lacks role Umpire (or is disabled) -> 422 UMPIRE_INVALID; umpireId is a player of either
    entry -> 422 UMPIRE_OWN_MATCH. Only the given fields change. Audit 'match.assign' with before/after.
  - Return the mapped Match.
  Test: set court 'สนาม 2' -> 200 court set; set umpireId of an Umpire -> 200, that umpire now sees it in GET
    /umpire/matches; umpireId of a Member without Umpire role -> 422; a player as umpire -> 422 UMPIRE_OWN_MATCH;
    court of 21 chars -> 400; empty body -> 400; Member caller -> 403; confirmed stage -> 409.
TOOLS: pnpm --filter @blulens/api db:generate; pnpm --filter @blulens/shared build; cd apps/api && pnpm build && pnpm lint && pnpm test
DONE: push dev/bl-25-match-assignment, verify on origin, done message to Kevin (sha + FULL pnpm test line).
