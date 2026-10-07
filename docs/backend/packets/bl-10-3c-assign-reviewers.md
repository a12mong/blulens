PACKET bl-10-3c: POST /api/v1/assessments/{assessmentId}/assign (wave 3)

Assignee: Creed (creed-muxswjfu) · Reviewer: Oscar (oscar-muxt974o) · Senior: Kevin (kevin-muxsqdkp)

GOAL:
  The Committee assigns reviewers to a submitted assessment, with the conflict-of-interest rule enforced by the API.

STATE:
  Your worktree. Branch dev/bl-10-assign from origin/develop (ca45f13+: your AssessmentsModule is merged). Rebuild shared,
  prisma generate. Exists: your assessments.{controller,service}.ts (mapAssessment, transitions pattern), Prisma
  ReviewAssignment (kind default 'assessment', partial unique: one live (open|submitted) assignment per (assessment, reviewer)
  -> P2002), TeamMembership (validFrom/validTo), UserRole.

SOURCES (openapi + architecture §3 + grading §7/§8, pasted):
  POST /assessments/{assessmentId}/assign   x-roles [Committee]
    body { reviewerIds: uuid[] (min 1), dueAt?: ISO date-time (default now + 72 h) }
    409 REVIEWER_CONFLICT_OF_INTEREST | ASSESSMENT_NOT_ASSIGNABLE
  §3 / G13: a reviewer may not review themselves or anyone who shares ANY current team with them (A11: several teams).
  §8: submitted -> in_review when reviewers are assigned; needs_reviewers -> in_review when more are assigned.

SPEC:
  Files (ONLY these 3): assessments.controller.ts (+1 handler, @Roles('Committee') @Post(':assessmentId/assign') @HttpCode(200)),
    assessments.service.ts (+ assign()), apps/api/test/assessment-assign.e2e-spec.ts (new)
  Input zod: { reviewerIds: z.array(z.string().uuid()).min(1).max(10), dueAt: z.string().datetime({ offset: true }).optional() };
    duplicate ids in reviewerIds -> 400 VALIDATION_FAILED (zod refine).
  assign(), ONE transaction:
    1. assessment exists (404 ASSESSMENT_NOT_FOUND); status in ['submitted','in_review','needs_reviewers'] else
       409 ASSESSMENT_NOT_ASSIGNABLE "มอบหมายกรรมการได้เฉพาะคำขอที่ส่งแล้วหรือกำลังประเมิน".
    2. each reviewer: active user holding the Reviewer role, else 409 REVIEWER_NOT_ELIGIBLE "ผู้ใช้นี้ไม่ใช่กรรมการ" (details { reviewerId }).
    3. conflict of interest: reviewerId === subjectUserId, OR any team shared between the reviewer's and the subject's memberships
       current at now (validFrom <= now AND (validTo null OR validTo > now)) -> 409 REVIEWER_CONFLICT_OF_INTEREST
       "กรรมการติดส่วนได้เสียกับผู้เล่น" with details { reviewerId, teamIds }.
    4. create one ReviewAssignment per reviewer { kind 'assessment', assessmentId, reviewerId, dueAt, assignedBy: actor.id };
       P2002 -> 409 REVIEWER_ALREADY_ASSIGNED (details { reviewerId }).
    5. if status is 'submitted' or 'needs_reviewers': conditional updateMany -> 'in_review' (+ version increment) and an
       AssessmentTransition row; lost race -> 409 ASSESSMENT_NOT_ASSIGNABLE.
    6. audit 'assessment.assign' { after: { reviewerIds, dueAt } }.
    7. return mapAssessment(...) (the full AssessmentDetail comes with the GET /assessments/{id} packet; keep it simple here).
  Edge cases (e2e; users with NO DB roles except where the test needs Reviewer; cookies carry roles):
    - submitted assessment, 2 eligible reviewers -> 200 status 'in_review'; 2 assignments with dueAt ~ now+72h; 1 transition
    - reviewer who shares a team with the subject -> 409 REVIEWER_CONFLICT_OF_INTEREST, nothing created (transaction)
    - the subject as reviewer -> 409 REVIEWER_CONFLICT_OF_INTEREST
    - user without Reviewer role -> 409 REVIEWER_NOT_ELIGIBLE
    - same reviewer again while the first assignment is open -> 409 REVIEWER_ALREADY_ASSIGNED
    - draft assessment -> 409 ASSESSMENT_NOT_ASSIGNABLE; Member cookie -> 403
  Cleanup: same pattern as assessments.e2e-spec.ts (disable users; leave append-only rows).
CONSTRAINTS: only the 3 files; no new deps; no `any`; conventional commits; push. Rebuild shared after every pull.
TOOLS: pnpm --filter @blulens/shared build · pnpm --filter @blulens/api test · pnpm --filter @blulens/api lint
DONE (single proving test): assessment-assign.e2e-spec.ts, "assigns eligible reviewers and refuses conflicts of interest"
  (first two edge cases). Report: branch, commit, diff --stat, real output.
