PACKET bl-25-2: demo seed, one published group stage with matches (SEED_DEMO=1)

Assignee: Meredith (meredith-muxtbonw) · Reviewer: Oscar (oscar-muxt974o) · Senior: Kevin (kevin-muxsqdkp)
Slice 3: gives the owner and Darryl real group-stage data before the draw write endpoints exist.

GOAL: with SEED_DEMO=1, `pnpm db:seed` creates a published group draw for the MD event of the open demo tournament
  'ศึกลูกขนไก่ชิงถ้วยประธานชมรม ครั้งที่ 3', with its groups, members and round-robin matches, some results confirmed,
  one reported. The owner re-seeds blulens_demo: ADDITIVE + IDEMPOTENT (no migration, no deletes, no updates of existing rows).

STATE: branch dev/bl-25-seed-group-stage from origin/develop (9412bc1+). apps/api/prisma/seed.ts (demo tournament with an
  MD event holding 3 approved + 2 pending pair entries). Shared: planGroups(entries, groupSize, seed), roundRobinSchedule(size),
  validateMatchScore(games, format), DRAW_RULESET_VERSION, DRAW_PRNG_ID. Prisma: Draw (required: eventId, kind 'group',
  version, status, seed, seedSource, inputHash char(64), snapshot json, rulesetVersion, prngId, size, seedsCount, createdBy),
  Group { eventId, drawId, label }, GroupMember { groupId, entryId, seedInGroup, pot }, Match (see bl-25-1).

SPEC (file: apps/api/prisma/seed.ts ONLY):
  - seedDemoGroupStage(adminId): idempotency marker = any Draw with kind 'group' for that MD event -> skip ('demo group
    stage: exists'). Needs adminId (Draw.createdBy is required): skip with a log line if there is no admin.
  - Before creating, approve the 2 pending MD entries? NO: use ONLY the approved entries. If fewer than 3 are approved,
    skip with a log line.
  - In ONE transaction: Draw { kind 'group', version 1, status 'published', seed 'demo-seed', seedSource: a valid enum value
    (read the SeedSource enum), inputHash = sha256 hex of the sorted entry ids, snapshot { entries: [...] }, rulesetVersion
    DRAW_RULESET_VERSION, prngId DRAW_PRNG_ID, size = entry count, seedsCount 0, createdBy adminId }.
    plan = planGroups(approved entries as DrawEntry { id, teamIds (clubs of the players), seedScore (mean official score) },
    4, 'demo-seed'); for each group i: Group { label 'A','B',... }, GroupMember rows (seedInGroup = position 1..n, pot =
    position), and Match rows from roundRobinSchedule(n): stage 'group', round, matchNo running 1.. per group,
    topEntryId / bottomEntryId from the seed positions, bye rounds create no match, court 'สนาม 1'.
  - Results: the FIRST match: games [{a:15,b:11},{a:15,b:9}], result 'a_win', winnerEntryId a, status 'confirmed',
    confirmedBy adminId, confirmedAt now, resultVersion 1, flags []. The SECOND match: games [{a:13,b:15},{a:15,b:12}],
    result 'draw', status 'reported', reportedBy adminId, reportedAt now. The rest stay 'scheduled'. Check both scores with
    validateMatchScore against the group_2x15 format (fixed_games, 2 games, 15 points, no deuce, drawAllowed) and throw if invalid.
  - Log 'demo group stage: created (N groups, M matches)'.
TEST: fresh scratch DB: migrate deploy, seed twice. The first run creates 1 draw + groups + matches (paste the counts);
  the second creates nothing. `cd apps/api && pnpm lint` clean.
DONE: push dev/bl-25-seed-group-stage, verify on origin, done message to Kevin (sha, both seed outputs, counts).
