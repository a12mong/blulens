# PACKET bl-29-3-emoji-and-tokens: Replace every emoji with an SVG icon and finish the raw-colour clean-up (Phyllis)

GOAL: No emoji remain in the UI and no raw Tailwind colour classes remain in ReasonDialog, AdminEntries, CreateTournamentForm, CreateTournamentWizard.

STATE:
- WORKTREE RULE: never switch branches in the shared checkout. Own worktree OUTSIDE it (sibling folder D:/_work/SourceDev/_code/blulens-<you>-3-emoji-and-tokens), branch `fe/bl-29-3-emoji-and-tokens` from `origin/develop`; `pnpm install`; before typecheck run `pnpm --filter @blulens/shared build`. Dev servers on port 3190. Never commit to main/develop. PUSH your branch and send the SHA.
- Review gate: Andy sends your branch to Stanley; merge only on APPROVE.
- Source: Pam's live pass docs/design/review-slice-3.md, item(s) S7 + #7 leftovers (Thai; read the table row for the evidence).

SOURCES:
- Emoji found in: `features/bracket/StandingsPage.tsx`, `features/draw/GroupDraw.tsx`, `features/review/ReviewCard.tsx`, `features/review/ReviewScoring.tsx`, `features/demo/AssessmentResultMock.tsx`. Raw colours (`text-red-600`, `bg-blue-600`...) in: `components/ui/ReasonDialog.tsx`, `features/entries/AdminEntries.tsx`, `features/events/CreateTournamentForm.tsx`, `features/events/CreateTournamentWizard.tsx`. Icon pattern: `components/ui/WarningBanner.tsx` (inline SVG, aria-hidden). Tokens: primary, destructive, muted-foreground, success, warning (apps/web/app/globals.css).

SPEC:
- Files (ONLY): the 9 files above and their existing tests. First run `grep -rnP '[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}\x{23F0}-\x{23FF}\x{FE0F}]' apps/web/features apps/web/components apps/web/app` to list every emoji (a plain check mark U+2713 as text is allowed).
- Create ONE small shared component `apps/web/components/ui/Icon.tsx` ONLY IF none exists (`WarningIcon`, `TimerIcon`, `LockIcon` as inline SVG with `aria-hidden="true"`, `className` prop); otherwise reuse WarningBanner's icon. Replace each emoji with the icon beside its existing text (text unchanged). Do not edit the staging/night styles of StandingsPage beyond the icon swap (another packet edits its text).
- Raw colours: `text-red-600` -> `text-destructive`, `bg-blue-600` -> `bg-primary text-primary-foreground`, and any other raw class the grep finds, to the matching token. Do not change layout.

CONSTRAINTS: only the listed files; no new dependencies; no `any`; Thai UI; theme tokens ONLY: day tokens only (bg-card, bg-primary, text-muted-foreground, bg-warning, ...); grep -E 'bg-(white|blue|gray|red|green|orange|yellow)|text-(gray|blue|red|green|orange|yellow)|border-(gray|red)' must be empty on every line you touch; NO emoji anywhere in UI text (use the SVG icon pattern of `components/ui/WarningBanner.tsx`, aria-hidden, plus text); keep every existing data-testid (Playwright gates use them); tap targets >= 44px; status never by colour alone; document.documentElement.scrollWidth == 390 at 390px.

TOOLS: `pnpm --filter @blulens/web test ReasonDialog` · `pnpm --filter @blulens/web typecheck`

DONE:
- Proving test: `Icon.test.tsx` (if created) renders an svg with aria-hidden; plus in ReviewCard.test.tsx the due badge has an `svg` and the text has no emoji (regex above); ReasonDialog test unchanged and green.
- Both greps (emoji, raw colour) are empty over apps/web/features, components, app (tests excluded).
- Report to andy-muxsqkra (act=done): paths, exact commands with real pass counts, unverified, open items, pushed branch + SHA.
