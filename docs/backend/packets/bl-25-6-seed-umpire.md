PACKET bl-25-6: demo seed, an Umpire for the demo group stage (SEED_DEMO=1)

Assignee: Creed (creed-muxswjfu) · Reviewer: Oscar (oscar-muxt974o) · Senior: Kevin (kevin-muxsqdkp)
GOAL: the owner can log in as umpire1@blulens.local and report the demo group-stage matches. ADDITIVE + IDEMPOTENT
  (the owner re-seeds blulens_demo: no migration, no deletes, no updates of existing rows).
STATE: branch dev/bl-25-seed-umpire from origin/develop. apps/api/prisma/seed.ts: upsertUser(), seedDemoGroupStage()
  (your bl-25-2: the MD event of 'ศึกลูกขนไก่ชิงถ้วยประธานชมรม ครั้งที่ 3' with a published group draw, court 'สนาม 1').
  Prisma EventUmpire { eventId, userId, courts String[] (empty = every court) }, Role 'Umpire', TeamMembership.
SPEC (file: apps/api/prisma/seed.ts ONLY):
  - upsertUser accepts 'Umpire'. Create umpire1@blulens.local ('กรรมการ 1'), role Umpire, password SEED_DEMO_PASSWORD,
    with NO team membership (so they share no team with any player).
  - seedDemoUmpire(): find the MD event above; if missing log 'demo umpire: no event' and return. If an EventUmpire row
    for (event, umpire1) exists log 'demo umpire: exists'; else create it with courts [] and log 'demo umpire: created'.
  - Call it after seedDemoGroupStage.
TEST: fresh scratch DB: migrate deploy, seed twice (paste both outputs: 'created' then 'exists'); `cd apps/api && pnpm lint` clean.
DONE: push dev/bl-25-seed-umpire, verify on origin, done message to Kevin (sha, both seed outputs, lint line).
