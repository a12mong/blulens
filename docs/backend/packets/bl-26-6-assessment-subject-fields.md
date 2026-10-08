PACKET bl-26-6: Committee sees who is assessed (subject + event + assignment status) in GET /assessments and GET /assessments/{id}

Assignee: Creed (creed-muxswjfu) · Reviewer: Oscar (oscar-muxt974o) · Senior: Kevin (kevin-muxsqdkp)
PRIORITY P1 (owner path, Pam review-slice-2 R1 + R2): every Committee row shows 'ไม่ระบุ' because the payload has no subject name.

GOAL: the list and detail payloads carry the subject's name and clubs and the event/tournament; the detail also carries
  one status row per review assignment. Reviewers stay blind: they never call these endpoints (their view is
  GET /reviews/assignments/{id}, unchanged).

STATE: branch dev/bl-26-subject-fields from origin/develop. assessments.service.ts: list() (bl-26-1) and the detail
  (bl-26-2) both build items via private mapAssessment(assessment, reviewsSubmitted, reviewsRequired). Prisma: User
  { displayName, memberships: TeamMembership { teamId, validFrom, validTo|null, team: Team { name } } }, Assessment
  { subjectUserId, eventId|null }, Event { tournamentId, discipline, tournament: Tournament { name } } (Event has NO name),
  ReviewAssignment { id, assessmentId, reviewerId, state, dueAt, createdAt, review?: { submittedAt } }.

SPEC (files ONLY: assessments.service.ts, apps/api/test/assessment-subject-fields.e2e-spec.ts new). All fields ADDITIVE:
  - every Assessment item (list + detail): subject = { userId, displayName, clubNames: string[] } where clubNames = names
    of the subject's ACTIVE memberships (validTo null or > now), de-duplicated, sorted; event = { id, discipline,
    tournamentName } or null when eventId is null.
  - load them with include/select in the SAME query as the assessments (no per-row queries).
  - detail only: assignments = [{ id, state, dueAt, submittedAt (review.submittedAt or null), reviewerId, reviewerName }]
    ordered by createdAt; Committee/Admin get the rows, a Member (the subject) gets [].
  Test: Committee list row has subject.displayName + clubNames ['<team>'] (an ended membership is NOT listed) and
    event.tournamentName for an event-bound assessment, event null otherwise; Committee detail has 2 assignments
    (one open: submittedAt null; one submitted: submittedAt set); the subject Member's detail has assignments []. Clean up.
TOOLS: pnpm --filter @blulens/api db:generate; pnpm --filter @blulens/shared build; cd apps/api && pnpm build && pnpm lint && pnpm test
DONE: push dev/bl-26-subject-fields, verify on origin, done message to Kevin (sha + result lines).
