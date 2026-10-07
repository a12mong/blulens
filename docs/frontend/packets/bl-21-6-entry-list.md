# PACKET bl-21-6-entry-list: EntryTable (status badges + role actions) (Phyllis)

GOAL: A presentational table of entries with status badges, warning chips and per-row action buttons, used by both the Admin entries list and the Committee queue.

STATE:
- WORKTREE RULE: never switch branches in the shared checkout. Own worktree, branch `fe/bl-21-entry-table` from `origin/develop`, `pnpm install` there; before typecheck run `pnpm --filter @blulens/shared build`. Run `pnpm --filter @blulens/web gen:api` if types look stale. Dev servers on port 3190 (not 3100). Never commit to main/develop.
- Review gate: after done, Andy sends your branch to Stanley; merge only on APPROVE.
- Depends on: bl-21-8 hooks not required: component is presentational

SOURCES:
- Contract (docs/api/openapi.yaml, develop 07543e2): EntryInput `{ name?, players: [{ userId, teamId? }] }` (doubles = exactly 2 players; slice 1 = doubles); Entry `{ id, eventId, status, name, forwardedAt, decidedAt, decisionReason, players[{userId, displayName, teamIds, teamCount, grade|null}], warnings[] }`; EntryStatus = draft | pending_committee | approved | rejected | withdrawn. Warnings (strings): MULTI_TEAM, NO_APPROVED_GRADE, GRADE_OUT_OF_BAND, FRESH_ASSESSMENT_REQUIRED. Lifecycle: POST `/events/{id}/entries` -> draft; POST `/entries/{id}/forward` (Admin|Committee) draft -> pending_committee; POST `/entries/{id}/approve` (Committee; body `{reason?}`; 409 ENTRY_PLAYER_UNGRADED, 409 ENTRY_OUT_OF_BAND_REASON_REQUIRED needs reason >= 20 chars); POST `/entries/{id}/reject` (Committee; body `{reason}`); PATCH `/entries/{id}` (draft/rejected only). Queue: GET `/entries?status=pending_committee&eventId=`; GET `/events/{id}/entries?status=`. Hard errors on create: ENTRIES_CLOSED, ENTRY_PLAYER_COUNT, ENTRY_DUPLICATE_PLAYER. (Check the exact request bodies of approve/reject/PATCH in openapi before coding.)
- Use `GradeBand` from `@/components/ui/GradeBand` for a player's grade when `grade` is non-null (props lower/upper/score/label; pass provisional/disputed only if the API gives them; otherwise omit).

SPEC:
- Files (ONLY these): `apps/web/features/entries/EntryTable.tsx`, `apps/web/features/entries/EntryTable.test.tsx`.
- Props: `{ entries: Entry[]; mode: 'admin' | 'committee'; onForward?: (e: Entry) => void; onApprove?: (e: Entry) => void; onReject?: (e: Entry) => void; onEdit?: (e: Entry) => void }`.
- Markup: `<table data-testid="entry-table">`, one `<tr data-testid="entry-row" data-entry-id={id} data-status={status}>` per entry. Cells: pair (`entry-pair`): `name` or players' displayName joined " / ", then each player's display name with its team count; status badge `<span data-testid="entry-status">` Thai text: draft ร่าง, pending_committee รอคณะกรรมการ, approved อนุมัติแล้ว, rejected ถูกปฏิเสธ, withdrawn ถอนตัว (text, not color only); grades cell: per player GradeBand if grade else `<span data-testid="entry-grade-hidden">ซ่อนอยู่</span>`; `<ul data-testid="entry-warnings">` chips (same Thai texts as the AdminEntryForm packet: MULTI_TEAM etc.); if `decisionReason` and status rejected show it in `entry-reason`.
- Actions column (buttons with testids): mode admin: status draft or rejected -> `entry-edit` "แก้ไข" and (draft only) `entry-forward` "ส่งให้คณะกรรมการ"; mode committee: status pending_committee -> `entry-approve` "อนุมัติ" and `entry-reject` "ปฏิเสธ". No buttons for other combinations. Buttons call the prop with the entry; do not call APIs.
- Empty list: `<p data-testid="entry-empty">ยังไม่มีรายการ</p>`.

CONSTRAINTS: only the listed files; no new dependencies; no `any`; Thai UI text; tailwind classes with theme tokens only, no hex; no business logic (API decides eligibility/status, web only renders and sends); no direct fetch in components (hooks only).

TOOLS: `pnpm --filter @blulens/web test EntryTable` · `pnpm --filter @blulens/web typecheck`

DONE:
- Proving test "committee mode shows approve and reject only for pending_committee rows": 3 entries (draft, pending_committee, approved) in committee mode -> exactly one entry-approve and one entry-reject; clicking approve calls onApprove with that entry.
- Others: admin mode shows edit+forward on draft, edit only on rejected (with decisionReason visible), none on approved; hidden grade text; warning chip texts; empty state.
- Report to andy-muxsqkra (act=done): paths, exact commands with real pass counts, unverified, open items.
