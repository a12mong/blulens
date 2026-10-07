import type { Rng } from './prng';
import { notImplemented } from './stub';
import type { DrawEntry, SlotValue } from './types';

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
  return notImplemented(`bl-18-4 solvePlacement(${problem.slotCount} slots, ${typeof rng})`);
}
