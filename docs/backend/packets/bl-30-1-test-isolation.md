PACKET bl-30-1: API e2e test isolation (tests only): rater-stats leak breaks list-assessments; rater-stats fails on a reused DB

Assignee: Angela (angela-muxswccx) · Reviewer: Oscar (oscar-muxt974o) · Senior: Kevin (kevin-muxsqdkp)
PRIORITY P0: the merge gate (gate.sh) is RED on develop, so nothing can merge until this lands.
FACTS: (Kelly, 5 runs) list-assessments.e2e-spec 'Committee sees assessments of 2 members with reviewsSubmitted batched'
  fails when rater-stats.e2e-spec ran first: rater-stats seeds 16 finalized assessments and never deletes them, pushing
  the list fixture past the default limit=20. (Kevin) rater-stats.e2e-spec alone fails 3/6 on the shared test DB, because
  its assertions count rows created by EARLIER runs (leftover reviews in the 90d/30d windows).
STATE: branch dev/bl-30-test-isolation from origin/develop. Results/transitions are append-only in prod code, but test
  cleanup may delete test-created rows children-first (see assessment-subject-fields.e2e-spec.ts afterAll).
SPEC (files ONLY under apps/api/test/; NO src changes):
  1) list-assessments.e2e-spec.ts: every list call that asserts on specific fixtures filters by subjectUserId (or uses
     limit=100 and finds by id); never depend on global ordering or the total count.
  2) rater-stats.e2e-spec.ts: (a) afterAll deletes everything it created, children first: review scores, reviews,
     review assignments, assessment results, assessment transitions, clips, assessments; then disable or delete users
     like the other specs. (b) make every assertion count only THIS run's reviewer ids: filter raters and pairs by
     [rev1, rev2, rev3]; in the Reviewer-caller test assert the single row is rev1 and pairs is []; panel n assertions
     use >= so leftovers of older runs cannot break them.
  3) grep the other specs that create assessments (aggregate-on-submit, assessment-decisions, assessment-override,
     review-submit, reviews, assessment-detail, assignment-detail, assessment-subject-fields) for the same leak (rows
     never deleted that a global list or count could see); fix only real leaks, same style.
TEST: run the WHOLE suite TWICE in a row on the same DB with runInBand (cd apps/api && pnpm test -- --runInBand, twice)
  plus once normally: all green each time. Paste the 3 Tests: lines.
DONE: push dev/bl-30-test-isolation, verify on origin, done message to Kevin (sha + the 3 Tests: lines).
