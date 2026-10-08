PACKET bl-29-1: every Event read returns format (EventFormat | null) (Pam S1; contract Jim e0d6aea)

Assignee: Creed (creed-muxswjfu), after bl-25-13 · Reviewer: Oscar (oscar-muxt974o) · Senior: Kevin (kevin-muxsqdkp)
GOAL: the web knows whether an event is groups_knockout before offering 'จับกลุ่ม'.
STATE: branch dev/bl-29-event-format-read from origin/develop. apps/api/src/modules/tournaments/tournaments.service.ts:
  toEvent(e: EventRow) at ~line 32 is the single Event mapper (used by GET /events/{id}, GET /tournaments/{id}/events,
  TournamentDetail.events, event create). Prisma Event { format Json?, formatLockedAt DateTime? }. Shared:
  eventFormatSchema (@blulens/shared).
SOURCES (openapi e0d6aea): Event.format: EventFormat | null (readOnly), including lockedAt (ISO string | null).
SPEC (files ONLY: tournaments.service.ts, apps/api/test/event-format-read.e2e-spec.ts new):
  - in toEvent: format = e.format == null ? null : (safeParse ok ? { ...parsed.data, lockedAt: e.formatLockedAt?.toISOString() ?? null } : null).
    An invalid stored value returns null (never a 500). Make sure EventRow / every query feeding toEvent selects
    format + formatLockedAt (check each caller).
  Test: event with a groups_knockout format -> GET /events/{id} has format.type 'groups_knockout' and lockedAt null;
    the same in GET /tournaments/{id}/events and the tournament detail; event with format null -> null; invalid stored
    JSON (set with prisma) -> null and 200. Clean up.
TOOLS: pnpm --filter @blulens/api db:generate; pnpm --filter @blulens/shared build; cd apps/api && pnpm build && pnpm lint && pnpm test
DONE: push dev/bl-29-event-format-read, verify on origin, done message to Kevin (sha + spec line + FULL pnpm test line).
