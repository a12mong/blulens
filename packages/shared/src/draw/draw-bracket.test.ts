import { describe, expect, it } from 'vitest';
import { drawBracket } from './draw-bracket';
import type { DrawEntry } from './types';

const appendixB: readonly DrawEntry[] = [
  { id: 'A1', teamIds: ['team-A'], seedScore: 8.2 },
  { id: 'B1', teamIds: ['team-B'], seedScore: 8.0 },
  { id: 'A2', teamIds: ['team-A'], seedScore: 7.6 },
  { id: 'C1', teamIds: ['team-C'], seedScore: 7.4 },
  { id: 'A3', teamIds: ['team-A'], seedScore: 7.1 },
  { id: 'B2', teamIds: ['team-B'], seedScore: 6.9 },
];

describe('drawBracket (bl-18-6)', () => {
  it('draws draw.md appendix B with seeds and byes in place and no same-team round-1 pair', () => {
    for (let i = 0; i < 200; i++) {
      const seed = `b${i}`;
      const result = drawBracket(appendixB, seed);

      expect(result.size).toBe(8);
      expect(result.seedCount).toBe(2);

      // Seeds and byes in place (positions 1, 2, 5, 6 -> slots 0, 1, 4, 5)
      expect(result.slots[0]).toBe('A1');
      expect(result.slots[1]).toBeNull();
      expect(result.slots[4]).toBe('B1');
      expect(result.slots[5]).toBeNull();

      // A2 and A3 never in the same round-1 pair:
      // Round-1 pairs are units: slots (0, 1), (2, 3), (4, 5), (6, 7)
      for (let u = 0; u < 4; u++) {
        const pair = [result.slots[2 * u], result.slots[2 * u + 1]];
        const hasA2 = pair.includes('A2');
        const hasA3 = pair.includes('A3');
        expect(hasA2 && hasA3).toBe(false);
      }

      expect(result.conflicts).toEqual([]);
      expect(result.minimumPossibleConflicts).toBe(0);
    }
  });

  it('is deterministic regardless of input entry order', () => {
    const reversed = [...appendixB].reverse();
    const testSeeds = ['seed-alpha', 'seed-beta', 'seed-gamma', 'seed-delta', 'seed-epsilon'];
    for (const s of testSeeds) {
      const res1 = drawBracket(appendixB, s);
      const res2 = drawBracket(reversed, s);
      expect(res1).toEqual(res2);
    }
  });

  it('handles unavoidable conflicts correctly', () => {
    const unavoidable: DrawEntry[] = [
      { id: 'A1', teamIds: ['team-A'], seedScore: 8 },
      { id: 'A2', teamIds: ['team-A'], seedScore: 7 },
      { id: 'A3', teamIds: ['team-A'], seedScore: 6 },
      { id: 'B1', teamIds: ['team-B'], seedScore: 5 },
    ];
    const res = drawBracket(unavoidable, 'seed-unavoidable');
    expect(res.size).toBe(4);
    expect(res.conflicts).toHaveLength(1);
    expect(res.minimumPossibleConflicts).toBe(1);
  });

  it('matches golden snapshot for seed golden-1 on appendix B', () => {
    const res = drawBracket(appendixB, 'golden-1');
    expect(res.rulesetVersion).toBe('draw-v1');
    expect(res.prngId).toBe('xoshiro128**/cyrb128-v1');
    expect(res.seed).toBe('golden-1');
    expect(res.size).toBe(8);
    expect(res.seedCount).toBe(2);
    expect(res.seeds).toEqual([
      { entryId: 'A1', seedNo: 1, rank: 1 },
      { entryId: 'B1', seedNo: 2, rank: 2 },
    ]);
    expect(res.slots).toEqual(['A1', null, 'A3', 'B2', 'B1', null, 'A2', 'C1']);
    expect(res.conflicts).toEqual([]);
    expect(res.minimumPossibleConflicts).toBe(0);
    expect(res.provenMinimal).toBe(true);
    expect(res.searchSteps).toBe(4);
  });

  it('handles N = 2 entries with no seeds, both entries placed, and no byes', () => {
    const entries: DrawEntry[] = [
      { id: 'E1', teamIds: ['team-1'], seedScore: 5.0 },
      { id: 'E2', teamIds: ['team-2'], seedScore: 4.5 },
    ];
    const res = drawBracket(entries, 'n2-seed');
    expect(res.size).toBe(2);
    expect(res.seedCount).toBe(0);
    expect(res.seeds).toEqual([]);
    expect(res.slots).toHaveLength(2);
    expect(res.slots).toContain('E1');
    expect(res.slots).toContain('E2');
    expect(res.slots.includes(null)).toBe(false);
    expect(res.conflicts).toEqual([]);
  });

  it('propagates RangeError for duplicate entry id or invalid sizes', () => {
    const dupEntries: DrawEntry[] = [
      { id: 'dup', teamIds: [], seedScore: 5.0 },
      { id: 'dup', teamIds: [], seedScore: 4.0 },
    ];
    expect(() => drawBracket(dupEntries, 'seed')).toThrow(RangeError);
    expect(() => drawBracket(dupEntries, 'seed')).toThrow('DRAW_DUPLICATE_ENTRY');

    expect(() => drawBracket([{ id: 'single', teamIds: [], seedScore: 5.0 }], 'seed')).toThrow(
      RangeError,
    );
  });
});
