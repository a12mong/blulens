# PACKET bl-21-12: CommitteeQueue component + page (Darryl)

GOAL: The Committee sees doubles entries forwarded for approval, and approves or rejects each (with a reason where required).

STATE:
- WORKTREE RULE: never switch branches in the shared checkout. Own worktree, branch `fe/bl-21-committee-queue` from `origin/develop`; `pnpm install`; before typecheck run `pnpm --filter @blulens/shared build`. Dev servers on port 3190. Never commit to main/develop.
- Review gate: Andy sends your branch to Stanley; merge only on APPROVE.
- Depends on: bl-21-8 (entry hooks, merged), bl-21-9 (ReasonDialog, merged), bl-21-6 (EntryTable; if not merged yet, cherry-pick `fe/bl-21-entry-table` commit 7229dc4 and say so).

SOURCES:
- Hooks in `apps/web/features/entries/api.ts`: `useCommitteeQueue(eventId?)` (GET /entries?status=pending_committee&eventId=, returns `{ items, nextCursor }`), `useApproveEntry()` (vars `{entryId, reason?}`), `useRejectEntry()` (vars `{entryId, reason}`).
- `EntryTable` (props `{ entries, mode:'committee', onApprove, onReject }`) in `apps/web/features/entries/EntryTable.tsx`; `ReasonDialog` (props `{ open, title, confirmLabel, minLength, onSubmit, onCancel, error?, pending? }`) in `apps/web/components/ui/ReasonDialog.tsx`.
- API rules (Kevin/Jim): reject reason >= 5 chars. Approve needs NO reason normally; when `entry.warnings` includes `GRADE_OUT_OF_BAND` the approve needs a reason >= 20 chars (else 409 ENTRY_OUT_OF_BAND_REASON_REQUIRED). Other approve 409s to show as the server's Thai message: ENTRY_PLAYER_UNGRADED, ENTRY_FRESH_ASSESSMENT_MISSING, ENTRY_NOT_PENDING.
- Page auth: wrap by area guard already provided by `apps/web/app/(app)/committee/layout.tsx` (RoleGuard area committee), so just place the page under `app/(app)/committee/`.

SPEC:
- Files (ONLY these): `apps/web/features/entries/CommitteeQueue.tsx`, `apps/web/features/entries/CommitteeQueue.test.tsx`, `apps/web/app/(app)/committee/events/[eventId]/entries/page.tsx`.
- page.tsx (server component): reads `params` (Next 15: `params: Promise<{ eventId: string }>`, await it), renders `<h1>คิวอนุมัติผู้สมัคร</h1>` and `<CommitteeQueue eventId={eventId} />`.
- CommitteeQueue props `{ eventId?: string }`. Uses `useCommitteeQueue(eventId)`. States: pending `role="status"` "กำลังโหลด…"; error `role="alert"` `data-testid="queue-error"`; empty -> EntryTable's own empty state; list -> `<EntryTable mode="committee" entries={items} onApprove onReject />`.
- Approve click: if entry.warnings includes 'GRADE_OUT_OF_BAND' -> open ReasonDialog (title "อนุมัติเกรดนอกช่วง", confirmLabel "อนุมัติ", minLength 20) and submit calls approve({entryId, reason}); else call approve({entryId}) immediately. Reject click: ReasonDialog (title "ปฏิเสธผู้สมัคร", confirmLabel "ปฏิเสธ", minLength 5) -> reject({entryId, reason}).
- On mutation error: show the ApiRequestError message in the dialog's `error` prop (when a dialog is open) or in `<p role="alert" data-testid="queue-action-error">` (direct approve). On success close the dialog (the hook invalidates the list).

CONSTRAINTS: only the listed files; no new dependencies; no `any`; Thai UI; tailwind theme tokens; no direct fetch.

TOOLS: `pnpm --filter @blulens/web test CommitteeQueue` · `pnpm --filter @blulens/web typecheck`

DONE:
- Proving test "approving an out-of-band entry asks for a 20-char reason before calling approve": mock hooks; queue has one entry with warnings ['GRADE_OUT_OF_BAND']; click `entry-approve` -> dialog open (`reason-input`), approve not called; type 20+ chars, click `reason-submit` -> approve called with {entryId, reason:<text>}.
- Others: approve without that warning calls approve({entryId}) immediately; reject needs 5 chars then calls reject with the reason; approve error message shown in queue-action-error; empty queue shows the table empty state.
- Report to andy-muxsqkra (act=done): paths, exact commands with real pass counts, unverified, open items.
