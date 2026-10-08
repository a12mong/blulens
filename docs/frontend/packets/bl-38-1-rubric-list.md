# PACKET bl-38-1: Rubric versions list: see all versions, make a draft, delete a draft, activate with a reason (S12 part 1)

GOAL: Committee/Admin open /committee/rubrics and see every rubric version (newest first) with its status; they can start a new draft copied from the active one, delete a draft, and activate a draft (old active becomes retired) after giving a reason. Editing a draft's criteria is the next packet (bl-38-2); here each draft only links to it.

STATE:
- WORKTREE RULE: never switch branches in the shared checkout. Own worktree OUTSIDE it (sibling folder D:/_work/SourceDev/_code/blulens-<you>-rubrics), branch `fe/bl-38-rubric-list` from `origin/develop`; `pnpm install`; before typecheck run `pnpm --filter @blulens/shared build`. Dev servers on port 3190. Never commit to main/develop. PUSH your branch and send the SHA.
- Review gate: Andy self-reviews; merge only after tests + tsc are green.
- Backend LIVE on develop (0c432eb), no flag needed: `GET /rubrics` -> Rubric[] newest first `{ id, status: 'draft'|'active'|'retired', createdAt, methodVersion, criteria[{ key, nameTh, weight, anchorsTh? }] }`; `POST /rubrics` (copies the active rubric into a new draft; 409 RUBRIC_DRAFT_EXISTS when a draft already exists) -> 201 Rubric; `DELETE /rubrics/{id}` -> 204 (draft only); `POST /rubrics/{id}/activate` body `{ reason }` (>= 5 chars) -> 200 Rubric active; 409 RUBRIC_NOT_DRAFT. Committee/Admin only.

SOURCES:
- Design: docs/design/screens/S12-rubric-editor.md (the list part). Types: `components['schemas']['Rubric']` in apps/web/lib/api/schema.d.ts (run `pnpm gen:api` if stale).
- Patterns: `features/teams/TeamRequestsQueue.tsx` + `requestsApi.ts` (list + mutations), `components/ui/ReasonDialog.tsx` (min length + submit), `features/assessments/AssessmentDecisions.tsx` (confirm dialog), `apps/web/app/(app)/committee/teams/requests/page.tsx` (page shape), `thaiError` in `lib/errors.ts`, `features/committee/CommitteeHome.tsx` (hub items array).

SPEC:
- Files (ONLY): `apps/web/features/rubrics/api.ts` (`useRubrics()` key ['rubrics']; `useCreateRubricDraft()`; `useDeleteRubric()`; `useActivateRubric()` body `{ id, reason }`; all mutations invalidate ['rubrics'] and ['rubric']; plain object bodies, apiFetch serialises), `apps/web/features/rubrics/RubricList.tsx`, `RubricList.test.tsx`, `apps/web/app/(app)/committee/rubrics/page.tsx` (server component, h1 'เกณฑ์การประเมิน (Rubric)', renders `<RubricList />`), `apps/web/features/committee/CommitteeHome.tsx` + test ONLY to add a hub item `committee-link-rubrics` 'เกณฑ์การประเมิน' (desc 'ดูเวอร์ชัน แก้ร่าง และเปิดใช้เกณฑ์ใหม่') -> /committee/rubrics, `apps/web/lib/errors.ts` (+ test) for RUBRIC_DRAFT_EXISTS 'มีฉบับร่างอยู่แล้ว แก้หรือลบฉบับร่างนั้นก่อน', RUBRIC_NOT_DRAFT 'แก้ได้เฉพาะฉบับร่าง' (add only if missing).
- RubricList (no props): one card per rubric `data-testid="rubric-card"`: method version, created date, status badge text `rubric-status` ('ฉบับร่าง' | 'ใช้งานอยู่' | 'เลิกใช้แล้ว'; text always, not colour only), criteria count 'เกณฑ์ {n} ข้อ' and the weight list as text (nameTh + weight). Draft card: link `rubric-edit` 'แก้ไข' -> /committee/rubrics/{id} (min-h 44px), button `rubric-delete` 'ลบร่าง' (confirm dialog 'ลบฉบับร่างนี้?'), button `rubric-activate` 'เปิดใช้' -> ReasonDialog (min 5, title 'เปิดใช้เกณฑ์เวอร์ชันนี้', warns 'เกณฑ์เดิมจะถูกเลิกใช้') -> mutation. Page-level button `rubric-new-draft` 'สร้างร่างจากเกณฑ์ที่ใช้อยู่' (44px; hidden when a draft exists, with the line 'มีฉบับร่างอยู่แล้ว').
- States: skeleton `rubric-loading` role=status; error `rubric-error` role=alert + 'ลองใหม่'; empty 'ยังไม่มีเกณฑ์'. Mutation errors via thaiError in a `rubric-action-error` role=alert.

CONSTRAINTS: only the listed files; no new dependencies; no `any` outside tests; Thai UI; day theme tokens ONLY; grep -E 'bg-(white|blue|gray|red|green|orange|yellow)|text-(gray|blue|red|green|orange|yellow)|border-(gray|red)' must be empty on lines you touch; NO emoji; keep every existing data-testid; tap targets >= 44px; status never by colour alone; document.documentElement.scrollWidth == 390 at 390px; no direct fetch in components. Never show grading parameters (the API does not send them).

TOOLS: `pnpm --filter @blulens/web test RubricList CommitteeHome errors` · `pnpm --filter @blulens/web typecheck`

DONE:
- Proving test "lists rubric versions and manages the draft": mock hooks with an active and a draft rubric -> 2 cards with status texts; draft has edit link to /committee/rubrics/{id}; new-draft button hidden (draft exists); delete -> confirm -> delete mutation with the id; activate -> reason of 5+ chars -> activate mutation `{ id, reason }`; with only an active rubric the new-draft button shows and calls create.
- Others: RUBRIC_DRAFT_EXISTS shows its Thai text; empty; error with retry.
- Report to andy-muxsqkra (act=done): paths, exact commands with real pass counts, unverified, open items, pushed branch + SHA.
