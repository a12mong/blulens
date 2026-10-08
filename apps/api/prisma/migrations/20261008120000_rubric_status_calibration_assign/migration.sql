-- bl-34 (god-approved 2026-10-08, additive): rubric draft/active/retired status (S12) and
-- calibration set period + assignment freeze (S16). No drop/rename; nullable columns only.

-- Rubric status is derived: active -> 'active'; activated_at set -> 'retired'; else 'draft'.
ALTER TABLE "rubrics" ADD COLUMN "activated_at" TIMESTAMPTZ(3);

-- Every rubric that existed before the editor was a seeded or activated version, never a draft.
-- Guarded, so re-running is a no-op.
UPDATE "rubrics" SET "activated_at" = "created_at" WHERE "activated_at" IS NULL;

-- A row that becomes active always gets activated_at, so deactivating it makes it retired, never a draft.
CREATE FUNCTION rubrics_stamp_activated_at() RETURNS trigger AS $$
BEGIN
  IF NEW."active" AND NEW."activated_at" IS NULL THEN
    NEW."activated_at" := now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER rubrics_stamp_activated_at
  BEFORE INSERT OR UPDATE ON "rubrics"
  FOR EACH ROW EXECUTE FUNCTION rubrics_stamp_activated_at();

-- At most one open draft (one active is already enforced by rubrics_one_active).
CREATE UNIQUE INDEX "rubrics_one_draft" ON "rubrics" ((true)) WHERE NOT "active" AND "activated_at" IS NULL;

ALTER TABLE "calibration_sets" ADD COLUMN "period" VARCHAR(16);
ALTER TABLE "calibration_sets" ADD COLUMN "assigned_at" TIMESTAMPTZ(3);
