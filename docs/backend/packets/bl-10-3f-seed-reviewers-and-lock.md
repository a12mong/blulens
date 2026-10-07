PACKETS bl-10-3f (seed) and bl-10-3g (lock): two small slice-2 follow-ups, in this order, ONE commit each, separate branches

Assignee: Meredith (meredith-muxtbonw) · Reviewer: Oscar (oscar-muxt974o) · Senior: Kevin (kevin-muxsqdkp)
Priority: BEFORE bl-20-1 planGroups (the owner cannot try /review without these).

=== bl-10-3f: demo seed, reviewers + assessments waiting for review ===
GOAL: with SEED_DEMO=1, `pnpm db:seed` also creates 3 Reviewer accounts and 2 submitted assessments with open
  review assignments, so the owner can log in as a reviewer and open /review. The owner already has data in
  blulens_demo and re-runs db:seed on it: the step must be ADDITIVE and IDEMPOTENT (no migration, no deletes).
STATE: branch dev/bl-10-seed-reviewers from origin/develop (b89d691 or later). apps/api/prisma/seed.ts has upsertUser(),
  DEMO_MEMBERS (member1..14) with official grades, seedDemoTournament(). Prisma: Assessment { subjectUserId, rubricId,
  status, submittedAt, note? }, Clip { assessmentId, objectKey (unique), status }, ReviewAssignment { kind 'assessment',
  assessmentId, reviewerId, state 'open', dueAt, assignedBy }, AssessmentTransition (append-only), Role 'Reviewer'.
SPEC (file: apps/api/prisma/seed.ts ONLY):
  - upsertUser accepts 'Reviewer' in its roles type. Create reviewer1..3@blulens.local ('ผู้ตรวจ 1'..'ผู้ตรวจ 3', Thai display
    names of your choice), role Reviewer, password SEED_DEMO_PASSWORD.
  - new seedDemoReviews(): idempotency marker = an Assessment with note 'demo-seed: review queue' for that subject; if it
    exists, skip that subject. For subjects member7 and member8: create Assessment { status 'in_review', submittedAt now,
    rubricId = active rubric, note 'demo-seed: review queue' }, one Clip { objectKey `clips/<assessmentId>/<clipId>`
    (generate the clip id with randomUUID first), status 'uploaded', contentType 'video/mp4', durationSec 45 }, two
    AssessmentTransition rows (draft->submitted, submitted->in_review, actorId null, reason 'demo seed'), and open
    ReviewAssignments for reviewer1 and reviewer2 (dueAt now + 48h, assignedBy admin id or null). Never assign a
    reviewer to an assessment of themselves.
  - Do all of a subject's rows in ONE prisma.$transaction. Log 'demo reviews: N created' or 'demo reviews: exists'.
  - No real video file is uploaded (MinIO is out of scope); the clip player will show its error state. Say so in the done message.
TEST: on a fresh scratch DB (`DATABASE_URL=<your scratch db> pnpm exec prisma migrate deploy`, then seed twice): the first
  run creates 3 reviewers + 2 assessments + 4 open assignments; the second run creates nothing (paste both outputs and
  the counts). Also `cd apps/api && pnpm lint` (tsc) clean.
DONE: push dev/bl-10-seed-reviewers, verify on origin, done message to Kevin (sha, both seed outputs, counts).

=== bl-10-3g: no lost aggregation when two last reviews arrive together ===
GOAL (Oscar's review note on f5e73f4): under Read Committed, two DIFFERENT reviewers submitting the last two open reviews
  at the same moment can each see openLeft === 1, and then neither aggregates; the assessment is stuck in_review.
STATE: branch dev/bl-10-aggregate-lock from origin/develop. reviews.service.ts submit(): inside the transaction it
  counts open assignments (`openLeft`) and aggregates when it is 0.
SPEC (files: reviews.service.ts + apps/api/test/aggregate-on-submit.e2e-spec.ts):
  - When assignment.kind === 'assessment', lock the assessment row first, inside the transaction and BEFORE the
    assignment flip: `await tx.$queryRaw\`SELECT id FROM assessments WHERE id = ${assignment.assessmentId}::uuid FOR UPDATE\``.
    Concurrent submits for the same assessment then serialize, so the second one sees openLeft === 0.
  - Test: two reviewers, two open assignments; submit both with Promise.all -> exactly 1 AssessmentResult (version 1)
    and the assessment is no longer 'in_review'. Run the test 3 times (it.each over 3 rounds with fresh fixtures).
TOOLS: cd apps/api && pnpm build && pnpm lint && pnpm test
DONE: push dev/bl-10-aggregate-lock, verify on origin, done message to Kevin (sha + test result lines).
