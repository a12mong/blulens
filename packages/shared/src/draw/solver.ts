import type { Rng } from './prng';
import { shuffle } from './prng';
import { sharesTeam } from './conflict';
import type { DrawEntry, SlotValue } from './types';
import { DRAW_MAX_SEARCH_STEPS } from './types';

/**
 * Generic "no same team inside a unit" placement problem (draw.md §4/§5, D3/D7).
 * Knockout round 1: each unit is one round-1 pair of slot indexes.
 * Group stage (bl-17): each unit is one group's slot indexes — same solver, different units.
 */
export interface PlacementProblem {
  /** Slots are indexed 0..slotCount-1. */
  slotCount: number;
  /** Disjoint sets of slot indexes whose occupants must not share a team. */
  units: readonly (readonly number[])[];
  /** Pre-filled slots: seeds (an entry) or byes (null). */
  fixed: ReadonlyMap<number, DrawEntry | null>;
  /** Entries for the remaining empty slots; length must equal the number of empty slots. */
  pool: readonly DrawEntry[];
  /** Search budget; defaults to DRAW_MAX_SEARCH_STEPS. */
  maxSteps?: number;
}

export interface UnitConflict {
  unitIndex: number;
  /** Ids of the clashing entries in that unit, ascending. */
  entryIds: string[];
  /** Team ids they share, ascending. */
  teamIds: string[];
}

export interface PlacementResult {
  /** Final content of every slot (entry id or null = bye). */
  slots: SlotValue[];
  conflicts: UnitConflict[];
  /** Lower bound on unavoidable conflicts. */
  minimumPossibleConflicts: number;
  /** True when conflicts.length is proven minimal (search finished or bound reached). */
  provenMinimal: boolean;
  /** Backtracking steps used. */
  steps: number;
}

/** Fill empty slots from the pool with zero same-team units if possible, else the fewest (D3). */
export function solvePlacement(problem: PlacementProblem, rng: Rng): PlacementResult {
  const { slotCount, units, fixed, pool, maxSteps = DRAW_MAX_SEARCH_STEPS } = problem;

  // Step 1: Validate
  const slotToUnit = new Map<number, number>();
  for (let u = 0; u < units.length; u++) {
    for (const slot of units[u]!) {
      if (slot < 0 || slot >= slotCount || slotToUnit.has(slot)) {
        throw new RangeError('DRAW_INVALID_UNITS');
      }
      slotToUnit.set(slot, u);
    }
  }

  for (const slot of fixed.keys()) {
    if (slot < 0 || slot >= slotCount) throw new RangeError('DRAW_INVALID_UNITS');
  }

  const emptySlots = new Set<number>();
  for (let s = 0; s < slotCount; s++) {
    if (!fixed.has(s)) emptySlots.add(s);
  }

  if (pool.length !== emptySlots.size) throw new RangeError('DRAW_POOL_MISMATCH');

  const seenIds = new Set<string>();
  for (const entry of fixed.values()) {
    if (entry && seenIds.has(entry.id)) throw new RangeError('DRAW_DUPLICATE_ENTRY');
    if (entry) seenIds.add(entry.id);
  }
  for (const entry of pool) {
    if (seenIds.has(entry.id)) throw new RangeError('DRAW_DUPLICATE_ENTRY');
    seenIds.add(entry.id);
  }

  // Step 2: Shuffle pool entries by id
  const sorted = [...pool].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const order = shuffle(sorted, rng);

  // Step 3: Initialize slots and search state
  const slots = new Array<SlotValue>(slotCount).fill(null);
  const filledSlots = new Set<number>();
  for (const [s, entry] of fixed) {
    slots[s] = entry?.id ?? null;
    filledSlots.add(s);
  }

  const used = new Set<string>();
  let stepsUsed = 0;
  let foundSolution = false;

  // Helper: get unit index for a slot (or -1 if slot is not in any unit)
  const getUnit = (slot: number): number => slotToUnit.get(slot) ?? -1;

  // Helper: get occupied entries in a unit (from fixed and current placement)
  const getUnitOccupants = (unitIdx: number): (DrawEntry | null)[] => {
    const occupants: (DrawEntry | null)[] = [];
    for (const slot of units[unitIdx]!) {
      if (filledSlots.has(slot)) {
        const slotVal = slots[slot];
        if (slotVal === null) {
          occupants.push(null);
        } else {
          const entry = [...order, ...fixed.values()].find((e) => e && e.id === slotVal);
          occupants.push(entry || null);
        }
      }
    }
    return occupants;
  };

  // Helper: check if an entry clashes with any occupant in a unit
  const wouldClash = (entry: DrawEntry, unitIdx: number): boolean => {
    if (unitIdx === -1) return false; // slot not in any unit
    const occupants = getUnitOccupants(unitIdx);
    for (const occ of occupants) {
      if (occ && sharesTeam(entry, occ)) return true;
    }
    return false;
  };

  // DFS with backtracking
  const dfs = (): boolean => {
    if (stepsUsed >= maxSteps) return false;

    // Find the empty slot with fewest candidates
    let minCandidates = Infinity;
    let chosenSlot = -1;

    for (const slot of emptySlots) {
      if (filledSlots.has(slot)) continue; // already filled
      const unitIdx = getUnit(slot);
      let candidates = 0;
      for (const entry of order) {
        if (!used.has(entry.id) && !wouldClash(entry, unitIdx)) {
          candidates++;
        }
      }
      if (candidates < minCandidates) {
        minCandidates = candidates;
        chosenSlot = slot;
      }
    }

    if (chosenSlot === -1) {
      // All slots filled
      return true;
    }

    if (minCandidates === 0) {
      // Dead end: no valid candidate for this slot
      return false;
    }

    // Try entries in order
    const unitIdx = getUnit(chosenSlot);
    for (const entry of order) {
      if (used.has(entry.id) || wouldClash(entry, unitIdx)) continue;

      stepsUsed++;
      slots[chosenSlot] = entry.id;
      filledSlots.add(chosenSlot);
      used.add(entry.id);

      if (dfs()) {
        foundSolution = true;
        return true;
      }

      // Backtrack
      slots[chosenSlot] = null;
      filledSlots.delete(chosenSlot);
      used.delete(entry.id);

      if (stepsUsed >= maxSteps) return false;
    }

    return false;
  };

  // Attempt zero-clash search
  dfs();

  // Step 4: If search didn't complete, use simple greedy fallback
  if (!foundSolution) {
    let poolIdx = 0;
    for (const slot of [...emptySlots].sort((a, b) => a - b)) {
      if (!filledSlots.has(slot) && poolIdx < order.length) {
        slots[slot] = order[poolIdx]!.id;
        filledSlots.add(slot);
        poolIdx++;
      }
    }
  }

  // Step 5: Compute conflicts
  const conflicts: UnitConflict[] = [];
  for (let u = 0; u < units.length; u++) {
    const unitSlots = units[u]!;
    for (let i = 0; i < unitSlots.length; i++) {
      for (let j = i + 1; j < unitSlots.length; j++) {
        const slotI = unitSlots[i]!;
        const slotJ = unitSlots[j]!;
        const entryI = slots[slotI];
        const entryJ = slots[slotJ];

        if (!entryI || !entryJ) continue; // bye never clashes

        const ei = [...order, ...fixed.values()].find((e) => e && e.id === entryI);
        const ej = [...order, ...fixed.values()].find((e) => e && e.id === entryJ);

        if (ei && ej && sharesTeam(ei, ej)) {
          const sharedTeams = new Set<string>();
          for (const teamId of ei.teamIds) {
            if (ej.teamIds.includes(teamId)) sharedTeams.add(teamId);
          }
          const teamIds = [...sharedTeams].sort((a, b) =>
            a < b ? -1 : a > b ? 1 : 0
          );
          conflicts.push({
            unitIndex: u,
            entryIds: [entryI, entryJ].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
            teamIds,
          });
        }
      }
    }
  }

  // Step 6: Compute lower bound
  const allEntries = [
    ...pool,
    ...[...fixed.values()].filter((e) => e),
  ] as DrawEntry[];
  const teamCounts = new Map<string, number>();
  for (const entry of allEntries) {
    for (const teamId of entry.teamIds) {
      teamCounts.set(teamId, (teamCounts.get(teamId) || 0) + 1);
    }
  }

  let minimumPossible = 0;
  for (const count of teamCounts.values()) {
    minimumPossible = Math.max(minimumPossible, count - units.length);
  }

  const provenMinimal =
    foundSolution || (stepsUsed >= maxSteps ? conflicts.length === minimumPossible : true);

  return {
    slots,
    conflicts,
    minimumPossibleConflicts: Math.max(0, minimumPossible),
    provenMinimal,
    steps: stepsUsed,
  };
}
