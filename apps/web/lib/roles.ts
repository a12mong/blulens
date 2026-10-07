export type Role = 'Admin' | 'Committee' | 'Reviewer' | 'Member';
export type Area = 'public' | 'member' | 'reviewer' | 'committee' | 'admin';

/** home path per area; Guest = no session */
export const AREA_PATH: Record<Area, string> = {
  public: '/',
  member: '/me',
  reviewer: '/review',
  committee: '/committee',
  admin: '/admin',
};

const ROLE_AREAS: Record<Role, Area[]> = {
  Member: ['member'],
  Reviewer: ['member', 'reviewer'],
  Committee: ['member', 'committee'],
  Admin: ['member', 'admin'],
};

/** Strict per architecture.md §3: Admin does NOT get committee/reviewer areas unless the user also holds that role.
 * Roles can be combined (user has several); area 'public' is always allowed. API stays authoritative. */
export function canAccess(roles: readonly Role[], area: Area): boolean {
  if (area === 'public') return true;
  return roles.some((r) => ROLE_AREAS[r].includes(area));
}

const HOME_AREA: Record<Role, Area> = { Admin: 'admin', Committee: 'committee', Reviewer: 'reviewer', Member: 'member' };
const HOME_ORDER: Role[] = ['Admin', 'Committee', 'Reviewer', 'Member'];

/** where to send a logged-in user: highest role's home area */
export function homePathFor(roles: readonly Role[]): string {
  const top = HOME_ORDER.find((r) => roles.includes(r));
  if (!top) return AREA_PATH.public;
  return AREA_PATH[HOME_AREA[top]];
}
