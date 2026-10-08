PACKET bl-25-14: a re-preview needs a reason (draw.md §7, decision D5)

Assignee: Meredith (meredith-muxtbonw) · Reviewer: Oscar (oscar-muxt974o) · Senior: Kevin (kevin-muxsqdkp)
GOAL: the first group preview of an event needs no reason; every later preview (version >= 2) must carry a reason
  (stored in Draw.reason and in the 'draw.preview' audit), so re-rolling until a result is liked is visible.
STATE: branch dev/bl-25-repreview-reason from origin/develop. draws.service createGroupPreview (bl-25-8): computes
  version = max + 1 inside the transaction. Prisma Draw.reason String? ('Required for every preview after the first').
  Contract: POST /events/{eventId}/groups/preview body gains reason?: string (Jim pins it; additive).
SPEC (files ONLY: draws.controller.ts, draws.service.ts, apps/api/test/groups-preview.e2e-spec.ts (+ tests)):
  - body reason?: string (trimmed, 5..2000). Inside the transaction, after computing version: version >= 2 and no
    reason -> 400 VALIDATION_FAILED, message 'ต้องระบุเหตุผลเมื่อสุ่มตัวอย่างใหม่' (field reason). Store reason on the Draw
    and in the audit entry's reason. Version 1 with a reason: store it too (allowed).
  Test: first preview without reason -> 201; second without reason -> 400; second with reason -> 201, version 2,
    Draw.reason saved, audit row reason set; reason 'abc' (too short) -> 400.
TOOLS: cd apps/api && pnpm build && pnpm lint && pnpm test
DONE: push, verify on origin, done message to Kevin (sha + FULL pnpm test line).
