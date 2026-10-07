import { describe, expect, it } from 'vitest';
import { bracketOrder } from './bracket-order';

describe('bracketOrder', () => {
  it('matches appendix A and satisfies the draw-v1 properties for every size', () => {
    // the 4 edge-case arrays, exactly (toEqual)
    expect(bracketOrder(2)).toEqual([1, 2]);
    expect(bracketOrder(4)).toEqual([1, 4, 2, 3]);
    expect(bracketOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
    expect(bracketOrder(16)).toEqual([1, 16, 8, 9, 4, 13, 5, 12, 2, 15, 7, 10, 3, 14, 6, 11]);

    const validSizes = [2, 4, 8, 16, 32, 64, 128, 256];

    for (const size of validSizes) {
      const result = bracketOrder(size);

      // result is a permutation of 1..size
      expect(result).toHaveLength(size);
      expect(new Set(result).size).toBe(size);
      const sorted = [...result].sort((a, b) => a - b);
      const expectedPermutation = Array.from({ length: size }, (_, i) => i + 1);
      expect(sorted).toEqual(expectedPermutation);

      // result[0] === 1
      expect(result[0]).toBe(1);

      // for every round-1 pair (positions 2k-1, 2k): rank_a + rank_b === size + 1
      for (let i = 0; i < size; i += 2) {
        expect(result[i]! + result[i + 1]!).toBe(size + 1);
      }

      // for every block width w in {size/2, size/4, size/8} with w >= 1, the ranks 1..(size/w) each fall
      // in a different block of w consecutive positions (halves, quarters, eighths)
      const widths = [size / 2, size / 4, size / 8].filter((w) => w >= 1);
      for (const w of widths) {
        const numBlocks = size / w;
        const blockIndices = new Set<number>();
        for (let rank = 1; rank <= numBlocks; rank++) {
          const pos = result.indexOf(rank);
          expect(pos).toBeGreaterThanOrEqual(0);
          const block = Math.floor(pos / w);
          blockIndices.add(block);
        }
        expect(blockIndices.size).toBe(numBlocks);
      }
    }
  });

  it('rejects invalid sizes with RangeError', () => {
    const invalidSizes = [0, 3, 6, 512, 2.5, -4];
    for (const size of invalidSizes) {
      expect(() => bracketOrder(size)).toThrow(RangeError);
      expect(() => bracketOrder(size)).toThrow(`bracketOrder: invalid size ${size}`);
    }
  });

  it('returns a new array each call', () => {
    const a = bracketOrder(8);
    const b = bracketOrder(8);
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
  });
});
