PACKET bl-21-8: demo seed realism (SEED_DEMO=1), one upcoming club tournament with entries

Assignee: Creed (creed-muxswjfu) · Reviewer: Oscar (oscar-muxt974o) · Senior: Kevin (kevin-muxsqdkp)

GOAL:
  When the owner opens the demo, the event list should look like a real Thai club event: one upcoming open tournament
  with a Thai name and venue, three events, and a few approved + pending entries of Thai-named players from Thai clubs.

STATE:
  Your worktree. Branch dev/bl-21-seed-realism from origin/develop (5f7f1d9 or later).
  Already exists: apps/api/prisma/seed.ts (seedAdmin, seedRubric, seedDemo with DEMO_TEAMS / DEMO_MEMBERS / upsertUser and
  an 'overridden' AssessmentResult per member as the official grade). Prisma: Tournament, Event, Entry, EntryPlayer
  (@@unique([eventId, userId])), Team (nameKey unique), TeamMembership. Shared: normalizeTeamName, GRADE_KEYS.

SOURCES:
  Grade ladder index: RK1 0, RK2 1, RK3 2, BG1 3, BG2 4, BG3 5, S- 6, S 7, S+ 8, N- 9, N 10, N+ 11, P- 12, P 13, P+ 14.
  Entry statuses: draft | pending_committee | approved | rejected | withdrawn. Tournament status: draft | open | ...
  Event: discipline MS|WS|MD|WD|XD, gradeMinIndex, gradeMaxIndex, maxEntries, minReviewers (default 2).

SPEC:
  File (ONLY this one): apps/api/prisma/seed.ts. No schema change, no migration.
  DO NOT change the existing 6 members (emails, names, grades) or the 3 existing teams: Playwright depends on them.
  1. Add 3 Thai clubs to DEMO_TEAMS, nameKey = normalizeTeamName(name) (import from @blulens/shared, as the API does):
       'ชมรมแบดมินตันบางเขน', 'สโมสรลูกขนไก่นนทบุรี', 'บ้านแบด สุขุมวิท'
  2. Add members 7..14 (member7@blulens.local ...) with realistic Thai first + last names you choose (not famous people).
     Grade indices so that MD S-..S+ has >= 10 eligible players, e.g. 6,6,7,7,8,8,7,6. Each member belongs to exactly
     one of the new Thai clubs. They get the same official grade as members 1..6 (reuse the loop).
  3. New seedDemoTournament(adminId), called from seedDemo after the members. Idempotent by name: if a Tournament named
     'ศึกลูกขนไก่ชิงถ้วยประธานชมรม ครั้งที่ 3' exists, return 'demo tournament: exists' and do nothing (never move dates).
     Otherwise create, in ONE prisma.$transaction:
       Tournament { that name, venue 'ศูนย์กีฬาแบดมินตัน ซอยลาดพร้าว 71', status 'open',
         startsOn = Bangkok date today + 21 days, entriesCloseAt = (startsOn - 5 days) 17:00 Asia/Bangkok (= 10:00Z) }
       Events: MD S-..S+ (maxEntries 16), XD BG3..S (maxEntries 12), MS S..N (maxEntries 16); minReviewers 2.
       MD entries built from members 7..14 (plus members 1..2 if needed), each player at most once per event:
         3 entries 'approved' (forwardedAt, decidedAt = now, decidedBy = adminId ?? null),
         2 entries 'pending_committee' (forwardedAt = now).
       Each EntryPlayer: userId, eventId, gradeResultId = that member's seeded official result id,
         teamId = that member's club, gradeConsent false.
       MS: 2 approved single entries from members whose grade is in S..N. XD: none (shows an empty event).
     Every player's grade index MUST lie inside the event's [gradeMinIndex, gradeMaxIndex].
  4. Also create a 'draft' tournament 'แบดมินตันสัมพันธ์ประจำเดือน', startsOn = today + 60 days, with one MD event and
     no entries (idempotent by name too). Drafts are hidden from Members; this shows the Committee view.
  5. The final log line says what happened, e.g. 'demo: ok (committee + 14 members, 6 teams, tournaments: 2 created)'.
  Bangkok date helper: new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10), then add days in UTC.

CONSTRAINTS:
  - Idempotent: running `SEED_DEMO=1 pnpm db:seed` twice creates nothing the second time.
  - Do NOT run the seed against the shared dev DB (localhost:5442/blulens): the owner demo and other agents use it.
    Test against your own DB, e.g. database name blulens_creed on the same server (CREATE DATABASE, then migrate deploy).
  - Never print .env values or URLs with passwords.

TOOLS:
  pnpm --filter @blulens/shared build
  cd apps/api; DATABASE_URL=<your db> pnpm exec prisma migrate deploy
  DATABASE_URL=<your db> SEED_DEMO=1 SEED_DEMO_PASSWORD=<any> pnpm exec tsx prisma/seed.ts   (run twice)
  pnpm test   (all API suites green)

DONE:
  One commit on dev/bl-21-seed-realism. Done message to Kevin with: both seed outputs (first: created, second: exists),
  counts of tournaments / events / entries by status after each run (must be identical), and the API test result.
