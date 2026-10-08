# PACKET bl-29-1-draw-polish: Group draw screen: pre-click summary and disabled states, groups visible right after publish, conflicts named in plain Thai (Darryl)

GOAL: The Committee sees how many pairs are approved and the format BEFORE pressing 'จับกลุ่ม'; the button is hidden/disabled when it cannot work; after publishing the group cards and match tables stay; conflicts say who meets whom.

STATE:
- WORKTREE RULE: never switch branches in the shared checkout. Own worktree OUTSIDE it (sibling folder D:/_work/SourceDev/_code/blulens-<you>-1-draw-polish), branch `fe/bl-29-1-draw-polish` from `origin/develop`; `pnpm install`; before typecheck run `pnpm --filter @blulens/shared build`. Dev servers on port 3190. Never commit to main/develop. PUSH your branch and send the SHA.
- Review gate: Andy sends your branch to Stanley; merge only on APPROVE.
- Source: Pam's live pass docs/design/review-slice-3.md, item(s) S1 + S2 + S3 (Thai; read the table row for the evidence).

SOURCES:
- `apps/web/features/draw/GroupDraw.tsx`, `api.ts`, `GroupDraw.test.tsx`; event hook `useEvent` (features/events) for `format` and groupSize if present in the Event type (check schema.d.ts: format, approved entry count may need `useEntries`/the entries list hook in features/entries; use what exists and report a missing field to andy); Draw conflicts shape in schema.d.ts (`conflicts`, `sameTeamR1Count`); `Group` members have `entry: EntryRef`.

SPEC:
- Files (ONLY): `GroupDraw.tsx`, `api.ts` (draw), `GroupDraw.test.tsx`.
- S1: above the button a summary `data-testid="draw-precheck"`: 'ผู้สมัครอนุมัติแล้ว {N} คู่ · รูปแบบ: {แบ่งกลุ่ม|น็อคเอาท์} · กลุ่มละ {groupSize}'. Event format not groups_knockout -> hide the button, show `data-testid="draw-not-groups"` 'รายการนี้ไม่ใช่รูปแบบแบ่งกลุ่ม' with a link to /events/{eventId}. N < groupSize -> button disabled + reason text 'ผู้สมัครไม่พอจับกลุ่ม'. If a needed field is absent from the types, skip that sub-check and say so in your report.
- S2: after publish success invalidate the groups queries (['events',eventId,'groups'] both 'preview' and 'published') so the cards and match tables show at once; show `data-testid="draw-published-summary"` 'เผยแพร่แล้ว: {G} กลุ่ม {M} แมตช์' (count from the refetched published groups).
- S3: each conflict line `data-testid="draw-conflict-item"` reads '{คู่ A} พบ {คู่ B} (ทีมเดียวกัน: {ทีม})' using the group members' names (fallback to the current wording only if names are not derivable); summary reads 'กลุ่มละ {n} คู่' not 'ขนาด n'; publish confirm dialog adds 'จะสร้าง {M} แมตช์ใน {G} กลุ่ม'.

CONSTRAINTS: only the listed files; no new dependencies; no `any`; Thai UI; theme tokens ONLY: day tokens only (bg-card, bg-primary, text-muted-foreground, bg-warning, ...); grep -E 'bg-(white|blue|gray|red|green|orange|yellow)|text-(gray|blue|red|green|orange|yellow)|border-(gray|red)' must be empty on every line you touch; NO emoji anywhere in UI text (use the SVG icon pattern of `components/ui/WarningBanner.tsx`, aria-hidden, plus text); keep every existing data-testid (Playwright gates use them); tap targets >= 44px; status never by colour alone; document.documentElement.scrollWidth == 390 at 390px.

TOOLS: `pnpm --filter @blulens/web test GroupDraw` · `pnpm --filter @blulens/web typecheck`

DONE:
- Proving test "explains why the draw cannot start and keeps the groups after publishing": event not groups format -> draw-not-groups and no draw-preview button; groups format with N<groupSize -> button disabled with reason; after publish success the groups query is invalidated and draw-published-summary shows counts.
- Others: conflict item names both pairs; dialog shows match count.
- Report to andy-muxsqkra (act=done): paths, exact commands with real pass counts, unverified, open items, pushed branch + SHA.
