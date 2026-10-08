PACKET bl-39-2: emit notifications N1-N8 inside the existing transactions

Assignee: Creed (creed-muxswjfu), after bl-39-1 · Reviewer: Oscar (post-review) · Senior: Kevin (kevin-muxsqdkp)
GOAL: the state changes in docs/specs/notifications.md §2 (N1-N8) create notifications atomically. N9
  (knockout_published) is NOT in this packet (blocked on owner decision D2).
STATE: branch dev/bl-39-emits from origin/develop after bl-39-1 merges. NotificationsService is global (inject it):
  emit(tx, actorId, items[]) with items { recipientUserId, type, title, body?, link? }; it drops the actor and
  duplicates. Call it with the SAME tx the service already uses, after the state change succeeded.
SOURCES: docs/specs/notifications.md §2 (types, recipients, Thai titles, links) and §4. Owner defaults in force: D3
  override also notifies every Committee member, D4 return notifies the member, D7 no notice on putEventUmpires.
SPEC (files ONLY: assessments.service.ts, calibration.service.ts, matches.service.ts,
  apps/api/test/notification-emits.e2e-spec.ts NEW):
  - AssessmentsService.decide (shared by approve/return/confirm/override): add an optional DecideOptions field
    notify?: (assessment) => NotificationItem[] and call this.notifications.emit(tx, actor.id, opts.notify(a))
    after the status update inside the existing $transaction. approve -> N1 assessment_approved; return -> N2
    assessment_returned with body = the reason; confirm -> N3 assessment_confirmed; override -> N4
    assessment_overridden with body = the reason, recipients = subject member (link /me/assessments/{id}) AND every
    active user with role Committee (link /committee/assessments/{id}), ONE user.findMany for the committee list.
    Member links /me/assessments/{id}. Titles exactly as the spec table.
  - AssessmentsService.assign: N5 review_assigned to each NEWLY assigned reviewer, title 'มีงานประเมินใหม่ 1 งาน',
    link '/review', NO body, nothing that names the subject, the assessment id or calibration (blind).
  - CalibrationService.assignCalibrationSet: N5 to each reviewer that got at least one NEW assignment in this call,
    title 'มีงานประเมินใหม่ N งาน' (N = their new assignments), link '/review'. Re-assigning an existing reviewer
    with no new task -> no notification. (createMany skipDuplicates returns only a count: compute new pairs by
    reading existing (reviewerId, clipId) pairs first in the same tx.)
  - MatchesService.approveMatchResult: N6 match_result_approved to match.reportedBy (link /umpire/matches/{id});
    skip when reportedBy is null (Committee entered it). rejectMatchResult: N7 match_result_rejected to
    match.reportedBy READ BEFORE the update nulls it, body = the reason. patchMatchAssignment: N8 umpire_assigned to
    the NEW umpireId only when it changed to a non-null user. These run inside applyResultAction's / the method's
    existing $transaction: pass the notification items out of the executeAction callback (e.g. return them next to
    updateData) and emit after the match update.
  - an idempotent call that changes nothing must not notify twice.
  Test (one suite, fixtures via prisma + the real endpoints): approve -> member gets N1 with the spec title and
    link; return -> N2 with the reason as body; override -> member + every OTHER Committee user get N4, the acting
    Committee user gets none; assign 2 reviewers -> each gets N5 whose title/body/link contain neither the subject
    name nor the assessment id; calibration assign twice with one new reviewer the 2nd time -> only the new reviewer
    is notified the 2nd time; umpire report + approve -> umpire gets N6; report + reject -> N7 with the reason;
    Committee-entered result approve path -> no N6; PATCH assignment to a new umpire -> N8, same umpire again -> none.
TOOLS: pnpm --filter @blulens/api db:generate; pnpm --filter @blulens/shared build; cd apps/api && pnpm build && pnpm lint && TEST_DATABASE_URL=<fresh *_test db> pnpm test
DONE: merge origin/develop first, push, done message to Kevin (sha + test names + FULL pnpm test line).
