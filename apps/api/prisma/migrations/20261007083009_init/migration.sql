-- CreateEnum
CREATE TYPE "Role" AS ENUM ('Admin', 'Committee', 'Umpire', 'Reviewer', 'Member');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'disabled');

-- CreateEnum
CREATE TYPE "TeamStatus" AS ENUM ('active', 'archived');

-- CreateEnum
CREATE TYPE "TeamRequestStatus" AS ENUM ('pending', 'created', 'aliased', 'rejected');

-- CreateEnum
CREATE TYPE "AssessmentStatus" AS ENUM ('draft', 'submitted', 'in_review', 'needs_reviewers', 'disputed', 'pending_approval', 'approved', 'overridden', 'rejected', 'withdrawn');

-- CreateEnum
CREATE TYPE "ResultStatus" AS ENUM ('needs_reviewers', 'provisional', 'pending_approval', 'disputed', 'approved', 'overridden');

-- CreateEnum
CREATE TYPE "ResultSource" AS ENUM ('computed', 'override');

-- CreateEnum
CREATE TYPE "GradeKind" AS ENUM ('exact', 'straddle', 'wide');

-- CreateEnum
CREATE TYPE "AssignmentState" AS ENUM ('open', 'submitted', 'expired', 'declined');

-- CreateEnum
CREATE TYPE "ClipStatus" AS ENUM ('pending_upload', 'uploaded', 'rejected');

-- CreateEnum
CREATE TYPE "TournamentStatus" AS ENUM ('draft', 'open', 'closed', 'running', 'finished');

-- CreateEnum
CREATE TYPE "Discipline" AS ENUM ('MS', 'WS', 'MD', 'WD', 'XD');

-- CreateEnum
CREATE TYPE "EntryStatus" AS ENUM ('active', 'reserve', 'withdrawn');

-- CreateEnum
CREATE TYPE "DrawKind" AS ENUM ('knockout', 'group');

-- CreateEnum
CREATE TYPE "DrawStatus" AS ENUM ('preview', 'published', 'discarded', 'superseded', 'locked');

-- CreateEnum
CREATE TYPE "SeedSource" AS ENUM ('server', 'committee');

-- CreateEnum
CREATE TYPE "MatchStage" AS ENUM ('group', 'knockout', 'third_place');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('scheduled', 'bye', 'reported', 'confirmed', 'walkover', 'void');

-- CreateEnum
CREATE TYPE "MatchResult" AS ENUM ('a_win', 'b_win', 'draw', 'walkover_a', 'walkover_b', 'void');

-- CreateEnum
CREATE TYPE "Qualification" AS ENUM ('qualified', 'best_third', 'out');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "display_name" VARCHAR(80) NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "deleted_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" UUID NOT NULL,
    "role" "Role" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "family_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "name_key" VARCHAR(120) NOT NULL,
    "short_name" VARCHAR(20),
    "status" "TeamStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_aliases" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "alias" VARCHAR(120) NOT NULL,
    "alias_key" VARCHAR(120) NOT NULL,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_requests" (
    "id" UUID NOT NULL,
    "requested_by" UUID NOT NULL,
    "text" VARCHAR(120) NOT NULL,
    "text_key" VARCHAR(120) NOT NULL,
    "status" "TeamRequestStatus" NOT NULL DEFAULT 'pending',
    "resolved_team_id" UUID,
    "resolved_by" UUID,
    "resolved_at" TIMESTAMPTZ(3),
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_memberships" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "valid_from" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_to" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rubrics" (
    "id" UUID NOT NULL,
    "method_version" TEXT NOT NULL,
    "criteria" JSONB NOT NULL,
    "params" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rubrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessments" (
    "id" UUID NOT NULL,
    "subject_user_id" UUID NOT NULL,
    "event_id" UUID,
    "rubric_id" UUID,
    "status" "AssessmentStatus" NOT NULL DEFAULT 'draft',
    "reviews_required" SMALLINT NOT NULL DEFAULT 3,
    "submitted_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_transitions" (
    "id" UUID NOT NULL,
    "assessment_id" UUID NOT NULL,
    "from_status" "AssessmentStatus" NOT NULL,
    "to_status" "AssessmentStatus" NOT NULL,
    "actor_id" UUID,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assessment_transitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clips" (
    "id" UUID NOT NULL,
    "assessment_id" UUID NOT NULL,
    "object_key" TEXT NOT NULL,
    "status" "ClipStatus" NOT NULL DEFAULT 'pending_upload',
    "content_type" TEXT,
    "size_bytes" BIGINT,
    "sha256" CHAR(64),
    "duration_sec" INTEGER,
    "upload_expires_at" TIMESTAMPTZ(3),
    "purge_after" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_assignments" (
    "id" UUID NOT NULL,
    "assessment_id" UUID NOT NULL,
    "reviewer_id" UUID NOT NULL,
    "state" "AssignmentState" NOT NULL DEFAULT 'open',
    "due_at" TIMESTAMPTZ(3) NOT NULL,
    "decline_reason" TEXT,
    "assigned_by" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" UUID NOT NULL,
    "assignment_id" UUID NOT NULL,
    "comment" VARCHAR(2000),
    "overall" DECIMAL(6,4),
    "abstained" BOOLEAN NOT NULL DEFAULT false,
    "submitted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_scores" (
    "review_id" UUID NOT NULL,
    "criterion" VARCHAR(40) NOT NULL,
    "grade_index" SMALLINT,

    CONSTRAINT "review_scores_pkey" PRIMARY KEY ("review_id","criterion")
);

-- CreateTable
CREATE TABLE "assessment_results" (
    "id" UUID NOT NULL,
    "assessment_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "source" "ResultSource" NOT NULL,
    "status" "ResultStatus" NOT NULL,
    "score" DECIMAL(6,4),
    "margin" DECIMAL(6,4),
    "lower_index" SMALLINT,
    "upper_index" SMALLINT,
    "center_index" SMALLINT,
    "kind" "GradeKind",
    "label" VARCHAR(20),
    "n_raters" SMALLINT NOT NULL,
    "n_excluded" SMALLINT NOT NULL DEFAULT 0,
    "spread" DECIMAL(6,4),
    "flags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "method_version" TEXT NOT NULL,
    "inputs" JSONB NOT NULL,
    "reason" TEXT,
    "expires_at" TIMESTAMPTZ(3),
    "computed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "computed_by" UUID,

    CONSTRAINT "assessment_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rater_agreement_snapshots" (
    "id" UUID NOT NULL,
    "window" VARCHAR(10) NOT NULL,
    "window_start" TIMESTAMPTZ(3) NOT NULL,
    "window_end" TIMESTAMPTZ(3) NOT NULL,
    "method_version" TEXT NOT NULL,
    "fleiss_kappa_tier" DECIMAL(6,4),
    "fleiss_n" INTEGER NOT NULL DEFAULT 0,
    "trigger" VARCHAR(10) NOT NULL,
    "computed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rater_agreement_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rater_stats" (
    "snapshot_id" UUID NOT NULL,
    "reviewer_id" UUID NOT NULL,
    "reviews" INTEGER NOT NULL,
    "bias" DECIMAL(6,4),
    "kappa_vs_consensus" DECIMAL(6,4),
    "kappa_n" INTEGER NOT NULL DEFAULT 0,
    "outlier_rate" DECIMAL(6,4),
    "flagged" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "rater_stats_pkey" PRIMARY KEY ("snapshot_id","reviewer_id")
);

-- CreateTable
CREATE TABLE "rater_pair_stats" (
    "snapshot_id" UUID NOT NULL,
    "reviewer_a" UUID NOT NULL,
    "reviewer_b" UUID NOT NULL,
    "cohen_kappa_quadratic" DECIMAL(6,4),
    "n_shared" INTEGER NOT NULL,

    CONSTRAINT "rater_pair_stats_pkey" PRIMARY KEY ("snapshot_id","reviewer_a","reviewer_b")
);

-- CreateTable
CREATE TABLE "tournaments" (
    "id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "venue" VARCHAR(160),
    "starts_on" DATE NOT NULL,
    "entries_close_at" TIMESTAMPTZ(3) NOT NULL,
    "status" "TournamentStatus" NOT NULL DEFAULT 'draft',
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tournaments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" UUID NOT NULL,
    "tournament_id" UUID NOT NULL,
    "discipline" "Discipline" NOT NULL,
    "grade_min_index" SMALLINT NOT NULL,
    "grade_max_index" SMALLINT NOT NULL,
    "max_entries" SMALLINT,
    "format" JSONB,
    "format_locked_at" TIMESTAMPTZ(3),
    "requires_fresh_assessment" BOOLEAN NOT NULL DEFAULT false,
    "min_reviewers" SMALLINT,
    "grades_disclosed_at" TIMESTAMPTZ(3),
    "grades_disclosed_by" UUID,
    "grades_disclosed_reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entries" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "status" "EntryStatus" NOT NULL DEFAULT 'active',
    "reserve_rank" SMALLINT,
    "withdrawn_at" TIMESTAMPTZ(3),
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entry_players" (
    "entry_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "grade_result_id" UUID,
    "grade_consent" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "entry_players_pkey" PRIMARY KEY ("entry_id","user_id")
);

-- CreateTable
CREATE TABLE "event_umpires" (
    "event_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "courts" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_umpires_pkey" PRIMARY KEY ("event_id","user_id")
);

-- CreateTable
CREATE TABLE "draws" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "kind" "DrawKind" NOT NULL DEFAULT 'knockout',
    "version" INTEGER NOT NULL,
    "status" "DrawStatus" NOT NULL DEFAULT 'preview',
    "seed" TEXT NOT NULL,
    "seed_source" "SeedSource" NOT NULL,
    "input_hash" CHAR(64) NOT NULL,
    "snapshot" JSONB NOT NULL,
    "ruleset_version" TEXT NOT NULL,
    "prng_id" TEXT NOT NULL,
    "size" SMALLINT NOT NULL,
    "seeds_count" SMALLINT NOT NULL,
    "same_team_r1_count" SMALLINT NOT NULL DEFAULT 0,
    "minimum_possible_conflicts" SMALLINT NOT NULL DEFAULT 0,
    "proven_minimal" BOOLEAN NOT NULL DEFAULT true,
    "conflicts" JSONB NOT NULL DEFAULT '[]',
    "conflicts_acknowledged_by" UUID,
    "conflicts_acknowledged_at" TIMESTAMPTZ(3),
    "search_stats" JSONB,
    "reason" TEXT,
    "source_group_draw_id" UUID,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "draws_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "draw_slots" (
    "draw_id" UUID NOT NULL,
    "position" SMALLINT NOT NULL,
    "entry_id" UUID,
    "seed_no" SMALLINT,

    CONSTRAINT "draw_slots_pkey" PRIMARY KEY ("draw_id","position")
);

-- CreateTable
CREATE TABLE "groups" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "draw_id" UUID NOT NULL,
    "label" VARCHAR(4) NOT NULL,

    CONSTRAINT "groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_members" (
    "group_id" UUID NOT NULL,
    "entry_id" UUID NOT NULL,
    "seed_in_group" SMALLINT NOT NULL,
    "pot" SMALLINT NOT NULL,

    CONSTRAINT "group_members_pkey" PRIMARY KEY ("group_id","entry_id")
);

-- CreateTable
CREATE TABLE "matches" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "draw_id" UUID NOT NULL,
    "stage" "MatchStage" NOT NULL,
    "group_id" UUID,
    "round" SMALLINT NOT NULL,
    "match_no" SMALLINT NOT NULL,
    "court" VARCHAR(20),
    "umpire_id" UUID,
    "top_entry_id" UUID,
    "bottom_entry_id" UUID,
    "games" JSONB,
    "result" "MatchResult",
    "winner_entry_id" UUID,
    "status" "MatchStatus" NOT NULL DEFAULT 'scheduled',
    "result_version" INTEGER NOT NULL DEFAULT 0,
    "reported_by" UUID,
    "reported_at" TIMESTAMPTZ(3),
    "confirmed_by" UUID,
    "confirmed_at" TIMESTAMPTZ(3),
    "flags" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_standings" (
    "group_id" UUID NOT NULL,
    "entry_id" UUID NOT NULL,
    "rank" SMALLINT NOT NULL,
    "played" SMALLINT NOT NULL,
    "won" SMALLINT NOT NULL,
    "drawn" SMALLINT NOT NULL,
    "lost" SMALLINT NOT NULL,
    "points" SMALLINT NOT NULL,
    "points_for" INTEGER NOT NULL,
    "points_against" INTEGER NOT NULL,
    "diff" INTEGER NOT NULL,
    "tiebreak_note" TEXT,
    "qualification" "Qualification" NOT NULL,
    "confirmed_by" UUID NOT NULL,
    "confirmed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_standings_pkey" PRIMARY KEY ("group_id","entry_id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actor_id" UUID,
    "action" VARCHAR(60) NOT NULL,
    "entity_type" VARCHAR(40) NOT NULL,
    "entity_id" VARCHAR(64) NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "reason" TEXT,
    "ip" VARCHAR(45),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_family_id_idx" ON "refresh_tokens"("family_id");

-- CreateIndex
CREATE UNIQUE INDEX "teams_name_key_key" ON "teams"("name_key");

-- CreateIndex
CREATE UNIQUE INDEX "team_aliases_alias_key_key" ON "team_aliases"("alias_key");

-- CreateIndex
CREATE INDEX "team_aliases_team_id_idx" ON "team_aliases"("team_id");

-- CreateIndex
CREATE INDEX "team_requests_status_idx" ON "team_requests"("status");

-- CreateIndex
CREATE INDEX "team_memberships_user_id_valid_from_idx" ON "team_memberships"("user_id", "valid_from");

-- CreateIndex
CREATE INDEX "team_memberships_team_id_idx" ON "team_memberships"("team_id");

-- CreateIndex
CREATE UNIQUE INDEX "rubrics_method_version_key" ON "rubrics"("method_version");

-- CreateIndex
CREATE INDEX "assessments_subject_user_id_created_at_idx" ON "assessments"("subject_user_id", "created_at");

-- CreateIndex
CREATE INDEX "assessments_status_idx" ON "assessments"("status");

-- CreateIndex
CREATE INDEX "assessments_event_id_idx" ON "assessments"("event_id");

-- CreateIndex
CREATE INDEX "assessment_transitions_assessment_id_created_at_idx" ON "assessment_transitions"("assessment_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "clips_object_key_key" ON "clips"("object_key");

-- CreateIndex
CREATE UNIQUE INDEX "clips_assessment_id_sha256_key" ON "clips"("assessment_id", "sha256");

-- CreateIndex
CREATE INDEX "review_assignments_reviewer_id_state_idx" ON "review_assignments"("reviewer_id", "state");

-- CreateIndex
CREATE INDEX "review_assignments_assessment_id_idx" ON "review_assignments"("assessment_id");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_assignment_id_key" ON "reviews"("assignment_id");

-- CreateIndex
CREATE INDEX "assessment_results_status_computed_at_idx" ON "assessment_results"("status", "computed_at");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_results_assessment_id_version_key" ON "assessment_results"("assessment_id", "version");

-- CreateIndex
CREATE INDEX "rater_agreement_snapshots_computed_at_idx" ON "rater_agreement_snapshots"("computed_at");

-- CreateIndex
CREATE UNIQUE INDEX "events_tournament_id_discipline_grade_min_index_grade_max_i_key" ON "events"("tournament_id", "discipline", "grade_min_index", "grade_max_index");

-- CreateIndex
CREATE INDEX "entries_event_id_status_idx" ON "entries"("event_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "entry_players_event_id_user_id_key" ON "entry_players"("event_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "draws_event_id_kind_version_key" ON "draws"("event_id", "kind", "version");

-- CreateIndex
CREATE UNIQUE INDEX "draw_slots_draw_id_entry_id_key" ON "draw_slots"("draw_id", "entry_id");

-- CreateIndex
CREATE UNIQUE INDEX "groups_draw_id_label_key" ON "groups"("draw_id", "label");

-- CreateIndex
CREATE INDEX "matches_event_id_status_idx" ON "matches"("event_id", "status");

-- CreateIndex
CREATE INDEX "matches_umpire_id_status_idx" ON "matches"("umpire_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "matches_draw_id_match_no_key" ON "matches"("draw_id", "match_no");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_created_at_idx" ON "audit_logs"("entity_type", "entity_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_created_at_idx" ON "audit_logs"("actor_id", "created_at");

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_aliases" ADD CONSTRAINT "team_aliases_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_memberships" ADD CONSTRAINT "team_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_memberships" ADD CONSTRAINT "team_memberships_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_subject_user_id_fkey" FOREIGN KEY ("subject_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_rubric_id_fkey" FOREIGN KEY ("rubric_id") REFERENCES "rubrics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_transitions" ADD CONSTRAINT "assessment_transitions_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clips" ADD CONSTRAINT "clips_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_assignments" ADD CONSTRAINT "review_assignments_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_assignments" ADD CONSTRAINT "review_assignments_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "review_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_scores" ADD CONSTRAINT "review_scores_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "reviews"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_results" ADD CONSTRAINT "assessment_results_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rater_stats" ADD CONSTRAINT "rater_stats_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "rater_agreement_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rater_pair_stats" ADD CONSTRAINT "rater_pair_stats_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "rater_agreement_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entries" ADD CONSTRAINT "entries_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entry_players" ADD CONSTRAINT "entry_players_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entry_players" ADD CONSTRAINT "entry_players_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entry_players" ADD CONSTRAINT "entry_players_grade_result_id_fkey" FOREIGN KEY ("grade_result_id") REFERENCES "assessment_results"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_umpires" ADD CONSTRAINT "event_umpires_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draws" ADD CONSTRAINT "draws_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draw_slots" ADD CONSTRAINT "draw_slots_draw_id_fkey" FOREIGN KEY ("draw_id") REFERENCES "draws"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "groups" ADD CONSTRAINT "groups_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "groups" ADD CONSTRAINT "groups_draw_id_fkey" FOREIGN KEY ("draw_id") REFERENCES "draws"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_draw_id_fkey" FOREIGN KEY ("draw_id") REFERENCES "draws"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_standings" ADD CONSTRAINT "group_standings_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- Constraints Prisma cannot express (bl-07). Covered by test/schema-constraints.e2e-spec.ts.
-- ============================================================================

-- Grade ladder indices 0..14 and INV-2 (lower <= center <= upper) at the database level.
ALTER TABLE "assessment_results"
  ADD CONSTRAINT "assessment_results_ladder_chk" CHECK (
    ("lower_index"  IS NULL OR "lower_index"  BETWEEN 0 AND 14) AND
    ("center_index" IS NULL OR "center_index" BETWEEN 0 AND 14) AND
    ("upper_index"  IS NULL OR "upper_index"  BETWEEN 0 AND 14) AND
    ("lower_index" IS NULL OR "center_index" IS NULL OR "lower_index" <= "center_index") AND
    ("center_index" IS NULL OR "upper_index" IS NULL OR "center_index" <= "upper_index")
  ),
  ADD CONSTRAINT "assessment_results_score_chk" CHECK (
    ("score" IS NULL OR ("score" >= 0 AND "score" < 15)) AND ("margin" IS NULL OR "margin" >= 0)
  ),
  -- a numeric result is all-or-nothing; only needs_reviewers may carry no numbers (G15)
  ADD CONSTRAINT "assessment_results_shape_chk" CHECK (
    ("score" IS NULL AND "margin" IS NULL AND "lower_index" IS NULL AND "center_index" IS NULL
       AND "upper_index" IS NULL AND "kind" IS NULL AND "label" IS NULL AND "status" = 'needs_reviewers')
    OR
    ("score" IS NOT NULL AND "margin" IS NOT NULL AND "lower_index" IS NOT NULL AND "center_index" IS NOT NULL
       AND "upper_index" IS NOT NULL AND "kind" IS NOT NULL AND "label" IS NOT NULL)
  ),
  ADD CONSTRAINT "assessment_results_override_reason_chk" CHECK (
    "source" <> 'override' OR char_length(btrim(coalesce("reason", ''))) >= 20
  );

ALTER TABLE "review_scores"
  ADD CONSTRAINT "review_scores_grade_index_chk" CHECK ("grade_index" IS NULL OR "grade_index" BETWEEN 0 AND 14);

ALTER TABLE "events"
  ADD CONSTRAINT "events_grade_range_chk" CHECK (
    "grade_min_index" BETWEEN 0 AND 14 AND "grade_max_index" BETWEEN 0 AND 14
    AND "grade_min_index" <= "grade_max_index"
  ),
  ADD CONSTRAINT "events_max_entries_chk" CHECK ("max_entries" IS NULL OR "max_entries" BETWEEN 2 AND 256);

ALTER TABLE "team_memberships"
  ADD CONSTRAINT "team_memberships_range_chk" CHECK ("valid_to" IS NULL OR "valid_to" > "valid_from");

-- One published draw per event and kind (DR-14: a concurrent second publish fails with a unique violation -> 409).
CREATE UNIQUE INDEX "draws_one_published_per_event_kind"
  ON "draws" ("event_id", "kind") WHERE "status" = 'published';

-- A reviewer holds at most one live assignment per assessment.
CREATE UNIQUE INDEX "review_assignments_one_live_per_reviewer"
  ON "review_assignments" ("assessment_id", "reviewer_id") WHERE "state" IN ('open', 'submitted');

-- Exactly one active rubric version.
CREATE UNIQUE INDEX "rubrics_one_active" ON "rubrics" ("active") WHERE "active";

-- One open membership per (player, team); concurrent memberships in different teams are allowed (A11).
CREATE UNIQUE INDEX "team_memberships_one_open_per_team"
  ON "team_memberships" ("user_id", "team_id") WHERE "valid_to" IS NULL;

-- Append-only tables: block UPDATE and DELETE for every role (the app role owns the tables, so REVOKE
-- alone would not hold). TRUNCATE stays possible for maintenance and test resets.
CREATE FUNCTION "forbid_mutation"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'APPEND_ONLY: % on % is not allowed', TG_OP, TG_TABLE_NAME
    USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER "assessment_results_append_only" BEFORE UPDATE OR DELETE ON "assessment_results"
  FOR EACH ROW EXECUTE FUNCTION "forbid_mutation"();
CREATE TRIGGER "assessment_transitions_append_only" BEFORE UPDATE OR DELETE ON "assessment_transitions"
  FOR EACH ROW EXECUTE FUNCTION "forbid_mutation"();
CREATE TRIGGER "audit_logs_append_only" BEFORE UPDATE OR DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION "forbid_mutation"();
CREATE TRIGGER "group_standings_append_only" BEFORE UPDATE OR DELETE ON "group_standings"
  FOR EACH ROW EXECUTE FUNCTION "forbid_mutation"();
