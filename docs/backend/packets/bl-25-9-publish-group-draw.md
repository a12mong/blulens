PACKET bl-25-9: POST /api/v1/draws/{drawId}/publish (group draws only in this packet)

Assignee: Meredith (meredith-muxtbonw) · Reviewer: Oscar (oscar-muxt974o) · Senior: Kevin (kevin-muxsqdkp)
Slice 3 write chain, step 2 of 3 (after bl-25-8 groups preview; next: GET /events/{id}/groups).

GOAL: the Committee publishes a preview group draw: it becomes 'published' (its groups and matches turn public through
  the existing read endpoints), and every other preview of the same event+kind becomes 'discarded'. Audited.

STATE: branch dev/bl-25-publish-draw from origin/dev/bl-25-groups-preview (merge origin/develop after bl-25-8 merges,
  before your done message). draws.service has createGroupPreview (inputHash = sha256 of sorted approved entry ids,
  Draw shape mapper). Prisma Draw { status preview|published|discarded|superseded|locked, inputHash, sameTeamR1Count,
  conflicts, conflictsAcknowledgedBy/At }.

SOURCES (openapi, pasted):
  POST /draws/{drawId}/publish  x-roles [Committee]  body { acknowledgeConflicts?: boolean (default false), reason?: string }
  200 Draw; 409 DRAW_INPUT_CHANGED | DRAW_CONFLICTS_NOT_ACKNOWLEDGED | DRAW_ALREADY_LOCKED

SPEC (files ONLY: draws.controller.ts, draws.service.ts, apps/api/test/publish-draw.e2e-spec.ts new):
  - @Roles('Committee','Admin'), uuid pipe, zod body. Missing draw -> 404 DRAW_NOT_FOUND. kind 'knockout' -> 409
    DRAW_KIND_NOT_SUPPORTED (knockout publish comes later).
  - ONE $transaction, lock the draw row FOR UPDATE:
    status !== 'preview' -> 409 DRAW_ALREADY_LOCKED; another draw of the same event+kind already published/locked -> 409
    DRAW_ALREADY_LOCKED (supersede is out of scope).
    recompute inputHash from the event's CURRENT approved entries (same function as preview: extract it to one private
    helper, do not copy) -> differs -> 409 DRAW_INPUT_CHANGED (the Committee must preview again).
    sameTeamR1Count > 0 and !acknowledgeConflicts -> 409 DRAW_CONFLICTS_NOT_ACKNOWLEDGED; if acknowledged, set
    conflictsAcknowledgedBy/At.
    update: this draw -> published; other previews of the same event+kind -> discarded. Audit 'draw.publish' (reason if any).
  - Return the Draw shape (reuse the bl-25-8 mapper).
  Test: preview (via POST groups/preview) -> publish -> 200 published; GET /events/{id}/matches now lists its matches;
    a second preview made before publish is now discarded; publish again -> 409 DRAW_ALREADY_LOCKED; approve one more
    entry after preview then publish -> 409 DRAW_INPUT_CHANGED; a draw with sameTeamR1Count > 0 (set it with prisma in
    the test) -> 409 without ack, 200 with acknowledgeConflicts true + acknowledgedBy set; Member -> 403. Clean up.
TOOLS: pnpm --filter @blulens/api db:generate; pnpm --filter @blulens/shared build; cd apps/api && pnpm build && pnpm lint && pnpm test
DONE: push dev/bl-25-publish-draw, verify on origin, done message to Kevin (sha + FULL pnpm test line).
