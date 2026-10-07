PACKET bl-10-3b: ReviewsModule — GET /rubric + GET /reviews/assignments/me (wave 3)

Assignee: Meredith (meredith-muxtbonw) · Reviewer: Oscar (oscar-muxt974o) · Senior: Kevin (kevin-muxsqdkp)

GOAL:
  Everyone can read the active rubric; a Reviewer sees their own review queue (blind: nothing about other reviewers).

STATE:
  Your worktree. Branch dev/bl-10-reviews from origin/develop (pull + pnpm --filter @blulens/shared build first).
  Exists: Prisma Rubric (methodVersion, criteria json [{key,nameTh,weight,anchorsTh?}], active), ReviewAssignment (kind
  assessment|calibration, assessmentId?, calibrationClipId?, reviewerId, state open|submitted|expired|declined, dueAt),
  Review (assignmentId unique, submittedAt). The seed already creates the active 'grading-v1' rubric.
  Creed builds AssessmentsModule in parallel; you create a NEW ReviewsModule (no shared files except app.module.ts).

SOURCES (openapi, pasted):
  GET /rubric  x-roles [Guest, Member, Reviewer, Committee, Admin] (public)
    -> 200 Rubric { methodVersion, criteria: [{ key, nameTh, weight, anchorsTh? }] }
  GET /reviews/assignments/me?state=open|submitted|expired   x-roles [Reviewer]
    -> 200 ReviewAssignment[] = [{ id, assessmentId, state, kind, dueAt, submittedAt: string|null }]

SPEC:
  Files (ONLY these 5): apps/api/src/modules/reviews/{reviews.module.ts, reviews.controller.ts, reviews.service.ts},
    apps/api/src/app.module.ts (register), apps/api/test/reviews.e2e-spec.ts
  GET /rubric (@Public): the rubric with active = true; none -> 404 RUBRIC_NOT_FOUND. Return { methodVersion, criteria } only.
  GET /reviews/assignments/me (@Roles('Reviewer')): query zod { state: z.enum(['open','submitted','expired']).optional() }.
    Rows WHERE reviewerId = actor.id AND kind = 'assessment' (calibration tasks come in a later packet) [AND state = q.state],
    orderBy [{ dueAt: 'asc' }, { id: 'asc' }], include review { submittedAt }.
    Map to { id, assessmentId, state, kind, dueAt ISO, submittedAt: review?.submittedAt ISO ?? null }.
    Never include other reviewers' assignments, scores or names.
  Edge cases (e2e): GET /rubric without cookie -> 200 methodVersion 'grading-v1' with 6 criteria (seeded) · reviewer R1 with 2
    assignments (one open due later, one submitted with a review row) and reviewer R2 with 1 -> R1 sees exactly its 2, ordered by
    dueAt; ?state=open -> 1 · Member cookie -> 403 · no cookie -> 401.
  Fixtures: create users/assessments/assignments/reviews with prisma; give users NO roles in the DB (cookies carry roles);
    afterAll: delete reviews, assignments; assessments cannot be deleted if transitions exist (you create none) -> delete them;
    then delete users.
  Cookies: signJwt as in apps/api/test/tournaments.e2e-spec.ts.
CONSTRAINTS: only the 5 files; no new deps; no `any`; conventional commits; push. ENGINE NOTE: reply JSON into your own outbox.
TOOLS: pnpm --filter @blulens/shared build · pnpm --filter @blulens/api test · pnpm --filter @blulens/api lint
DONE (single proving test): reviews.e2e-spec.ts, "shows a reviewer only their own assignments, ordered by due date"
  Report: branch, commit, diff --stat, real output.
