import { describe, expect, it } from 'vitest';
import { createRng, shuffle, xoshiro128ss } from './prng';

describe('xoshiro128ss', () => {
  // Hand-derived from the reference C (prng.di.unimi.it/xoshiro128starstar.c):
  // s1=2 -> rotl(10,7)*9 = 11520; s1=0 -> 0; s1=1029 -> rotl(5145,7)*9 = 5927040;
  // s1=12295 -> rotl(61475,7)*9 = 70819200.
  it('matches the reference algorithm for state [1, 2, 3, 4]', () => {
    const next = xoshiro128ss([1, 2, 3, 4]);
    expect([next(), next(), next(), next()]).toEqual([11520, 0, 5927040, 70819200]);
  });
});

describe('createRng', () => {
  it('is deterministic per seed and differs across seeds', () => {
    const a = createRng('seed-1');
    const b = createRng('seed-1');
    const c = createRng('seed-2');
    const seqA = Array.from({ length: 5 }, () => a.nextUint32());
    expect(Array.from({ length: 5 }, () => b.nextUint32())).toEqual(seqA);
    expect(Array.from({ length: 5 }, () => c.nextUint32())).not.toEqual(seqA);
  });

  it('int(n) stays in range and covers every value', () => {
    const rng = createRng('range');
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const v = rng.int(7);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(7);
      seen.add(v);
    }
    expect(seen.size).toBe(7);
  });

  it('int(n) rejects invalid bounds', () => {
    const rng = createRng('x');
    expect(() => rng.int(0)).toThrow(RangeError);
    expect(() => rng.int(2.5)).toThrow(RangeError);
  });
});

describe('shuffle', () => {
  it('returns a permutation, leaves the input untouched, and is seed-deterministic', () => {
    const input = ['a', 'b', 'c', 'd', 'e', 'f'];
    const out = shuffle(input, createRng('s'));
    expect([...out].sort()).toEqual(input);
    expect(input).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
    expect(shuffle(input, createRng('s'))).toEqual(out);
  });

  it('puts an item in each position roughly uniformly (4 items, 40k shuffles)', () => {
    const rng = createRng('uniform');
    const counts = [0, 0, 0, 0];
    for (let i = 0; i < 40_000; i++) counts[shuffle([0, 1, 2, 3], rng).indexOf(0)]!++;
    for (const c of counts) expect(Math.abs(c - 10_000)).toBeLessThan(400);
  });
});
