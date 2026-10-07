import { bracketOrder } from './bracket-order';
import { planSeeding, type SeedPlacement } from './plan-seeding';
import { createRng } from './prng';
import { solvePlacement } from './solver';
import { DRAW_PRNG_ID, DRAW_RULESET_VERSION, type DrawEntry, type SlotValue } from './types';

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
  const rng = createRng(seed);
  const plan = planSeeding(entries, rng);

  const order = bracketOrder(plan.size);
  const positionOfRank = new Map<number, number>();
  for (let p = 1; p <= order.length; p++) {
    positionOfRank.set(order[p - 1]!, p);
  }

  const entryById = new Map<string, DrawEntry>();
  for (const entry of entries) {
    entryById.set(entry.id, entry);
  }

  const fixed = new Map<number, DrawEntry | null>();
  for (const s of plan.seeds) {
    const p = positionOfRank.get(s.rank)!;
    fixed.set(p - 1, entryById.get(s.entryId)!);
  }

  for (const byeRank of plan.byeRanks) {
    const p = positionOfRank.get(byeRank)!;
    fixed.set(p - 1, null);
  }

  const pool: DrawEntry[] = plan.unseededIds.map((id) => entryById.get(id)!);

  const units: number[][] = [];
  for (let i = 0; i < plan.size; i += 2) {
    units.push([i, i + 1]);
  }

  const res = solvePlacement({ slotCount: plan.size, units, fixed, pool }, rng);

  return {
    rulesetVersion: DRAW_RULESET_VERSION,
    prngId: DRAW_PRNG_ID,
    seed,
    size: plan.size,
    seedCount: plan.seedCount,
    seeds: plan.seeds,
    slots: res.slots,
    conflicts: res.conflicts.map((c) => ({
      matchNo: c.unitIndex + 1,
      entryIds: [c.entryIds[0]!, c.entryIds[1]!] as [string, string],
      teamIds: c.teamIds,
    })),
    minimumPossibleConflicts: res.minimumPossibleConflicts,
    provenMinimal: res.provenMinimal,
    searchSteps: res.steps,
  };
}
