/**
 * Shared draw types (docs/specs/draw.md, ruleset draw-v1).
 * Every function in src/draw/ is pure: no Date, no Math.random, no I/O.
 * Randomness comes only from an Rng created by createRng(seed) in ./prng.
 */

export const DRAW_RULESET_VERSION = 'draw-v1';

/** Name + version of the PRNG recorded with every draw (draw.md §4). */
export const DRAW_PRNG_ID = 'xoshiro128**/cyrb128-v1';

/** Backtracking budget before falling back to the best placement found (draw.md §4 step 4). */
export const DRAW_MAX_SEARCH_STEPS = 200_000;

/** One entry (singles = 1 player, doubles = 2) as snapshotted at draw time (draw.md §2). */
export interface DrawEntry {
  id: string;
  /**
   * Team ids of the entry's players on the draw date, deduplicated.
   * Empty = no team, never clashes. Doubles from two clubs carry two ids (D7).
   */
  teamIds: readonly string[];
  /** Singles: approved score. Doubles: mean of both players' scores (D2). */
  seedScore: number;
}

/** Content of one bracket position: an entry id, or null for a bye. */
export type SlotValue = string | null;
