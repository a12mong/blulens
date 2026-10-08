PACKET bl-25-8: POST /api/v1/events/{eventId}/groups/preview (group draw preview, new draws module)

Assignee: Meredith (meredith-muxtbonw) · Reviewer: Oscar (oscar-muxt974o) · Senior: Kevin (kevin-muxsqdkp)
Slice 3 write chain, step 1 of 3 (next: POST /draws/{drawId}/publish for group draws, then GET /events/{id}/groups).

GOAL: the Committee generates a PREVIEW group draw for an event from its approved entries: a Draw (kind group, status
  preview) with Groups, GroupMembers and the round-robin Matches. Preview draws are invisible to the public (all read
  endpoints already filter draw.status 'published'), so nothing changes for players until publish.

STATE: branch dev/bl-25-groups-preview from origin/develop. No draws module in apps/api: create
  apps/api/src/modules/draws/{draws.module.ts, draws.controller.ts, draws.service.ts}, register in app.module.ts.
  The demo seed (apps/api/prisma/seed.ts seedDemoGroupStage, bl-25-2) already builds exactly these rows: copy its
  logic (DrawEntry with teamIds + seedScore, planGroups(entries, groupSize, seed), roundRobinSchedule(n), inputHash =
  sha256 of the sorted entry ids, snapshot { entries }, DRAW_RULESET_VERSION, DRAW_PRNG_ID). Prisma Draw (see schema:
  version unique per (eventId, kind), seedSource server|committee, createdBy required, sameTeamR1Count default 0).

SOURCES (openapi, pasted):
  POST /events/{eventId}/groups/preview  x-roles [Committee]
    body { seed?: string matching ^[0-9a-f]{32}$, groupCount?: int >= 1 }   201 Draw
  Draw = { id, eventId, version, status, sameTeamR1Count, createdAt, createdBy, seed, inputHash, kind, rulesetVersion,
    size, slots: [] (knockout only; [] here), conflicts: [], minimumPossibleConflicts }

SPEC (files ONLY: the 3 new draws module files, app.module.ts, apps/api/test/groups-preview.e2e-spec.ts new):
  - @Roles('Committee','Admin'). Event missing -> 404 EVENT_NOT_FOUND. Event format (eventFormatSchema.safeParse) must
    be type 'groups_knockout' else 409 EVENT_NOT_GROUP_FORMAT. A PUBLISHED or LOCKED group draw exists -> 409
    DRAW_ALREADY_LOCKED (re-draw after publish is out of scope).
  - groupCount given -> 400 VALIDATION_FAILED with message 'groupCount override not supported yet' (keep the field).
  - entries = approved entries of the event (>= 3, else 409 NOT_ENOUGH_ENTRIES). seed = body.seed (seedSource committee)
    or randomBytes(16).toString('hex') (server). planGroups(entries, format.groupSize, seed); error -> 422
    GROUP_SIZES_IMPOSSIBLE.
  - ONE $transaction: version = max(version for event+kind group) + 1 (1 if none); Draw status preview, size = entry count,
    seedsCount 0, sameTeamR1Count = plan.sameTeamPairs.length, conflicts = sameTeamPairs as [{ entryIds:[a,b] }];
    Groups 'A','B',...; GroupMembers (seedInGroup = position, pot = position); Matches per roundRobinSchedule (stage
    group, matchNo running across the draw, court null, status scheduled, byes create no match). Audit 'draw.preview'.
  - Return the Draw shape above.
  Test: open tournament + groups_knockout event + 6 approved entries -> 201 preview, version 1, 2 groups of 3, 6 matches;
    GET /events/{id}/matches still returns [] (preview hidden); same seed twice -> same group membership (determinism);
    second preview -> version 2; event with knockout format -> 409; Member -> 403; bad seed -> 400. Clean up.
TOOLS: pnpm --filter @blulens/api db:generate; pnpm --filter @blulens/shared build; cd apps/api && pnpm build && pnpm lint && pnpm test
DONE: push dev/bl-25-groups-preview, verify on origin, done message to Kevin (sha + FULL pnpm test line).
