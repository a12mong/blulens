export type Role = 'Admin' | 'Committee' | 'Umpire' | 'Reviewer' | 'Member';
export type Area = 'public' | 'member' | 'reviewer' | 'umpire' | 'committee' | 'admin';

export const ROLE_LABELS: Record<Role, string> = {
  Admin: 'ผู้ดูแลระบบ',
  Committee: 'คณะกรรมการ',
  Umpire: 'กรรมการสนาม',
  Reviewer: 'ผู้ตรวจประเมิน',
  Member: 'สมาชิก',
};

/** home path per area; Guest = no session */
export const AREA_PATH: Record<Area, string> = {
  public: '/',
  member: '/me',
  reviewer: '/review',
  umpire: '/umpire',
  committee: '/committee/assessments',
  admin: '/admin',
};

const ROLE_AREAS: Record<Role, Area[]> = {
  Member: ['member'],
  Reviewer: ['reviewer'],
  Umpire: ['umpire'],
  Committee: ['committee'],
  Admin: ['admin'],
};

/**
 * Strict per architecture.md section 3: a role grants only its own area; users hold several roles when needed.
 * Area 'public' is always allowed. The API stays authoritative.
 */
export function canAccess(roles: readonly Role[], area: Area): boolean {
  if (area === 'public') return true;
  return roles.some((r) => ROLE_AREAS[r].includes(area));
}

const HOME_AREA: Record<Role, Area> = {
  Admin: 'admin',
  Committee: 'committee',
  Umpire: 'umpire',
  Reviewer: 'reviewer',
  Member: 'member',
};
const HOME_ORDER: Role[] = ['Admin', 'Committee', 'Umpire', 'Reviewer', 'Member'];

/** where to send a logged-in user: highest role's home area */
export function homePathFor(roles: readonly Role[]): string {
  const top = HOME_ORDER.find((r) => roles.includes(r));
  if (!top) return AREA_PATH.public;
  return AREA_PATH[HOME_AREA[top]];
}
