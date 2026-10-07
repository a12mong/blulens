PACKET bl-21-3: GET /api/v1/teams/suggest (team type-ahead endpoint) — DEMO SLICE

Assignee: Creed (creed-muxswjfu) · Reviewer: Oscar (oscar-muxt974o) · Senior: Kevin (kevin-muxsqdkp)

GOAL:
  The web's club field calls this as the user types and shows the ranked suggestions (architecture §6.6, A8).

STATE:
  Your own worktree. Branch dev/bl-21-teams-suggest FROM YOUR bl-21-1 BRANCH (it is with Oscar; merge order 1 then 3):
    git fetch origin && git switch -c dev/bl-21-teams-suggest origin/dev/bl-21-suggest-teams
  Then also bring in latest develop (auth + guards are there): git merge origin/develop
  Already exists (do not rewrite): your packages/shared/src/teams/suggest.ts (suggestTeams, TeamNameCandidate);
    apps/api/src/modules/auth/* (REFERENCE style), common/auth/decorators.ts (Roles), common/zod/zod.ts (createZodDto),
    Prisma models Team (name, nameKey, status), TeamAlias (teamId, alias, aliasKey).
  Depends on: bl-21-1 (yours), bl-10 platform (merged).

SOURCES (docs/api/openapi.yaml, pasted):
  GET /teams/suggest   x-roles: [Member, Reviewer, Committee, Admin]
    query: q (required, minLength 1), limit (1..20, default 8)
    200: array of { teamId: uuid, name: string, matchedAlias: string | null, distance: integer }
  Envelope is added by EnvelopeInterceptor; return the plain array.

SPEC:
  Files to create/touch (ONLY these 5):
    - apps/api/src/modules/teams/teams.module.ts
    - apps/api/src/modules/teams/teams.controller.ts      (@Controller('teams'))
    - apps/api/src/modules/teams/teams.service.ts
    - apps/api/src/app.module.ts                         (import TeamsModule: one import line + one array entry)
    - apps/api/test/teams.e2e-spec.ts
  Input (zod via createZodDto on @Query()):
    z.object({ q: z.string().min(1).max(120), limit: z.coerce.number().int().min(1).max(20).default(8) })
  Handler: @Roles('Member', 'Reviewer', 'Committee', 'Admin') @Get('suggest')
  Service:
    1. candidates = every team with status 'active' as { teamId, name, alias: null, key: nameKey }
       + every alias of an active team as { teamId, name: <team name>, alias: alias.alias, key: alias.aliasKey }.
       (Two Prisma queries, or one findMany with include aliases. Fine for hundreds of teams; no pagination.)
    2. return suggestTeams(q, candidates, limit). No ranking logic in the API.
  Edge cases (expected, in the e2e test). Create test teams with a unique token so the seeded demo teams never match:
    const t = `zq${randomUUID().slice(0, 6)}`  ->  teams `${t} Falcon` (key `${t} falcon`) with alias `${t}ฟัลคอน`,
    and `${t} Fortress` (key `${t} fortress`).
    - Member cookie, ?q=${t} -> 200, both teams, Falcon before Fortress (name order), distance 0
    - ?q=${t}ฟั -> [Falcon] with matchedAlias `${t}ฟัลคอน`
    - ?q=${t} f&limit=1 -> exactly 1 item
    - an archived team (status 'archived') never appears
    - no cookie -> 401 'UNAUTHENTICATED'; ?q= (empty) -> 400 'VALIDATION_FAILED'
  Cookies: import { signJwt } from '../src/common/auth/jwt';
    const cookieFor = (id: string, roles: string[]) => `bl_access=${signJwt({ sub: id, roles }, process.env.JWT_ACCESS_SECRET!, 900, Math.floor(Date.now() / 1000))}`;
  Bootstrap: copy beforeAll/afterAll from apps/api/test/tournaments.e2e-spec.ts. Delete your teams (aliases first) in afterAll.

CONSTRAINTS: only the 5 files; no new deps; no `any`; no matching logic in the API (call suggestTeams); conventional
  commits (feat(api): add GET /teams/suggest); push your branch. Local DB + repo-root .env as in your earlier packets.
TOOLS: pnpm install --frozen-lockfile · pnpm --filter @blulens/shared build · pnpm --filter @blulens/api test · pnpm --filter @blulens/api lint

DONE (the single proving test):
  File: apps/api/test/teams.e2e-spec.ts
  Test name: "suggests active teams and their aliases for the type-ahead"
  Asserts: the first three edge cases exactly.
  Report back (act=done to kevin-muxsqdkp): branch, commit, `git diff --stat origin/develop...HEAD`, commands + real output.
