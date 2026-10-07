# PACKET bl-26-2-forward-keeps-warnings: AdminEntryForm: keep the result visible after forward (Darryl)

GOAL: After the Admin presses forward, the form must NOT reset until the admin has seen the entry status and warnings and presses 'เพิ่มคู่ใหม่' or 'กลับไปรายการ'.

STATE:
- WORKTREE RULE: never switch branches in the shared checkout. Own worktree, branch `fe/bl-26-forward-warnings` from `origin/develop`; `pnpm install`; before typecheck run `pnpm --filter @blulens/shared build`. Dev servers on port 3190. Never commit to main/develop.
- Review gate: Andy sends your branch to Stanley; merge only on APPROVE.
- Source of the finding: docs/design/review-slice-1.md item #2 (Pam).

SOURCES:
- `apps/web/features/entries/AdminEntryForm.tsx` (read it: the forward mutation onSuccess near line 35 calls `resetForm()`; warnings state near line 20; testids entry-warnings, entry-forward, entry-save-draft). Warning enum: MULTI_TEAM, NO_APPROVED_GRADE, GRADE_OUT_OF_BAND, FRESH_ASSESSMENT_REQUIRED.

SPEC:
- Files (ONLY these): `apps/web/features/entries/AdminEntryForm.tsx`, `apps/web/features/entries/AdminEntryForm.test.tsx`.
- On forward success: do not call resetForm; keep a `forwarded` state with the returned entry; replace the form body by a result panel `data-testid="entry-forwarded"` with text 'ส่งให้คณะกรรมการแล้ว', the entry name, and the entry's `warnings` rendered in the existing `entry-warnings` list with Thai text: MULTI_TEAM 'ผู้เล่นสังกัดหลายสโมสร', NO_APPROVED_GRADE 'ผู้เล่นยังไม่มีเกรดที่อนุมัติ', GRADE_OUT_OF_BAND 'เกรดอยู่นอกช่วงของประเภทนี้', FRESH_ASSESSMENT_REQUIRED 'ต้องประเมินใหม่ก่อนลงแข่ง'. Two buttons: `entry-add-another` 'เพิ่มคู่ใหม่' (resets the form) and `entry-done` 'กลับไปรายการ' (calls the existing `onDone?.(entry)`). Do not call onDone automatically on success any more.
- Save-draft path unchanged.

CONSTRAINTS: only the listed files; no new dependencies; no `any`; Thai UI; theme tokens only (no bg-blue-500 etc.); no direct fetch in components.

TOOLS: `pnpm --filter @blulens/web test AdminEntryForm` · `pnpm --filter @blulens/web typecheck`

DONE:
- Proving test "after forward the panel and warnings stay until the admin chooses": mock hooks so forward resolves an entry with warnings ['GRADE_OUT_OF_BAND']; click entry-forward -> entry-forwarded visible with the Thai out-of-band text, onDone NOT called yet; click entry-add-another -> form is back and empty; separate case: click entry-done -> onDone called with the entry.
- Update existing tests that assumed auto-reset or auto-onDone.
- Report to andy-muxsqkra (act=done): paths, exact commands with real pass counts, unverified, open items.
