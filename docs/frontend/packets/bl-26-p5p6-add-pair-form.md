# PACKET bl-26-p5p6-add-pair-form: P-5 + P-6: add-pair page event header and player 1 / 2 cards (Darryl)

GOAL: The add-pair page names the tournament, category and grade range; the two players sit in two labelled cards, each with its own club field.

STATE:
- WORKTREE RULE: never switch branches in the shared checkout. Own worktree OUTSIDE it (sibling folder D:/_work/SourceDev/_code/blulens-<you>-<packet>), branch `fe/bl-26-p5p6-add-pair-form` from `origin/develop`; `pnpm install`; before typecheck run `pnpm --filter @blulens/shared build`. Dev servers on port 3190. Never commit to main/develop. PUSH your branch and send the SHA.
- Review gate: Andy sends your branch to Stanley; merge only on APPROVE.
- Source: Pam's findings in docs/design/fe-polish-packets.md and docs/design/review-slice-2.md (read the item named in the title; both are in Thai).

SOURCES:
- `apps/web/app/(app)/admin/events/[eventId]/entries/new/page.tsx`, `apps/web/features/entries/AdminEntryForm.tsx` + test, event hook in features/events. Spec: docs/design/fe-polish-packets.md P-5 and P-6.

SPEC:
- Files (ONLY): those + tests. After the r3r4 packet.
- Header 'เพิ่มคู่: {event name} · {category} {gradeMin}–{gradeMax}', back link '← กลับไปรายการผู้สมัคร', skeleton while loading, thaiError banner on failure.
- Two cards 'ผู้เล่นที่ 1' / 'ผู้เล่นที่ 2' each with PlayerPicker + 'สโมสรของ {ชื่อ}' (disabled with hint 'เลือกผู้เล่นก่อน' until chosen); tab order P1 picker, P1 club, P2 picker, P2 club.
- All existing testids unchanged (entry-forward etc.).

CONSTRAINTS: only the listed files; no new dependencies; no `any`; Thai UI; theme tokens ONLY (grep -E 'bg-(white|blue|gray|red|green|orange|yellow)|text-(gray|blue|red|green|orange|yellow)|border-(gray|red)' must be empty on every line you touch); keep EVERY existing data-testid (Playwright gates use them); tap targets >= 44px; status never by colour alone; check document.documentElement.scrollWidth == 390 at 390px if layout changes.

TOOLS: `pnpm --filter @blulens/web test AdminEntryForm` · `pnpm --filter @blulens/web typecheck`

DONE:
- Proving test "shows the event name in the header" from a mocked event; plus the club field is disabled until a player is chosen.
- The slice 1 smoke stays green.
- Report to andy-muxsqkra (act=done): paths, exact commands with real pass counts, unverified, open items, pushed branch + SHA.
