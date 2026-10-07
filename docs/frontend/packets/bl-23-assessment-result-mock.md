# PACKET bl-23: static assessment RESULT page mock at /demo/assessment-result (Darryl)

GOAL: A finished-looking, customer-facing, STATIC page the owner uses in a sales pitch: the grading result of one player. Hard-coded demo data, no API, no auth, Thai UI. It must look polished, not like a wireframe.

STATE:
- WORKTREE RULE: never switch branches in the shared checkout. Own worktree, branch `fe/bl-23-assessment-result-mock` from `origin/develop`; `pnpm install`; before typecheck run `pnpm --filter @blulens/shared build`. Dev server on port 3190 (`pnpm --filter @blulens/web exec next dev --port 3190`; this machine needs `NODE_ENV=production` only for `next build`). Never commit to main/develop.
- Review gate: Andy sends your branch to Stanley; merge only on APPROVE.
- Deadline: about 2 hours from 15:30 owner time. Depends on: nothing (GradeBand is on develop).

SOURCES:
- Pam's visual spec: docs/design/mock-assessment-result.md (arriving; if it is not on origin/develop yet, start from the content list below and the existing tokens in apps/web/app/globals.css, then adjust to Pam's file when it lands).
- docs/specs/grading.md (result shape, sections 6 and 12), docs/api/openapi.yaml schemas GradeView (score, lower, upper, center, kind, label, tier, margin) and AssessmentResult/flags; existing component `apps/web/components/ui/GradeBand.tsx` (props lower, upper, score, label, provisional, disputed).

CONTENT (all hard-coded; Thai):
1. Header: player name and club (e.g. "สมชาย ใจดี · เชียงใหม่ แบด"), assessment date, event context "ประเมินฝีมือ XD เกรด S-–S+", status chip: approved "อนุมัติแล้ว" (green) shown as the main state; also render, in a small "ตัวอย่างสถานะอื่น" row under the page, the provisional chip ("ชั่วคราว · กรรมการ 1 คน") and disputed chip ("ผลไม่ตรงกัน").
2. Hero grade block: big grade label (e.g. "S/S+"), the 15-rung ladder via GradeBand with lower/upper/score marker, score "7.8 / 15", margin, tier name (Standard) and kind (straddle), one-line plain-language explanation.
3. Clip card: a thumbnail placeholder (CSS gradient with a play icon, no external image) with title, duration "0:47", and "ผู้ประเมิน 3 คน".
4. Reviewer table (3 reviewers, anonymous "กรรมการ A/B/C"): each reviewer's score and the six criteria scores; mark one score as an outlier with a visible "ค่าผิดปกติ ถูกตัดออก" badge (icon + text, not colour only) and show it struck through.
5. Agreement panel: Fleiss' Kappa value (e.g. 0.71) with a text label "สอดคล้องกันดี" and a simple horizontal gauge; "จำนวนผู้ประเมินที่ใช้คำนวณ 2 จาก 3".
6. "ผลนี้คำนวณอย่างไร" panel: 4 numbered steps (collect scores; remove outliers; weighted mean of 6 criteria; margin and range on the 15-rung ladder). Short Thai sentences.
7. Footer note: "ข้อมูลตัวอย่างเพื่อการนำเสนอ".

SPEC:
- Files (ONLY these): `apps/web/app/demo/assessment-result/page.tsx` (server component, no auth: the middleware only protects /me /review /committee /admin /events so /demo is public), `apps/web/features/demo/AssessmentResultMock.tsx` (the whole view), `apps/web/features/demo/demoAssessment.ts` (the hard-coded data object, typed), `apps/web/features/demo/AssessmentResultMock.test.tsx`.
- Layout: responsive. Desktop (>= 1024px): two columns (hero + clip left; reviewers, agreement, how-computed right/below). Phone (<= 420px): single column, nothing overflows horizontally (reviewer table scrolls inside its own container or stacks as cards).
- Visual: plain daylight theme with existing tokens in globals.css (bg-background, text-foreground, bg-card, border, text-muted-foreground, bg-primary...). Spacing and type scale consistent; cards with soft shadow/rounded corners; no raw hex except gauge fill via tokens. A11y: headings in order (one h1), status and outlier not conveyed by colour only, `aria-label`s on the gauge.
- Testids: `demo-result-page`, `demo-status`, `demo-grade-label`, `demo-reviewer-row` (x3), `demo-outlier-badge` (x1), `demo-kappa`, `demo-howto-step` (x4).

CONSTRAINTS: only the listed files; no new dependencies; no `any`; no network, no images from the internet; Thai text; do not alter GradeBand.

TOOLS: `pnpm --filter @blulens/web test AssessmentResultMock` · `pnpm --filter @blulens/web typecheck` · open http://localhost:3190/demo/assessment-result and look at it at 1440px and 390px widths (browser devtools) before reporting.

DONE:
- Proving test "renders the approved result with 3 reviewers, one outlier and 4 how-to steps": render AssessmentResultMock -> demo-status has text 'อนุมัติแล้ว', 3 demo-reviewer-row, exactly 1 demo-outlier-badge, 4 demo-howto-step, demo-kappa contains '0.71'.
- Report to andy-muxsqkra (act=done): paths, exact commands with real pass counts, what you checked visually at 1440 and 390 widths, unverified, open items. Andy takes the PNG screenshots.
