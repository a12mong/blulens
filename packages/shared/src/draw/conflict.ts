import type { DrawEntry } from './types';

/**
 * Two entries clash ("same team") when their team sets share at least one id
 * (draw.md §2, decision D7). An entry without a team never clashes.
 */
export function sharesTeam(a: Pick<DrawEntry, 'teamIds'>, b: Pick<DrawEntry, 'teamIds'>): boolean {
  return a.teamIds.some((t) => b.teamIds.includes(t));
}
