# PACKET bl-21-13: Admin entries list + "new entry" pages (Phyllis)

GOAL: The Admin sees an event's entries (all statuses) with a Forward button on drafts, and opens a page to create a new doubles entry.

STATE:
- WORKTREE RULE: never switch branches in the shared checkout. Own worktree, branch `fe/bl-21-admin-entries` from `origin/develop`; `pnpm install`; before typecheck run `pnpm --filter @blulens/shared build`. Dev servers on port 3190. Never commit to main/develop.
- Review gate: Andy sends your branch to Stanley; merge only on APPROVE.
- Depends on: bl-21-8 (hooks, merged), bl-21-6 (EntryTable; cherry-pick `fe/bl-21-entry-table` 7229dc4 if not merged), bl-21-5 AdminEntryForm (Ryan; NOT merged yet: the `new` page imports it, so build it last and say so in your report; mock it in the test).

SOURCES:
- Hooks in `apps/web/features/entries/api.ts`: `useEntries(eventId, status?)` (GET /events/{id}/entries, returns Entry[]), `useForwardEntry()` (vars `{entryId}`).
- `EntryTable` props `{ entries, mode:'admin', onForward, onEdit }`; `AdminEntryForm` props `{ eventId, onDone?(entry) }` from `apps/web/features/entries/AdminEntryForm.tsx`.
- Auth: `apps/web/app/(app)/admin/layout.tsx` already guards area admin.
- Event header data: `useEvent(eventId)` from `@/features/events/api` -> EventDetail {discipline, gradeMin, gradeMax, tournamentName, tournamentStatus, entryCount}.
- Rule: entries can only be created while the tournament is `open` (409 ENTRIES_CLOSED). If `tournamentStatus !== 'open'` show a notice `data-testid="entries-closed-notice"` "ต้องเปิดรับสมัครทัวร์นาเมนต์ก่อน" and hide the "new entry" link.

SPEC:
- Files (ONLY these): `apps/web/features/entries/AdminEntries.tsx`, `apps/web/features/entries/AdminEntries.test.tsx`, `apps/web/app/(app)/admin/events/[eventId]/entries/page.tsx`, `apps/web/app/(app)/admin/events/[eventId]/entries/new/page.tsx`.
- AdminEntries props `{ eventId: string }`: header from useEvent (tournamentName + `{discipline} {gradeMin}–{gradeMax}`), link `<a data-testid="entry-new" href={`/admin/events/${eventId}/entries/new`}>+ เพิ่มคู่</a>` when tournamentStatus === 'open', the closed notice otherwise; below, `<EntryTable mode="admin" entries onForward>`; forward click calls `forward({entryId})`, error shown in `role="alert"` `data-testid="entries-action-error"`. Do NOT pass onEdit (edit is out of this slice): EntryTable must then not render the edit button; if it renders it anyway, leave it and report it as a bug for Phyllis's own EntryTable follow-up.
- Pages (server components): list page awaits `params` (Next 15 `Promise<{eventId}>`) and renders `<h1>รายการคู่ผู้สมัคร</h1><AdminEntries eventId=.../>`. New page is a small client wrapper `NewEntryClient` defined inside that page file (`'use client'` page component is allowed; take eventId via `useParams()` from next/navigation) rendering `<h1>เพิ่มคู่ผู้สมัคร</h1><AdminEntryForm eventId=... onDone={() => router.push(`/admin/events/${eventId}/entries`)} />`.

CONSTRAINTS: only the listed files; no new dependencies; no `any`; Thai UI; tailwind theme tokens; no direct fetch.

TOOLS: `pnpm --filter @blulens/web test AdminEntries` · `pnpm --filter @blulens/web typecheck`

DONE:
- Proving test "shows the new-entry link only when the tournament is open and forwards a draft": mock useEvent -> tournamentStatus 'open', useEntries -> one draft entry; entry-new present; click `entry-forward` -> forward called with {entryId}; with tournamentStatus 'draft' -> entry-new absent and entries-closed-notice present.
- Others: forward error shown; table receives mode admin.
- Report to andy-muxsqkra (act=done): paths, exact commands with real pass counts, unverified, open items.
