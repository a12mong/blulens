import type { Rng } from './prng';
import { shuffle } from './prng';
import { sharesTeam } from './conflict';
import type { DrawEntry, SlotValue } from './types';
import { DRAW_MAX_SEARCH_STEPS } from './types';

/** Generic "no same team inside a unit" placement problem (draw.md §4/§5, D3/D7). */
export interface PlacementProblem {
  slotCount: number;
  units: readonly (readonly number[])[];
  fixed: ReadonlyMap<number, DrawEntry | null>;
  pool: readonly DrawEntry[];
  maxSteps?: number;
}

export interface UnitConflict {
  unitIndex: number;
  entryIds: string[];
  teamIds: string[];
}

export interface PlacementResult {
  slots: SlotValue[];
  conflicts: UnitConflict[];
  minimumPossibleConflicts: number;
  provenMinimal: boolean;
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
  for (const s of fixed.keys()) {
    if (s < 0 || s >= slotCount) throw new RangeError('DRAW_INVALID_UNITS');
  }
  const emptySlots = new Set<number>();
  for (let s = 0; s < slotCount; s++) {
    if (!fixed.has(s)) emptySlots.add(s);
  }
  if (pool.length !== emptySlots.size) throw new RangeError('DRAW_POOL_MISMATCH');

  const seenIds = new Set<string>();
  for (const e of [...fixed.values(), ...pool]) {
    if (!e) continue;
    if (seenIds.has(e.id)) throw new RangeError('DRAW_DUPLICATE_ENTRY');
    seenIds.add(e.id);
  }

  // Step 0: Lookup map & initial slot state
  const byId = new Map<string, DrawEntry>();
  const slots = new Array<SlotValue>(slotCount).fill(null);
  const filledSlots = new Set<number>();
  for (const [s, entry] of fixed) {
    if (entry) byId.set(entry.id, entry);
    slots[s] = entry?.id ?? null;
    filledSlots.add(s);
  }
  for (const entry of pool) byId.set(entry.id, entry);

  // Step 2: Deterministic pool shuffle
  const sorted = [...pool].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const order = shuffle(sorted, rng);

  const used = new Set<string>();
  let stepsUsed = 0;
  let foundSolution = false;

  const getUnit = (slot: number): number => slotToUnit.get(slot) ?? -1;
  const wouldClash = (entry: DrawEntry, unitIdx: number): boolean => {
    if (unitIdx === -1) return false;
    return units[unitIdx]!.some((s) => {
      const id = slots[s];
      return id ? sharesTeam(entry, byId.get(id)!) : false;
    });
  };

  // Phase 1: Zero-clash DFS
  const dfs = (): boolean => {
    if (stepsUsed >= maxSteps) return false;
    let minCandidates = Infinity;
    let chosenSlot = -1;
    for (const slot of emptySlots) {
      if (filledSlots.has(slot)) continue;
      const unitIdx = getUnit(slot);
      let candidates = 0;
      for (const entry of order) {
        if (!used.has(entry.id) && !wouldClash(entry, unitIdx)) candidates++;
      }
      if (candidates < minCandidates) {
        minCandidates = candidates;
        chosenSlot = slot;
      }
    }
    if (chosenSlot === -1) return true;
    if (minCandidates === 0) return false;

    const unitIdx = getUnit(chosenSlot);
    for (const entry of order) {
      if (used.has(entry.id) || wouldClash(entry, unitIdx)) continue;
      stepsUsed++;
      slots[chosenSlot] = entry.id;
      filledSlots.add(chosenSlot);
      used.add(entry.id);

      if (dfs()) return (foundSolution = true);

      slots[chosenSlot] = null;
      filledSlots.delete(chosenSlot);
      used.delete(entry.id);
      if (stepsUsed >= maxSteps) return false;
    }
    return false;
  };

  dfs();

  // Conflict lower bounds
  const teamCounts = new Map<string, number>();
  for (const e of byId.values()) {
    for (const t of e.teamIds) teamCounts.set(t, (teamCounts.get(t) || 0) + 1);
  }
  let minimumPossible = 0;
  for (const c of teamCounts.values())
    minimumPossible = Math.max(minimumPossible, c - units.length);

  let minPossibleC = 0;
  if (minimumPossible > 0) {
    const all = [...byId.values()];
    const pairSums: number[] = [];
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        if (sharesTeam(all[i]!, all[j]!)) {
          pairSums.push((all[i]!.seedScore ?? 0) + (all[j]!.seedScore ?? 0));
        }
      }
    }
    pairSums.sort((x, y) => x - y);
    for (let k = 0; k < Math.min(minimumPossible, pairSums.length); k++)
      minPossibleC += pairSums[k]!;
  }

  const evaluatePlacement = (curSlots: SlotValue[]) => {
    const conflicts: UnitConflict[] = [];
    let a = 0;
    let b = 0;
    let c = 0;
    for (let u = 0; u < units.length; u++) {
      const uSlots = units[u]!;
      for (let i = 0; i < uSlots.length; i++) {
        for (let j = i + 1; j < uSlots.length; j++) {
          const sI = uSlots[i]!;
          const sJ = uSlots[j]!;
          const idI = curSlots[sI];
          const idJ = curSlots[sJ];
          if (!idI || !idJ) continue;
          const ei = byId.get(idI);
          const ej = byId.get(idJ);
          if (ei && ej && sharesTeam(ei, ej)) {
            a++;
            if (fixed.has(sI) || fixed.has(sJ)) b++;
            c += (ei.seedScore ?? 0) + (ej.seedScore ?? 0);
            conflicts.push({
              unitIndex: u,
              entryIds: [idI, idJ].sort(),
              teamIds: ei.teamIds.filter((t) => ej.teamIds.includes(t)).sort(),
            });
          }
        }
      }
    }
    return { a, b, c, conflicts };
  };

  const emptySlotList = [...emptySlots].sort((a, b) => a - b);
  let finalSlots: SlotValue[] = slots;
  let finalConflicts: UnitConflict[] = [];
  let provenMinimal = true;

  if (!foundSolution) {
    // Phase 2: Branch-and-bound with remaining budget
    let curClashes = evaluatePlacement(slots).a;
    const bestHolder: {
      current: {
        a: number;
        b: number;
        c: number;
        slots: SlotValue[];
        conflicts: UnitConflict[];
      } | null;
    } = { current: null };
    let bbFinished = true;
    let stoppedEarly = false;

    const bb = (slotIdx: number) => {
      if (stoppedEarly) return;
      if (slotIdx >= emptySlotList.length) {
        const cost = evaluatePlacement(slots);
        const best = bestHolder.current;
        if (
          !best ||
          cost.a < best.a ||
          (cost.a === best.a && (cost.b < best.b || (cost.b === best.b && cost.c < best.c)))
        ) {
          bestHolder.current = { ...cost, slots: [...slots] };
          if (cost.a === minimumPossible && cost.b === 0 && cost.c <= minPossibleC) {
            stoppedEarly = true;
          }
        }
        return;
      }

      const chosenSlot = emptySlotList[slotIdx]!;
      const unitIdx = getUnit(chosenSlot);

      for (const entry of order) {
        if (used.has(entry.id)) continue;
        if (stepsUsed >= maxSteps) {
          bbFinished = false;
          return;
        }
        stepsUsed++;

        let newClashes = 0;
        if (unitIdx !== -1) {
          for (const s of units[unitIdx]!) {
            const id = slots[s];
            if (s !== chosenSlot && id && sharesTeam(entry, byId.get(id)!)) newClashes++;
          }
        }

        curClashes += newClashes;
        slots[chosenSlot] = entry.id;
        filledSlots.add(chosenSlot);
        used.add(entry.id);

        const backtrack = () => {
          slots[chosenSlot] = null;
          filledSlots.delete(chosenSlot);
          used.delete(entry.id);
          curClashes -= newClashes;
        };

        const best = bestHolder.current;
        if (!best || curClashes <= best.a) {
          bb(slotIdx + 1);
          if (stoppedEarly) {
            backtrack();
            return;
          }
        }

        backtrack();
        if (stepsUsed >= maxSteps) {
          bbFinished = false;
          return;
        }
      }
    };

    bb(0);

    const best = bestHolder.current;
    if (best !== null) {
      finalSlots = best.slots;
      finalConflicts = best.conflicts;
      provenMinimal = bbFinished || best.a === minimumPossible;
    } else {
      let p = 0;
      for (const s of emptySlotList) {
        if (!filledSlots.has(s) && p < order.length) slots[s] = order[p++]!.id;
      }
      finalSlots = slots;
      finalConflicts = evaluatePlacement(finalSlots).conflicts;
      provenMinimal = finalConflicts.length === minimumPossible;
    }
  }

  return {
    slots: finalSlots,
    conflicts: finalConflicts,
    minimumPossibleConflicts: Math.max(0, minimumPossible),
    provenMinimal,
    steps: stepsUsed,
  };
}
