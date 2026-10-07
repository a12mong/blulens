PACKET bl-18-3: drawTransition (shared, pure)

Assignee: Creed (creed-muxswjfu) · Reviewer: Oscar (oscar-muxt974o) · Senior: Kevin (kevin-muxsqdkp)

GOAL:
  One pure function that decides whether a draw version may move from its current status via an action,
  and returns either the next status or the exact error code the API will send.

STATE:
  AMENDED 2026-10-07: origin/be/bl-18-draw-foundation now holds a stub of your file with the final signature (commit 6d74a21).
  If you already branched: git fetch origin && git rebase origin/be/bl-18-draw-foundation
  Repo: D:/_work/SourceDev/_code/blulens  (work in your own worktree, not in that shared folder:
    git worktree add ../blulens-creed -b dev/bl-18-draw-transition origin/be/bl-18-draw-foundation)
  Branch to create: dev/bl-18-draw-transition — based on origin/be/bl-18-draw-foundation
  Already exists (do not rewrite): packages/shared/src/draw/{types.ts, conflict.ts, prng.ts, index.ts}
  Depends on (merged): none

SOURCES (everything you need is here; read nothing else):
  docs/specs/draw.md §6 (owner-approved), state diagram verbatim:
    [*] --> preview : Committee draws (after entries close)
    preview --> published : publish (input_hash must match)
    preview --> discarded : a newer preview was published
    published --> superseded : redraw after publishing (reason required)
    published --> locked : first match started
    locked --> [*]
  draw.md §5: "Publishing requires acknowledgeConflicts when conflicts > 0 — otherwise the API answers
    DRAW_CONFLICTS_NOT_ACKNOWLEDGED."
  draw.md §6: "If entry data changed after preview -> input_hash differs -> cannot publish (DRAW_INPUT_CHANGED)."
  draw.md §7 / decision D8: redraw only with a reason; never after the first match started (locked).
  Reason rule (openapi ReasonInput): reason.trim().length must be >= 5.
  Sibling pattern: packages/shared/src/draw/conflict.ts (small pure function + JSDoc)

SPEC:
  Files to touch (ONLY these 2):
    - packages/shared/src/draw/transition.ts   (EXISTS as a stub since 6d74a21: keep the exact exported names/types, replace the body)
    - packages/shared/src/draw/transition.test.ts
  Types + signature (exact, export all):
    export type DrawStatus = 'preview' | 'published' | 'discarded' | 'superseded' | 'locked';
    export type DrawAction =
      | { type: 'publish'; inputHashMatches: boolean; conflictCount: number; acknowledgeConflicts: boolean }
      | { type: 'discard' }
      | { type: 'supersede'; reason: string }
      | { type: 'lock' };
    export type DrawErrorCode =
      | 'DRAW_INVALID_TRANSITION'
      | 'DRAW_INPUT_CHANGED'
      | 'DRAW_CONFLICTS_NOT_ACKNOWLEDGED'
      | 'DRAW_REASON_REQUIRED';
    export type DrawTransitionResult = { ok: true; next: DrawStatus } | { ok: false; code: DrawErrorCode };
    export function drawTransition(current: DrawStatus, action: DrawAction): DrawTransitionResult
  Behaviour (checks in EXACTLY this order; first failure wins):
    1. Allowed pairs only: preview+publish -> published, preview+discard -> discarded,
       published+supersede -> superseded, published+lock -> locked. Any other pair -> DRAW_INVALID_TRANSITION.
    2. publish: inputHashMatches === false -> DRAW_INPUT_CHANGED.
    3. publish: conflictCount > 0 && acknowledgeConflicts !== true -> DRAW_CONFLICTS_NOT_ACKNOWLEDGED.
    4. supersede: reason.trim().length < 5 -> DRAW_REASON_REQUIRED.
    5. Otherwise { ok: true, next }.
  Edge cases (expected return):
    - ('preview', publish{true,0,false}) -> { ok: true, next: 'published' }
    - ('preview', publish{true,2,true})  -> { ok: true, next: 'published' }
    - ('preview', publish{false,2,false}) -> { ok: false, code: 'DRAW_INPUT_CHANGED' }      (hash checked before conflicts)
    - ('preview', publish{true,1,false}) -> { ok: false, code: 'DRAW_CONFLICTS_NOT_ACKNOWLEDGED' }
    - ('published', supersede{'   ab  '}) -> { ok: false, code: 'DRAW_REASON_REQUIRED' }
    - ('published', supersede{'team data was wrong'}) -> { ok: true, next: 'superseded' }
    - ('locked', supersede{'team data was wrong'}) -> { ok: false, code: 'DRAW_INVALID_TRANSITION' }
    - ('published', publish{...}) -> DRAW_INVALID_TRANSITION (already published)
    - every action from 'discarded', 'superseded', 'locked' -> DRAW_INVALID_TRANSITION
  Pure: no Date, no Math.random, no I/O.

CONSTRAINTS:
  - Touch only the 2 files listed. index.ts already exports this module: do not edit it, stub.ts or stubs.test.ts. No new dependencies. No `any`. Do not throw; always return a result.
  - Do not modify foundation files. Conventional commits (feat(shared): add drawTransition). Push your branch.

TOOLS (from your worktree root):
  pnpm install --frozen-lockfile
  pnpm --filter @blulens/shared exec vitest run src/draw/transition.test.ts
  pnpm --filter @blulens/shared exec vitest run
  pnpm --filter @blulens/shared lint

DONE (the single proving test):
  File: packages/shared/src/draw/transition.test.ts
  Test name: "allows exactly the draw.md §6 transitions and reports the first failing rule"
  Asserts: a table test over ALL 5 statuses x 4 action types (20 rows, using valid action payloads)
           expecting ok only for the 4 allowed pairs, plus every edge case listed above, exactly (toEqual).
  Report back (act=done to kevin-muxsqdkp): branch, paths changed, exact commands + real output
  (pass/fail counts), anything unverified, anything left open.
