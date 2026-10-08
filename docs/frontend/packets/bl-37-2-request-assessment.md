# PACKET bl-37-2: Member "request an assessment" page: note + up to 3 clips + submit (held until bl-37-1 merges)

GOAL: A signed-in member opens /me/assessments/new, opens a draft assessment, adds up to 3 clips with the ClipUploader, optionally writes a note, previews the clips, and submits the request.

STATE:
- WORKTREE RULE: never switch branches in the shared checkout. Own worktree OUTSIDE it (sibling folder D:/_work/SourceDev/_code/blulens-<you>-request), branch `fe/bl-37-request-page` from `origin/develop`; `pnpm install`; before typecheck run `pnpm --filter @blulens/shared build`. Dev servers on port 3190. Never commit to main/develop. PUSH your branch and send the SHA.
- Review gate: Andy self-reviews; merge only after tests + tsc are green.
- Depends on bl-37-1 (ClipUploader, uploadApi) being merged. Assignee: whoever frees first (Phyllis, or Darryl if Gemini returns).
- ROUTE RULE: same as bl-37-1; the whole page sits behind `process.env.NEXT_PUBLIC_UPLOAD_UI === '1'` (default OFF; tests set it).

SOURCES:
- Contract: `POST /assessments` body `{ note?: string (<=1000), eventId?: uuid }` -> 201 Assessment `{ id, status: 'draft', ... }`; `POST /assessments/{id}/submit` (draft -> submitted, needs >= 1 uploaded clip; read its error codes in docs/api/openapi.yaml near line 365); `GET /assessments/{id}` -> AssessmentDetail with `clips[]`. `GET /clips/{clipId}/playback-url` -> `{ url, expiresAt }` (bl-36-4; when it lands, ClipPlayer's `onRefreshNeeded` calls it).
- Existing: `features/assessments/api.ts` (add `useCreateAssessment`, `useSubmitAssessment` only if missing), `components/ui/ClipPlayer.tsx`, `features/clips/ClipUploader.tsx` (bl-37-1), `features/me/MyResults.tsx` (link target after submit), page shape `apps/web/app/(app)/me/page.tsx`.

SPEC:
- Files (ONLY): `apps/web/features/clips/RequestAssessment.tsx`, `RequestAssessment.test.tsx`, `apps/web/app/(app)/me/assessments/new/page.tsx` (server component, h1 'ขอประเมินฝีมือ', renders the component only when the flag is on, else `notFound()`), `apps/web/features/me/MyResults.tsx` + test ONLY to add a link `data-testid="myresult-new"` 'ขอประเมินใหม่' to /me/assessments/new when the flag is on, `apps/web/features/assessments/api.ts` if hooks are missing.
- Component (no props): step 1 'สร้างคำขอ': note textarea (<=1000, with counter) + button `request-start` 'เริ่มคำขอ' -> POST /assessments (once; the draft id is kept in state and reused). Step 2: up to 3 slots (`request-slot`): finished clips show a ClipPlayer preview + duration; below, a ClipUploader while fewer than 3 clips ('คลิปที่ {n} จาก 3'). Button `request-submit` 'ส่งคำขอ' (44px) disabled until >= 1 uploaded clip, with the visible reason 'ต้องมีอย่างน้อย 1 คลิป'; click -> submit -> success view `request-done` 'ส่งคำขอแล้ว' + link 'ดูผลของฉัน' to /me. Errors via thaiError in `request-error` role=alert. Reload after step 1 is out of scope (note it in the report).

CONSTRAINTS: only the listed files; no new dependencies; no `any` outside tests; Thai UI; day theme tokens ONLY; grep -E 'bg-(white|blue|gray|red|green|orange|yellow)|text-(gray|blue|red|green|orange|yellow)|border-(gray|red)' must be empty on lines you touch; NO emoji; tap targets >= 44px; status never by colour alone; document.documentElement.scrollWidth == 390 at 390px; no direct fetch in components.

TOOLS: `pnpm --filter @blulens/web test RequestAssessment MyResults` · `pnpm --filter @blulens/web typecheck`

DONE:
- Proving test "creates a draft once, collects clips and submits": mock hooks; start -> create called once with the note; two onUploaded calls -> two previews and the uploader still shown; submit disabled with 0 clips; with clips click submit -> submit called with the draft id -> request-done shown.
- Others: 3 clips hides the uploader; submit error shows thaiError; MyResults link only with the flag.
- Report to andy-muxsqkra (act=done): paths, exact commands with real pass counts, unverified, open items, pushed branch + SHA.
