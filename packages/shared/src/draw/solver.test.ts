import { describe, it, expect } from 'vitest';
import { createRng } from './prng';
import { solvePlacement } from './solver';
import type { DrawEntry, PlacementProblem } from './types';

describe('solvePlacement', () => {
  it('places draw.md appendix B with no same-team round-1 pair for 200 seeds', () => {
    // Appendix B: 8 slots, 4 pair units, A and B teams
    const A1: DrawEntry = { id: 'A1', teamIds: ['A'], seedScore: 8.2 };
    const B1: DrawEntry = { id: 'B1', teamIds: ['B'], seedScore: 8.0 };
    const A2: DrawEntry = { id: 'A2', teamIds: ['A'], seedScore: 7.6 };
    const C1: DrawEntry = { id: 'C1', teamIds: ['C'], seedScore: 7.4 };
    const A3: DrawEntry = { id: 'A3', teamIds: ['A'], seedScore: 7.1 };
    const B2: DrawEntry = { id: 'B2', teamIds: ['B'], seedScore: 6.9 };

    for (let i = 0; i < 200; i++) {
      const problem: PlacementProblem = {
        slotCount: 8,
        units: [[0, 1], [2, 3], [4, 5], [6, 7]],
        fixed: new Map([
          [0, A1],
          [1, null],
          [4, B1],
          [5, null],
        ]),
        pool: [A2, C1, A3, B2],
      };

      const rng = createRng(`b${i}`);
      const result = solvePlacement(problem, rng);

      // Verify structure
      expect(result.slots).toHaveLength(8);
      expect(result.conflicts).toEqual([]);
      expect(result.minimumPossibleConflicts).toBe(0);
      expect(result.provenMinimal).toBe(true);

      // Verify fixed slots
      expect(result.slots[0]).toBe('A1');
      expect(result.slots[1]).toBeNull();
      expect(result.slots[4]).toBe('B1');
      expect(result.slots[5]).toBeNull();

      // Verify A2 and A3 are in different units
      if (result.slots[2]) expect(result.slots[3]).not.toBe(result.slots[2]); // unit [2,3]
      if (result.slots[6]) expect(result.slots[7]).not.toBe(result.slots[6]); // unit [6,7]

      // Verify no two A's in same unit
      const slotsByUnit: { [k: number]: string[] } = {};
      for (let u = 0; u < 4; u++) {
        slotsByUnit[u] = problem.units[u]!
          .map((s) => result.slots[s])
          .filter((x) => x);
      }
      for (const ids of Object.values(slotsByUnit)) {
        const aCount = ids.filter((id) => id?.startsWith('A')).length;
        expect(aCount).toBeLessThanOrEqual(1);
      }
    }
  });

  it('handles infeasible placement with unavoidable conflict', () => {
    // 4 slots, 2 units [[0,1],[2,3]], 3 entries team A, 1 team B
    const A1: DrawEntry = { id: 'A1', teamIds: ['A'], seedScore: 10 };
    const A2: DrawEntry = { id: 'A2', teamIds: ['A'], seedScore: 9 };
    const A3: DrawEntry = { id: 'A3', teamIds: ['A'], seedScore: 8 };
    const B1: DrawEntry = { id: 'B1', teamIds: ['B'], seedScore: 7 };

    const problem: PlacementProblem = {
      slotCount: 4,
      units: [[0, 1], [2, 3]],
      fixed: new Map(),
      pool: [A1, A2, A3, B1],
    };

    const rng = createRng('infeasible');
    const result = solvePlacement(problem, rng);

    expect(result.slots).toHaveLength(4);
    expect(result.conflicts.length).toBe(1);
    expect(result.minimumPossibleConflicts).toBe(1);
    expect(result.provenMinimal).toBe(true);
  });

  it('places 16 entries with 4 teams 4 each into 8 pair units with 0 conflicts', () => {
    // DR-01: 16 entries, 4 teams, 8 pair units
    const entries: DrawEntry[] = [];
    for (let t = 0; t < 4; t++) {
      const team = String.fromCharCode(65 + t); // A, B, C, D
      for (let i = 0; i < 4; i++) {
        entries.push({
          id: `${team}${i}`,
          teamIds: [team],
          seedScore: 16 - entries.length,
        });
      }
    }

    const problem: PlacementProblem = {
      slotCount: 16,
      units: [
        [0, 1],
        [2, 3],
        [4, 5],
        [6, 7],
        [8, 9],
        [10, 11],
        [12, 13],
        [14, 15],
      ],
      fixed: new Map(),
      pool: entries,
    };

    for (let seed = 0; seed < 10; seed++) {
      const rng = createRng(`d${seed}`);
      const result = solvePlacement(problem, rng);

      expect(result.slots).toHaveLength(16);
      expect(result.conflicts).toEqual([]);
      expect(result.minimumPossibleConflicts).toBe(0);
    }
  });

  it('handles doubles with multi-team entries', () => {
    // Entries with multi-team ids
    const AB: DrawEntry = { id: 'AB', teamIds: ['A', 'B'], seedScore: 10 };
    const B: DrawEntry = { id: 'B', teamIds: ['B'], seedScore: 9 };
    const C: DrawEntry = { id: 'C', teamIds: ['C'], seedScore: 8 };
    const CD: DrawEntry = { id: 'CD', teamIds: ['C', 'D'], seedScore: 7 };

    const problem: PlacementProblem = {
      slotCount: 4,
      units: [[0, 1], [2, 3]],
      fixed: new Map(),
      pool: [AB, B, C, CD],
    };

    const rng = createRng('doubles');
    const result = solvePlacement(problem, rng);

    expect(result.conflicts).toEqual([]);
    expect(result.minimumPossibleConflicts).toBe(0);
  });

  it('handles group stage (4 slots per group)', () => {
    // Two groups with 4 slots each, 2 teams × 4
    const entries: DrawEntry[] = [
      { id: 'A1', teamIds: ['A'], seedScore: 10 },
      { id: 'A2', teamIds: ['A'], seedScore: 9 },
      { id: 'B1', teamIds: ['B'], seedScore: 8 },
      { id: 'B2', teamIds: ['B'], seedScore: 7 },
      { id: 'C1', teamIds: ['C'], seedScore: 6 },
      { id: 'C2', teamIds: ['C'], seedScore: 5 },
      { id: 'D1', teamIds: ['D'], seedScore: 4 },
      { id: 'D2', teamIds: ['D'], seedScore: 3 },
    ];

    const problem: PlacementProblem = {
      slotCount: 8,
      units: [[0, 1, 2, 3], [4, 5, 6, 7]],
      fixed: new Map(),
      pool: entries,
    };

    const rng = createRng('groups');
    const result = solvePlacement(problem, rng);

    expect(result.conflicts).toEqual([]);
    expect(result.minimumPossibleConflicts).toBe(0);
  });

  it('handles teamless entries (never clash)', () => {
    const E1: DrawEntry = { id: 'E1', teamIds: [], seedScore: 10 };
    const E2: DrawEntry = { id: 'E2', teamIds: [], seedScore: 9 };
    const E3: DrawEntry = { id: 'E3', teamIds: [], seedScore: 8 };
    const E4: DrawEntry = { id: 'E4', teamIds: [], seedScore: 7 };

    const problem: PlacementProblem = {
      slotCount: 4,
      units: [[0, 1], [2, 3]],
      fixed: new Map(),
      pool: [E1, E2, E3, E4],
    };

    const rng = createRng('teamless');
    const result = solvePlacement(problem, rng);

    expect(result.conflicts).toEqual([]);
    expect(result.minimumPossibleConflicts).toBe(0);
    expect(result.provenMinimal).toBe(true);
  });

  it('produces deterministic results for same problem and seed', () => {
    const entries: DrawEntry[] = [
      { id: 'A1', teamIds: ['A'], seedScore: 10 },
      { id: 'A2', teamIds: ['A'], seedScore: 9 },
      { id: 'B1', teamIds: ['B'], seedScore: 8 },
      { id: 'B2', teamIds: ['B'], seedScore: 7 },
    ];

    const problem: PlacementProblem = {
      slotCount: 4,
      units: [[0, 1], [2, 3]],
      fixed: new Map(),
      pool: entries,
    };

    const rng1 = createRng('det');
    const result1 = solvePlacement(problem, rng1);

    const rng2 = createRng('det');
    const result2 = solvePlacement(problem, rng2);

    expect(result1.slots).toEqual(result2.slots);
    expect(result1.conflicts).toEqual(result2.conflicts);
  });

  it('produces deterministic results with reversed pool order', () => {
    const entries: DrawEntry[] = [
      { id: 'A1', teamIds: ['A'], seedScore: 10 },
      { id: 'A2', teamIds: ['A'], seedScore: 9 },
      { id: 'B1', teamIds: ['B'], seedScore: 8 },
      { id: 'B2', teamIds: ['B'], seedScore: 7 },
    ];

    const problem1: PlacementProblem = {
      slotCount: 4,
      units: [[0, 1], [2, 3]],
      fixed: new Map(),
      pool: entries,
    };

    const problem2: PlacementProblem = {
      slotCount: 4,
      units: [[0, 1], [2, 3]],
      fixed: new Map(),
      pool: [...entries].reverse(),
    };

    const rng1 = createRng('reversed');
    const result1 = solvePlacement(problem1, rng1);

    const rng2 = createRng('reversed');
    const result2 = solvePlacement(problem2, rng2);

    // Same results despite reversed pool
    expect(result1.slots).toEqual(result2.slots);
  });

  it('respects search budget and returns best placement found', () => {
    const entries: DrawEntry[] = Array.from({ length: 4 }, (_, i) => ({
      id: `A${i}`,
      teamIds: ['A'],
      seedScore: 10 - i,
    }));

    const problem: PlacementProblem = {
      slotCount: 4,
      units: [[0, 1], [2, 3]],
      fixed: new Map(),
      pool: entries,
      maxSteps: 1, // Very tight budget
    };

    const rng = createRng('budget');
    const result = solvePlacement(problem, rng);

    // Should still return a valid placement
    expect(result.slots).toHaveLength(4);
    expect(result.slots.filter((s) => s !== null)).toHaveLength(4);
    expect(result.steps).toBeLessThanOrEqual(1);
  });

  it('validates invalid units', () => {
    const problem: PlacementProblem = {
      slotCount: 4,
      units: [[0, 1], [1, 2]], // Slot 1 appears twice
      fixed: new Map(),
      pool: [
        { id: 'A', teamIds: ['A'], seedScore: 10 },
        { id: 'B', teamIds: ['B'], seedScore: 9 },
        { id: 'C', teamIds: ['C'], seedScore: 8 },
        { id: 'D', teamIds: ['D'], seedScore: 7 },
      ],
    };

    const rng = createRng('test');
    expect(() => solvePlacement(problem, rng)).toThrow('DRAW_INVALID_UNITS');
  });

  it('validates out-of-range fixed slots', () => {
    const problem: PlacementProblem = {
      slotCount: 4,
      units: [[0, 1], [2, 3]],
      fixed: new Map([[5, null]]), // Slot 5 doesn't exist
      pool: [
        { id: 'A', teamIds: ['A'], seedScore: 10 },
        { id: 'B', teamIds: ['B'], seedScore: 9 },
        { id: 'C', teamIds: ['C'], seedScore: 8 },
      ],
    };

    const rng = createRng('test');
    expect(() => solvePlacement(problem, rng)).toThrow('DRAW_INVALID_UNITS');
  });

  it('validates pool/empty-slot count mismatch', () => {
    const problem: PlacementProblem = {
      slotCount: 4,
      units: [[0, 1], [2, 3]],
      fixed: new Map([[0, { id: 'A', teamIds: ['A'], seedScore: 10 }]]),
      pool: [
        { id: 'B', teamIds: ['B'], seedScore: 9 },
        { id: 'C', teamIds: ['C'], seedScore: 8 },
      ], // Should be 3 entries for 3 empty slots
    };

    const rng = createRng('test');
    expect(() => solvePlacement(problem, rng)).toThrow('DRAW_POOL_MISMATCH');
  });

  it('validates duplicate entry ids', () => {
    const dup = { id: 'DUP', teamIds: ['A'], seedScore: 10 };

    const problem: PlacementProblem = {
      slotCount: 4,
      units: [[0, 1], [2, 3]],
      fixed: new Map([[0, dup]]),
      pool: [
        dup, // Same entry in pool
        { id: 'B', teamIds: ['B'], seedScore: 9 },
        { id: 'C', teamIds: ['C'], seedScore: 8 },
      ],
    };

    const rng = createRng('test');
    expect(() => solvePlacement(problem, rng)).toThrow('DRAW_DUPLICATE_ENTRY');
  });
});
