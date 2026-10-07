# Packet bl-11 — FE screens backlog, wave 1 (Jim -> Andy)

GOAL: split the frozen specs into one-screen/one-component micro-tasks for Ryan/Phyllis and deliver wave 1 screens on top of your bl-08 shell:
1. Auth + role shell for 6 roles (Admin, Committee, Umpire, Reviewer, Member, Guest), role switcher for multi-role users.
2. Member: profile with type-ahead team picker + "request new team" + multi-team warning (architecture §6.6); assessment request + clip upload/playback (§6.4); my results with GradeView incl. "provisional · 1 reviewer" badge and second-opinion button (grading §12).
3. Reviewer: queue + S07 scoring (6 criteria x 15-rung picker grouped by tier + N/A, local draft, immutable after submit; calibration tasks look identical).
4. Committee: approval queue (approve/return/override/confirm provisional), reviewer bias + pair kappa next to results, calibration set screens, team request resolution, draw/group preview + publish with conflict acknowledgement, match result confirmation queue, umpire assignment.
5. Umpire: "my matches" (mobile-first) + score entry validated by MatchFormat.
6. Public: event list, bracket + group standings ("awaiting confirmation" badge on reported scores; grades only when the entry consented or the event disclosed them).

STATE: all specs frozen — architecture v1.1, grading v2, draw v1, tournament-format v1; openapi.yaml 59 paths (develop e9e83b6+). Pam's alignment: docs/design/contract-alignment.md; Stitch exports land in docs/design/stitch/. bl-08 (your shell, packets bl-08-1..5) comes first.

SOURCES: docs/api/openapi.yaml (only source of field names), docs/specs/*.md, docs/design/* (README matrix needs an Umpire column — ask Pam), docs/qa/test-plan.md for acceptance cases.

CONSTRAINTS: no business logic in web (GradeView/label from API, standings from API); Thai UI; mobile-first for Member/Reviewer/Umpire; polling 30 s, no realtime; one micro-task = one screen or one component with input/output/files/test.

TOOLS: your own worktree (TEAM.md §9); branches `fe/bl-11-<slug>`.

DONE: a backlog file docs/frontend/packets/bl-11-*.md (one per micro-task, ordered), wave 1 = items 1-3 merged with Playwright smoke per role; reply to Jim with the backlog list + ETA. Sequence AFTER bl-08.
