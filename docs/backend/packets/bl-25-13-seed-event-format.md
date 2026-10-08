PACKET bl-25-13: demo seed sets the group format on the demo MD event (S12)

Assignee: Angela (angela-muxswccx) · Reviewer: Oscar (oscar-muxt974o) · Senior: Kevin (kevin-muxsqdkp)
GOAL: after `SEED_DEMO=1 pnpm db:seed`, the demo MD event of 'ศึกลูกขนไก่ชิงถ้วยประธานชมรม ครั้งที่ 3' (it has the published
  group draw from bl-25-2) has events.format = groups_knockout, so the groups page does not say 'not group format'.
STATE: branch dev/bl-25-seed-event-format from origin/develop. apps/api/prisma/seed.ts: seedDemoGroupStage (bl-25-2),
  seedDemoUmpire (bl-25-6). Shared eventFormatSchema (packages/shared/src/schemas/format.ts).
SPEC (file: apps/api/prisma/seed.ts ONLY). The ONLY allowed update of an existing row in the demo seed (god-approved
  exception; must stay idempotent): new seedDemoEventFormat():
  - find that MD event; missing -> log 'demo event format: no event' and return.
  - if event.format is NOT null -> log 'demo event format: exists' and return (never overwrite an owner's setting).
  - else build `eventFormatSchema.parse({ type: 'groups_knockout', groupSize: 4, advancePerGroup: 2, bestThirds: 0 })`
    (parse fills the defaults) and `prisma.event.update({ where: { id }, data: { format } })`; log 'demo event format: set'.
  - also pass the same format object in the create of that event (so a fresh seed has it from the start); call
    seedDemoEventFormat() BEFORE seedDemoGroupStage.
TEST: new scratch db (migrate deploy), SEED_DEMO=1 SEED_DEMO_PASSWORD=<any> npx tsx prisma/seed.ts twice: paste both outputs
  ('exists' on both runs is expected on a fresh DB, since the create now sets it; to see 'set', null it with SQL first
  and run once more: paste that too). `cd apps/api && pnpm lint` clean.
DONE: push dev/bl-25-seed-event-format, verify on origin, done message to Kevin (sha + the 3 seed outputs + lint line).
