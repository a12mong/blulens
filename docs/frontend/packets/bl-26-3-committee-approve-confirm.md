# PACKET bl-26-3-committee-approve-confirm: CommitteeQueue: approve shows who is being approved and asks to confirm (Phyllis)

GOAL: Before an approve is sent, the Committee sees the players, their grades and the warnings of the entry in a confirm dialog, and can cancel.

STATE:
- WORKTREE RULE: never switch branches in the shared checkout. Own worktree, branch `fe/bl-26-committee-confirm` from `origin/develop`; `pnpm install`; before typecheck run `pnpm --filter @blulens/shared build`. Dev servers on port 3190. Never commit to main/develop.
- Review gate: Andy sends your branch to Stanley; merge only on APPROVE.
- Source of the finding: docs/design/review-slice-1.md item #3 (Pam).

SOURCES:
- `apps/web/features/entries/CommitteeQueue.tsx` (handleApprove calls approve immediately unless GRADE_OUT_OF_BAND opens ReasonDialog), `apps/web/components/ui/ReasonDialog.tsx` (props open,title,confirmLabel,minLength,onSubmit,onCancel,error,pending), type `components['schemas']['Entry']` from `@/lib/api/schema` (check its fields for players and grade info).

SPEC:
- Files (ONLY these): `apps/web/features/entries/CommitteeQueue.tsx`, `apps/web/features/entries/CommitteeQueue.test.tsx`, new `apps/web/features/entries/ApproveConfirmDialog.tsx` and `ApproveConfirmDialog.test.tsx`.
- ApproveConfirmDialog props `{ entry: Entry; open: boolean; pending?: boolean; error?: string; onConfirm(): void; onCancel(): void }`: modal (role=dialog, aria-modal, focus on confirm) listing each player (displayName + grade label when the Entry carries one, else 'ยังไม่มีเกรด'), the entry's warnings in Thai (MULTI_TEAM 'ผู้เล่นสังกัดหลายสโมสร', NO_APPROVED_GRADE 'ผู้เล่นยังไม่มีเกรดที่อนุมัติ', GRADE_OUT_OF_BAND 'เกรดอยู่นอกช่วงของประเภทนี้', FRESH_ASSESSMENT_REQUIRED 'ต้องประเมินใหม่ก่อนลงแข่ง'), buttons `approve-confirm` 'ยืนยันอนุมัติ' and `approve-cancel` 'ยกเลิก'.
- In CommitteeQueue: approve click on an entry WITHOUT GRADE_OUT_OF_BAND opens ApproveConfirmDialog; confirm calls approve({entryId}). With GRADE_OUT_OF_BAND keep the ReasonDialog unchanged. Reject: set its ReasonDialog minLength to 10 (Jim decided, openapi 5518cd5; out-of-band approve stays 20) and update the tests that assert 5.

CONSTRAINTS: only the listed files; no new dependencies; no `any`; Thai UI; theme tokens only (no bg-blue-500 etc.); no direct fetch in components.

TOOLS: `pnpm --filter @blulens/web test CommitteeQueue` · `pnpm --filter @blulens/web typecheck`

DONE:
- Proving test "approve opens a confirm dialog with the players and only calls approve after confirm": click entry-approve -> dialog shows both player names, approve not called; click approve-cancel -> still not called; click approve again then approve-confirm -> approve called with {entryId}.
- Others: an approve error is shown in the dialog.
- Report to andy-muxsqkra (act=done): paths, exact commands with real pass counts, unverified, open items.
