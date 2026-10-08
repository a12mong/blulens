# PACKET bl-38-2: Rubric draft editor: criteria name, weight and tier anchors (S12 part 2; after bl-38-1)

GOAL: Committee/Admin open a draft rubric at /committee/rubrics/{id}, edit its criteria (name, key, weight, the five tier descriptions), add or remove criteria, and save. Only drafts can be edited; active/retired versions are read-only.

STATE:
- WORKTREE RULE: never switch branches in the shared checkout. Own worktree OUTSIDE it (sibling folder D:/_work/SourceDev/_code/blulens-<you>-rubric-editor), branch `fe/bl-38-rubric-editor` from `origin/develop` (after bl-38-1 is merged); `pnpm install`; before typecheck run `pnpm --filter @blulens/shared build`. Dev servers on port 3190. Never commit to main/develop. PUSH your branch and send the SHA.
- Review gate: Andy self-reviews; merge only after tests + tsc are green.
- Backend LIVE on develop (0c432eb): `GET /rubrics` (no single-get route: find the rubric by id in the list), `PUT /rubrics/{id}` body `{ criteria[{ key, nameTh, weight, anchorsTh? }] }` -> 200 Rubric; 409 RUBRIC_NOT_DRAFT; 400 VALIDATION_FAILED (message is Thai: show it). Contract: criteria 1..12; `key` matches ^[a-z][a-z_]{1,31}$ and is unique; `nameTh` 1..80; `weight` > 0 and <= 10 (relative weights, normalised at scoring: do NOT demand a sum of 100); `anchorsTh` keys are exactly the five tiers Rookie, Beginner, Standard, Neutral, Professional (each <= 500 chars).

SOURCES:
- Design: docs/design/screens/S12-rubric-editor.md (the weight-sum-100 and 1-5 scale rows are OLD: follow the contract above). Tier Thai names are in `components/ui/GradePicker.tsx` (TIER_NAMES).
- `features/rubrics/api.ts` (bl-38-1: `useRubrics`; add `useSaveRubric()` PUT here), `features/rubrics/RubricList.tsx` (link source), page shape `apps/web/app/(app)/committee/rubrics/page.tsx`, `thaiError`, `lib/api/schema.d.ts` (Rubric).

SPEC:
- Files (ONLY): `apps/web/features/rubrics/api.ts` (add `useSaveRubric()` mutation `{ id, criteria }`, invalidates ['rubrics']), `apps/web/features/rubrics/RubricEditor.tsx`, `RubricEditor.test.tsx`, `apps/web/app/(app)/committee/rubrics/[rubricId]/page.tsx` (server component, params is a Promise, renders `<RubricEditor rubricId={...} />`), `apps/web/lib/errors.ts` (+ test) only if a code is missing.
- RubricEditor props `{ rubricId }`: finds the rubric in `useRubrics()`; not found -> `rubric-notfound` 'ไม่พบเกณฑ์นี้'. Not draft -> read-only view (`rubric-readonly` 'เกณฑ์ที่ใช้งานแล้วแก้ไม่ได้ ให้สร้างร่างใหม่จากหน้ารายการ' + link back) listing criteria as text. Draft: one editor card per criterion `rubric-criterion`: inputs `crit-name` (nameTh), `crit-key` (key, helper 'a-z และ _ เท่านั้น'), `crit-weight` (number, step 0.1, 0 < w <= 10), five textareas `crit-anchor-{Tier}` labelled with the Thai tier names, remove button `crit-remove` (44px; disabled when only 1 criterion left), up/down buttons `crit-up`/`crit-down` (44px, aria-labels). Buttons: `crit-add` '+ เพิ่มเกณฑ์' (disabled at 12), `rubric-save` 'บันทึก' (44px).
- Client validation before save (inline text per field, role=alert summary `rubric-invalid` 'แก้ข้อผิดพลาดก่อนบันทึก (n)'): key pattern, key unique ('คีย์ซ้ำ'), nameTh 1..80, weight in (0,10], anchors <= 500. Invalid -> save disabled. Show the live share of each criterion as 'สัดส่วน {pct}%' computed from weights (text, informational). Save -> PUT with criteria (omit empty anchors, omit `anchorsTh` when all empty); success shows `rubric-saved` 'บันทึกแล้ว'; errors via thaiError in `rubric-action-error` (VALIDATION_FAILED shows the server message).
- Unsaved-change guard: `beforeunload` listener while dirty (added/removed in an effect).

CONSTRAINTS: only the listed files; no new dependencies; no `any` outside tests; Thai UI; day theme tokens ONLY; grep -E 'bg-(white|blue|gray|red|green|orange|yellow)|text-(gray|blue|red|green|orange|yellow)|border-(gray|red)' must be empty on lines you touch; NO emoji (use SVG icons or text arrows via aria-label buttons with Icon.tsx if an arrow icon exists, otherwise the words 'ขึ้น'/'ลง'); tap targets >= 44px; document.documentElement.scrollWidth == 390 at 390px; no direct fetch in components.

TOOLS: `pnpm --filter @blulens/web test RubricEditor RubricList` · `pnpm --filter @blulens/web typecheck`

DONE:
- Proving test "edits a draft rubric and saves the criteria": mock hooks; a draft with 2 criteria -> change a weight and an anchor, add a third criterion with a valid key -> save calls the mutation with `{ id, criteria }` of 3 items with the edited values (empty anchors omitted).
- Others: duplicate key and bad key disable save with the inline text; weight 0 and 11 invalid; active rubric renders read-only without inputs; not found; VALIDATION_FAILED message shown; remove disabled at 1 criterion; add disabled at 12.
- Report to andy-muxsqkra (act=done): paths, exact commands with real pass counts, unverified, open items, pushed branch + SHA.
