# PACKET bl-24-4-review-card: ReviewCard: one task in the reviewer queue (Ryan)

GOAL: A card for one review assignment: neutral task id, due time, state badge, and a start/continue/view action.

STATE:
- WORKTREE RULE: never switch branches in the shared checkout. Own worktree, branch `fe/bl-24-review-card` from `origin/develop`; `pnpm install`; before typecheck run `pnpm --filter @blulens/shared build`. Dev servers on port 3190. Never commit to main/develop.
- Review gate: Andy sends your branch to Stanley; merge only on APPROVE.
- BLIND REVIEW: a reviewer task carries only the assignment id (neutral task id), state and due time. Never show or ask for an assessment id, the player, or whether a task is a calibration clip.

SOURCES:
- docs/design/demo-slice-2.md section R1.
- `ReviewAssignment` from `components['schemas']['ReviewAssignment']` in `@/lib/api/schema` ({id, state: open|submitted|expired|declined, dueAt, submittedAt}).

SPEC:
- Files (ONLY these): `apps/web/features/review/ReviewCard.tsx`, `apps/web/features/review/ReviewCard.test.tsx`.
- Props `{ assignment: ReviewAssignment; now?: Date }` (`now` defaults to new Date(), for testing).
- `<article data-testid="review-card" data-state={state}>`: heading `งาน #{last 4 chars of id uppercased}`; due text `ส่งภายใน {d MMM HH:mm}` in Thai short month, Buddhist year NOT shown (use `Intl.DateTimeFormat('th-TH-u-ca-gregory',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})`); when open and due within 24h add `data-testid="review-card-soon"` text 'ใกล้ครบกำหนด'.
- Badge `data-testid="review-card-state"`: open 'ยังไม่ทำ', submitted 'ส่งแล้ว' (+ submittedAt), expired 'หมดเวลา', declined 'ปฏิเสธแล้ว' (text, never colour only).
- Action link `data-testid="review-card-action"` href `/review/tasks/{id}`: open 'เริ่ม', submitted 'ดู', expired and declined: no action link (render nothing).

CONSTRAINTS: only the listed files; no new dependencies; no `any`; Thai UI; theme tokens only; no direct fetch in components; mobile-first (nothing overflows at 390px), tap targets >= 44px.

TOOLS: `pnpm --filter @blulens/web test ReviewCard` · `pnpm --filter @blulens/web typecheck`

DONE:
- Proving test "shows the neutral task id, the state badge and a start link only for open tasks": open assignment id 'aaaa-bbbb-a3f2' -> heading contains 'A3F2', state text 'ยังไม่ทำ', action href '/review/tasks/aaaa-bbbb-a3f2' text 'เริ่ม'; expired -> text 'หมดเวลา' and no review-card-action.
- Others: submitted shows 'ส่งแล้ว' and action 'ดู'; open due in 2h (with `now`) shows review-card-soon; the output never contains the words 'calibration' or 'ชุดมาตรฐาน'.
- Report to andy-muxsqkra (act=done): paths, exact commands with real pass counts, unverified, open items.
