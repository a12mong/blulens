/*
  Warnings:

  - Made the column `min_reviewers` on table `events` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "AssignmentKind" AS ENUM ('assessment', 'calibration');

-- CreateEnum
CREATE TYPE "SecondOpinionRequester" AS ENUM ('member', 'committee');

-- AlterEnum
ALTER TYPE "AssessmentStatus" ADD VALUE 'provisional';

-- AlterTable
ALTER TABLE "assessments" ALTER COLUMN "reviews_required" SET DEFAULT 2;

-- AlterTable (backfill before NOT NULL so existing events get the G3' default)
ALTER TABLE "events" ALTER COLUMN "min_reviewers" SET DEFAULT 2;
UPDATE "events" SET "min_reviewers" = 2 WHERE "min_reviewers" IS NULL;
ALTER TABLE "events" ALTER COLUMN "min_reviewers" SET NOT NULL;

-- AlterTable
ALTER TABLE "rater_stats" ADD COLUMN     "calibration_bias" DECIMAL(6,4),
ADD COLUMN     "calibration_mae" DECIMAL(6,4),
ADD COLUMN     "calibration_n" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "review_assignments" ADD COLUMN     "calibration_clip_id" UUID,
ADD COLUMN     "kind" "AssignmentKind" NOT NULL DEFAULT 'assessment',
ALTER COLUMN "assessment_id" DROP NOT NULL;

-- CreateTable
CREATE TABLE "second_opinions" (
    "id" UUID NOT NULL,
    "assessment_id" UUID NOT NULL,
    "requested_by" UUID NOT NULL,
    "requester" "SecondOpinionRequester" NOT NULL,
    "assignment_id" UUID,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "second_opinions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calibration_sets" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calibration_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calibration_clips" (
    "id" UUID NOT NULL,
    "set_id" UUID NOT NULL,
    "object_key" TEXT NOT NULL,
    "reference_index" SMALLINT NOT NULL,
    "status" "ClipStatus" NOT NULL DEFAULT 'pending_upload',
    "content_type" TEXT,
    "size_bytes" BIGINT,
    "sha256" CHAR(64),
    "duration_sec" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calibration_clips_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "second_opinions_assignment_id_key" ON "second_opinions"("assignment_id");

-- CreateIndex
CREATE INDEX "second_opinions_assessment_id_idx" ON "second_opinions"("assessment_id");

-- CreateIndex
CREATE UNIQUE INDEX "calibration_clips_object_key_key" ON "calibration_clips"("object_key");

-- CreateIndex
CREATE INDEX "calibration_clips_set_id_idx" ON "calibration_clips"("set_id");

-- CreateIndex
CREATE INDEX "review_assignments_calibration_clip_id_idx" ON "review_assignments"("calibration_clip_id");

-- AddForeignKey
ALTER TABLE "review_assignments" ADD CONSTRAINT "review_assignments_calibration_clip_id_fkey" FOREIGN KEY ("calibration_clip_id") REFERENCES "calibration_clips"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "second_opinions" ADD CONSTRAINT "second_opinions_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "second_opinions" ADD CONSTRAINT "second_opinions_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "review_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calibration_clips" ADD CONSTRAINT "calibration_clips_set_id_fkey" FOREIGN KEY ("set_id") REFERENCES "calibration_sets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- grading v2 constraints (bl-07b). Covered by test/schema-constraints.e2e-spec.ts.
-- ============================================================================

-- G3': 1..5 valid reviews per event / request.
ALTER TABLE "events" ADD CONSTRAINT "events_min_reviewers_chk" CHECK ("min_reviewers" BETWEEN 1 AND 5);
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_reviews_required_chk" CHECK ("reviews_required" BETWEEN 1 AND 5);

-- An assignment points at exactly the target its kind says.
ALTER TABLE "review_assignments" ADD CONSTRAINT "review_assignments_kind_target_chk" CHECK (
  ("kind" = 'assessment'  AND "assessment_id" IS NOT NULL AND "calibration_clip_id" IS NULL) OR
  ("kind" = 'calibration' AND "calibration_clip_id" IS NOT NULL AND "assessment_id" IS NULL)
);

-- A reviewer holds at most one live assignment per calibration clip (same rule as for assessments).
CREATE UNIQUE INDEX "review_assignments_one_live_per_calibration_clip"
  ON "review_assignments" ("calibration_clip_id", "reviewer_id")
  WHERE "calibration_clip_id" IS NOT NULL AND "state" IN ('open', 'submitted');

-- Committee reference grade is a ladder index.
ALTER TABLE "calibration_clips" ADD CONSTRAINT "calibration_clips_reference_index_chk" CHECK ("reference_index" BETWEEN 0 AND 14);

-- G20: the player gets one second opinion per request (the Committee is not limited).
CREATE UNIQUE INDEX "second_opinions_one_member_request"
  ON "second_opinions" ("assessment_id") WHERE "requester" = 'member';
