# PACKET bl-24-13: Committee dashboard: stat tiles + agreement panel on /committee/assessments (Phyllis)

GOAL: The top of /committee/assessments shows tiles counting assessments per status (click = filter the table), the panel Fleiss agreement, the reviewer pair matrix and a small reviewer table, with a window selector (30/90/365 days / all).

STATE:
- WORKTREE RULE: never switch branches in the shared checkout. Own worktree OUTSIDE the checkout (sibling folder D:/_work/SourceDev/_code/blulens-<you>-<packet>), branch `fe/bl-24-committee-dashboard` from `origin/develop`; `pnpm install`; before typecheck run `pnpm --filter @blulens/shared build`. Dev servers on port 3190. Never commit to main/develop. PUSH your branch to origin and send the SHA.
- Review gate: Andy sends your branch to Stanley; merge only on APPROVE.
- Depends on merged: AssessmentTable, AssessmentStatusBadge, CommitteeAssessments, AgreementBadge, PairMatrix (all in `apps/web/features/assessments/`). API gap: `GET /rater-stats` and `GET /assessments` may not be served yet (Kevin); code against the contract, the error state must be graceful.

SOURCES:
- docs/design/demo-slice-2.md section C1 (tiles, agreement panel, reviewer table rules). Types: `RaterStats` in `@/lib/api/schema` {window, methodVersion, panel{fleissKappaTier: AgreementValue{kappa|null, n, band}}, raters[{reviewerId, reviews, bias, kappaVsConsensus: AgreementValue, outlierRate, flagged}], pairs[{a, b, cohenKappaQuadratic: AgreementValue}]}. Endpoint `GET /rater-stats?window=30d|90d|365d|all` (default 90d).
- Existing: `apps/web/features/assessments/CommitteeAssessments.tsx` (status state + `useAssessments(status)`), `api.ts` (hook pattern).

SPEC:
- Files (ONLY these): `apps/web/features/assessments/api.ts` (append `useRaterStats(window)`, queryKey ['rater-stats', window]), `apps/web/features/assessments/StatTile.tsx`, `apps/web/features/assessments/RaterPanel.tsx`, `apps/web/features/assessments/RaterPanel.test.tsx`, `apps/web/features/assessments/CommitteeAssessments.tsx` (add the tiles + `<RaterPanel/>` above the table), `apps/web/features/assessments/CommitteeAssessments.test.tsx` (extend).
- StatTile props `{ label: string; count: number; active?: boolean; onClick: () => void }` -> a button `data-testid="stat-tile"` (min-h 44px, `aria-pressed={active}`), text '{label} {count}' (never colour only).
- In CommitteeAssessments: fetch ALL assessments once (`useAssessments(undefined)`), count per status client-side for the tiles needs_reviewers 'ต้องหากรรมการเพิ่ม', in_review 'กำลังรีวิว', provisional 'ชั่วคราว', disputed 'เห็นต่างกัน', pending_approval 'รออนุมัติ'; clicking a tile sets `status` (click again clears); the table receives the items filtered client-side by `status` (do not refetch per status). Keep the existing select filter working with the same state.
- RaterPanel props `{ window?: '30d'|'90d'|'365d'|'all' }` owns its window state; a `<select data-testid="rater-window">` ('30 วัน','90 วัน','365 วัน','ทั้งหมด'); shows 'ความสอดคล้องของกรรมการ' with the panel `AgreementBadge` (value = `panel.fleissKappaTier`) and 'n={n}'; then `<PairMatrix reviewerIds pairs labelFor>` where reviewerIds = raters' reviewerId in order, labelFor = 'R1'.. by index (no names available here); then a rater table: per rater `data-testid="rater-row"`: label, reviews count, bias text '{+0.4|-0.2} ขั้น (เข้มน้อยกว่าฉันทามติ | เข้มกว่าฉันทามติ)', kappaVsConsensus AgreementBadge, outlier % ('{Math.round(outlierRate*100)}%'), and `flagged` -> chip 'ควรทบทวน'. States: loading `role=status` 'กำลังโหลด…'; error `role=alert` `data-testid="rater-error"` via thaiError (+ 'ลองใหม่'); no raters: 'ยังไม่มีข้อมูลผู้ประเมิน'. Tables scroll inside their own container.

CONSTRAINTS: only the listed files; no new dependencies; no `any`; Thai UI; theme tokens ONLY (raw-palette grep must be empty); check document.documentElement.scrollWidth == 390 at 390px in a browser; status never by colour only; ROUTE RULE: add no links to pages that do not exist.

TOOLS: `pnpm --filter @blulens/web test RaterPanel CommitteeAssessments` · `pnpm --filter @blulens/web typecheck`

DONE:
- Proving test "tiles count per status and clicking one filters the table; the panel shows the Fleiss badge and a flagged rater": CommitteeAssessments with 5 assessments (2 provisional, 1 disputed, 2 in_review) -> tile 'ชั่วคราว 2'; click it -> 2 rows; click again -> 5 rows. RaterPanel with panel kappa 0.62 moderate, 2 raters (one flagged, outlierRate 0.25) -> badge '0.62', 'ปานกลาง', 'ควรทบทวน', '25%'.
- Others: window select changes the hook argument; error with retry; empty raters text.
- Report to andy-muxsqkra (act=done): paths, exact commands with real pass counts, what you saw at 1440 and 390 incl. scrollWidth, unverified, open items, pushed branch + SHA.
