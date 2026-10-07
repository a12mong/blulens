import type { SeedPlacement } from './plan-seeding';
import { notImplemented } from './stub';
import type { DrawEntry, SlotValue } from './types';

export interface DrawConflict {
  /** Round-1 match number k = positions (2k-1, 2k), 1-based. */
  matchNo: number;
  entryIds: [string, string];
  teamIds: string[];
}

export interface DrawResult {
  rulesetVersion: string;
  prngId: string;
  seed: string;
  size: number;
  seedCount: number;
  seeds: SeedPlacement[];
  /** slots[p - 1] = entry id at position p, null = bye. */
  slots: SlotValue[];
  conflicts: DrawConflict[];
  minimumPossibleConflicts: number;
  provenMinimal: boolean;
  searchSteps: number;
}

/**
 * Full knockout draw (draw.md §3-§5): planSeeding -> bracketOrder -> solvePlacement.
 * Same entries (any input order) + same seed string = identical result (draw.md §1 item 5).
 */
export function drawBracket(entries: readonly DrawEntry[], seed: string): DrawResult {
  return notImplemented(`bl-18-6 drawBracket(${entries.length} entries, ${seed})`);
}
