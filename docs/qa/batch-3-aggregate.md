# QA Batch 3: aggregateAssessment (bl-12 / GR-05..30)

## Overview
- **Branch**: `tester/bl-12-gr-aggregate`
- **Suite**: `packages/shared/src/grading/qa/gr-aggregate.test.ts` (34 test cases, 387 lines)
- **Target Cases**: GR-05, GR-06, GR-07, GR-12, GR-21, GR-23, GR-24, GR-25, GR-28, GR-29, GR-30
- **Scope**: Multi-rater aggregation pipeline testing `aggregateAssessment(scores, minReviewers)` against `docs/specs/grading.md` §12.5 and Appendix ค golden values.
- **Constraints**: Tests/docs only. Zero modifications to product code (`packages/shared/src/grading/aggregate.ts`).

---

## Cases Covered

| Case ID | Description | Golden / Boundary | Spec Ref |
|---|---|---|---|
| **GR-05** | Null / empty result handling | Empty scores → `needs_reviewers`, `< minReviewers` after exclusion → `needs_reviewers` | §12.5 |
| **GR-06** | `minReviewers` parametrization (1–5) | minReviewers=1 allows n=1; minReviewers=2 rejects n=1; minReviewers=3 requires n≥3; throws `GRADING_INVALID_MIN_REVIEWERS` for 0, 6, non-int | §12.1, §12.5 |
| **GR-07** | Single rater (n=1) | `SINGLE_REVIEWER` flag, no outlier detection, no kappa | §12.5 row 1 |
| **GR-12** | Complete result shape | Structure: `status`, `score`, `margin`, `grade` (lower, upper, center, kind, label), `nRaters`, `excludedIndexes`, `flags`, `spread`, `suggestThirdReviewer` | §12.5, bad8bit |
| **GR-21** | Single rater provisional | v=7.83, minReviewers=1 → score 7.83, fixed margin 1.0, wide `S-–S+`, `provisional` | §12.5 row 1 |
| **GR-23** | n=2 exact & straddle cases | [7.50, 7.50] → 7.50/0.50 exact S; [7.50, 7.83] → 7.665/0.50 straddle S/S+; [7.50, 8.50] → 8.00/0.75 straddle S/S+ | §12.5 row 2 |
| **GR-24** | n=2 boundary at gap 2.0 | gap = 2.0 → `pending_approval`, margin 1.25, suggestThirdReviewer=false; gap > 2.0 (2.01+) → `disputed`, `PAIR_DISAGREEMENT`, suggestThirdReviewer=true | §12.5 row 3 |
| **GR-25** | n=2 large disagreement | [6.50, 9.00] → 7.75/1.50 wide `S-–N-`, `disputed`, `PAIR_DISAGREEMENT` | §12.5 row 4 |
| **GR-28** | Routing table n (0..4) × minReviewers (1..5) | Full matrix routing across provisional, pending_approval, needs_reviewers | §12.5 matrix |
| **GR-29** | 3 scores with 1 outlier | [7.50, 7.50, 11.50] with minReviewers=3: excludes 11.50, leaves 2 < 3 → `needs_reviewers`, `OUTLIER_EXCLUDED`. Pin: minReviewers=2 uses pair route (`pending_approval`, exact S) | §12.5 row 7, App ค.5 |
| **GR-30** | Appendix ค golden fixtures | ค.1: [7.50, 7.50, 7.83] → 7.61/0.25 exact S; ค.2: [7.50, 7.50, 8.50] → 7.83/0.63 straddle S/S+; ค.3: [7.50, 7.83, 8.17, 11.00] → excludes 11.00 → 7.83/0.36 straddle S/S+; ค.4: [6.50, 7.50, 9.50] → 7.83/1.66 wide S-–N- disputed | App ค.1–ค.4 |

---

## 3x Consecutive Green Runs (Consistency Verification)

Command: `pnpm --filter @blulens/shared test` (vitest run)

### Run 1
```
Test Files  28 passed (28)
     Tests  320 passed (320)
  Duration  3.65s (tests 1.16s)
```

### Run 2
```
Test Files  28 passed (28)
     Tests  320 passed (320)
  Duration  4.13s (tests 1.11s)
```

### Run 3
```
Test Files  28 passed (28)
     Tests  320 passed (320)
  Duration  3.40s (tests 905ms)
```

**Result**: 320/320 tests passed consistently across all 3 runs (0 flakes).

---

## Mutation Testing Table

To guarantee anti-vacuity, 4 hand mutations were applied to `packages/shared/src/grading/aggregate.ts` and tested with `pnpm --filter @blulens/shared test`. All mutations were observed to fail specific named GR cases and were subsequently reverted.

| Mutation # | Target Function / Logic | Mutation Applied to `aggregate.ts` | Expected Failure | Observed Failure (GR Test Cases) | Revert Verified |
|---|---|---|---|---|---|
| **M1** | Outlier exclusion (`scores.length >= 3`) | Disabled outlier exclusion by injecting `if (false as boolean && scores.length >= 3)` | Tests relying on outlier filtering fail | **FAIL** (6 tests):<br>• `GR-05: < minReviewers after outlier exclusion → needs_reviewers`<br>• `GR-29: [7.50, 7.50, 11.50] excludes 11.50, leaves 2 < 3 → needs_reviewers`<br>• `GR-29: same with minReviewers=2: n=2 == minReviewers so uses pair route`<br>• `GR-30: ค.3 (outlier path) [7.50, 7.83, 8.17, 11.00]` | ✅ Clean diff (`git diff` empty) |
| **M2** | Min reviewer threshold check | Off-by-one error: changed `if (K.length < minReviewers)` to `if (K.length <= minReviewers)` | Exact matches of n == minReviewers wrongly rejected as `needs_reviewers` | **FAIL** (15 tests, 13 in `gr-aggregate`):<br>• `GR-06: minReviewers=1 allows n=1 to compute`<br>• `GR-06: minReviewers=3 requires n≥3 after exclusion`<br>• `GR-07: n=1 has SINGLE_REVIEWER flag`<br>• `GR-21: single rater v=7.83, minReviewers=1`<br>• `GR-23: case 1, case 2, case 3`<br>• `GR-24: boundary ≤2.0 and >2.0`<br>• `GR-25: n=2 large disagreement`<br>• `GR-28: routing table n=1, n=2`<br>• `GR-29: same with minReviewers=2` | ✅ Clean diff (`git diff` empty) |
| **M3** | Pair disagreement threshold | Widened threshold: changed `gap > 2.0 + OUTLIER_EPSILON` to `gap > 3.0 + OUTLIER_EPSILON` | Pair disagreement at gap > 2.0 not flagged as `disputed` | **FAIL** (3 tests):<br>• `GR-24: gap > 2.0 (2.01+) → disputed with PAIR_DISAGREEMENT`<br>• `GR-25: [6.50, 9.00] → 7.75 / 1.50 wide S-–N-, disputed` | ✅ Clean diff (`git diff` empty) |
| **M4** | Single-reviewer provisional margin | Changed fixed provisional margin from `margin = 1.0;` to `margin = 0.5;` | Provisional margin assertion fails | **FAIL** (2 tests):<br>• `GR-21: single rater v=7.83, minReviewers=1: score 7.83, margin 1.0, provisional` | ✅ Clean diff (`git diff` empty) |

---

## Pinned Status & Open Items
- **GR-29 (n=2 after exclusion)**:
  - Input `[7.5, 7.5, 11.5]` with `minReviewers = 3`: 11.5 excluded, 2 remaining < 3 → returns `needs_reviewers` (verified).
  - Input `[7.5, 7.5, 11.5]` with `minReviewers = 2`: 11.5 excluded, 2 remaining == 2 → executes pair route returning `pending_approval` with exact S (pinned as current behavior pending Jim confirmation).
- **Zero Product Code Modifications**: `git diff packages/shared/src/grading/aggregate.ts` is 100% clean.
