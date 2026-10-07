-- bl-21 (architecture §6.10): Admin/Committee-created entries forwarded to the Committee for approval.
-- Existing active/reserve rows (pre-slice data model) map to approved.
-- AlterEnum
BEGIN;
CREATE TYPE "EntryStatus_new" AS ENUM ('draft', 'pending_committee', 'approved', 'rejected', 'withdrawn');
ALTER TABLE "public"."entries" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "entries" ALTER COLUMN "status" TYPE "EntryStatus_new" USING (
  CASE "status"::text WHEN 'active' THEN 'approved' WHEN 'reserve' THEN 'approved' ELSE "status"::text END
)::"EntryStatus_new";
ALTER TYPE "EntryStatus" RENAME TO "EntryStatus_old";
ALTER TYPE "EntryStatus_new" RENAME TO "EntryStatus";
DROP TYPE "public"."EntryStatus_old";
ALTER TABLE "entries" ALTER COLUMN "status" SET DEFAULT 'draft';
COMMIT;

-- AlterTable
ALTER TABLE "entries" ADD COLUMN     "decided_at" TIMESTAMPTZ(3),
ADD COLUMN     "decided_by" UUID,
ADD COLUMN     "decision_reason" TEXT,
ADD COLUMN     "forwarded_at" TIMESTAMPTZ(3),
ADD COLUMN     "name" VARCHAR(80),
ALTER COLUMN "status" SET DEFAULT 'draft';

-- AlterTable
ALTER TABLE "entry_players" ADD COLUMN     "team_id" UUID;

-- AddForeignKey
ALTER TABLE "entry_players" ADD CONSTRAINT "entry_players_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Rejecting an entry needs a written reason (>= 20 chars), like every Committee decision.
ALTER TABLE "entries" ADD CONSTRAINT "entries_reject_reason_chk" CHECK (
  "status" <> 'rejected' OR char_length(btrim(coalesce("decision_reason", ''))) >= 20
);
