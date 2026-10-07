# Packet bl-10 — BE endpoints backlog (Jim -> Kevin)

GOAL: implement every path in docs/api/openapi.yaml as thin NestJS controllers/services over the bl-07/07b schema and the shared pure functions (bl-18/19/20), split by Kevin into one-endpoint Dev packets. Suggested order (each group = one wave):
1. Platform: envelope + error codes, cookie auth (bl_access/bl_refresh/bl_session, rotation + reuse detection), Origin check on mutations, role guard (6 roles, union), audit service, /health, /auth/*, /users/{id}/roles, /audit-logs.
2. Teams: /teams, /teams/suggest (normalise NFC/trim/collapse/zero-width/casefold + prefix + edit distance <= 2), /team-requests (+ resolve), /me/teams (MULTI_TEAM warning), /teams/{id}/members.
3. Assessments + reviews: /assessments (eventId optional), clips upload-url + /clips/{id}/playback-url (15 min presigned, S3_PUBLIC_ENDPOINT), submit, assign (conflict of interest = any shared team; random + 12-month rotation), /reviews/assignments/* (blind, immutable, decline), approve / return / override (>= 20 chars) / confirm (provisional) / second-opinion (member once / 14 days), results history, /rubric. BullMQ jobs: aggregate on submit (aggregateAssessment n=1/2/>=3), 48h reminder, 72h expiry + auto reassign, nightly rater stats.
4. Rater stats + calibration: /rater-stats, /calibration-sets (+ clips upload-url, assign, results); calibration tasks reuse review assignments (kind=calibration).
5. Tournaments + entries: /tournaments, /tournaments/{id}/events (minReviewers, requiresFreshAssessment, format), /events/{id}/entries (grade band, NO_APPROVED_GRADE, FRESH_ASSESSMENT_REQUIRED, provisional results rejected), /entries/{id}/withdraw, /entries/{id}/grade-consent, /events/{id}/grades/disclose (POST/DELETE).
6. Draws + format: /events/{id}/draws/preview, /draws/{id}(/publish|/verify), /events/{id}/bracket, /events/{id}/format, groups preview/list/confirm, /events/{id}/standings, /events/{id}/knockout/preview, /matches/{id}/result (+ approve/reject), /matches/{id}/assignment, /events/{id}/umpires, /umpire/matches.

STATE: all specs frozen (architecture v1.1, grading v2, draw v1, tournament-format v1); openapi.yaml on develop (59 paths) is the contract; bl-07 merged (7dc3e85), bl-07b in review (7fbf519). Start AFTER bl-07b is merged; waves 3-6 depend on the bl-19/18/20 pure functions landing first (stub-free).

SOURCES: docs/api/openapi.yaml, docs/specs/architecture.md §3-6, grading.md §4-8 + §12, draw.md §6-8, tournament-format.md §4-7, docs/qa/test-plan.md (GR/DR/GS/RG cases), kpaccv2 pipeline for the platform wave.

CONSTRAINTS: no math in controllers (call packages/shared); every privileged action writes audit_logs; error codes exactly as in openapi; zod DTOs from shared; a contract-drift test (zod vs openapi) in wave 1; one endpoint per Dev packet with input/output/files/test.

TOOLS: own worktree (TEAM.md §9); branches be/bl-10-<slug>; Oscar reviews.

DONE: per wave, e2e tests for the state machines touched (assessment §8 + §12, draw §6, match result §5.1), the drift test green, PR + the real test command output; a wave summary to Jim.
