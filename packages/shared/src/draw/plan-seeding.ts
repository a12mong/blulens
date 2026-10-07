import type { Rng } from './prng';
import { notImplemented } from './stub';
import type { DrawEntry } from './types';

export interface SeedPlacement {
  entryId: string;
  seedNo: number;
  /** Virtual rank the seed occupies (see bracketOrder). */
  rank: number;
}

export interface SeedingPlan {
  /** S: smallest power of two >= N (minimum 2). */
  size: number;
  /** Default seed count from draw.md §3 (D1). */
  seedCount: number;
  /** S - N. */
  byeCount: number;
  /** Ordered by seedNo 1..seedCount. */
  seeds: SeedPlacement[];
  /** Virtual ranks holding a bye: N+1..S ascending. */
  byeRanks: number[];
  /** Non-seed entry ids, ascending. */
  unseededIds: string[];
}

/** Bracket size S for N entries (draw.md §3). Throws RangeError outside 2..256. */
export function bracketSize(entryCount: number): number {
  return notImplemented(`bl-18-2 bracketSize(${entryCount})`);
}

/** Default number of seeds for N entries (draw.md §3, D1). Throws RangeError outside 2..256. */
export function seedCount(entryCount: number): number {
  return notImplemented(`bl-18-2 seedCount(${entryCount})`);
}

/** Size, seeds (tie-break and rank groups by Rng) and bye ranks for one event (D1/D2). */
export function planSeeding(entries: readonly DrawEntry[], rng: Rng): SeedingPlan {
  return notImplemented(`bl-18-2 planSeeding(${entries.length} entries, ${typeof rng})`);
}
