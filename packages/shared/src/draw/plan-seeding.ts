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
  return 1 << Math.ceil(Math.log2(entryCount));
}

/** Default number of seeds for N entries (draw.md §3, D1). Throws RangeError outside 2..256. */
export function seedCount(entryCount: number): number {
  if (entryCount < 2) throw new RangeError('DRAW_TOO_FEW_ENTRIES');
  if (entryCount > 256) throw new RangeError('DRAW_TOO_MANY_ENTRIES');
  const s = bracketSize(entryCount);
  if (s <= 2) return 0;
  if (s <= 4) return 2;
  if (s <= 8) return 2;
  if (s <= 16) return 4;
  if (s <= 32) return 8;
  if (s <= 64) return 16;
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

  ranked.sort((a, b) => a.entryId.localeCompare(b.entryId));

  // Group by score (while maintaining id-sorted order within each group)
  const groups: RankedEntry[][] = [];
  let currentGroup: RankedEntry[] = [];
  for (const entry of ranked) {
    if (currentGroup.length > 0 && currentGroup[0]!.seedScore !== entry.seedScore) {
      groups.push(currentGroup);
      currentGroup = [];
    }
    currentGroup.push(entry);
  }
  if (currentGroup.length > 0) groups.push(currentGroup);

  // Sort groups by score descending
  groups.sort((a, b) => b[0]!.seedScore - a[0]!.seedScore);

  // Flatten groups, shuffling runs of identical scores
  const result: RankedEntry[] = [];
  for (const group of groups) {
    const shuffled = group.length > 1 ? shuffle(group, rng) : group;
    result.push(...shuffled);
  }

  // Step 4: First seedCount are seeds
  const seedList = result.slice(0, sc);

  // Step 5: Rank assignment
  // Seed 1 -> rank 1, Seed 2 -> rank 2, then shuffle groups [3..4], [5..8], [9..16]
  const rankMap = new Map<string, number>();
  if (sc >= 1) rankMap.set(seedList[0]!.entryId, 1);
  if (sc >= 2) rankMap.set(seedList[1]!.entryId, 2);

  if (sc >= 3) {
    const groups35: number[] = [];
    if (sc >= 3) groups35.push(3);
    if (sc >= 4) groups35.push(4);
    if (groups35.length > 0) {
      const entries35 = seedList.slice(2, 4);
      if (entries35.length > 0) {
        const shuffled = shuffle(entries35, rng);
        shuffled.forEach((e, i) => rankMap.set(e.entryId, groups35[i]!));
      }
    }
  }

  if (sc >= 5) {
    const groups58: number[] = [];
    for (let i = 5; i <= Math.min(8, sc); i++) groups58.push(i);
    if (groups58.length > 0) {
      const entries58 = seedList.slice(4, 8);
      if (entries58.length > 0) {
        const shuffled = shuffle(entries58, rng);
        shuffled.forEach((e, i) => rankMap.set(e.entryId, groups58[i]!));
      }
    }
  }

  if (sc >= 9) {
    const groups916: number[] = [];
    for (let i = 9; i <= Math.min(16, sc); i++) groups916.push(i);
    if (groups916.length > 0) {
      const entries916 = seedList.slice(8, 16);
      if (entries916.length > 0) {
        const shuffled = shuffle(entries916, rng);
        shuffled.forEach((e, i) => rankMap.set(e.entryId, groups916[i]!));
      }
    }
  }

  // Step 6: Build output
  const seeds: SeedPlacement[] = [];
  for (let i = 0; i < sc; i++) {
    const seed = seedList[i]!;
    seeds.push({
      entryId: seed.entryId,
      seedNo: i + 1,
      rank: rankMap.get(seed.entryId)!,
    });
  }

  const byeRanks: number[] = [];
  for (let r = n + 1; r <= size; r++) {
    byeRanks.push(r);
  }

  const unseededIds = result
    .slice(sc)
    .map((e) => e.entryId)
    .sort((a, b) => a.localeCompare(b));

  return {
    size,
    seedCount: sc,
    byeCount,
    seeds,
    byeRanks,
    unseededIds,
  };
}
