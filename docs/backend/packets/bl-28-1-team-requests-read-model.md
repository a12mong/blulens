PACKET bl-28-1: GET /api/v1/team-requests adds requestedByName + similarTeams (additive read model for S17)

Assignee: Angela (angela-muxswccx) · Reviewer: Oscar (oscar-muxt974o) · Senior: Kevin (kevin-muxsqdkp)
GOAL: Darryl's team-request queue shows who asked and which existing teams look similar, so the Committee can choose
  create / alias / reject without leaving the page.
STATE: branch dev/bl-28-team-requests-read from origin/develop. apps/api/src/modules/teams/team-requests.service.ts:
  list (findMany at ~line 112) returns TeamRequest { id, name, requestedBy, status, teamId, createdAt }; create() uses a
  textKey normaliser for the name (reuse the SAME function). Prisma: Team { id, name, nameKey (unique), status },
  TeamAlias { teamId, alias, aliasKey (unique) }, User { displayName }.
SPEC (files ONLY: team-requests.service.ts, apps/api/test/team-requests-read.e2e-spec.ts new). ADDITIVE fields per item:
  - requestedByName: string|null = requester's displayName (include in the same findMany, no per-row query).
  - similarTeams: [{ id, name }] (max 5, active teams only, ordered by name) where, with k = textKey(request.name):
    team.nameKey contains k OR k contains team.nameKey OR an alias with aliasKey contains k. Compute with ONE query for
    the whole page: collect the page's keys, load candidate active teams with their aliasKeys once
    (where OR of `contains` per key, case already normalised), then match in memory.
  Test: request 'ชมรมแบดหาดใหญ่' with an active team 'ชมรมแบดหาดใหญ่ A' -> similarTeams has it; an inactive team is not
    listed; an alias match is listed; requestedByName = the requester's displayName; unrelated name -> []. Clean up.
TOOLS: pnpm --filter @blulens/api db:generate; pnpm --filter @blulens/shared build; cd apps/api && pnpm build && pnpm lint && pnpm test
DONE: push dev/bl-28-team-requests-read, verify on origin, done message to Kevin (sha + spec line + FULL pnpm test line).
