import type { Role } from '../schemas/auth';

/**
 * Permission registry (architecture.md §3 table). Roles are not a hierarchy: a user's permissions are the
 * UNION over their roles. Guest (not logged in) has no entry here; public endpoints are marked @Public().
 * Names are `resource.action`; the API checks roles per endpoint (openapi x-roles), and these strings are
 * returned by GET /auth/me so the web can show/hide actions.
 */
export const ROLE_PERMISSIONS: Record<Role, readonly string[]> = {
  Member: [
    'profile.manage',
    'assessment.request',
    'clip.upload',
    'result.view_own',
    'entry.manage_own',
    'entry.grade_consent',
  ],
  Reviewer: ['review.queue', 'review.submit', 'review.decline', 'rater_stats.view_own'],
  Umpire: ['match.report'],
  Committee: [
    'assessment.assign',
    'assessment.view_reviewers',
    'assessment.decide',
    'assessment.override',
    'rater_stats.view_all',
    'calibration.manage',
    'team.manage',
    'tournament.manage',
    'draw.manage',
    'rubric.manage',
    'grades.disclose',
    'match.report',
    'match.confirm',
    'umpire.assign',
  ],
  Admin: ['user.manage', 'audit.view', 'team.manage', 'grades.disclose'],
};

/** Union of the permissions of the given roles, sorted, without duplicates. */
export function permissionsFor(roles: readonly Role[]): string[] {
  return [...new Set(roles.flatMap((r) => ROLE_PERMISSIONS[r]))].sort();
}
