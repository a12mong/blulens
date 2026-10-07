import type { DrawEntry } from '../draw';
import { createRng, sharesTeam, shuffle } from '../draw';

export interface GroupPlan {
  groups: string[][];
  sameTeamPairs: [string, string][];
}

/**
 * Computes group sizes for n entries and target groupSize (tournament-format.md §3.1).
 * Returns array of sizes or an error object if any group would have < 3 or > 5 entries.
 */
export function groupSizes(
  n: number,
  groupSize: number,
): number[] | { error: 'GROUP_SIZES_IMPOSSIBLE' } {
  if (!Number.isInteger(n) || !Number.isInteger(groupSize) || n <= 0 || groupSize <= 0) {
    return { error: 'GROUP_SIZES_IMPOSSIBLE' };
  }

  const g = Math.max(1, Math.floor(n / groupSize + 0.5));
  const rem = n % g;
  const high = Math.ceil(n / g);
  const low = Math.floor(n / g);

  const sizes: number[] = [];
  for (let i = 0; i < g; i++) {
    sizes.push(i < rem ? high : low);
  }

  for (const s of sizes) {
    if (s < 3 || s > 5) {
      return { error: 'GROUP_SIZES_IMPOSSIBLE' };
    }
  }

  return sizes;
}

/**
 * Plans group stage pots and placement, separating same-team entries (tournament-format.md §3.2).
 * Pure function; deterministic for a given seed.
 */
export function planGroups(
  entries: readonly DrawEntry[],
  groupSize: number,
  seed: string,
): GroupPlan | { error: 'GROUP_SIZES_IMPOSSIBLE' } {
  const sizesResult = groupSizes(entries.length, groupSize);
  if ('error' in sizesResult) {
    return sizesResult;
  }
  const sizes = sizesResult;
  const g = sizes.length;

  const rng = createRng(`${seed}:groups`);

  // Map entries by id for lookup
  const entryMap = new Map<string, DrawEntry>();
  for (const e of entries) {
    entryMap.set(e.id, e);
  }

  // Group entries by seedScore
  const byScore = new Map<number, DrawEntry[]>();
  for (const e of entries) {
    const list = byScore.get(e.seedScore);
    if (list) {
      list.push(e);
    } else {
      byScore.set(e.seedScore, [e]);
    }
  }

  // Sort distinct scores descending
  const scores = Array.from(byScore.keys()).sort((a, b) => b - a);

  // For each score, sort tied entries by id ascending, then shuffle if multiple
  const ordered: DrawEntry[] = [];
  for (const score of scores) {
    const tied = byScore.get(score)!;
    tied.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    if (tied.length > 1) {
      ordered.push(...shuffle(tied, rng));
    } else {
      ordered.push(tied[0]!);
    }
  }

  const groups: string[][] = Array.from({ length: g }, () => []);

  // Pot 1 goes in order to groups 0..g-1
  const pot1 = ordered.slice(0, g);
  for (let i = 0; i < pot1.length; i++) {
    groups[i]!.push(pot1[i]!.id);
  }

  // Each later pot: assign members to distinct groups that still have room
  const potCount = Math.ceil(ordered.length / g);
  for (let p = 1; p < potCount; p++) {
    const potMembers = ordered.slice(p * g, (p + 1) * g);
    const m = potMembers.length;

    // Groups that still have room
    const availableGroups: number[] = [];
    for (let i = 0; i < g; i++) {
      if (groups[i]!.length < sizes[i]!) {
        availableGroups.push(i);
      }
    }

    const groupOrder = shuffle(availableGroups, rng);

    interface BestAssignment {
      assignment: number[];
      conflicts: number;
    }

    let best: BestAssignment | null = null;
    let foundZero = false;

    const used = new Set<number>();
    const currentAssignment = new Array<number>(m);

    function search(memberIdx: number, currentConflicts: number) {
      if (foundZero) return;

      if (memberIdx === m) {
        if (best === null || currentConflicts < best.conflicts) {
          best = { assignment: [...currentAssignment], conflicts: currentConflicts };
          if (currentConflicts === 0) {
            foundZero = true;
          }
        }
        return;
      }

      const member = potMembers[memberIdx]!;

      for (const gId of groupOrder) {
        if (used.has(gId)) continue;

        let clashes = 0;
        for (const existingId of groups[gId]!) {
          const existingEntry = entryMap.get(existingId)!;
          if (sharesTeam(existingEntry, member)) {
            clashes++;
          }
        }

        const nextConflicts = currentConflicts + clashes;
        if (best !== null && nextConflicts >= best.conflicts) {
          continue;
        }

        used.add(gId);
        currentAssignment[memberIdx] = gId;

        search(memberIdx + 1, nextConflicts);

        used.delete(gId);
        if (foundZero) return;
      }
    }

    search(0, 0);

    for (let k = 0; k < m; k++) {
      const targetGroup = best!.assignment[k]!;
      groups[targetGroup]!.push(potMembers[k]!.id);
    }
  }

  // Find all same-team pairs across all groups
  const sameTeamPairs: [string, string][] = [];
  for (const group of groups) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const idA = group[i]!;
        const idB = group[j]!;
        const entryA = entryMap.get(idA)!;
        const entryB = entryMap.get(idB)!;
        if (sharesTeam(entryA, entryB)) {
          if (idA < idB) {
            sameTeamPairs.push([idA, idB]);
          } else {
            sameTeamPairs.push([idB, idA]);
          }
        }
      }
    }
  }

  sameTeamPairs.sort((a, b) => {
    const cmp0 = a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0;
    if (cmp0 !== 0) return cmp0;
    return a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0;
  });

  return {
    groups,
    sameTeamPairs,
  };
}
