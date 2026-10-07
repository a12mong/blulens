import { describe, it, expect } from 'vitest';
import { roundRobinSchedule, RoundRobinRound } from './round-robin';

describe('roundRobinSchedule', () => {
  it('size 4 equals exactly the spec table', () => {
    const result = roundRobinSchedule(4);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ round: 1, matches: [[1, 4], [2, 3]], bye: null });
    expect(result[1]).toEqual({ round: 2, matches: [[1, 3], [4, 2]], bye: null });
    expect(result[2]).toEqual({ round: 3, matches: [[1, 2], [3, 4]], bye: null });
  });

  it('size 3 has all pairs exactly once', () => {
    const result = roundRobinSchedule(3);

    const pairs = new Set<string>();
    for (const round of result) {
      for (const [a, b] of round.matches) {
        pairs.add(JSON.stringify([Math.min(a, b), Math.max(a, b)]));
      }
    }

    const expected = new Set([
      JSON.stringify([1, 2]),
      JSON.stringify([1, 3]),
      JSON.stringify([2, 3]),
    ]);

    expect(pairs).toEqual(expected);
  });

  it('size 4 has all pairs exactly once', () => {
    const result = roundRobinSchedule(4);

    const pairs = new Set<string>();
    for (const round of result) {
      for (const [a, b] of round.matches) {
        pairs.add(JSON.stringify([Math.min(a, b), Math.max(a, b)]));
      }
    }

    const expected = new Set([
      JSON.stringify([1, 2]),
      JSON.stringify([1, 3]),
      JSON.stringify([1, 4]),
      JSON.stringify([2, 3]),
      JSON.stringify([2, 4]),
      JSON.stringify([3, 4]),
    ]);

    expect(pairs).toEqual(expected);
  });

  it('size 5 has all pairs exactly once', () => {
    const result = roundRobinSchedule(5);

    const pairs = new Set<string>();
    for (const round of result) {
      for (const [a, b] of round.matches) {
        pairs.add(JSON.stringify([Math.min(a, b), Math.max(a, b)]));
      }
    }

    const expected = new Set([
      JSON.stringify([1, 2]),
      JSON.stringify([1, 3]),
      JSON.stringify([1, 4]),
      JSON.stringify([1, 5]),
      JSON.stringify([2, 3]),
      JSON.stringify([2, 4]),
      JSON.stringify([2, 5]),
      JSON.stringify([3, 4]),
      JSON.stringify([3, 5]),
      JSON.stringify([4, 5]),
    ]);

    expect(pairs).toEqual(expected);
  });

  it('size 3 has match count 3', () => {
    const result = roundRobinSchedule(3);
    const matchCount = result.reduce((sum, r) => sum + r.matches.length, 0);
    expect(matchCount).toBe(3);
  });

  it('size 4 has match count 6', () => {
    const result = roundRobinSchedule(4);
    const matchCount = result.reduce((sum, r) => sum + r.matches.length, 0);
    expect(matchCount).toBe(6);
  });

  it('size 5 has match count 10', () => {
    const result = roundRobinSchedule(5);
    const matchCount = result.reduce((sum, r) => sum + r.matches.length, 0);
    expect(matchCount).toBe(10);
  });

  it('size 3 has 3 rounds', () => {
    const result = roundRobinSchedule(3);
    expect(result).toHaveLength(3);
  });

  it('size 4 has 3 rounds', () => {
    const result = roundRobinSchedule(4);
    expect(result).toHaveLength(3);
  });

  it('size 5 has 5 rounds', () => {
    const result = roundRobinSchedule(5);
    expect(result).toHaveLength(5);
  });

  it('size 3 has exactly one bye per round, every position sits out exactly once', () => {
    const result = roundRobinSchedule(3);

    const byeCounts = new Map<number, number>();
    for (const round of result) {
      expect(round.bye).not.toBeNull();
      byeCounts.set(round.bye!, (byeCounts.get(round.bye!) ?? 0) + 1);
    }

    expect(byeCounts.size).toBe(3);
    for (const count of byeCounts.values()) {
      expect(count).toBe(1);
    }
  });

  it('size 5 has exactly one bye per round, every position sits out exactly once', () => {
    const result = roundRobinSchedule(5);

    const byeCounts = new Map<number, number>();
    for (const round of result) {
      expect(round.bye).not.toBeNull();
      byeCounts.set(round.bye!, (byeCounts.get(round.bye!) ?? 0) + 1);
    }

    expect(byeCounts.size).toBe(5);
    for (const count of byeCounts.values()) {
      expect(count).toBe(1);
    }
  });

  it('lastRoundPairs [[2,3]] with size 4: the last round contains the pair 2,3', () => {
    const result = roundRobinSchedule(4, [[2, 3]]);

    const lastRound = result[result.length - 1];
    const hasPair = lastRound.matches.some(
      ([a, b]) =>
        (a === 2 && b === 3) ||
        (a === 3 && b === 2),
    );

    expect(hasPair).toBe(true);
  });

  it('lastRoundPairs [[2,3]] with size 4: still a valid round robin', () => {
    const result = roundRobinSchedule(4, [[2, 3]]);

    const pairs = new Set<string>();
    for (const round of result) {
      for (const [a, b] of round.matches) {
        pairs.add(JSON.stringify([Math.min(a, b), Math.max(a, b)]));
      }
    }

    const expected = new Set([
      JSON.stringify([1, 2]),
      JSON.stringify([1, 3]),
      JSON.stringify([1, 4]),
      JSON.stringify([2, 3]),
      JSON.stringify([2, 4]),
      JSON.stringify([3, 4]),
    ]);

    expect(pairs).toEqual(expected);
  });

  it('for every size 3: every possible single pair lands in the last round', () => {
    const pairs3: [number, number][] = [
      [1, 2],
      [1, 3],
      [2, 3],
    ];

    for (const pair of pairs3) {
      const result = roundRobinSchedule(3, [pair]);
      const lastRound = result[result.length - 1];
      const hasPair = lastRound.matches.some(
        ([a, b]) =>
          (a === pair[0] && b === pair[1]) ||
          (a === pair[1] && b === pair[0]),
      );
      expect(hasPair).toBe(true);
    }
  });

  it('for every size 4: every possible single pair lands in the last round', () => {
    const pairs4: [number, number][] = [
      [1, 2],
      [1, 3],
      [1, 4],
      [2, 3],
      [2, 4],
      [3, 4],
    ];

    for (const pair of pairs4) {
      const result = roundRobinSchedule(4, [pair]);
      const lastRound = result[result.length - 1];
      const hasPair = lastRound.matches.some(
        ([a, b]) =>
          (a === pair[0] && b === pair[1]) ||
          (a === pair[1] && b === pair[0]),
      );
      expect(hasPair).toBe(true);
    }
  });

  it('for every size 5: every possible single pair lands in the last round', () => {
    const pairs5: [number, number][] = [
      [1, 2],
      [1, 3],
      [1, 4],
      [1, 5],
      [2, 3],
      [2, 4],
      [2, 5],
      [3, 4],
      [3, 5],
      [4, 5],
    ];

    for (const pair of pairs5) {
      const result = roundRobinSchedule(5, [pair]);
      const lastRound = result[result.length - 1];
      const hasPair = lastRound.matches.some(
        ([a, b]) =>
          (a === pair[0] && b === pair[1]) ||
          (a === pair[1] && b === pair[0]),
      );
      expect(hasPair).toBe(true);
    }
  });

  it('size 2 throws RangeError', () => {
    expect(() => roundRobinSchedule(2)).toThrow(RangeError);
  });

  it('size 6 throws RangeError', () => {
    expect(() => roundRobinSchedule(6)).toThrow(RangeError);
  });

  it('size 3.5 throws RangeError', () => {
    expect(() => roundRobinSchedule(3.5)).toThrow(RangeError);
  });
});
