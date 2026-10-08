PACKET bl-35-6: GET /api/v1/calibration-sets/{setId}/results (bias vs the reference grade per reviewer)

Assignee: Creed (creed-muxswjfu), after bl-35-5 · Reviewer: Oscar (oscar-muxt974o) · Senior: Kevin (kevin-muxsqdkp)
GOAL: the Committee sees how far each reviewer's calibration scores sit from the reference grades.
STATE: branch dev/bl-35-calibration-results from origin/develop after bl-35-5 merges. Review { assignmentId, overall
  Decimal? (ladder units, null when abstained), abstained }. Calibration assignment -> calibrationClip.referenceIndex.
SOURCES: openapi /calibration-sets/{setId}/results: array of { reviewerId, clipsScored, biasVsReference, meanAbsError };
  biasVsReference = mean(overall - (referenceIndex + 0.5)) in ladder units (grading.md §12.4).
SPEC (files ONLY: calibration.controller.ts, calibration.service.ts, apps/api/test/calibration-results.e2e-spec.ts NEW):
  - @Roles('Committee','Admin'); missing set -> 404 CALIBRATION_SET_NOT_FOUND.
  - ONE review.findMany where { abstained: false, overall: not null, assignment: { kind: 'calibration',
    calibrationClip: { setId } } } selecting overall, assignment.reviewerId, assignment.calibrationClip.referenceIndex.
  - per reviewer: d_i = Number(overall) - (referenceIndex + 0.5); clipsScored = count; biasVsReference = mean(d_i);
    meanAbsError = mean(|d_i|); both rounded to 3 decimals. Reviewers with no scored clip are omitted.
    Order by reviewerId asc.
  Test: set with clips ref 'S' (index 7) and 'N' (index 10); reviewer A overall 8.0 and 10.0 -> d = 0.5 and -0.5 ->
    bias 0, MAE 0.5, clipsScored 2; reviewer B overall 7.5 on 'S' and abstained on 'N' -> clipsScored 1, bias 0, MAE 0;
    reviewer C with assignments but no review -> absent. Create reviews via prisma (fields as in
    test/rater-stats.e2e-spec.ts). Unknown set -> 404; Reviewer -> 403.
TOOLS: pnpm --filter @blulens/api db:generate; pnpm --filter @blulens/shared build; cd apps/api && pnpm build && pnpm lint && TEST_DATABASE_URL=<fresh *_test db> pnpm test
DONE: push, verify on origin, done message to Kevin (sha + test names + FULL pnpm test line on a fresh test DB).
