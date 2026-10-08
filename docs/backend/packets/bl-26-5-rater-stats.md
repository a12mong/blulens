PACKET bl-26-5: rater agreement stats: (a) pure computeRaterStats in shared, (b) GET /rater-stats

Assignee: Meredith (meredith-muxtbonw), two branches, (a) first · Reviewer: Oscar (oscar-muxt974o)
Senior: Jim while Kevin is paused (jim-muxspl2j) · Tell on merge of (b): Andy (andy-muxsqkra), for the Committee rater dashboard.

GOAL: the Committee sees how consistent each reviewer is (bias, kappa vs consensus, outlier rate, flag), the
  pairwise kappa, and the panel's Fleiss kappa (grading.md §5, appendix B.6-B.8). Kappa is for monitoring reviewers
  only; it never changes a player's score.

SOURCES (grading.md §5 + appendix B, pasted):
  Review value v = Review.overall (ladder units 0..14.99); abstained reviews (overall null) are ignored everywhere.
  Category of a review for Cohen = floor(v) (0..14). Category for Fleiss = floor(floor(v) / 3) (tier 0..4).
  Reviewer vs consensus (Cohen quadratic, 15 categories): for each case the reviewer scored that has >= 2 OTHER valid
    reviews: pair [floor(v_r), floor(mean(v of the others))]. Shown when the reviewer has >= 15 reviews in the window.
  Pair (Cohen quadratic, 15 categories): the cases both scored; shown when >= 10 shared cases.
  Panel (Fleiss, 5 tiers): every case with >= 2 valid reviews; shown when >= 20 cases.
  Bias_r = mean over r's cases that have >= 1 other valid review of (v_r - mean(v of the others)). Shown at >= 15 reviews.
  Outlier rate = times excluded as an outlier / reviews (excluded reviews STILL count everywhere). Shown at >= 15.
  Flag (only when reviews >= 15): kappaVsConsensus < 0.40 OR |bias| > 1.0 OR outlierRate > 0.20.
  Band (Landis & Koch): kappa < 0.21 poor · 0.21-0.40 fair · 0.41-0.60 moderate · 0.61-0.80 substantial ·
    > 0.80 almost_perfect · below the minimum sample OR kappa null (undefined, G12) -> band 'insufficient', kappa null.
    Never show an undefined kappa as 1.0.
  openapi RaterStats = { window, methodVersion, panel: { fleissKappaTier: AgreementValue },
    raters: [{ reviewerId, reviews, bias, kappaVsConsensus: AgreementValue, outlierRate, flagged }],
    pairs: [{ a, b, cohenKappaQuadratic: AgreementValue }] } · AgreementValue = { kappa|null, n, band }.

(a) SHARED, branch dev/bl-26-rater-stats-core from origin/develop.
  Files ONLY: packages/shared/src/grading/rater-stats.ts (new), rater-stats.test.ts (new), grading/index.ts (+ export).
  export interface RaterCase { caseId: string; reviews: { reviewerId: string; value: number; excluded: boolean }[] }
  export function computeRaterStats(cases: readonly RaterCase[]): { panel, raters, pairs } with the shapes above
    (no window/methodVersion: the API adds those). Use cohenKappaQuadratic and fleissKappa that already exist; add a
    small exported `kappaBand(kappa: number | null, n: number, min: number): AgreementValue`.
  Pure: no Date, no I/O. raters sorted by reviewerId; pairs only with a < b (string order), sorted by (a, b).
  bias / outlierRate are null below 15 reviews (contract types: send null, the web shows "ข้อมูลไม่พอ").
  Tests: a hand-checked 3-reviewer fixture (write the expected numbers in a comment); the minimum thresholds (14 vs 15
    reviews, 9 vs 10 shared cases, 19 vs 20 cases); all-same category -> kappa null + insufficient (G12); an excluded
    review still counts; an abstained review is ignored; the flag fires for each of the 3 reasons.

(b) API, branch dev/bl-26-rater-stats-api from origin/develop AFTER (a) merges.
  Files ONLY: apps/api/src/modules/rater-stats/{rater-stats.module.ts, rater-stats.controller.ts,
    rater-stats.service.ts} (new), app.module.ts (+ module), apps/api/test/rater-stats.e2e-spec.ts (new).
  GET /rater-stats?window=30d|90d|365d|all (default 90d), @Roles('Committee','Reviewer').
  Load cases live: submitted reviews whose submittedAt is inside the window, grouped by assessmentId, kind
    'assessment' only (calibration tasks are excluded, they have their own stats). excluded = the review's index is in
    the latest computed AssessmentResult.inputs.excludedIndexes (match by inputs.reviewIds). One query for reviews +
    one for the results (no N+1).
  methodVersion 'grading-v2'. Reviewer caller: raters = only their own row, pairs = [], panel kept (contract).
  No snapshot table writes in this packet (the nightly snapshot job is a later jobs packet).
  Test: seed 3 reviewers x 15+ cases cheaply through prisma (no HTTP per review); Committee sees 3 raters + 3 pairs;
    Reviewer sees only their own row and pairs []; Member -> 403; window=30d excludes an older review.
TOOLS: pnpm --filter @blulens/shared build && (cd packages/shared && npx vitest run); for (b) also
  pnpm --filter @blulens/api db:generate; cd apps/api && pnpm build && pnpm lint && pnpm test
DONE: push each branch, verify on origin, done message to Jim per branch (sha + result lines).
