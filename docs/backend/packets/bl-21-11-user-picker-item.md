PACKET bl-21-11: GET /api/v1/users returns UserPickerItem (club names + current grade label)

Assignee: Angela (angela-muxswccx) · Reviewer: Oscar (oscar-muxt974o) · Senior: Kevin (kevin-muxsqdkp) · tell: Andy (andy-muxsqkra)

GOAL:
  Andy's add-pair picker (Pam N2/N4) shows each player's clubs and current grade, so the Committee can pick the right
  person. GET /users items gain teamNames, gradeLabel and gradeProvisional (openapi UserPickerItem, Jim 99b26c7).

STATE:
  Your worktree. Branch dev/bl-21-user-picker-item FROM origin/be/bl-21-user-search-contains (4b180e4): that branch
  changes the same service (search matches any word start) and merges first. Do not undo its `where` clause.
  Already exists: apps/api/src/modules/users/users.service.ts listUsers() (filters, cursor paging, include roles +
  current memberships) mapping rows to UserSummary { id, displayName, roles, teamIds };
  users.controller.ts GET /users (@Roles Admin, Committee) returning { items: UserSummary[], nextCursor }.
  apps/api/src/common/grades.ts officialResults(db, userIds): Map userId -> latest approved/overridden AssessmentResult
  (has .label). Prisma ResultStatus: needs_reviewers | provisional | pending_approval | disputed | approved | overridden.

SOURCES (openapi, pasted):
  UserPickerItem: required [id, displayName]
    id uuid; displayName string; teamIds uuid[]; teamNames string[];
    gradeLabel: string | null  'label of the current official grade (approved/overridden), null if none'
    gradeProvisional: boolean  'true when only a provisional (unconfirmed) result exists'

SPEC:
  Files (ONLY these 3): users.service.ts, users.controller.ts (return type), apps/api/test/users.e2e-spec.ts (+1 test).
  1. Define the item type locally in users.service.ts:
       export type UserPickerItem = { id; displayName; roles: Role[]; teamIds: string[]; teamNames: string[];
         gradeLabel: string | null; gradeProvisional: boolean }
     Keep `roles` (extra field, the web may still read it).
  2. Memberships include: add `team: { select: { name: true } }`. teamIds and teamNames come from the same memberships,
     sorted together by team name (same order in both arrays).
  3. After paging, for the page's user ids only (no N+1):
       official = await officialResults(this.prisma, ids)  -> gradeLabel = official.get(id)?.label ?? null
       provisional = assessmentResult.findMany({ where: { status: 'provisional', assessment: { subjectUserId: { in: ids } } },
         select: { assessment: { select: { subjectUserId: true } } } })
       gradeProvisional = !official.has(id) && provisionalSet.has(id)
  4. Controller: Promise<{ items: UserPickerItem[]; nextCursor: string | null }>.
  Test (users.e2e-spec, new it): one Member in two clubs ('<PREFIX>Zeta' and '<PREFIX>Alpha' teams) with an approved
    AssessmentResult (label 'S+'), a second Member with only a 'provisional' result, a third with none.
    GET /users?role=Member&q=<their unique prefix> as Committee ->
      first: teamNames ['<PREFIX>Alpha', '<PREFIX>Zeta'] with teamIds in the same order, gradeLabel 'S+', gradeProvisional false
      second: gradeLabel null, gradeProvisional true;  third: gradeLabel null, gradeProvisional false.
    Create results the way apps/api/test/entries.e2e-spec.ts creates its fixture grade (Assessment + AssessmentResult
    with all required fields). Clean up everything you create in afterAll: results/transitions are append-only, so
    disable the users (status 'disabled') like assessments.e2e-spec does, instead of deleting them.

CONSTRAINTS:
  - The existing users tests stay green. No schema change. Admin/Committee only (unchanged guard).
  - Never print .env values.

TOOLS:
  pnpm --filter @blulens/shared build; cd apps/api && pnpm test (all suites green; runs on the <db>_test database)

DONE:
  `git push -u origin dev/bl-21-user-picker-item` (one commit). Done message to Kevin: sha, the test command + result line.
