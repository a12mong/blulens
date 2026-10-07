# PACKET bl-21-6-entry-list: EntryList component (Phyllis)

GOAL: A table of an event's entries for the Committee (and a 'mine only' mode for Members).

STATE:
- WORKTREE RULE: never switch branches in the shared checkout. Own worktree, branch `fe/bl-21-entry-list` from `origin/develop`, `pnpm install` there; before typecheck run `pnpm --filter @blulens/shared build`. Dev servers on port 3190 (not 3100). Never commit to main/develop.
- Review gate: after done, Andy sends your branch to Stanley; merge only on APPROVE.
- Depends on: bl-21-1 merged (mock the hook until then)

SOURCES:
- docs/api/openapi.yaml schema Entry {id,eventId,status active|withdrawn, players[{userId,displayName,teamIds,teamCount,gradeConsent,grade|null}], seedScore|null, gradeVisibility hidden|public|disclosed, warnings[]}. Hook `useEventEntries(eventId)` (bl-21-1). `useMe` from `@/features/auth/api`.
- Rule: grades are shown only when `player.grade` is not null (the API hides them); never compute anything.

SPEC:
- Files (ONLY these): `apps/web/features/events/EntryList.tsx`, `apps/web/features/events/EntryList.test.tsx`.
- Props: `{ eventId: string; mineOnly?: boolean }`. mineOnly filters entries whose players include me.id.
- Markup: `<table data-testid="entry-table">`; one `<tr data-testid="entry-row" data-entry-id={id}>` per entry; cells: players' displayName joined by " / " (`data-testid="entry-players"`), status badge text ใช้งาน/ถอนตัว, grade cell: if grade non-null render `<GradeBand .../>` from `@/components/ui/GradeBand` using lower/upper/score/label, else the text "ซ่อนอยู่" (`data-testid="entry-grade-hidden"`), and a warning chip `data-testid="entry-multiteam"` text "หลายทีม" when warnings include 'MULTI_TEAM' or any player teamCount > 1.
- States: loading `role="status"` "กำลังโหลด…"; empty `data-testid="entry-empty"` "ยังไม่มีผู้สมัคร"; error `role="alert"` with message.

CONSTRAINTS: only the listed files; no new dependencies; no `any`; Thai UI text; tokens/tailwind classes only, no hex; no business logic (API decides, web only renders); no direct fetch in components (use hooks / apiFetch from apps/web/lib/api/client.ts).

TOOLS: `pnpm --filter @blulens/web test EntryList` · `pnpm --filter @blulens/web typecheck`

DONE:
- Proving test "renders one row per entry with players, hidden grade and multi-team chip": mock useEventEntries -> 2 entries (one with warnings ['MULTI_TEAM'] and grade null); assert 2 entry-row, names joined with ' / ', 'ซ่อนอยู่' present, exactly one entry-multiteam.
- Others: mineOnly shows only my rows; empty state; error state.
- Report to andy-muxsqkra (act=done): paths, exact commands with real pass counts, unverified, open items.
