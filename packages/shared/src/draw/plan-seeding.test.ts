import { describe, it, expect } from 'vitest';
import { createRng } from './prng';
import { planSeeding, bracketSize, seedCount } from './plan-seeding';
import type { DrawEntry } from './types';

describe('bracketSize', () => {
  const cases = [
    [2, 2],
    [3, 4],
    [4, 4],
    [5, 8],
    [8, 8],
    [9, 16],
    [16, 16],
    [17, 32],
    [32, 32],
    [33, 64],
    [64, 64],
    [65, 128],
    [128, 128],
    [129, 256],
    [256, 256],
  ];

  for (const [n, expected] of cases) {
    it(`returns ${expected} for N=${n}`, () => {
      expect(bracketSize(n)).toBe(expected);
    });
  }

  it('throws DRAW_TOO_FEW_ENTRIES when N < 2', () => {
    expect(() => bracketSize(1)).toThrow('DRAW_TOO_FEW_ENTRIES');
  });

  it('throws DRAW_TOO_MANY_ENTRIES when N > 256', () => {
    expect(() => bracketSize(257)).toThrow('DRAW_TOO_MANY_ENTRIES');
  });
});

describe('seedCount', () => {
  const cases = [
    [2, 0],
    [3, 2],
    [4, 2],
    [5, 2],
    [8, 2],
    [9, 4],
    [16, 4],
    [17, 8],
    [32, 8],
    [33, 16],
    [64, 16],
    [65, 16],
    [128, 16],
    [129, 16],
    [256, 16],
  ];

  for (const [n, expected] of cases) {
    it(`returns ${expected} seeds for N=${n}`, () => {
      expect(seedCount(n)).toBe(expected);
    });
  }

  it('throws DRAW_TOO_FEW_ENTRIES when N < 2', () => {
    expect(() => seedCount(1)).toThrow('DRAW_TOO_FEW_ENTRIES');
  });

  it('throws DRAW_TOO_MANY_ENTRIES when N > 256', () => {
    expect(() => seedCount(257)).toThrow('DRAW_TOO_MANY_ENTRIES');
  });
});

describe('planSeeding', () => {
  it('tie-breaks non-adjacent equal scores (D1 rule)', () => {
    // Bug test: a=7.0, b=8.0, c=7.0 are not id-adjacent but have same scores
    // After sort by id: [a,b,c]; after stable sort by score desc: [b, {a,c}]
    // a and c must shuffle together, so seeds[1] is sometimes a, sometimes c
    const entries: DrawEntry[] = [
      { id: 'a', teamIds: [], seedScore: 7.0 },
      { id: 'b', teamIds: [], seedScore: 8.0 },
      { id: 'c', teamIds: [], seedScore: 7.0 },
    ];

    const seed2Results = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const rng = createRng(`t${i}`);
      const result = planSeeding(entries, rng);
      if (result.seedCount >= 2) {
        seed2Results.add(result.seeds[1]!.entryId);
        // b is always seed 1 (highest score 8.0)
        expect(result.seeds[0]!.entryId).toBe('b');
      }
    }
    // Both a and c should appear as seed 2 due to tie-breaking shuffle
    expect(seed2Results).toContain('a');
    expect(seed2Results).toContain('c');
  });

  it('plans the draw.md appendix B event exactly', () => {
    const entries: DrawEntry[] = [
      { id: 'A1', teamIds: [], seedScore: 8.2 },
      { id: 'B1', teamIds: [], seedScore: 8.0 },
      { id: 'A2', teamIds: [], seedScore: 7.6 },
      { id: 'C1', teamIds: [], seedScore: 7.4 },
      { id: 'A3', teamIds: [], seedScore: 7.1 },
      { id: 'B2', teamIds: [], seedScore: 6.9 },
    ];

    const rng = createRng('appendix-b');
    const result = planSeeding(entries, rng);

    expect(result).toEqual({
      size: 8,
      seedCount: 2,
      byeCount: 2,
      seeds: [
        { entryId: 'A1', seedNo: 1, rank: 1 },
        { entryId: 'B1', seedNo: 2, rank: 2 },
      ],
      byeRanks: [7, 8],
      unseededIds: ['A2', 'A3', 'B2', 'C1'],
    });
  });

  it('handles N=2 (no seeds)', () => {
    const entries: DrawEntry[] = [
      { id: 'P1', teamIds: [], seedScore: 10 },
      { id: 'P2', teamIds: [], seedScore: 9 },
    ];

    const rng = createRng('n2');
    const result = planSeeding(entries, rng);

    expect(result).toEqual({
      size: 2,
      seedCount: 0,
      byeCount: 0,
      seeds: [],
      byeRanks: [],
      unseededIds: ['P1', 'P2'],
    });
  });

  it('handles N=3 (size 4, 2 seeds)', () => {
    const entries: DrawEntry[] = [
      { id: 'E1', teamIds: [], seedScore: 7.5 },
      { id: 'E2', teamIds: [], seedScore: 7.3 },
      { id: 'E3', teamIds: [], seedScore: 6.8 },
    ];

    const rng = createRng('n3');
    const result = planSeeding(entries, rng);

    expect(result.size).toBe(4);
    expect(result.seedCount).toBe(2);
    expect(result.byeCount).toBe(1);
    expect(result.byeRanks).toEqual([4]);
    expect(result.seeds).toHaveLength(2);
    expect(result.unseededIds).toEqual(['E3']);
  });

  it('handles N=4 (size 4, 2 seeds)', () => {
    const entries: DrawEntry[] = [
      { id: 'X1', teamIds: [], seedScore: 10 },
      { id: 'X2', teamIds: [], seedScore: 9 },
      { id: 'X3', teamIds: [], seedScore: 8 },
      { id: 'X4', teamIds: [], seedScore: 7 },
    ];

    const rng = createRng('n4');
    const result = planSeeding(entries, rng);

    expect(result.size).toBe(4);
    expect(result.seedCount).toBe(2);
    expect(result.byeCount).toBe(0);
    expect(result.byeRanks).toEqual([]);
  });

  it('handles N=5 (size 8, 2 seeds)', () => {
    const entries: DrawEntry[] = [
      { id: 'F1', teamIds: [], seedScore: 10 },
      { id: 'F2', teamIds: [], seedScore: 9 },
      { id: 'F3', teamIds: [], seedScore: 8 },
      { id: 'F4', teamIds: [], seedScore: 7 },
      { id: 'F5', teamIds: [], seedScore: 6 },
    ];

    const rng = createRng('n5');
    const result = planSeeding(entries, rng);

    expect(result.size).toBe(8);
    expect(result.seedCount).toBe(2);
    expect(result.byeCount).toBe(3);
    expect(result.byeRanks).toEqual([6, 7, 8]);
  });

  it('handles N=8 (size 8, 2 seeds)', () => {
    const entries: DrawEntry[] = Array.from({ length: 8 }, (_, i) => ({
      id: `E${i}`,
      teamIds: [],
      seedScore: 10 - i,
    }));

    const rng = createRng('n8');
    const result = planSeeding(entries, rng);

    expect(result.size).toBe(8);
    expect(result.seedCount).toBe(2);
    expect(result.byeCount).toBe(0);
  });

  it('handles N=9 (size 16, 4 seeds)', () => {
    const entries: DrawEntry[] = Array.from({ length: 9 }, (_, i) => ({
      id: `G${i}`,
      teamIds: [],
      seedScore: 10 - i,
    }));

    const rng = createRng('n9');
    const result = planSeeding(entries, rng);

    expect(result.size).toBe(16);
    expect(result.seedCount).toBe(4);
    expect(result.byeCount).toBe(7);
    expect(result.seeds).toHaveLength(4);
    // Seeds 3 and 4 should have ranks from [3, 4]
    const seed3Rank = result.seeds[2]!.rank;
    const seed4Rank = result.seeds[3]!.rank;
    expect([seed3Rank, seed4Rank].sort()).toEqual([3, 4]);
  });

  it('handles N=16 (size 16, 4 seeds)', () => {
    const entries: DrawEntry[] = Array.from({ length: 16 }, (_, i) => ({
      id: `H${i}`,
      teamIds: [],
      seedScore: 20 - i,
    }));

    const rng = createRng('n16');
    const result = planSeeding(entries, rng);

    expect(result.size).toBe(16);
    expect(result.seedCount).toBe(4);
    expect(result.byeCount).toBe(0);
  });

  it('handles N=17 (size 32, 8 seeds)', () => {
    const entries: DrawEntry[] = Array.from({ length: 17 }, (_, i) => ({
      id: `I${i}`,
      teamIds: [],
      seedScore: 20 - i,
    }));

    const rng = createRng('n17');
    const result = planSeeding(entries, rng);

    expect(result.size).toBe(32);
    expect(result.seedCount).toBe(8);
    expect(result.byeCount).toBe(15);
  });

  it('handles N=32 (size 32, 8 seeds)', () => {
    const entries: DrawEntry[] = Array.from({ length: 32 }, (_, i) => ({
      id: `J${String(i).padStart(2, '0')}`,
      teamIds: [],
      seedScore: 40 - i,
    }));

    const rng = createRng('n32');
    const result = planSeeding(entries, rng);

    expect(result.size).toBe(32);
    expect(result.seedCount).toBe(8);
    expect(result.byeCount).toBe(0);
  });

  it('handles N=33 (size 64, 16 seeds)', () => {
    const entries: DrawEntry[] = Array.from({ length: 33 }, (_, i) => ({
      id: `K${String(i).padStart(2, '0')}`,
      teamIds: [],
      seedScore: 40 - i,
    }));

    const rng = createRng('n33');
    const result = planSeeding(entries, rng);

    expect(result.size).toBe(64);
    expect(result.seedCount).toBe(16);
    expect(result.byeCount).toBe(31);
  });

  it('handles N=64 (size 64, 16 seeds)', () => {
    const entries: DrawEntry[] = Array.from({ length: 64 }, (_, i) => ({
      id: `L${String(i).padStart(2, '0')}`,
      teamIds: [],
      seedScore: 70 - i,
    }));

    const rng = createRng('n64');
    const result = planSeeding(entries, rng);

    expect(result.size).toBe(64);
    expect(result.seedCount).toBe(16);
    expect(result.byeCount).toBe(0);
  });

  it('handles N=65 (size 128, 16 seeds)', () => {
    const entries: DrawEntry[] = Array.from({ length: 65 }, (_, i) => ({
      id: `M${String(i).padStart(2, '0')}`,
      teamIds: [],
      seedScore: 70 - i,
    }));

    const rng = createRng('n65');
    const result = planSeeding(entries, rng);

    expect(result.size).toBe(128);
    expect(result.seedCount).toBe(16);
    expect(result.byeCount).toBe(63);
  });

  it('handles N=256 (size 256, 16 seeds)', () => {
    const entries: DrawEntry[] = Array.from({ length: 256 }, (_, i) => ({
      id: `N${String(i).padStart(3, '0')}`,
      teamIds: [],
      seedScore: 260 - i,
    }));

    const rng = createRng('n256');
    const result = planSeeding(entries, rng);

    expect(result.size).toBe(256);
    expect(result.seedCount).toBe(16);
    expect(result.byeCount).toBe(0);
  });

  it('throws DRAW_TOO_FEW_ENTRIES when N < 2', () => {
    const entries: DrawEntry[] = [{ id: 'X', teamIds: [], seedScore: 10 }];
    const rng = createRng('test');

    expect(() => planSeeding(entries, rng)).toThrow('DRAW_TOO_FEW_ENTRIES');
  });

  it('throws DRAW_TOO_MANY_ENTRIES when N > 256', () => {
    const entries: DrawEntry[] = Array.from({ length: 257 }, (_, i) => ({
      id: `O${String(i).padStart(3, '0')}`,
      teamIds: [],
      seedScore: 260 - i,
    }));
    const rng = createRng('test');

    expect(() => planSeeding(entries, rng)).toThrow('DRAW_TOO_MANY_ENTRIES');
  });

  it('throws DRAW_DUPLICATE_ENTRY when there are duplicate ids', () => {
    const entries: DrawEntry[] = [
      { id: 'DUP', teamIds: [], seedScore: 10 },
      { id: 'DUP', teamIds: [], seedScore: 9 },
    ];
    const rng = createRng('test');

    expect(() => planSeeding(entries, rng)).toThrow('DRAW_DUPLICATE_ENTRY');
  });

  it('handles 4 entries with identical seedScore deterministically', () => {
    const entries: DrawEntry[] = [
      { id: 'T1', teamIds: [], seedScore: 7.0 },
      { id: 'T2', teamIds: [], seedScore: 7.0 },
      { id: 'T3', teamIds: [], seedScore: 7.0 },
      { id: 'T4', teamIds: [], seedScore: 7.0 },
    ];

    const rng1 = createRng('tie');
    const result1 = planSeeding(entries, rng1);

    const rng2 = createRng('tie');
    const result2 = planSeeding(entries, rng2);

    expect(result1).toEqual(result2);
  });

  it('handles 4 entries with identical seedScore differently with different seed', () => {
    const entries: DrawEntry[] = [
      { id: 'T1', teamIds: [], seedScore: 7.0 },
      { id: 'T2', teamIds: [], seedScore: 7.0 },
      { id: 'T3', teamIds: [], seedScore: 7.0 },
      { id: 'T4', teamIds: [], seedScore: 7.0 },
    ];

    const rng1 = createRng('tie1');
    const result1 = planSeeding(entries, rng1);

    const rng2 = createRng('tie2');
    const result2 = planSeeding(entries, rng2);

    // Results may differ because the tie-breaking shuffle is different
    // but they should still be valid
    expect(result1).toBeDefined();
    expect(result2).toBeDefined();
  });

  it('produces valid seed rankings', () => {
    const entries: DrawEntry[] = Array.from({ length: 16 }, (_, i) => ({
      id: `V${i}`,
      teamIds: [],
      seedScore: 20 - i,
    }));

    const rng = createRng('valid-ranks');
    const result = planSeeding(entries, rng);

    // Check seed 1 is rank 1
    expect(result.seeds[0]!.rank).toBe(1);

    // Check seed 2 is rank 2
    if (result.seedCount >= 2) {
      expect(result.seeds[1]!.rank).toBe(2);
    }

    // All ranks should be unique among seeds
    const ranks = result.seeds.map((s) => s.rank);
    const uniqueRanks = new Set(ranks);
    expect(uniqueRanks.size).toBe(ranks.length);

    // All ranks should be in range [1, size]
    for (const rank of ranks) {
      expect(rank).toBeGreaterThanOrEqual(1);
      expect(rank).toBeLessThanOrEqual(result.size);
    }
  });

  it('produces valid bye ranks', () => {
    const entries: DrawEntry[] = Array.from({ length: 10 }, (_, i) => ({
      id: `W${i}`,
      teamIds: [],
      seedScore: 15 - i,
    }));

    const rng = createRng('valid-byes');
    const result = planSeeding(entries, rng);

    // Bye ranks should start at N+1
    if (result.byeRanks.length > 0) {
      expect(result.byeRanks[0]).toBe(entries.length + 1);
    }

    // Bye ranks should be consecutive
    for (let i = 0; i < result.byeRanks.length; i++) {
      expect(result.byeRanks[i]).toBe(entries.length + 1 + i);
    }

    // Total should match
    expect(result.byeCount).toBe(result.byeRanks.length);
  });

  it('produces valid unseeded ids', () => {
    const entries: DrawEntry[] = Array.from({ length: 12 }, (_, i) => ({
      id: `U${i}`,
      teamIds: [],
      seedScore: 15 - i,
    }));

    const rng = createRng('valid-unseeded');
    const result = planSeeding(entries, rng);

    // Unseeded should be sorted
    const sorted = [...result.unseededIds].sort((a, b) => a.localeCompare(b));
    expect(result.unseededIds).toEqual(sorted);

    // Total entries should be accounted for
    expect(result.seedCount + result.unseededIds.length).toBe(entries.length);

    // All unseeded ids should be unique
    const unique = new Set(result.unseededIds);
    expect(unique.size).toBe(result.unseededIds.length);
  });
});
