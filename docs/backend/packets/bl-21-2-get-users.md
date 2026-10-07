PACKET bl-21-2: GET /api/v1/users (player picker) — DEMO SLICE

Assignee: Meredith (meredith-muxtbonw) · Reviewer: Oscar (oscar-muxt974o) · Senior: Kevin (kevin-muxsqdkp)

GOAL:
  The Committee can search users by role and name/email prefix to pick the player they register into an event
  (owner demo path bl-21, Jim D-S4).

STATE:
  Your worktree: D:/_work/SourceDev/_harness/blulens/worktrees/meredith-muxtbonw
  Branch dev/bl-21-get-users from origin/develop (ebb45ae or later: it has auth, guards, Prisma schema)
    git fetch origin && git switch -c dev/bl-21-get-users origin/develop
  Already exists (do not rewrite): apps/api/src/modules/auth/* (the REFERENCE controller to copy the style from),
    apps/api/src/common/auth/{decorators.ts (Roles, CurrentUser), jwt.ts (signJwt)}, common/zod/zod.ts (createZodDto),
    common/prisma/prisma.service.ts, prisma schema (User, UserRole, TeamMembership).
  Depends on (merged): bl-10 platform (ebb45ae).

SOURCES (docs/api/openapi.yaml on develop, pasted):
  GET /users   x-roles: [Committee, Admin]
    query: role? (Admin|Committee|Umpire|Reviewer|Member), q? (display name or email prefix), cursor?, limit? (1..100, default 20)
    200: { items: UserSummary[], nextCursor: string | null }
    UserSummary = { id: uuid, displayName: string, roles: Role[], teamIds: uuid[] (current teams, several allowed) }
  Envelope { success: true, data } is added by EnvelopeInterceptor — return the plain object.
  Errors: 401 UNAUTHENTICATED (no cookie), 403 FORBIDDEN (not Committee/Admin) — both come from the global AuthGuard
  when you put @Roles('Committee', 'Admin') on the handler. 400 VALIDATION_FAILED from the zod pipe.

SPEC:
  Files to create/touch (ONLY these 5):
    - apps/api/src/modules/users/users.module.ts
    - apps/api/src/modules/users/users.controller.ts
    - apps/api/src/modules/users/users.service.ts
    - apps/api/src/app.module.ts                 (add UsersModule to imports: one import line + one array entry)
    - apps/api/test/users.e2e-spec.ts
  Input (zod, in the controller file, used via createZodDto on @Query()):
    const listUsersQuery = z.object({
      role: roleSchema.optional(),                       // import { roleSchema } from '@blulens/shared'
      q: z.string().trim().min(1).max(80).optional(),
      cursor: z.string().uuid().optional(),
      limit: z.coerce.number().int().min(1).max(100).default(20),
    });
  Behaviour (service, Prisma only, no raw SQL):
    1. where: deletedAt null AND status 'active'; if role: roles some { role }; if q: OR [displayName startsWith q (mode insensitive),
       email startsWith q.toLowerCase()].
    2. orderBy [{ displayName: 'asc' }, { id: 'asc' }]; take limit + 1; when cursor: cursor { id: cursor }, skip 1.
    3. include roles and memberships where validFrom <= now AND (validTo null OR validTo > now).
    4. items = first `limit` rows mapped to UserSummary; nextCursor = id of the last returned item if there were more, else null.
  Edge cases (expected, in the e2e test):
    - Committee cookie, ?role=Member&q=<prefix unique to the test> -> 200, only the test's Member users, sorted by displayName
    - limit=2 over 3 matching users -> 2 items + nextCursor; calling again with that cursor -> the 3rd item, nextCursor null
    - a user with two current teams -> teamIds has both ids
    - no cookie -> 401 error.code 'UNAUTHENTICATED'; Member cookie -> 403 'FORBIDDEN'; limit=0 -> 400 'VALIDATION_FAILED'
  How to get cookies in the test (no login round-trip needed):
    import { signJwt } from '../src/common/auth/jwt';
    const cookieFor = (id: string, roles: string[]) =>
      `bl_access=${signJwt({ sub: id, roles }, process.env.JWT_ACCESS_SECRET!, 900, Math.floor(Date.now() / 1000))}`;
  Test app bootstrap: copy beforeAll/afterAll from apps/api/test/auth.e2e-spec.ts (Test.createTestingModule({ imports:
  [AppModule] }), setGlobalPrefix('api/v1'), cookieParser()). Create your users with a unique prefix in displayName
  (e.g. `zz-${randomUUID().slice(0,8)}-`) and delete them in afterAll (prisma.user.deleteMany; memberships cascade;
  teams you create: delete them after the users).

CONSTRAINTS:
  - Touch only the 5 files. No new dependencies. No `any`. No business logic beyond the query above.
  - Conventional commits (feat(api): add GET /users picker for the Committee). Push your branch.
  - Needs the local DB: docker compose up -d (already running on this machine) and the repo-root .env (copy
    D:/_work/SourceDev/_code/blulens/.env into your worktree root; never print its values).

TOOLS (from your worktree root):
  pnpm install --frozen-lockfile && pnpm --filter @blulens/shared build
  pnpm --filter @blulens/api exec dotenv -e ../../.env -- prisma migrate deploy   (expect "No pending migrations")
  pnpm --filter @blulens/api test
  pnpm --filter @blulens/api lint

DONE (the single proving test):
  File: apps/api/test/users.e2e-spec.ts
  Test name: "lets the Committee page through Members by name prefix with current team ids"
  Asserts: first two edge cases (filter + sort + cursor paging) and the two-teams case.
  Report back (act=done to kevin-muxsqdkp): branch, commit, `git diff --stat origin/develop...HEAD`, commands + real output.
  This is on the owner's demo path (bl-21): please do it first, now.
