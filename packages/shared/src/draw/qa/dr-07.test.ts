import { describe, expect, it } from 'vitest';
import { bracketOrder } from '../bracket-order';

describe('DR-07: standard slot order', () => {
  // Golden fixtures from docs/specs/draw.md Appendix A
  it('matches golden slot order for S=8 (Appendix A)', () => {
    const order = bracketOrder(8);
    expect(order).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });

  it('matches golden slot order for S=16 (Appendix A)', () => {
    const order = bracketOrder(16);
    expect(order).toEqual([1, 16, 8, 9, 4, 13, 5, 12, 2, 15, 7, 10, 3, 14, 6, 11]);
  });

  // Property testing across all valid bracket sizes: S = 2, 4, 8, 16, 32, 64, 128, 256
  const bracketSizes = [2, 4, 8, 16, 32, 64, 128, 256] as const;

  it.each(bracketSizes)('satisfies balanced bracket properties for S=%i', (size) => {
    const order = bracketOrder(size);

    // Property 1: Exact length equals bracket size
    expect(order).toHaveLength(size);

    // Property 2: Rank 1 is always at slot 1 (position 1, index 0)
    expect(order[0]).toBe(1);

    // Property 3: Permutation of 1..S with no duplicates
    const uniqueRanks = new Set(order);
    expect(uniqueRanks.size).toBe(size);
    for (let r = 1; r <= size; r++) {
      expect(uniqueRanks.has(r)).toBe(true);
    }

    // Property 4: First-round matchup pairs (r meets S + 1 - r)
    // Every pair [order[2*i], order[2*i + 1]] must sum to size + 1
    for (let i = 0; i < size / 2; i++) {
      const top = order[2 * i];
      const bottom = order[2 * i + 1];
      expect(top + bottom).toBe(size + 1);
    }

    // Property 5: Half separation (ranks 1 and 2 in opposite halves) for S >= 4
    if (size >= 4) {
      const idx1 = order.indexOf(1);
      const idx2 = order.indexOf(2);
      const halfSize = size / 2;
      expect(idx1 < halfSize).toBe(true);
      expect(idx2 >= halfSize).toBe(true);
    }

    // Property 6: Quarter separation (ranks 1, 2, 3, 4 in different quarters) for S >= 8
    if (size >= 8) {
      const quarterSize = size / 4;
      const quarters = [1, 2, 3, 4].map((rank) => Math.floor(order.indexOf(rank) / quarterSize));
      const uniqueQuarters = new Set(quarters);
      expect(uniqueQuarters.size).toBe(4);
    }

    // Property 7: Eighth separation (ranks 1..8 in different eighths) for S >= 16
    if (size >= 16) {
      const eighthSize = size / 8;
      const eighths = [1, 2, 3, 4, 5, 6, 7, 8].map((rank) => Math.floor(order.indexOf(rank) / eighthSize));
      const uniqueEighths = new Set(eighths);
      expect(uniqueEighths.size).toBe(8);
    }
  });

  it('throws RangeError for invalid bracket sizes', () => {
    expect(() => bracketOrder(0)).toThrow(RangeError);
    expect(() => bracketOrder(3)).toThrow(RangeError);
    expect(() => bracketOrder(6)).toThrow(RangeError);
    expect(() => bracketOrder(512)).toThrow(RangeError);
  });
});
