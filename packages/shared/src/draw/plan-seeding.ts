import type { Rng } from './prng';
import type { DrawEntry } from './types';
import { shuffle } from './prng';

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
  if (entryCount < 2) throw new RangeError('DRAW_TOO_FEW_ENTRIES');
  if (entryCount > 256) throw new RangeError('DRAW_TOO_MANY_ENTRIES');
  let s = 2;
  while (s < entryCount) s *= 2;
  return s;
}

/** Default number of seeds for N entries (draw.md §3, D1). Throws RangeError outside 2..256. */
export function seedCount(entryCount: number): number {
  if (entryCount < 2) throw new RangeError('DRAW_TOO_FEW_ENTRIES');
  if (entryCount > 256) throw new RangeError('DRAW_TOO_MANY_ENTRIES');
  if (entryCount === 2) return 0;
  if (entryCount <= 8) return 2;
  if (entryCount <= 16) return 4;
  if (entryCount <= 32) return 8;
  return 16;
}

/** Size, seeds (tie-break and rank groups by Rng) and bye ranks for one event (D1/D2). */
export function planSeeding(entries: readonly DrawEntry[], rng: Rng): SeedingPlan {
  const n = entries.length;

  // Step 1: Validation
  if (n < 2) throw new RangeError('DRAW_TOO_FEW_ENTRIES');
  if (n > 256) throw new RangeError('DRAW_TOO_MANY_ENTRIES');

  const seenIds = new Set<string>();
  for (const entry of entries) {
    if (seenIds.has(entry.id)) throw new RangeError('DRAW_DUPLICATE_ENTRY');
    seenIds.add(entry.id);
  }

  // Step 2: Compute size and seedCount
  const size = bracketSize(n);
  const sc = seedCount(n);
  const byeCount = size - n;

  // Step 3: Ranking (sort by id, then stable-sort by score, then shuffle tied runs)
  interface RankedEntry {
    entryId: string;
    seedScore: number;
  }

  const ranked: RankedEntry[] = entries.map((e) => ({
    entryId: e.id,
    seedScore: e.seedScore,
  }));

  // Sort by id ascending
  ranked.sort((a, b) => (a.entryId < b.entryId ? -1 : a.entryId > b.entryId ? 1 : 0));

  // Stable-sort by seedScore descending (insertion sort maintains stability)
  for (let i = 1; i < ranked.length; i++) {
    const key = ranked[i]!;
    let j = i - 1;
    while (j >= 0 && ranked[j]!.seedScore < key.seedScore) {
      ranked[j + 1] = ranked[j]!;
      j--;
    }
    ranked[j + 1] = key;
  }

  // Walk and shuffle consecutive runs of identical scores
  const result: RankedEntry[] = [];
  let i = 0;
  while (i < ranked.length) {
    const score = ranked[i]!.seedScore;
    let j = i;
    while (j < ranked.length && ranked[j]!.seedScore === score) j++;
    const run = ranked.slice(i, j);
    if (run.length > 1) {
      result.push(...shuffle(run, rng));
    } else {
      result.push(...run);
    }
    i = j;
  }

  // Step 4: First seedCount are seeds
  const seedList = result.slice(0, sc);

  // Step 5: Rank assignment with group shuffling
  const rankOf = new Map<string, number>();
  if (sc >= 1) rankOf.set(seedList[0]!.entryId, 1);
  if (sc >= 2) rankOf.set(seedList[1]!.entryId, 2);

  const rankGroups: [number, number][] = [
    [3, 4],
    [5, 8],
    [9, 16],
  ];
  for (const [lo, hi] of rankGroups) {
    if (lo > sc) break;
    const ranks: number[] = [];
    for (let r = lo; r <= Math.min(hi, sc); r++) ranks.push(r);
    const shuffledRanks = shuffle(ranks, rng);
    for (let i = 0; i < shuffledRanks.length; i++) {
      const seed = seedList[lo - 1 + i]!;
      rankOf.set(seed.entryId, shuffledRanks[i]!);
    }
  }

  // Step 6: Build output
  const seeds: SeedPlacement[] = [];
  for (let i = 0; i < sc; i++) {
    const seed = seedList[i]!;
    seeds.push({
      entryId: seed.entryId,
      seedNo: i + 1,
      rank: rankOf.get(seed.entryId)!,
    });
  }

  const byeRanks: number[] = [];
  for (let r = n + 1; r <= size; r++) {
    byeRanks.push(r);
  }

  const unseededIds = result
    .slice(sc)
    .map((e) => e.entryId)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  return {
    size,
    seedCount: sc,
    byeCount,
    seeds,
    byeRanks,
    unseededIds,
  };
}
