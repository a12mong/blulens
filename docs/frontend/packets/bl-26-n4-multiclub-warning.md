# PACKET bl-26-n4: Specific warning text from Entry.warningDetails (Darryl)

GOAL: Warnings on an entry name the player and clubs involved, e.g. 'สมชาย สังกัด 2 สโมสร (A, B)', in the entry table, the forward result panel and the approve confirm dialog.

STATE:
- WORKTREE RULE: never switch branches in the shared checkout. Own worktree, branch `fe/bl-26-warning-details` from `origin/develop`; `pnpm install`; before typecheck run `pnpm --filter @blulens/shared build`. Dev servers on port 3190. Never commit to main/develop. PUSH your branch to origin and send the SHA.
- Review gate: Andy sends your branch to Stanley; merge only on APPROVE.
- Depends on: openapi 99b26c7 (types regenerated on develop). Do after bl-26-n5.

SOURCES:
- `Entry.warningDetails[]` = `{ code, userId, displayName, teamNames: string[], gradeLabel }` next to the bare `warnings` enum (apps/web/lib/api/schema.d.ts). MULTI_TEAM: teamNames = all current clubs. GRADE_OUT_OF_BAND: gradeLabel = that player's grade.
- Current Thai warning strings live in `apps/web/features/entries/EntryTable.tsx` (WARNING_LABELS), `AdminEntryForm.tsx` (warningText) and `ApproveConfirmDialog.tsx`.

SPEC:
- Files (ONLY these): new `apps/web/features/entries/warningText.ts` + `warningText.test.ts`; then use it in `EntryTable.tsx`, `AdminEntryForm.tsx`, `ApproveConfirmDialog.tsx` (replace their local maps; keep testids).
- Export `warningLines(entry: { warnings?: string[]; warningDetails?: WarningDetail[] }): string[]`. For each warning code: if there are details for it, one line per detail: MULTI_TEAM '{displayName} สังกัด {n} สโมสร ({teamNames.join(", ")})'; GRADE_OUT_OF_BAND '{displayName} เกรด {gradeLabel} อยู่นอกช่วงของประเภทนี้'; NO_APPROVED_GRADE '{displayName} ยังไม่มีเกรดที่อนุมัติ'; FRESH_ASSESSMENT_REQUIRED '{displayName} ต้องประเมินใหม่ก่อนลงแข่ง'. If no details for a code: the generic text as today (MULTI_TEAM 'ผู้เล่นสังกัดหลายสโมสร', NO_APPROVED_GRADE 'ผู้เล่นยังไม่มีเกรดที่อนุมัติ', GRADE_OUT_OF_BAND 'เกรดอยู่นอกช่วงของประเภทนี้', FRESH_ASSESSMENT_REQUIRED 'ต้องประเมินใหม่ก่อนลงแข่ง').

CONSTRAINTS: only the listed files; no new dependencies; no `any`; Thai UI; theme tokens only; keep every existing data-testid (Playwright gate uses them).

TOOLS: `pnpm --filter @blulens/web test warningText` · `pnpm --filter @blulens/web typecheck`

DONE:
- Proving test "names the player and clubs for a multi-club warning and falls back to the generic text": warnings ['MULTI_TEAM'] + details [{code:'MULTI_TEAM', displayName:'สมชาย', teamNames:['A','B']}] -> ['สมชาย สังกัด 2 สโมสร (A, B)']; same without details -> ['ผู้เล่นสังกัดหลายสโมสร'].
- Others: out-of-band line includes the grade label; two players with the same warning give two lines; existing component tests stay green.
- Report to andy-muxsqkra (act=done): paths, exact commands with real pass counts, unverified, open items, pushed branch + SHA.
