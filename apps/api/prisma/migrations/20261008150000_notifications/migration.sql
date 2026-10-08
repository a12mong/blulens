-- bl-39 (docs/specs/notifications.md §3): in-app notifications. Additive: one new table, nothing else changes.
-- type is TEXT (not a DB enum) so a new notification type never needs an enum migration.
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "recipient_user_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "body" VARCHAR(1000),
    "link" TEXT,
    "read_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "notifications_link_chk" CHECK ("link" IS NULL OR "link" LIKE '/%')
);

-- unread count + "unread first, newest first" listing per recipient
CREATE INDEX "notifications_recipient_read_created_idx"
    ON "notifications" ("recipient_user_id", "read_at", "created_at" DESC);

ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_user_id_fkey"
    FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
