# PACKET bl-24-3: ClipPlayer (Ryan)

GOAL: Native video player for the reviewer's clip(s) with 1-3 clip tabs, 5-second rewind, speed buttons, keyboard keys, and graceful handling of expired signed URLs and not-ready clips.

STATE:
- WORKTREE RULE: never switch branches in the shared checkout. Own worktree, branch `fe/bl-24-clip-player` from `origin/develop`; `pnpm install`; before typecheck run `pnpm --filter @blulens/shared build`. Dev servers on port 3190. Never commit to main/develop.
- Review gate: Andy sends your branch to Stanley; merge only on APPROVE.
- Depends on: none.

SOURCES:
- docs/design/demo-slice-2.md section R2 (the 'player' row of the behaviour table and the Components line: `ClipPlayer (clips, onError, onTimeUpdate?; variants native only)`).
- docs/api/openapi.yaml: Clip {id, status (pending|ready|rejected ...check enum), viewUrl, durationSec}; clip viewUrl is a presigned MinIO URL valid ~15 min with Range support.
- docs/specs/architecture.md section 6.4 (MP4 H.264, no HLS).

SPEC:
- Files (ONLY these): `apps/web/components/ui/ClipPlayer.tsx`, `apps/web/components/ui/ClipPlayer.test.tsx`.
- Props: `{ clips: { id: string; status: string; viewUrl?: string | null; durationSec?: number | null }[]; onRefreshNeeded?: () => void; onTimeUpdate?: (sec: number) => void }`.
- Renders `<div data-testid="clip-player">`. Tabs: if clips.length > 1 a tablist `data-testid="clip-tabs"` with one `role="tab"` button per clip `data-testid="clip-tab-{index}"` text `คลิป {index+1}`; selected has aria-selected. Only the selected clip's `<video data-testid="clip-video" controls playsInline preload="metadata" src={viewUrl}>` is mounted.
- Not ready: if the selected clip status !== 'ready' or no viewUrl show `<p role="status" data-testid="clip-not-ready">คลิปยังไม่พร้อม</p>` and no video, plus button `clip-refresh` "รีเฟรช" that calls onRefreshNeeded.
- Controls under the video (buttons min 44px height): `clip-rewind` "ย้อน 5 วิ" sets currentTime = max(0, currentTime-5); speed buttons `clip-speed-0.5`, `clip-speed-1`, `clip-speed-1.5` set playbackRate (selected one aria-pressed=true; default 1).
- Keyboard (when focus is NOT inside an input/textarea/button): Space toggles play/pause, ArrowLeft/ArrowRight seek -5/+5 s. Attach on the container `onKeyDown` with tabIndex=0; preventDefault for handled keys.
- Expired URL: on the video's `error` event (or a 403): call `onRefreshNeeded()` exactly once per clip until `viewUrl` changes; remember `currentTime` before the error and, when a new `viewUrl` prop arrives for the same clip id, set `currentTime` back to the remembered value on `loadedmetadata`. If the error happens again for the same new URL show `<p role="alert" data-testid="clip-error">เล่นคลิปไม่ได้</p>` and `clip-retry` "ลองใหม่" (calls onRefreshNeeded).
- `onTimeUpdate` forwards the video's `timeupdate` as whole seconds (throttled to when the integer second changes).
- Switching tabs keeps the other clip state independent; no autoplay.

CONSTRAINTS: only the listed files; no new dependencies; no `any`; Thai UI; tailwind theme tokens; no direct fetch; no autoplay; do not show the URL text.

TOOLS: `pnpm --filter @blulens/web test ClipPlayer` · `pnpm --filter @blulens/web typecheck`

DONE:
- Proving test "a video error asks for a refresh once, then restores the playback time when a new URL arrives": jsdom has no media: define `HTMLMediaElement.prototype.play/pause` mocks and set `currentTime` via Object.defineProperty on the element; render with clip A viewUrl u1, set currentTime 12, fire `error` on clip-video -> onRefreshNeeded called once; fire `error` again -> still once; rerender with viewUrl u2 and fire `loadedmetadata` -> video.currentTime === 12.
- Others: two clips render two tabs and switching changes the src; status 'pending' shows clip-not-ready + refresh button calls the callback; rewind button subtracts 5 (not below 0); speed button sets playbackRate 1.5 and aria-pressed; Space toggles play.
- Report to andy-muxsqkra (act=done): paths, exact commands with real pass counts, unverified, open items.
