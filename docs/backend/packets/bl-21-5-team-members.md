PACKET bl-21-5: POST /api/v1/teams/{teamId}/members — DEMO SLICE

Assignee: Meredith (meredith-muxtbonw) · Reviewer: Oscar (oscar-muxt974o) · Senior: Kevin (kevin-muxsqdkp)

GOAL:
  The Committee/Admin adds a player to a club from a date (several concurrent clubs allowed, A11; memberships are
  dated so the draw can use the teams on the draw date).

STATE:
  Your worktree: D:/_work/SourceDev/_harness/blulens/worktrees/meredith-muxtbonw
  Branch dev/bl-21-team-members from origin/dev/bl-21-teams-suggest (Creed's TeamsModule; in review), then merge develop:
    git fetch origin && git switch -c dev/bl-21-team-members origin/dev/bl-21-teams-suggest && git merge origin/develop
  Already exists: apps/api/src/modules/teams/{teams.module.ts, teams.controller.ts, teams.service.ts} (Creed);
    Prisma TeamMembership (userId, teamId, validFrom, validTo null = current; DB partial unique: ONE open membership per
    (user, team) -> Prisma error P2002), Team (status active|archived), User; AuditService; reference style:
    apps/api/src/modules/users/* (yours) and apps/api/src/modules/tournaments/*.
  Note: Creed adds a team-requests controller to the same module at the same time; keep your changes to teams.module.ts
  to the minimum (register your controller + service). Kevin resolves that file at merge.

SOURCES (openapi, pasted):
  POST /teams/{teamId}/members  x-roles [Committee, Admin]
    body { userId: uuid, validFrom: 'YYYY-MM-DD' }  -> 201 (body: the membership)  · 409 Conflict
  architecture §6.6: several concurrent teams allowed (A11); each membership has a start/end date.

SPEC:
  Files to create/touch (ONLY these 4):
    - apps/api/src/modules/teams/team-members.controller.ts   (@Controller('teams'), handler @Post(':teamId/members'))
    - apps/api/src/modules/teams/team-members.service.ts
    - apps/api/src/modules/teams/teams.module.ts               (register controller + service)
    - apps/api/test/team-members.e2e-spec.ts
  Input: teamId via ParseUUIDPipe; body zod z.object({ userId: z.string().uuid(), validFrom: z.string().date() }).
  Behaviour (one transaction):
    1. team must exist with status 'active' -> else 404 TEAM_NOT_FOUND "ไม่พบทีมที่ต้องการ".
    2. user must exist, not deleted, status 'active' -> else 404 USER_NOT_FOUND "ไม่พบผู้ใช้ที่ต้องการ".
    3. create TeamMembership { userId, teamId, validFrom: new Date(`${validFrom}T00:00:00Z`) };
       Prisma P2002 (already an open membership in this team) -> 409 MEMBERSHIP_EXISTS "ผู้เล่นอยู่ในทีมนี้แล้ว".
    4. audit { action: 'team.member_add', entityType: 'team', entityId: teamId, after: { userId, validFrom } }.
    5. return 201 { id, userId, teamId, validFrom: 'YYYY-MM-DD', teamCount } where teamCount = the user's memberships current
       at now after the insert (A11: the web shows a MULTI_TEAM warning when > 1).
  Edge cases (e2e; unique token in names/emails):
    - Committee adds user U to team T1 (validFrom today) -> 201, teamCount 1
    - add U to T2 -> 201, teamCount 2
    - add U to T1 again -> 409 MEMBERSHIP_EXISTS
    - archived team -> 404 TEAM_NOT_FOUND; unknown user -> 404 USER_NOT_FOUND
    - Member cookie -> 403 FORBIDDEN; validFrom '2026-13-01' -> 400 VALIDATION_FAILED
  Cleanup in afterAll: delete memberships, teams, users you created (no results involved, so users CAN be deleted).

CONSTRAINTS: only the 4 files; no new deps; no `any`; conventional commits (feat(api): add POST /teams/{teamId}/members); push.
TOOLS: pnpm install --frozen-lockfile · pnpm --filter @blulens/shared build · pnpm --filter @blulens/api test · pnpm --filter @blulens/api lint
DONE (single proving test): apps/api/test/team-members.e2e-spec.ts, test "adds dated memberships, allows several clubs, rejects a duplicate"
  asserting the first three edge cases. Report: branch, commit, `git diff --stat origin/develop...HEAD`, commands + real output.
