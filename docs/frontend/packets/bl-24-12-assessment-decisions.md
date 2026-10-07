# PACKET bl-24-12-assessment-decisions: Committee decision buttons on the assessment detail (confirm, approve, return, override) (Darryl)

GOAL: On /committee/assessments/[id] the Committee can confirm a provisional result, approve a pending/disputed one, send it back for more reviews, or override it, with a reason where required. Only the buttons the status allows are shown.

STATE:
- WORKTREE RULE: never switch branches in the shared checkout. Own worktree OUTSIDE the checkout (sibling folder D:/_work/SourceDev/_code/blulens-<you>-<packet>), branch `fe/bl-24-assessment-decisions` from `origin/develop`; `pnpm install`; before typecheck run `pnpm --filter @blulens/shared build`. Dev servers on port 3190. Never commit to main/develop. PUSH your branch to origin and send the SHA.
- Review gate: Andy sends your branch to Stanley; merge only on APPROVE.
- ROUTE RULE: every link/route you add must point to a page that exists on develop (the list page links to /committee/assessments/{id}, this packet creates that page).

SOURCES:
- docs/design/demo-slice-2.md section C2 (button rules table, ConfirmDialog rules). Packet bl-24-11 must be merged first (AssessmentDetailView, useAssessmentDetail).
- openapi: `POST /assessments/{id}/confirm` (provisional -> approved; 409 ASSESSMENT_NOT_PROVISIONAL), `/approve` (pending_approval|disputed -> approved; body `{resultVersion?, note?}`), `/return` (body ReasonInput {reason}, -> in_review), `/override` (body `{centerKey: GradeKey, reason (>= 20 chars), resultVersion?}`), all return the AssessmentDetail. See `components['schemas']['OverrideInput']` and `ReasonInput` for exact fields and min lengths.
- `ReasonDialog` (`@/components/ui/ReasonDialog`: props open,title,confirmLabel,minLength,onSubmit,onCancel,error,pending), `GradePicker` (`@/components/ui/GradePicker`), `thaiError`.

SPEC:
- Files (ONLY these): `apps/web/features/assessments/api.ts` (append mutations `useAssessmentAction(id)` with `mutate({ action: 'confirm'|'approve'|'return'|'override', body? })` posting to `/assessments/{id}/{action}`; onSuccess sets query data ['assessments','detail',id] to the returned detail and invalidates ['assessments'] list), `apps/web/features/assessments/AssessmentDecisions.tsx`, `apps/web/features/assessments/AssessmentDecisions.test.tsx`, and in `AssessmentDetailView.tsx` only the line that renders `<AssessmentDecisions detail={data} />` below the result block.
- AssessmentDecisions props `{ detail: AssessmentDetail }`; buttons `data-testid="decide-confirm|decide-approve|decide-return|decide-override"` (min-h 44px): provisional -> confirm 'ยืนยันผล', return, override; disputed -> approve 'อนุมัติ' (dialog with optional note), return, override; pending_approval -> approve, return, override; approved/overridden -> override only; needs_reviewers/in_review/others -> none, text 'ยังไม่มีการตัดสินใจที่ทำได้ในสถานะนี้'. Provisional also shows 'ยังไม่ใช้สมัคร/จัดสายจนกว่ายืนยัน'.
- confirm: a small confirm dialog (role=dialog) 'ยืนยันผลที่ประเมินโดยกรรมการ 1 คน?'. return: ReasonDialog min as ReasonInput says. override: a dialog with a GradePicker (variant ladder, no N/A) for the new centre grade, a reason textarea (min 20 chars, counter x/20) and the sentence 'ผลเดิม {oldLabel} → ผลใหม่ {newKey}'; submit sends `{ centerKey, reason, resultVersion: detail.latestResultVersion ?? undefined }`. approve sends `{ note, resultVersion }`.
- Errors via thaiError in the dialog's error prop; success closes the dialog (the returned detail refreshes the view). Buttons disabled while pending.

CONSTRAINTS: only the listed files; no new dependencies; no `any`; Thai UI; theme tokens ONLY (grep -E 'bg-(white|blue|gray|red|green|orange|yellow)|text-(gray|blue|red|green|orange|yellow)|border-(gray|red)' must be empty); mobile-first: check document.documentElement.scrollWidth == 390 at 390px; tap targets >= 44px; no direct fetch in components; status and flags never by colour only.

TOOLS: `pnpm --filter @blulens/web test AssessmentDecisions` · `pnpm --filter @blulens/web typecheck`

DONE:
- Proving test "shows only the buttons the status allows and sends the override with a 20-char reason": provisional -> decide-confirm, decide-return, decide-override present, decide-approve absent; open override, pick a grade, reason of 19 chars -> submit disabled, 20 chars -> enabled; submit -> mutate called with action 'override' and body {centerKey, reason, resultVersion}.
- Others: approved shows only override; in_review shows none with the explanatory text; return needs its reason; a mutation error shows in the dialog.
- Report to andy-muxsqkra (act=done): paths, exact commands with real pass counts, what you saw at 1440 and 390 incl. scrollWidth, unverified, open items, pushed branch + SHA.
