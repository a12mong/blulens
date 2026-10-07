# PACKET bl-21-8-entry-workflow-hooks: entry workflow hooks (create/forward/approve/reject/edit/queue) (Ryan)

GOAL: Hooks for the doubles-entry lifecycle so no page calls fetch.

STATE:
- WORKTREE RULE: never switch branches in the shared checkout. Own worktree, branch `fe/bl-21-entry-hooks` from `origin/develop`, `pnpm install` there; before typecheck run `pnpm --filter @blulens/shared build`. Run `pnpm --filter @blulens/web gen:api` if types look stale. Dev servers on port 3190 (not 3100). Never commit to main/develop.
- Review gate: after done, Andy sends your branch to Stanley; merge only on APPROVE.
- Depends on: bl-21-1 merged (same file area)

SOURCES:
- Contract (docs/api/openapi.yaml, develop 07543e2): EntryInput `{ name?, players: [{ userId, teamId? }] }` (doubles = exactly 2 players; slice 1 = doubles); Entry `{ id, eventId, status, name, forwardedAt, decidedAt, decisionReason, players[{userId, displayName, teamIds, teamCount, grade|null}], warnings[] }`; EntryStatus = draft | pending_committee | approved | rejected | withdrawn. Warnings (strings): MULTI_TEAM, NO_APPROVED_GRADE, GRADE_OUT_OF_BAND, FRESH_ASSESSMENT_REQUIRED. Lifecycle: POST `/events/{id}/entries` -> draft; POST `/entries/{id}/forward` (Admin|Committee) draft -> pending_committee; POST `/entries/{id}/approve` (Committee; body `{reason?}`; 409 ENTRY_PLAYER_UNGRADED, 409 ENTRY_OUT_OF_BAND_REASON_REQUIRED needs reason >= 20 chars); POST `/entries/{id}/reject` (Committee; body `{reason}`); PATCH `/entries/{id}` (draft/rejected only). Queue: GET `/entries?status=pending_committee&eventId=`; GET `/events/{id}/entries?status=`. Hard errors on create: ENTRIES_CLOSED, ENTRY_PLAYER_COUNT, ENTRY_DUPLICATE_PLAYER. (Check the exact request bodies of approve/reject/PATCH in openapi before coding.)
- Pattern: apps/web/features/events/api.ts (bl-21-1) and apps/web/features/auth/api.ts (composed onSuccess).

SPEC:
- Files (ONLY these): `apps/web/features/entries/api.ts`, `apps/web/features/entries/api.test.tsx`. (Do not edit features/events/api.ts; if its `useCreateEntry` / `useEventEntries` conflict with the new contract, leave them and use the new names below. Andy removes the old ones later.)
- Keys: `entriesKey(eventId, status?)` = ['entries', eventId, status ?? 'all']; `queueKey(eventId?)` = ['entries', 'queue', eventId ?? 'all'].
- `useEntries(eventId, status?)` -> GET /events/{id}/entries with query {status}; refetchInterval 30_000.
- `useCommitteeQueue(eventId?)` -> GET /entries with query {status:'pending_committee', eventId}; refetchInterval 30_000.
- `useCreateEntry(eventId, options?)` body EntryInput -> POST /events/{id}/entries -> Entry (draft). `useForwardEntry(options?)` variables `{entryId}` -> POST /entries/{id}/forward. `useApproveEntry(options?)` variables `{entryId, reason?}` -> POST /entries/{id}/approve body {reason} (omit when undefined). `useRejectEntry(options?)` variables `{entryId, reason}` -> POST /entries/{id}/reject body {reason}. `useUpdateEntry(options?)` variables `{entryId, body: EntryInput}` -> PATCH /entries/{id}.
- Every mutation: spread caller options first, then our onSuccess `(...args)` which invalidates ['entries'] (prefix; refreshes lists and queue) and then calls `options?.onSuccess?.(...args)`.
- Types from `@/lib/api/schema` (components['schemas']['Entry'] etc.).

CONSTRAINTS: only the listed files; no new dependencies; no `any`; Thai UI text; tailwind classes with theme tokens only, no hex; no business logic (API decides eligibility/status, web only renders and sends); no direct fetch in components (hooks only).

TOOLS: `pnpm --filter @blulens/web test features/entries` · `pnpm --filter @blulens/web typecheck`

DONE:
- Proving test "useForwardEntry posts to /entries/{id}/forward and invalidates the entries lists": mock apiFetch; mutate {entryId:'E1'}; assert apiFetch called with '/entries/E1/forward' and method 'POST' and invalidateQueries called with {queryKey:['entries']}.
- Others: useCommitteeQueue calls '/entries' with query {status:'pending_committee', eventId}; useRejectEntry sends {reason}; useApproveEntry omits body.reason when not given; caller onSuccess still runs.
- Report to andy-muxsqkra (act=done): paths, exact commands with real pass counts, unverified, open items.
