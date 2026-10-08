PACKET bl-39-1: GET /api/v1/me/notifications + POST /me/notifications/{notificationId}/read + POST /me/notifications/read-all

Assignee: Creed (creed-muxswjfu) · Reviewer: Oscar (post-review) · Senior: Kevin (kevin-muxsqdkp)
GOAL: every logged-in user reads their own notifications (bell count + list) and marks them read.
STATE: branch dev/bl-39-my-notifications from origin/develop (>= caa5498). bl-39-0 is merged: table `notifications`
  (Prisma model Notification { id, recipientUserId, type, title, body?, link?, readAt?, createdAt }, index
  (recipient_user_id, read_at, created_at desc)) and NotificationsService.emit (global; you do NOT touch it).
SOURCES: docs/specs/notifications.md §5; openapi tag notifications: paths /me/notifications (GET, query cursor, limit,
  unread), /me/notifications/{notificationId}/read (POST 204), /me/notifications/read-all (POST 200 { updated });
  schemas Notification { id, type, title, body, link, readAt, createdAt } and NotificationPage { items, nextCursor,
  unreadCount }. Read components/parameters Cursor and Limit for the limit bounds/default.
SPEC (files ONLY, NEW: apps/api/src/modules/notifications/notifications.module.ts, notifications.controller.ts,
  me-notifications.service.ts; apps/api/src/app.module.ts (import the module, one line);
  apps/api/test/my-notifications.e2e-spec.ts):
  - all routes: any logged-in role (@Roles('Member','Reviewer','Umpire','Committee','Admin')); Guest/unauth -> 401.
    Only the caller's rows, ever (where recipientUserId = user.id).
  - GET: zod query { cursor?: uuid, limit?: int per the Limit parameter, unread?: 'true'|'false' } -> 400
    VALIDATION_FAILED. ORDER: unread first, then createdAt desc, then id desc. Cursor = id of the last item of the
    previous page; look that row up (must belong to the caller, else 400 VALIDATION_FAILED) and continue AFTER it:
      last was unread: (readAt null AND (createdAt < c OR (createdAt = c AND id < cid))) OR readAt not null
      last was read:   readAt not null AND (createdAt < c OR (createdAt = c AND id < cid))
    (unread=true keeps only readAt null.) Fetch limit+1 rows; nextCursor = last returned id when there were more,
    else null. unreadCount = count(recipient = me, readAt null), independent of cursor and unread filter.
    Map rows to Notification (readAt/createdAt ISO strings).
  - POST {id}/read: ParseUUIDPipe; row missing or not mine -> 404 NOTIFICATION_NOT_FOUND; readAt null -> set now;
    already read -> unchanged; @HttpCode(204).
  - POST read-all: updateMany(recipient = me, readAt null) -> { updated: count }; @HttpCode(200).
  - no audit rows (spec §3: notifications are not audited).
  Test: seed rows via prisma for two users (A: 3 unread + 2 read with distinct createdAt; B: 1 unread):
    GET as A -> unread rows first newest-first, then read newest-first; unreadCount 3; never B's row.
    limit=2 -> page 1 (2 unread) + nextCursor; page 2 continues (1 unread + 1 read) ; page 3 the last read, nextCursor
    null; unread=true -> only the 3 unread, unreadCount still 3. read on one -> 204, unreadCount 2; read again -> 204
    and readAt unchanged; read B's id as A -> 404; read-all -> { updated: 2 } then { updated: 0 }; B untouched.
    Unauthenticated -> 401. Cleanup: users disabled (rows can stay).
TOOLS: pnpm --filter @blulens/api db:generate; pnpm --filter @blulens/shared build; cd apps/api && pnpm build && pnpm lint && TEST_DATABASE_URL=<fresh *_test db> pnpm test
  (plain command, do NOT override JWT or other env; MinIO must be running.)
DONE: merge origin/develop into your branch first, push, done message to Kevin (sha + test names + FULL pnpm test line).
  No any, no expect(true), no conditional asserts; worktree as a SIBLING of the repo (D:/_work/SourceDev/_code/blulens-creed-39-1).
