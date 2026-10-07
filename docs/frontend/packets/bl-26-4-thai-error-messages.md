# PACKET bl-26-4-thai-error-messages: lib/errors.ts: map API error codes to Thai messages and use it in the entry UIs (Ryan)

GOAL: No raw English or untranslated API message reaches the user: one helper maps an error to a Thai message, and the entry UIs use it.

STATE:
- WORKTREE RULE: never switch branches in the shared checkout. Own worktree, branch `fe/bl-26-thai-errors` from `origin/develop`; `pnpm install`; before typecheck run `pnpm --filter @blulens/shared build`. Dev servers on port 3190. Never commit to main/develop.
- Review gate: Andy sends your branch to Stanley; merge only on APPROVE.
- Source of the finding: docs/design/review-slice-1.md item #4 (Pam).

SOURCES:
- `apps/web/lib/api/client.ts` (ApiRequestError has code, message, details). Codes of the entry flow: ENTRIES_CLOSED, ENTRY_DUPLICATE_PLAYER, ENTRY_PLAYER_COUNT, ENTRY_NOT_DRAFT, ENTRY_NOT_EDITABLE, ENTRY_NOT_PENDING, ENTRY_PLAYER_UNGRADED, ENTRY_FRESH_ASSESSMENT_MISSING, ENTRY_OUT_OF_BAND_REASON_REQUIRED, TEAM_EXISTS, TEAM_NOT_FOUND, USER_NOT_FOUND, EVENT_NOT_FOUND, TOURNAMENT_INVALID_TRANSITION, VALIDATION_FAILED, FORBIDDEN, NOT_FOUND (docs/api/openapi.yaml).
- Callers with English fallbacks: `apps/web/features/entries/AdminEntryForm.tsx` ('Error creating entry', 'Error forwarding entry') and `apps/web/features/entries/CommitteeQueue.tsx`.

SPEC:
- Files (ONLY these): `apps/web/lib/errors.ts`, `apps/web/lib/errors.test.ts`, and in `AdminEntryForm.tsx` and `CommitteeQueue.tsx` ONLY the lines that build error text (Darryl and Phyllis edit other parts of these files in parallel: keep the diff minimal and rebase before pushing).
- Export `thaiError(e: unknown, fallback?: string): string`. ApiRequestError: return the Thai text of its code from a `const MESSAGES: Record<string, string>` (write natural short Thai for every code listed, e.g. ENTRIES_CLOSED 'ปิดรับสมัครแล้ว', ENTRY_DUPLICATE_PLAYER 'ผู้เล่นซ้ำในคู่เดียวกัน', FORBIDDEN 'คุณไม่มีสิทธิ์ทำรายการนี้'); unknown code: if the server message contains a Thai character return it, else the fallback or 'เกิดข้อผิดพลาด ลองใหม่อีกครั้ง'. TypeError (network) -> 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้'. Anything else -> the fallback.
- Replace the English fallbacks and direct `err.message` uses in the two components with `thaiError(err, '<Thai fallback>')`.

CONSTRAINTS: only the listed files; no new dependencies; no `any`; Thai UI; theme tokens only (no bg-blue-500 etc.); no direct fetch in components.

TOOLS: `pnpm --filter @blulens/web test errors` · `pnpm --filter @blulens/web typecheck`

DONE:
- Proving test "maps known codes to Thai, passes through Thai server messages, hides English ones": ENTRIES_CLOSED -> 'ปิดรับสมัครแล้ว'; unknown code with message 'ผู้เล่นไม่พบ' -> the same message; unknown code with message 'Internal error' -> the generic Thai fallback; TypeError -> the network message.
- Others: every listed code has a non-empty Thai text.
- Report to andy-muxsqkra (act=done): paths, exact commands with real pass counts, unverified, open items.
