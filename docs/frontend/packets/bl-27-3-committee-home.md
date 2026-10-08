# PACKET bl-27-3: Committee home /committee: a hub with links to every Committee area (Darryl)

GOAL: The Committee menu item opens /committee, which today is only the heading 'คณะกรรมการ'. It becomes a hub of big links to the areas that exist on develop, so nobody has to type a URL.

STATE:
- WORKTREE RULE: never switch branches in the shared checkout. Own worktree OUTSIDE it (sibling folder D:/_work/SourceDev/_code/blulens-darryl-chome), branch `fe/bl-27-committee-home` from `origin/develop`; `pnpm install`; before typecheck run `pnpm --filter @blulens/shared build`. Dev servers on port 3190. Never commit to main/develop. PUSH your branch and send the SHA.
- Review gate: Andy sends your branch to Stanley; merge only on APPROVE.
- ROUTE RULE: every link must point to a page that exists on develop (listed below).

SOURCES:
- `apps/web/app/(app)/committee/page.tsx` (the stub), `committee/layout.tsx` (guard), `apps/web/lib/nav.ts` (the menu 'ผลประเมิน' points to /committee).
- Existing Committee pages: `/committee/assessments` (list, with the dashboard tiles + RaterPanel at its top), `/committee/teams/requests` (team requests queue). Event-level pages need an event id, so link to `/events` ('เลือกอีเวนต์เพื่อจัดการคิวอนุมัติ ผลแข่ง และจัดกลุ่ม') instead.
- Link styling pattern: `features/events/TournamentDetailView.tsx` Committee links.

SPEC:
- Files (ONLY): `apps/web/features/committee/CommitteeHome.tsx`, `CommitteeHome.test.tsx`, `apps/web/app/(app)/committee/page.tsx` (keep an h1 'คณะกรรมการ', render `<CommitteeHome />`).
- CommitteeHome (no props): a list of cards (each a Link, min-h 44px, title + one-line description), `data-testid`s: `committee-link-assessments` 'ผลประเมิน' (desc 'ดูผล ตัดสิน และมอบหมายผู้ตรวจ') -> /committee/assessments; `committee-link-team-requests` 'คำขอทีม' (desc 'สร้างทีมใหม่ ผูกชื่อเรียกอื่น หรือปฏิเสธ') -> /committee/teams/requests; `committee-link-events` 'อีเวนต์' (desc 'คิวอนุมัติผู้สมัคร จัดกลุ่ม และผลที่รอยืนยัน อยู่ในแต่ละอีเวนต์') -> /events. Single column at 390px, two columns from md.

CONSTRAINTS: only the listed files; no new dependencies; no `any`; Thai UI; day theme tokens ONLY (grep -E 'bg-(white|blue|gray|red|green|orange|yellow)|text-(gray|blue|red|green|orange|yellow)|border-(gray|red)' must be empty); document.documentElement.scrollWidth == 390 at 390px; tap targets >= 44px.

TOOLS: `pnpm --filter @blulens/web test CommitteeHome` · `pnpm --filter @blulens/web typecheck`

DONE:
- Proving test "links every committee area": renders 3 links with the hrefs above.
- Existing tests stay green.
- Report to andy-muxsqkra (act=done): paths, exact commands with real pass counts, unverified, open items, pushed branch + SHA.
