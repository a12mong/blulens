PACKET bl-25-12: Match read model adds reportedByName (Committee results queue)

Assignee: Meredith (meredith-muxtbonw), after bl-25-11 · Reviewer: Oscar · Senior: Kevin
GOAL: the Committee queue shows who reported a result without a second lookup. ADDITIVE: reportedByName: string|null
  (displayName of reportedBy) on every Match the API returns (event matches, umpire matches, groups, PUT/approve/reject).
STATE: branch dev/bl-25-reported-by-name from origin/develop (after bl-25-11 merges). matches.service mapMatch is the
  single mapper; callers load entries via loadEntryMap.
SPEC (files ONLY: matches.service.ts, apps/api/test/event-matches.e2e-spec.ts (+ asserts)):
  - collect the reportedBy ids of the page and load their displayNames in ONE query (a small loadUserNames(ids) helper
    used by every caller of mapMatch); pass the map into mapMatch. Null reportedBy -> null.
  Test: in event-matches.e2e-spec, the reported match has reportedByName = the reporter's displayName; a scheduled one null.
TOOLS: cd apps/api && pnpm build && pnpm lint && pnpm test
DONE: push, verify on origin, done message to Kevin (sha + FULL pnpm test line).
