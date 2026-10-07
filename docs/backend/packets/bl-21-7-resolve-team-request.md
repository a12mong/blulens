PACKET bl-21-7: POST /api/v1/team-requests/{requestId}/resolve

Assignee: Creed (creed-muxswjfu) · Reviewer: Oscar (oscar-muxt974o) · Senior: Kevin (kevin-muxsqdkp)

GOAL:
  The Committee/Admin turns a pending team request into a new team, an alias of an existing team (e.g. 'บลูวิง' ->
  Blue Wing), or rejects it (architecture §6.6, A8).

STATE:
  Your worktree. Branch dev/bl-21-resolve-team-request from origin/develop (1c1ee27 or later: your team-requests are merged).
  Already exists (yours): apps/api/src/modules/teams/team-requests.{controller,service}.ts; Prisma TeamRequest, Team
  (nameKey unique), TeamAlias (aliasKey unique); AuditService; shared normalizeTeamName.

SOURCES (openapi, pasted):
  POST /team-requests/{requestId}/resolve   x-roles [Committee, Admin]
    body { action: 'create_team' | 'alias_to_team' | 'reject', teamId?: uuid (required for alias_to_team), reason?: string }
    200 TeamRequest = { id, name, requestedBy, status: pending|created|aliased|rejected, teamId: uuid|null, createdAt }

SPEC:
  Files (ONLY these 3): team-requests.controller.ts (+1 handler, @Post(':requestId/resolve') @HttpCode(200)),
    team-requests.service.ts (+ resolve()), apps/api/test/team-request-resolve.e2e-spec.ts (new)
  Input zod (in the controller): z.object({ action: z.enum(['create_team','alias_to_team','reject']),
    teamId: z.string().uuid().optional(), reason: z.string().trim().max(2000).optional() })
    .refine(b => b.action !== 'alias_to_team' || !!b.teamId, { message: 'ต้องเลือกทีมที่จะผูกชื่อ', path: ['teamId'] })
    .refine(b => b.action !== 'reject' || (b.reason?.length ?? 0) >= 5, { message: 'ต้องระบุเหตุผลอย่างน้อย 5 ตัวอักษร', path: ['reason'] })
  resolve(requestId, body, actor, ip), ONE transaction:
    1. load request (404 TEAM_REQUEST_NOT_FOUND); must be 'pending' else 409 TEAM_REQUEST_NOT_PENDING "คำขอนี้ถูกดำเนินการแล้ว".
    2. create_team: create Team { name: request.text, nameKey: request.textKey } -> status 'created', resolvedTeamId = new id;
         audit 'team.create'.
       alias_to_team: target team must exist with status 'active' (404 TEAM_NOT_FOUND); create TeamAlias
         { teamId, alias: request.text, aliasKey: request.textKey } -> status 'aliased', resolvedTeamId = teamId; audit 'team.alias_add'.
       reject: status 'rejected', reason.
       Prisma P2002 in create_team / alias_to_team (the key is now taken by a team or alias) -> 409 TEAM_EXISTS.
    3. conditional updateMany WHERE id AND status 'pending' with { status, resolvedTeamId, resolvedBy: actor.id, resolvedAt: now,
       reason }; count 0 -> 409 TEAM_REQUEST_NOT_PENDING (lost a race).
    4. audit 'team_request.resolve' { before: { status: 'pending' }, after: { status, teamId }, reason }.
    5. return the TeamRequest (same mapping as your create()).
  Edge cases (e2e; unique token in names, clean up teams/aliases/requests in afterAll):
    - create_team -> 200 status 'created', teamId set; then GET /teams/suggest?q=<the name> finds that team
    - alias_to_team to team T -> 200 status 'aliased', teamId T; GET /teams/suggest?q=<the request text> returns T with matchedAlias
    - reject without reason -> 400 VALIDATION_FAILED; with reason -> 200 'rejected'
    - resolving the same request twice -> 409 TEAM_REQUEST_NOT_PENDING
    - alias_to_team without teamId -> 400; to an archived team -> 404 TEAM_NOT_FOUND
    - Member cookie -> 403
CONSTRAINTS: only the 3 files; no new deps; no `any`; conventional commits; push.
TOOLS: pnpm --filter @blulens/shared build · pnpm --filter @blulens/api test · pnpm --filter @blulens/api lint (DB on localhost:5442; repo-root .env copied into your worktree)
DONE (single proving test): team-request-resolve.e2e-spec.ts, test "resolves a request into a new team or an alias that the type-ahead then finds",
  asserting the first two edge cases. Report: branch, commit, `git diff --stat origin/develop...HEAD`, commands + real output.
