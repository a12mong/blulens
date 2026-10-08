# PACKET bl-26-p10-account-menu: P-10 + R10: account block, menu naming, mobile drawer and menu skeleton (Phyllis)

GOAL: The shell shows an account block (name, role as text, logout) apart from the menu; menu labels differ from role names; below 768px a top bar + drawer; while /me loads the menu shows a skeleton, never a partial menu.

STATE:
- WORKTREE RULE: never switch branches in the shared checkout. Own worktree OUTSIDE it (sibling folder D:/_work/SourceDev/_code/blulens-<you>-<packet>), branch `fe/bl-26-p10-account-menu` from `origin/develop`; `pnpm install`; before typecheck run `pnpm --filter @blulens/shared build`. Dev servers on port 3190. Never commit to main/develop. PUSH your branch and send the SHA.
- Review gate: Andy sends your branch to Stanley; merge only on APPROVE.
- Source: Pam's findings in docs/design/fe-polish-packets.md and docs/design/review-slice-2.md (read the item named in the title; both are in Thai).

SOURCES:
- `apps/web/components/layout/` (AppShell, SideNav, AuthedShell and tests), `apps/web/lib/roles.ts` (menu items per role). Spec: docs/design/fe-polish-packets.md P-10.

SPEC:
- Files (ONLY): the layout components + their tests (+ roles.ts labels).
- Labels: menu item 'ผู้ดูแลระบบ' becomes 'จัดการผู้ใช้'; 'คณะกรรมการ' becomes 'ผลประเมิน' (to /committee/assessments) or 'คิวอนุมัติ' per target page; never equal to a role name.
- Drawer: menu button `aria-expanded`, 44px, closes on route change.
- Loading: `data-testid="menu-skeleton"` `role="status"`.
- Keep AuthedShell's stale-session redirect untouched.

CONSTRAINTS: only the listed files; no new dependencies; no `any`; Thai UI; theme tokens ONLY (grep -E 'bg-(white|blue|gray|red|green|orange|yellow)|text-(gray|blue|red|green|orange|yellow)|border-(gray|red)' must be empty on every line you touch); keep EVERY existing data-testid (Playwright gates use them); tap targets >= 44px; status never by colour alone; check document.documentElement.scrollWidth == 390 at 390px if layout changes.

TOOLS: `pnpm --filter @blulens/web test AuthedShell` · `pnpm --filter @blulens/web typecheck`

DONE:
- Proving test "shows a menu skeleton while /me loads and the full role menu after": mocked useMe pending -> menu-skeleton, no links; resolved committee user -> link 'ผลประเมิน' and an account block with name, role text and logout.
- Others: no menu label equals a role label; drawer toggles aria-expanded.
- Report to andy-muxsqkra (act=done): paths, exact commands with real pass counts, unverified, open items, pushed branch + SHA.
