# PACKET bl-27-2: "My results" page /me: the member's own assessments and published grades (S11, assessments part) (Darryl)

GOAL: A signed-in member opens /me and sees each of their own assessments: the event, a plain status, and, once the Committee has approved it, their grade band. Today /me is only a heading.

STATE:
- WORKTREE RULE: never switch branches in the shared checkout. Own worktree OUTSIDE it (sibling folder D:/_work/SourceDev/_code/blulens-darryl-myresults), branch `fe/bl-27-my-results` from `origin/develop`; `pnpm install`; before typecheck run `pnpm --filter @blulens/shared build`. Dev servers on port 3190. Never commit to main/develop. PUSH your branch and send the SHA.
- Review gate: Andy sends your branch to Stanley; merge only on APPROVE.
- Do this after packet bl-27-1. Backend: `GET /assessments` is already scoped to the caller for a Member (bl-26-1). `latestGrade` / `latestResultVersion` are in the contract but the API fills them only after Kevin's packet bl-26-7 (a Member then sees ONLY approved results; null while pending). Code defensively: null grade = "อยู่ระหว่างตรวจ". Tests use mocks, so you are not blocked.
- Scope: assessments only. The applications list/withdraw part of S11 is NOT in this packet (no member entries endpoint confirmed).

SOURCES:
- Design: docs/design/screens/S11-my-results.md (blind rules: the member never sees reviewer identity, per-reviewer scores or the review count).
- `apps/web/features/assessments/api.ts` (`useAssessments(options)` -> AssessmentPage {items, nextCursor}), `apps/web/features/assessments/AssessmentStatusBadge.tsx` (status labels; do NOT reuse its Committee wording blindly: a member sees only the member wording below), `apps/web/components/ui/GradeBand.tsx` (props lower, upper, score, label, provisional, disputed), `apps/web/lib/api/schema.d.ts` (`Assessment` has subject, event {id, discipline, tournamentName}|null, status, createdAt, latestGrade GradeView|null).
- Current page: `apps/web/app/(app)/me/page.tsx` (a stub heading) and `me/layout.tsx`. Patterns: `features/assessments/CommitteeAssessments.tsx` (list + states + load more), `thaiError`.

SPEC:
- Files (ONLY): `apps/web/features/me/MyResults.tsx`, `apps/web/features/me/MyResults.test.tsx`, `apps/web/app/(app)/me/page.tsx` (keep the 'ของฉัน' h1, render `<MyResults />` below it).
- MyResults (no props): `useAssessments()` (no filters). One card per item `data-testid="myresult-card"`: event line `{tournamentName} · {discipline in Thai}` (reuse the discipline label helper exported from `features/assessments/ReviewerProgress.tsx`) or 'ประเมินทั่วไป' when event is null; created date; member status text `data-testid="myresult-status"`: latestGrade present -> 'ผลประกาศแล้ว'; status `withdrawn`/`void`-like -> 'ยกเลิก'; anything else -> 'อยู่ระหว่างตรวจ' (never the review count, reviewer names, flags, or 'provisional'/'disputed' words). When latestGrade is present show `<GradeBand compact lower upper score label />` (no provisional/disputed flags) and text 'ระดับ {label} · ช่วง {lower}–{upper}'.
- Timeline `data-testid="myresult-timeline"` with 3 labelled steps 'ส่งแล้ว' -> 'กำลังตรวจ' -> 'ผลประกาศ'; current step marked with text '(ตอนนี้)' (not colour only).
- States: skeleton role=status `data-testid="myresult-loading"`; error role=alert `data-testid="myresult-error"` via thaiError + 'ลองใหม่'; empty `data-testid="myresult-empty"` 'คุณยังไม่มีผลประเมิน' + link 'ดูอีเวนต์' to /events; 'โหลดเพิ่ม' button (same pattern as CommitteeAssessments) when nextCursor.

CONSTRAINTS: only the listed files; no new dependencies; no `any`; Thai UI; day theme tokens ONLY (grep -E 'bg-(white|blue|gray|red|green|orange|yellow)|text-(gray|blue|red|green|orange|yellow)|border-(gray|red)' must be empty); mobile-first (document.documentElement.scrollWidth == 390 at 390px); tap targets >= 44px; status never by colour alone; no direct fetch in components.

TOOLS: `pnpm --filter @blulens/web test MyResults` · `pnpm --filter @blulens/web typecheck`

DONE:
- Proving test "shows the grade only when it is published and never leaks reviewer details": mock useAssessments with 2 items, one with latestGrade (label 'S/S+'), one null -> 2 cards; first shows 'ผลประกาศแล้ว' and 'S/S+', second shows 'อยู่ระหว่างตรวจ' and no GradeBand; no text 'provisional', 'disputed', 'ผู้ตรวจ', or a count of reviews in either card.
- Others: event null -> 'ประเมินทั่วไป'; empty state; error with retry; load more calls fetch next page.
- Report to andy-muxsqkra (act=done): paths, exact commands with real pass counts, unverified, open items, pushed branch + SHA.
