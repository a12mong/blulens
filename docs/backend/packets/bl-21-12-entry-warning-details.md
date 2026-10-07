PACKET bl-21-12: Entry.warningDetails (which player caused which warning)

Assignee: Creed (creed-muxswjfu) · Reviewer: Oscar (oscar-muxt974o) · Senior: Kevin (kevin-muxsqdkp) · tell: Andy (andy-muxsqkra)

GOAL:
  The Committee queue shows WHO triggered each warning ("นภา: อยู่ 2 ชมรม Blue Wing, Green Valley", "ธนา: เกรด N- นอกช่วง").
  Every Entry response gains warningDetails[], one row per (warning, player) (openapi, Jim 99b26c7).

STATE:
  Your worktree. Branch dev/bl-21-entry-warning-details from origin/develop (76a2270 or later).
  Already exists: apps/api/src/modules/entries/entries.service.ts private present(rows, viewer). It loads official
  results, current memberships (select userId, teamId) and event-bound results, then per player adds to a Set
  `warnings`: MULTI_TEAM (teamIds.length > 1), NO_APPROVED_GRADE (no official result), GRADE_OUT_OF_BAND (centerIndex
  outside [event.gradeMinIndex, event.gradeMaxIndex]), FRESH_ASSESSMENT_REQUIRED. It returns
  `warnings: isStaff(viewer) ? [...warnings].sort() : []`. Every Entry endpoint goes through present().

SOURCES (openapi, pasted):
  Entry.warningDetails: array, 'one row per (warning, player); Admin/Committee only'
    item required [code]: code enum [MULTI_TEAM, NO_APPROVED_GRADE, GRADE_OUT_OF_BAND, FRESH_ASSESSMENT_REQUIRED];
    userId uuid | null; displayName string | null;
    teamNames string[]  'MULTI_TEAM: all current clubs of the player';
    gradeLabel string | null  'GRADE_OUT_OF_BAND: the player label, e.g. N-'

SPEC:
  Files (ONLY these 2): entries.service.ts, apps/api/test/entries.e2e-spec.ts (+1 test).
  1. Memberships query: also select `team: { select: { name: true } }`; keep a map userId -> team names (sorted by name).
  2. In present(), next to each `warnings.add(code)` for a player, push a detail row:
       { code, userId: p.userId, displayName: p.user.displayName,
         teamNames: code === 'MULTI_TEAM' ? namesOf(p.userId) : [],
         gradeLabel: code === 'GRADE_OUT_OF_BAND' ? result.label : null }
     Always send all five fields (empty array / null when not applicable).
  3. Sort the details by code, then by player order in the entry. Return
       warningDetails: isStaff(viewer) ? details : []   (next to warnings; the same staff rule).
  `warnings` stays exactly as it is.
  Test (entries.e2e-spec, new it): one doubles entry where player A is in 2 clubs and player B has an official grade
    outside the event band. As Committee, GET the entry (or read the create response) ->
      warningDetails contains { code: 'MULTI_TEAM', userId: A, displayName: A's name, teamNames: [both club names, sorted], gradeLabel: null }
      and { code: 'GRADE_OUT_OF_BAND', userId: B, teamNames: [], gradeLabel: B's label }.
    As a Member (GET /events/{id}/entries, approved entries only: approve it with a 20+ char reason first, or read
    any approved entry) -> warningDetails is [].
    Reuse the fixtures and helpers already in entries.e2e-spec.ts (it builds multi-club and graded users).

CONSTRAINTS:
  - No extra queries per entry (use the maps present() already builds). No schema change.
  - The existing entries tests stay green. Never print .env values.

TOOLS:
  pnpm --filter @blulens/shared build; cd apps/api && pnpm test (all suites green; runs on the <db>_test database)

DONE:
  `git push -u origin dev/bl-21-entry-warning-details` (one commit). Done message to Kevin: sha, the test command + result line.
