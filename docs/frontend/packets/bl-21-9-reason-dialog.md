# PACKET bl-21-9-reason-dialog: ReasonDialog (reject / approve-with-reason) (Phyllis)

GOAL: A modal dialog that asks for a written reason with a minimum length, used by Committee reject and approve-out-of-band.

STATE:
- WORKTREE RULE: never switch branches in the shared checkout. Own worktree, branch `fe/bl-21-reason-dialog` from `origin/develop`, `pnpm install` there; before typecheck run `pnpm --filter @blulens/shared build`. Run `pnpm --filter @blulens/web gen:api` if types look stale. Dev servers on port 3190 (not 3100). Never commit to main/develop.
- Review gate: after done, Andy sends your branch to Stanley; merge only on APPROVE.
- Depends on: none

SOURCES:
- Contract: reject needs a reason; approve of an out-of-band grade needs a reason of at least 20 characters (409 ENTRY_OUT_OF_BAND_REASON_REQUIRED). docs/design/components.md for dialog tone (Thai).

SPEC:
- Files (ONLY these): `apps/web/components/ui/ReasonDialog.tsx`, `apps/web/components/ui/ReasonDialog.test.tsx`.
- Props: `{ open: boolean; title: string; confirmLabel: string; minLength?: number (default 1); onSubmit: (reason: string) => void; onCancel: () => void; error?: string; pending?: boolean }`.
- When `open` is false render null. Else `<div role="dialog" aria-modal="true" aria-labelledby=...>` with `<h2>` title, `<textarea data-testid="reason-input" aria-label="เหตุผล">`, a counter text "{n}/{minLength}" `data-testid="reason-count"`, `<button data-testid="reason-submit">` (confirmLabel; disabled until trimmed length >= minLength or while pending), `<button data-testid="reason-cancel">ยกเลิก</button>`. Escape key calls onCancel. Focus the textarea on open. `error` shown in `role="alert"` `reason-error`.
- Submit passes the trimmed reason.

CONSTRAINTS: only the listed files; no new dependencies; no `any`; Thai UI text; tailwind classes with theme tokens only, no hex; no business logic (API decides eligibility/status, web only renders and sends); no direct fetch in components (hooks only).

TOOLS: `pnpm --filter @blulens/web test ReasonDialog` · `pnpm --filter @blulens/web typecheck`

DONE:
- Proving test "submit stays disabled until the reason reaches minLength, then passes the trimmed text": minLength 20; type 19 chars -> disabled; type 1 more (with surrounding spaces) -> enabled; click -> onSubmit called with the trimmed string.
- Others: closed renders nothing; Escape and cancel call onCancel; error text shown; pending disables submit.
- Report to andy-muxsqkra (act=done): paths, exact commands with real pass counts, unverified, open items.
