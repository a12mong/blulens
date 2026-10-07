PACKET bl-10-3a: AssessmentsModule — POST /assessments + POST /assessments/{id}/submit (wave 3)

Assignee: Creed (creed-muxswjfu) · Reviewer: Oscar (oscar-muxt974o) · Senior: Kevin (kevin-muxsqdkp)

GOAL:
  A Member opens an assessment request and submits it once a clip is uploaded (grading.md §8: draft -> submitted).

STATE:
  Your worktree. Branch dev/bl-10-assessments from origin/develop. FIRST: pnpm install --frozen-lockfile &&
  pnpm --filter @blulens/shared build (stale dist was your blocker twice).
  Exists: Prisma Assessment (subjectUserId, eventId?, rubricId?, status, reviewsRequired default 2, submittedAt, version),
  AssessmentTransition (append-only), Clip (assessmentId, status pending_upload|uploaded|rejected), Rubric (active, unique
  active), Event (minReviewers); AuditService; reference style apps/api/src/modules/tournaments/*.
  Clip upload endpoints do not exist yet: in the e2e test create clip rows with prisma (status 'uploaded').

SOURCES (openapi + grading.md §8 + G3', pasted):
  POST /assessments  x-roles [Member]  body { note?: string <= 1000, eventId?: uuid }  -> 201 Assessment (status draft)
  POST /assessments/{assessmentId}/submit  x-roles [Member]  -> 200 Assessment (status submitted); 409 Conflict
  Assessment = { id, subjectUserId, eventId: uuid|null, status, reviewsSubmitted: int, reviewsRequired: int, createdAt, updatedAt }
  §8: draft -> submitted needs >= 1 clip. G3': reviews required = the event's minReviewers, or the system default 2 for a
  standalone request.

SPEC:
  Files (ONLY these 5): apps/api/src/modules/assessments/{assessments.module.ts, assessments.controller.ts,
    assessments.service.ts}, apps/api/src/app.module.ts (register), apps/api/test/assessments.e2e-spec.ts
  create(actor, body):
    - eventId given -> event must exist (404 EVENT_NOT_FOUND). (Whether the event requires a fresh assessment does not matter here.)
    - create { subjectUserId: actor.id, eventId, status 'draft' }. `note` is NOT stored (no column yet; Kevin asked Jim) — accept and ignore it.
    - audit 'assessment.create'. Return Assessment.
  submit(id, actor), ONE transaction:
    - load; not found OR subjectUserId !== actor.id -> 404 ASSESSMENT_NOT_FOUND (never reveal other players' requests)
    - status must be 'draft' else 409 ASSESSMENT_NOT_DRAFT "ส่งได้เฉพาะคำขอที่เป็นร่าง"
    - at least one clip with status 'uploaded' else 409 ASSESSMENT_NO_CLIP "ต้องอัปโหลดคลิปอย่างน้อย 1 คลิปก่อนส่ง"
    - active rubric required else 409 RUBRIC_MISSING
    - reviewsRequired = event?.minReviewers ?? 2 (define `export const DEFAULT_MIN_REVIEWERS = 2` at the top of the service with a
      comment "system default (G3'); becomes a system setting later")
    - conditional updateMany WHERE id AND status 'draft' -> { status 'submitted', submittedAt now, rubricId, reviewsRequired,
      version: { increment: 1 } }; count 0 -> 409 ASSESSMENT_NOT_DRAFT
    - insert AssessmentTransition { fromStatus 'draft', toStatus 'submitted', actorId }
    - audit 'assessment.submit'. Return Assessment.
  Mapping: reviewsSubmitted = count of reviews (abstained false) whose assignment belongs to the assessment.
  Edge cases (e2e): create standalone -> 201 draft, reviewsRequired 2 · create with eventId of an event with minReviewers 3 then
    submit -> reviewsRequired 3 · submit without clip -> 409 ASSESSMENT_NO_CLIP · submit twice -> second 409 ASSESSMENT_NOT_DRAFT ·
    another Member submits it -> 404 · Reviewer cookie POST /assessments -> 403 · transition row written once.
  Test users: users who own assessments cannot be deleted later if results exist; here no results are created, so delete
  clips, transitions(cannot: append-only -> leave them), assessments(cannot: transitions reference them) — therefore give test
  users NO roles in the DB (cookies carry roles) and set status 'disabled' in afterAll, like entries.e2e-spec.ts.
CONSTRAINTS: only the 5 files; no new deps; no `any`; conventional commits; push.
TOOLS: pnpm --filter @blulens/shared build · pnpm --filter @blulens/api test · pnpm --filter @blulens/api lint
DONE (single proving test): assessments.e2e-spec.ts, "opens a draft request and submits it once a clip is uploaded"
  (create -> 409 no clip -> add uploaded clip -> 200 submitted with reviewsRequired). Report: branch, commit, diff --stat, real output.
