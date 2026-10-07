# bl-11 FE backlog (index) — Andy

One row = one micro-task packet (one component or one page, one proving test). Individual packet files `bl-11-<n>-<slug>.md` are written per row just before dispatch, using docs/frontend/packets template; spec screen = docs/design/screens/S*.md; field names only from docs/api/openapi.yaml. Branches `fe/bl-11-<slug>`.

## Wave 1 (after bl-08 merged)

| # | Task | Screen/spec | Owner (planned) |
|---|---|---|---|
| 1.1 | AppShell + SideNav per role (6 roles) + role switcher for multi-role users | S01, README matrix | Andy |
| 1.2 | Login page + form | S02 | Phyllis |
| 1.3 | Register page + form | S02 | Phyllis |
| 1.4 | Role guard layouts per route group (403 page) | arch §3 | Andy |
| 1.5 | TeamCombobox (type-ahead, "request new team" row) | S05, arch §6.6 | Darryl |
| 1.6 | MultiTeamWarning (count of teams the player already belongs to) | S05, A11 | Ryan |
| 1.7 | Member profile page (teams, current grade) | S05/S11 | Phyllis |
| 1.8 | AssessmentRequest page (create + submit) | S11 | Ryan |
| 1.9 | ClipUploader (presigned PUT, progress, type/size/length check) | arch §6.4 | Darryl |
| 1.10 | VideoPlayer (signed URL, expiry refetch, speed, step) | arch §6.4 | Ryan |
| 1.11 | GradeBand: provisional + disputed states | grading v2 §12 | Darryl |
| 1.12 | SecondOpinionButton (once, 14-day remaining time) | grading v2 G20 | Phyllis |
| 1.13 | MyResults page (GradeView, status, polling 30s) | S11 | Phyllis |
| 1.14 | ReviewerQueue page (assignments list) | S06 | Ryan |
| 1.15 | RubricScorer: 15-rung picker grouped by tier + N/A (one criterion) | S07 | Darryl |
| 1.16 | ReviewScoring page (6 criteria, local draft, submit, immutable) | S07 | Phyllis |
| 1.17 | Playwright smoke per role (login -> home) | QA | Andy + Toby |

## Wave 2 — Committee

2.1 ApprovalQueue page (approve/return) · 2.2 OverrideDialog (reason required) · 2.3 ConfirmProvisional button · 2.4 BiasKappaPanel (per reviewer + pair) · 2.5 CalibrationSets list/create · 2.6 CalibrationClipUpload + reference grade · 2.7 CalibrationAssign + results table · 2.8 TeamRequests resolve (approve/alias) · 2.9 EventForm incl. minReviewers (S03) · 2.10 EventManage (S04) · 2.11 DrawPreview + conflict acknowledgement · 2.12 DrawPublish · 2.13 GroupPreview/confirm · 2.14 ResultsQueue (approve/reject + reason, flags) (S14) · 2.15 UmpireAssignment with courts (S15) · 2.16 Rubric editor (S12) · 2.17 Committee dashboard (S08) · 2.18 Grade transparency/disclose action (A14, audited).

## Wave 3 — Umpire and public

3.1 UmpireMatches (mobile-first) (S13) · 3.2 ScoreEntryForm validated by MatchFormat · 3.3 Public EventList (S01) · 3.4 BracketView with "awaiting confirmation" badge (S10) · 3.5 GroupStandings table · 3.6 Grade visibility per entry (consent toggle at registration, A14).

## Open dependencies

- Stitch exports for visual source (docs/design/stitch/<screen>/): not landed yet. Packets for 1.x can start on plain tokens; polish is a later pass.
- Pam: Umpire column in README role matrix + whether Admin has its own nav items (user admin, audit).
- Jim: confirm endpoint names for second opinion / confirm provisional / calibration in openapi (regenerated client needed: pnpm gen:api).
