# PACKET bl-26-p7-tokens-44px: P-7 + R8: raw colours to tokens and 44px targets in ClipPlayer and GradePicker (Phyllis)

GOAL: No raw Tailwind colour left in ClipPlayer.tsx, GradePicker.tsx (and AdminEntryForm.tsx, check); skip-back 5s / 0.5x / 1x / 1.5x buttons and the S-/S/S+ sub-step buttons are at least 44px tall.

STATE:
- WORKTREE RULE: never switch branches in the shared checkout. Own worktree OUTSIDE it (sibling folder D:/_work/SourceDev/_code/blulens-<you>-<packet>), branch `fe/bl-26-p7-tokens-44px` from `origin/develop`; `pnpm install`; before typecheck run `pnpm --filter @blulens/shared build`. Dev servers on port 3190. Never commit to main/develop. PUSH your branch and send the SHA.
- Review gate: Andy sends your branch to Stanley; merge only on APPROVE.
- Source: Pam's findings in docs/design/fe-polish-packets.md and docs/design/review-slice-2.md (read the item named in the title; both are in Thai).

SOURCES:
- `apps/web/components/ui/ClipPlayer.tsx` (`bg-blue-500`, `bg-red-500`, `text-gray-600`), `apps/web/components/ui/GradePicker.tsx` (`bg-blue-100/green-100/red-100`, `text-gray-600/700`). Tokens: primary, destructive, muted-foreground, success, warning (see apps/web/app/globals.css).

SPEC:
- Files (ONLY): the two components, their existing tests, and AdminEntryForm.tsx only if grep finds raw colours.
- Primary buttons use `primary`, danger `destructive`, secondary text `muted-foreground`. GradePicker tier colours: use existing tokens (success/primary/warning...) and keep the letter/label text so state is not colour-only.
- Buttons: add `min-h-11`.

CONSTRAINTS: only the listed files; no new dependencies; no `any`; Thai UI; theme tokens ONLY (grep -E 'bg-(white|blue|gray|red|green|orange|yellow)|text-(gray|blue|red|green|orange|yellow)|border-(gray|red)' must be empty on every line you touch); keep EVERY existing data-testid (Playwright gates use them); tap targets >= 44px; status never by colour alone; check document.documentElement.scrollWidth == 390 at 390px if layout changes.

TOOLS: `pnpm --filter @blulens/web test ClipPlayer` · `pnpm --filter @blulens/web typecheck`

DONE:
- Proving test: render GradePicker and ClipPlayer and assert the sub-step buttons and speed buttons have class `min-h-11`; the grep above is empty on both files.
- Existing tests stay green.
- Report to andy-muxsqkra (act=done): paths, exact commands with real pass counts, unverified, open items, pushed branch + SHA.
