import { AREA_PATH, canAccess, type Area, type Role } from './roles';

export type NavItem = { area: Area; href: string; label: string };

/** one entry per area; Thai labels. Placeholder pages until phase 2 screens land. */
export const NAV_ITEMS: readonly NavItem[] = [
  { area: 'member', href: AREA_PATH.member, label: 'ของฉัน' },
  { area: 'reviewer', href: AREA_PATH.reviewer, label: 'ตรวจประเมิน' },
  { area: 'umpire', href: AREA_PATH.umpire, label: 'บันทึกคะแนน' },
  { area: 'committee', href: AREA_PATH.committee, label: 'ผลประเมิน' },
  { area: 'admin', href: AREA_PATH.admin, label: 'จัดการผู้ใช้' },
];

export const PUBLIC_NAV: readonly NavItem[] = [
  { area: 'public', href: '/', label: 'หน้าแรก' },
  { area: 'public', href: '/events', label: 'อีเวนต์' },
];

/** nav for a user: public links + one entry per area the held roles can access (doubles as the role switcher) */
export function navFor(roles: readonly Role[]): NavItem[] {
  return [...PUBLIC_NAV, ...NAV_ITEMS.filter((i) => canAccess(roles, i.area))];
}
