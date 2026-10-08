PACKET bl-25-10: GET /api/v1/events/{eventId}/groups (groups with members and their round-robin schedule)

Assignee: Meredith (meredith-muxtbonw) · Reviewer: Oscar (oscar-muxt974o) · Senior: Kevin (kevin-muxsqdkp)
Slice 3 write chain, step 3 (read side). Next: POST /events/{id}/groups/confirm.

GOAL: public view of the event's PUBLISHED group draw: each group with its members (with entry labels) and its matches.
  Staff (Committee/Admin) may ask for the latest PREVIEW with ?draw=preview so the publish screen can show it.

STATE: branch dev/bl-25-event-groups from origin/develop (after bl-25-9 merges, else stacked on
  origin/dev/bl-25-publish-draw). matches.service: event visibility rule, loadEntryMap (EntryRef), mapMatch (with format).
SOURCES (openapi, pasted): GET /events/{eventId}/groups  x-roles [Guest, Member, Reviewer, Committee, Admin]
  200 Group[] = { id, label, members: [{ entryId, seedInGroup, pot }], matches: Match[] }
  ADDITIVE (Jim pins it): members[].entry: EntryRef; query draw? = published (default) | preview (staff only).
SPEC (files ONLY: matches.controller.ts, matches.service.ts, apps/api/test/event-groups.e2e-spec.ts new):
  - same event visibility as GET /events/{id}/matches. draw=preview by a non-staff caller -> 403 FORBIDDEN; bad value -> 400.
  - published: the event's group Draw with status published or locked; preview: the highest-version group Draw with
    status preview. None -> 200 [].
  - groups ordered by label; members by seedInGroup, each with entry (EntryRef); matches of that group ordered by round,
    matchNo, mapped with mapMatch. Load everything with a fixed number of queries (no N+1).
  Test: after preview + publish (use the draws endpoints) -> Guest gets 2 groups with 3 members each, entry.displayName
    set, 3 matches per group; a newer preview is NOT shown by default; Committee ?draw=preview gets the preview; Guest
    ?draw=preview -> 403; draft tournament as Guest -> 404; no draw -> []. Clean up.
TOOLS: pnpm --filter @blulens/api db:generate; pnpm --filter @blulens/shared build; cd apps/api && pnpm build && pnpm lint && pnpm test
DONE: push dev/bl-25-event-groups, verify on origin, done message to Kevin (sha + FULL pnpm test line).
