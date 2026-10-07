import { describe, expect, it } from 'vitest';
import { solvePlacement, type PlacementProblem } from '../solver';
import { createRng } from '../prng';

describe('DR-14: Solver provenMinimal on exhausted search budget vs optimal run', () => {
  // 8 entries with two teams of 2 each across 4 pairs (lower bound 0).
  // Seed 'seed-14' produces 1 clash on first-fit fallback when budget runs out,
  // whereas the full search budget achieves the lower bound of 0 clashes.
  const seed = 'seed-14';

  const baseProblem: PlacementProblem = {
    slotCount: 8,
    units: [
      [0, 1],
      [2, 3],
      [4, 5],
      [6, 7],
    ],
    fixed: new Map(),
    pool: [
      { id: 'a1', teamIds: ['team-A'], seedScore: 10 },
      { id: 'a2', teamIds: ['team-A'], seedScore: 9 },
      { id: 'b1', teamIds: ['team-B'], seedScore: 8 },
      { id: 'b2', teamIds: ['team-B'], seedScore: 7 },
      { id: 'c1', teamIds: [], seedScore: 6 },
      { id: 'c2', teamIds: [], seedScore: 5 },
      { id: 'c3', teamIds: [], seedScore: 4 },
      { id: 'c4', teamIds: [], seedScore: 3 },
    ],
  };

  it('reports provenMinimal=false when search budget is exhausted above the lower bound (seed: seed-14)', () => {
    // Tiny search budget forces DFS/B&B to exhaust steps and fall back to first-fit
    const problem: PlacementProblem = {
      ...baseProblem,
      maxSteps: 1,
    };

    const rng = createRng(seed);
    const result = solvePlacement(problem, rng);

    // Verify search budget was exhausted
    expect(result.steps).toBeGreaterThanOrEqual(problem.maxSteps!);

    // Fixture precondition: placement returned above theoretical lower bound (0)
    expect(result.minimumPossibleConflicts).toBe(0);
    expect(result.conflicts.length).toBeGreaterThan(result.minimumPossibleConflicts);

    // When placement has more clashes than minimumPossible and search budget was exhausted,
    // solver cannot guarantee minimality; provenMinimal MUST be false.
    expect(result.provenMinimal).toBe(false);
  });

  it('reports provenMinimal=true and 0 conflicts with default budget (positive twin, seed: seed-14)', () => {
    const rng = createRng(seed);
    const result = solvePlacement(baseProblem, rng);

    // Full search budget finds zero-clash assignment matching theoretical lower bound
    expect(result.minimumPossibleConflicts).toBe(0);
    expect(result.conflicts.length).toBe(result.minimumPossibleConflicts);
    expect(result.provenMinimal).toBe(true);
  });
});
