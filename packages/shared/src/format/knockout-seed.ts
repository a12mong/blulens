import { bracketOrder } from '../draw/bracket-order';
import { sharesTeam } from '../draw/conflict';

export interface Qualifier {
  entryId: string;
  teamIds: string[];
  groupIndex: number;
  tier: 1 | 2 | 3;
  tierRank: number; // tierRank 1 = best inside its tier (the caller ranks each tier with the §4.3 criteria)
}

export interface KnockoutPlan {
  size: number;
  slots: (string | null)[];
  teamClashes: number;
  groupClashes: number;
}

function countClashes(
  slots: readonly (string | null)[],
  byId: ReadonlyMap<string, Qualifier>,
): { teamClashes: number; groupClashes: number } {
  let teamClashes = 0;
  let groupClashes = 0;

  for (let m = 0; m < slots.length; m += 2) {
    const aId = slots[m];
    const bId = slots[m + 1];
    if (typeof aId === 'string' && typeof bId === 'string') {
      const a = byId.get(aId)!;
      const b = byId.get(bId)!;
      if (sharesTeam(a, b)) {
        teamClashes++;
      }
      if (a.groupIndex === b.groupIndex) {
        groupClashes++;
      }
    }
  }

  return { teamClashes, groupClashes };
}

function isBetter(t1: number, g1: number, t2: number, g2: number): boolean {
  if (t1 < t2) return true;
  if (t1 > t2) return false;
  return g1 < g2;
}

export function seedKnockout(qualifiers: readonly Qualifier[], _seed: string): KnockoutPlan {
  const Q = qualifiers.length;
  if (Q < 2) {
    throw new RangeError(`seedKnockout: at least 2 qualifiers required, got ${Q}`);
  }

  // 1. Sort by (tier asc, tierRank asc, entryId asc) -> seed number 1..Q
  const ordered = [...qualifiers].sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    if (a.tierRank !== b.tierRank) return a.tierRank - b.tierRank;
    return a.entryId.localeCompare(b.entryId);
  });

  const byId = new Map<string, Qualifier>(ordered.map((q) => [q.entryId, q]));

  // 2. Bracket size S = smallest power of two >= Q
  let S = 2;
  while (S < Q) {
    S *= 2;
  }

  const sOrder = bracketOrder(S);
  const currentSlots: (string | null)[] = new Array(S).fill(null);

  for (let slotIdx = 0; slotIdx < S; slotIdx++) {
    const seedNumber = sOrder[slotIdx]!;
    if (seedNumber <= Q) {
      currentSlots[slotIdx] = ordered[seedNumber - 1]!.entryId;
    } else {
      currentSlots[slotIdx] = null;
    }
  }

  // 3. Improve: repeatedly look for the best single SWAP of two entries of the SAME tier
  // that lowers (teamClashes, groupClashes) lexicographically; apply it; stop when no swap improves.
  let currentClashes = countClashes(currentSlots, byId);

  while (true) {
    let bestSwap: {
      i: number;
      j: number;
      teamClashes: number;
      groupClashes: number;
    } | null = null;

    for (let i = 0; i < S; i++) {
      const aId = currentSlots[i];
      if (typeof aId !== 'string') continue;
      const aQualifier = byId.get(aId)!;

      for (let j = i + 1; j < S; j++) {
        const bId = currentSlots[j];
        if (typeof bId !== 'string') continue;
        const bQualifier = byId.get(bId)!;

        // Never swap across tiers
        if (aQualifier.tier !== bQualifier.tier) continue;

        // Trial swap in-place
        currentSlots[i] = bId;
        currentSlots[j] = aId;
        const trialClashes = countClashes(currentSlots, byId);
        currentSlots[i] = aId;
        currentSlots[j] = bId;

        // Must strictly improve current clashes
        if (
          !isBetter(
            trialClashes.teamClashes,
            trialClashes.groupClashes,
            currentClashes.teamClashes,
            currentClashes.groupClashes,
          )
        ) {
          continue;
        }

        // Must be better than the best swap seen so far in this iteration
        if (bestSwap === null) {
          bestSwap = {
            i,
            j,
            teamClashes: trialClashes.teamClashes,
            groupClashes: trialClashes.groupClashes,
          };
        } else if (
          isBetter(
            trialClashes.teamClashes,
            trialClashes.groupClashes,
            bestSwap.teamClashes,
            bestSwap.groupClashes,
          )
        ) {
          bestSwap = {
            i,
            j,
            teamClashes: trialClashes.teamClashes,
            groupClashes: trialClashes.groupClashes,
          };
        }
      }
    }

    if (bestSwap === null) {
      break;
    }

    // Apply the best swap
    const tmp = currentSlots[bestSwap.i] ?? null;
    currentSlots[bestSwap.i] = currentSlots[bestSwap.j] ?? null;
    currentSlots[bestSwap.j] = tmp;
    currentClashes = {
      teamClashes: bestSwap.teamClashes,
      groupClashes: bestSwap.groupClashes,
    };
  }

  const finalClashes = countClashes(currentSlots, byId);

  return {
    size: S,
    slots: currentSlots,
    teamClashes: finalClashes.teamClashes,
    groupClashes: finalClashes.groupClashes,
  };
}
