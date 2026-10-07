PACKET bl-21-4: POST + GET /api/v1/team-requests — DEMO SLICE (A8 "request a new team")

Assignee: Creed (creed-muxswjfu) · Reviewer: Oscar (oscar-muxt974o) · Senior: Kevin (kevin-muxsqdkp)

GOAL:
  When the type-ahead finds no club, the user asks for a new one; the Committee/Admin sees pending requests.
  (Resolving a request is the next packet.)

STATE:
  Your own worktree. Branch dev/bl-21-team-requests from origin/dev/bl-21-teams-suggest (your TeamsModule; in review):
    git fetch origin && git switch -c dev/bl-21-team-requests origin/dev/bl-21-teams-suggest && git merge origin/develop
  Already exists: apps/api/src/modules/teams/{teams.module.ts, teams.controller.ts, teams.service.ts} (yours);
    shared normalizeTeamName (yours); Prisma TeamRequest (id, requestedBy, text, textKey, status pending|created|aliased|rejected,
    resolvedTeamId, resolvedBy, resolvedAt, reason, createdAt), Team (nameKey), TeamAlias (aliasKey);
    common/audit/audit.service.ts (AuditService.record(entry, tx)); reference style: apps/api/src/modules/tournaments/*.

SOURCES (openapi + architecture §6.6, pasted):
  POST /team-requests  x-roles [Member, Reviewer, Committee, Admin]  body { name: string 1..120 }  -> 201 TeamRequest
  GET  /team-requests  x-roles [Committee, Admin]                                                  -> 200 TeamRequest[] (pending)
  TeamRequest = { id, name, requestedBy, status: pending|created|aliased|rejected, teamId: uuid|null, createdAt }
  §6.6: "If the normalised name matches an existing team or alias -> offer that team instead" (the user must pick from the list).

SPEC:
  Files to create/touch (ONLY these 4):
    - apps/api/src/modules/teams/team-requests.controller.ts   (@Controller('team-requests'))
    - apps/api/src/modules/teams/team-requests.service.ts
    - apps/api/src/modules/teams/teams.module.ts               (register the new controller + service)
    - apps/api/test/team-requests.e2e-spec.ts
  POST behaviour (service, one transaction):
    1. key = normalizeTeamName(name); key === '' -> 400 VALIDATION_FAILED (zod: name trimmed min 1 max 120 catches most).
    2. An ACTIVE team with nameKey = key, or an alias with aliasKey = key of an active team ->
       409 TEAM_EXISTS "มีทีมนี้อยู่แล้ว กรุณาเลือกจากรายการ" with details { teamId, name } (the web then selects it).
    3. A PENDING request with textKey = key -> 409 TEAM_REQUEST_PENDING "มีคำขอเพิ่มทีมนี้รออยู่แล้ว" with details { requestId }.
    4. Create { requestedBy: user.id, text: name (trimmed), textKey: key, status: 'pending' };
       audit { action: 'team_request.create', entityType: 'team_request', entityId: id, after: { name } }.
    5. Return TeamRequest (name = text, teamId = resolvedTeamId).
  GET behaviour: status 'pending', orderBy createdAt asc, map to TeamRequest[].
  Edge cases (e2e; use a unique token in every name, e.g. `zr${randomUUID().slice(0,6)}`):
    - Member: POST { name: '  <t> Eagles ' } -> 201 { name '<t> Eagles', status 'pending', teamId null }
    - same name again (different spacing/case '<T>  EAGLES') -> 409 TEAM_REQUEST_PENDING with details.requestId = the first id
    - create a team '<t> Hawks' (prisma) then POST '<t> hawks' -> 409 TEAM_EXISTS details.teamId = that team
    - create an alias '<t>ฮอว์ก' for it then POST '<t>ฮอว์ก' -> 409 TEAM_EXISTS
    - Committee GET -> contains the '<t> Eagles' request; Member GET -> 403 FORBIDDEN; no cookie POST -> 401
  Cookies: signJwt as in apps/api/test/tournaments.e2e-spec.ts. Cleanup in afterAll: delete your team_requests, aliases, teams.

CONSTRAINTS: only the 4 files; no new deps; no `any`; normalisation only via normalizeTeamName; conventional commits
  (feat(api): add team requests create + pending list); push.
TOOLS: pnpm install --frozen-lockfile · pnpm --filter @blulens/shared build · pnpm --filter @blulens/api test · pnpm --filter @blulens/api lint
DONE (single proving test): apps/api/test/team-requests.e2e-spec.ts, test "creates a team request unless the team or a pending request already exists"
  asserting the first four edge cases. Report: branch, commit, `git diff --stat origin/develop...HEAD`, commands + real output.
