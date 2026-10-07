# PACKET bl-21-3b-event-type-card: EventTypeCard + format presets (Phyllis)

GOAL: One card in the wizard that edits one event type of a tournament: discipline, grade range, max entries, fresh-assessment toggle, format preset and match preset. Plus the pure preset table.

STATE:
- WORKTREE RULE: never switch branches in the shared checkout. Own worktree, branch `fe/bl-21-event-type-card` from `origin/develop`, `pnpm install` there; before typecheck run `pnpm --filter @blulens/shared build`. Dev servers on port 3190 (not 3100). Never commit to main/develop.
- Review gate: after done, Andy sends your branch to Stanley; merge only on APPROVE.
- Depends on: bl-21-3a (GradeRangeSelect) merged; vi.mock it until then

SOURCES:
- docs/design/demo-slice-1.md D2 step 3; docs/specs/tournament-format.md sections 2 (defaults) for presets; openapi EventInput {discipline MS|WS|MD|WD|XD, gradeMin, gradeMax, maxEntries<=256, requiresFreshAssessment, minReviewers 1-5 default 2} and EventFormat/MatchFormat (type knockout|groups_knockout, groupSize, advancePerGroup, groupMatchFormat, knockoutMatchFormat).
- Slice = doubles first: show MD/WD/XD first in the discipline select, MS/WS after (labels: ชายคู่ MD, หญิงคู่ WD, คู่ผสม XD, ชายเดี่ยว MS, หญิงเดี่ยว WS).

SPEC:
- Files (ONLY these): `apps/web/features/events/formatPresets.ts`, `apps/web/features/events/EventTypeCard.tsx`, `apps/web/features/events/EventTypeCard.test.tsx`, `apps/web/features/events/formatPresets.test.ts`.
- formatPresets.ts exports: `type FormatPresetKey = 'knockout' | 'groups_knockout'`; `FORMAT_PRESETS: Record<FormatPresetKey, { label: string; hint: string; format: EventFormat }>` where knockout = {type:'knockout', thirdPlacePlayoff:true, knockoutMatchFormat: BO3_21} and groups_knockout = {type:'groups_knockout', groupSize:4, advancePerGroup:2, thirdPlacePlayoff:true, groupMatchFormat: GROUP_2X15, knockoutMatchFormat: BO3_21}; `BO3_21 = {preset:'bo3_21', mode:'best_of', games:3, pointsPerGame:21, deuce:true, cap:30, drawAllowed:false}`, `GROUP_2X15 = {preset:'group_2x15', mode:'fixed_games', games:2, pointsPerGame:15, deuce:false, cap:null, drawAllowed:false}` (verify these numbers against tournament-format.md section 2 and fix if the spec differs; note it in your report). Labels: knockout "น็อคเอาท์อย่างเดียว", groups_knockout "แบ่งกลุ่ม + น็อคเอาท์ (แนะนำเมื่อ ≥ 6 คู่)".
- EventTypeCard props: `{ value: EventTypeDraft; onChange: (v: EventTypeDraft) => void; onRemove?: () => void; errors?: Partial<Record<'discipline'|'grade'|'maxEntries', string>> }` where `EventTypeDraft = { discipline: 'MS'|'WS'|'MD'|'WD'|'XD'; gradeMin: GradeKey; gradeMax: GradeKey; maxEntries?: number; requiresFreshAssessment: boolean; minReviewers: number; formatPreset: FormatPresetKey }` (export the type and a `defaultEventType(): EventTypeDraft` = XD, S-, S+, undefined, false, 2, 'knockout').
- Markup (testids): select `etc-discipline`; GradeRangeSelect inside; number `etc-max-entries`; checkbox `etc-fresh` "ต้องประเมินใหม่สำหรับอีเวนต์นี้"; radio group `etc-format` with two radios (`etc-format-knockout`, `etc-format-groups_knockout`) showing label+hint; remove button `etc-remove` (only if onRemove). Advanced settings are NOT in this card.

CONSTRAINTS: only the listed files; no new dependencies; no `any`; Thai UI text; tailwind classes with theme tokens only, no hex; no business logic; no direct fetch in components.

TOOLS: `pnpm --filter @blulens/web test EventTypeCard formatPresets` · `pnpm --filter @blulens/web typecheck`

DONE:
- Proving test "choosing the groups preset and a grade range reports the full draft": render with defaultEventType(); pick MD, click etc-format-groups_knockout -> onChange last call has {discipline:'MD', formatPreset:'groups_knockout', ...rest unchanged}.
- formatPresets.test: groups_knockout.format.groupMatchFormat.pointsPerGame === 15 and knockoutMatchFormat.games === 3.
- Others: doubles options listed first; remove button only when onRemove; errors rendered with role=alert.
- Report to andy-muxsqkra (act=done): paths, exact commands with real pass counts, unverified, open items.
