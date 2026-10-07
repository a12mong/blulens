import { describe, expect, it } from 'vitest';
import { bracketSize, seedCount, planSeeding } from '../plan-seeding';
import { createRng } from '../prng';
import type { DrawEntry } from '../types';

describe('DR-06: bracket size and seed count table', () => {
  interface TestCase {
    n: number;
    expectedSize: number;
    expectedSeeds: number;
  }

  // 13 table-driven values specified in docs/qa/test-plan.md row DR-06
  // Matching table in docs/specs/draw.md section 3 (including boundaries and decision D1 cap)
  const testCases: readonly TestCase[] = [
    { n: 2, expectedSize: 2, expectedSeeds: 0 },
    { n: 3, expectedSize: 4, expectedSeeds: 2 },
    { n: 4, expectedSize: 4, expectedSeeds: 2 },
    { n: 5, expectedSize: 8, expectedSeeds: 2 },
    { n: 8, expectedSize: 8, expectedSeeds: 2 },
    { n: 9, expectedSize: 16, expectedSeeds: 4 },
    { n: 16, expectedSize: 16, expectedSeeds: 4 },
    { n: 17, expectedSize: 32, expectedSeeds: 8 },
    { n: 32, expectedSize: 32, expectedSeeds: 8 },
    { n: 33, expectedSize: 64, expectedSeeds: 16 },
    { n: 64, expectedSize: 64, expectedSeeds: 16 },
    { n: 65, expectedSize: 128, expectedSeeds: 16 },
    { n: 256, expectedSize: 256, expectedSeeds: 16 },
  ];

  it.each(testCases)(
    'bracketSize and seedCount return S=$expectedSize and seeds=$expectedSeeds for N=$n entries',
    ({ n, expectedSize, expectedSeeds }) => {
      expect(bracketSize(n)).toBe(expectedSize);
      expect(seedCount(n)).toBe(expectedSeeds);
    },
  );

  it.each(testCases)(
    'planSeeding agrees with table size=$expectedSize and seedCount=$expectedSeeds for N=$n entries',
    ({ n, expectedSize, expectedSeeds }) => {
      const entries: DrawEntry[] = Array.from({ length: n }, (_, i) => ({
        id: `entry-${i + 1}`,
        teamIds: [],
        seedScore: 100 - i,
      }));
      const rng = createRng(`dr-06-seed-${n}`);
      const plan = planSeeding(entries, rng);
      expect(plan.size).toBe(expectedSize);
      expect(plan.seedCount).toBe(expectedSeeds);
      expect(plan.byeCount).toBe(expectedSize - n);
    },
  );

  it('throws RangeError DRAW_TOO_FEW_ENTRIES for N < 2', () => {
    expect(() => bracketSize(0)).toThrow(RangeError);
    expect(() => bracketSize(1)).toThrow(RangeError);
    expect(() => seedCount(0)).toThrow(RangeError);
    expect(() => seedCount(1)).toThrow(RangeError);
  });

  it('throws RangeError DRAW_TOO_MANY_ENTRIES for N > 256', () => {
    expect(() => bracketSize(257)).toThrow(RangeError);
    expect(() => seedCount(257)).toThrow(RangeError);
  });
});
