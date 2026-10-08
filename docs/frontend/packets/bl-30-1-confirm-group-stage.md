# PACKET bl-30-1: Committee "confirm the group stage" action on the results queue page (Darryl)

GOAL: When every group match is confirmed, the Committee can lock the group stage with one action that shows who qualifies; afterwards standings are final and results can no longer be changed.

STATE:
- WORKTREE RULE: never switch branches in the shared checkout. Own worktree OUTSIDE it (sibling folder D:/_work/SourceDev/_code/blulens-darryl-groupconfirm), branch `fe/bl-30-confirm-groups` from `origin/develop`; `pnpm install`; before typecheck run `pnpm --filter @blulens/shared build`. Dev servers on port 3190. Never commit to main/develop. PUSH your branch and send the SHA.
- Review gate: Andy sends your branch to Stanley; merge only on APPROVE.
- Backend live on develop (7138225): `POST /events/{eventId}/groups/confirm` (Committee/Admin) -> 200 `GroupStanding[]` (confirmed true; qualification qualified|best_third|out). Errors: 409 GROUP_MATCHES_INCOMPLETE (details.count = matches still open), 409 NO_PUBLISHED_GROUP_DRAW, 409 DRAW_ALREADY_LOCKED. After confirm: draw locked, standings serve the snapshot, `PUT /matches/{id}/result` and approve/reject return 409 STAGE_CONFIRMED.

SOURCES:
- Design: docs/design/screens/S18-group-draw-standings.md (row "ยืนยันผลรอบกลุ่ม": enabled only when all matches confirmed/void; explain the qualifiers before confirming).
- `apps/web/features/results/ResultsQueue.tsx` and `api.ts` (hooks pattern, invalidations ['events',eventId,'matches'|'bracket'|'standings']), `features/bracket/api.ts` (`useStandings`, `useEventMatches`, `GroupStanding`), `GroupStandingsTable.tsx` (to show qualifiers), `features/assessments/AssessmentDecisions.tsx` (confirm dialog pattern), `thaiError` in `@/lib/errors`.

SPEC:
- Files (ONLY): `apps/web/features/results/api.ts` (add `useConfirmGroups(eventId)` mutation; onSuccess invalidates matches, standings, bracket, groups), `apps/web/features/results/GroupStageConfirm.tsx`, `GroupStageConfirm.test.tsx`, `apps/web/features/results/ResultsQueue.tsx` (ONLY render `<GroupStageConfirm eventId={eventId} />` above the list), `apps/web/lib/errors.ts` (+ test) for GROUP_MATCHES_INCOMPLETE 'ยังมีแมตช์รอบกลุ่มที่ยังไม่ยืนยัน', NO_PUBLISHED_GROUP_DRAW 'ยังไม่ได้เผยแพร่การจับกลุ่ม', STAGE_CONFIRMED already mapped (verify).
- GroupStageConfirm props `{ eventId }`: uses `useEventMatches(eventId)` (group-stage matches only: stage 'group'). No group matches -> render nothing. Open = matches whose status is not confirmed/void/walkover. Panel `data-testid="groupconfirm"`: text 'รอบกลุ่ม: ยืนยันแล้ว {done} จาก {total} แมตช์'. Button `data-testid="groupconfirm-button"` 'ยืนยันผลรอบกลุ่ม' (min-h 44px) disabled while open > 0 with the visible reason 'ต้องยืนยันครบทุกแมตช์ก่อน (เหลือ {n})'; when all done opens a dialog (role=dialog) 'ยืนยันผลรอบกลุ่มแล้วจะแก้ผลไม่ได้' listing qualifiers from `useStandings` (rank/qualification 'qualified' => names via entry). Confirm -> mutate; success shows `data-testid="groupconfirm-done"` 'ล็อกผลรอบกลุ่มแล้ว' (icon + text) and hides the button; errors via thaiError inside the dialog. If standings rows already have `confirmed: true` show the done state immediately.

CONSTRAINTS: only the listed files; no new dependencies; no `any`; Thai UI; day theme tokens ONLY; grep -E 'bg-(white|blue|gray|red|green|orange|yellow)|text-(gray|blue|red|green|orange|yellow)|border-(gray|red)' must be empty on lines you touch; NO emoji (SVG icon pattern of components/ui/Icon.tsx or WarningBanner); keep every existing data-testid; tap targets >= 44px; document.documentElement.scrollWidth == 390 at 390px.

TOOLS: `pnpm --filter @blulens/web test GroupStageConfirm ResultsQueue` · `pnpm --filter @blulens/web typecheck`

DONE:
- Proving test "keeps the button disabled until every group match is confirmed, then confirms with the qualifiers shown": matches 2 confirmed + 1 reported -> disabled with 'เหลือ 1'; all confirmed -> enabled; click -> dialog lists the qualified pair names; confirm -> mutate called; success shows groupconfirm-done.
- Others: no group matches renders nothing; standings already confirmed shows done; GROUP_MATCHES_INCOMPLETE error text in the dialog.
- Report to andy-muxsqkra (act=done): paths, exact commands with real pass counts, unverified, open items, pushed branch + SHA.
