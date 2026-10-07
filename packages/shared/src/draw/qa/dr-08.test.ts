import { describe, expect, it } from 'vitest';
import { drawBracket } from '../draw-bracket';
import { sharesTeam } from '../conflict';
import type { DrawEntry, SlotValue } from '../types';

describe('DR-08: Appendix B fixture', () => {
  // Input fixture from docs/specs/draw.md Appendix B
  // Men's Singles N = 6 entries:
  // A1 (8.2), B1 (8.0), A2 (7.6), C1 (7.4), A3 (7.1), B2 (6.9)
  const entries: readonly DrawEntry[] = [
    { id: 'A1', teamIds: ['team-A'], seedScore: 8.2 },
    { id: 'B1', teamIds: ['team-B'], seedScore: 8.0 },
    { id: 'A2', teamIds: ['team-A'], seedScore: 7.6 },
    { id: 'C1', teamIds: ['team-C'], seedScore: 7.4 },
    { id: 'A3', teamIds: ['team-A'], seedScore: 7.1 },
    { id: 'B2', teamIds: ['team-B'], seedScore: 6.9 },
  ];

  it('generates valid draw with 0 conflicts and proper seed/bye positions (Appendix B)', () => {
    // Fixed seed for determinism (never Math.random)
    const seed = 'fixture-appendix-b-seed-128bit';
    const result = drawBracket(entries, seed);

    expect(result.size).toBe(8);
    expect(result.slots).toHaveLength(8);

    // Position 1 (index 0): Seed 1 = A1 (virtual rank 1)
    expect(result.slots[0]).toBe('A1');

    // Position 2 (index 1): Bye (virtual rank 8)
    expect(result.slots[1]).toBeNull();

    // Position 5 (index 4): Seed 2 = B1 (virtual rank 2)
    expect(result.slots[4]).toBe('B1');

    // Position 6 (index 5): Bye (virtual rank 7)
    expect(result.slots[5]).toBeNull();

    // Unseeded players (A2, C1, A3, B2) occupy remaining positions 3, 4, 7, 8 (indices 2, 3, 6, 7)
    const remainingSlots = [result.slots[2], result.slots[3], result.slots[6], result.slots[7]];
    expect(remainingSlots).toHaveLength(4);
    expect(new Set(remainingSlots).size).toBe(4);
    expect(remainingSlots).toContain('A2');
    expect(remainingSlots).toContain('C1');
    expect(remainingSlots).toContain('A3');
    expect(remainingSlots).toContain('B2');

    // Rule: Same-team players A2 and A3 must not meet in first round.
    // Match 2 is Position 3 (idx 2) vs Position 4 (idx 3)
    const match2 = [result.slots[2], result.slots[3]];
    const hasA2A3InMatch2 = match2.includes('A2') && match2.includes('A3');
    expect(hasA2A3InMatch2).toBe(false);

    // Match 4 is Position 7 (idx 6) vs Position 8 (idx 7)
    const match4 = [result.slots[6], result.slots[7]];
    const hasA2A3InMatch4 = match4.includes('A2') && match4.includes('A3');
    expect(hasA2A3InMatch4).toBe(false);

    // Conflicts must be exactly 0
    expect(result.conflicts).toHaveLength(0);
    expect(result.minimumPossibleConflicts).toBe(0);
  });

  it('produces identical bracket regardless of input entry order (determinism)', () => {
    const seed = 'fixture-appendix-b-seed-128bit';
    const reversedEntries = [...entries].reverse();

    const result1 = drawBracket(entries, seed);
    const result2 = drawBracket(reversedEntries, seed);

    expect(result1.slots).toEqual(result2.slots);
    expect(result1.conflicts).toEqual(result2.conflicts);
  });

  it('detects same-team collision if A2 and A3 are placed in the same match', () => {
    const entryMap = new Map(entries.map((e) => [e.id, e]));

    // Helper validator using domain sharesTeam rule
    function findClashes(slots: SlotValue[]): number[] {
      const clashedMatches: number[] = [];
      for (let k = 1; k <= slots.length / 2; k++) {
        const idA = slots[2 * k - 2];
        const idB = slots[2 * k - 1];
        if (idA && idB) {
          const entryA = entryMap.get(idA);
          const entryB = entryMap.get(idB);
          if (entryA && entryB && sharesTeam(entryA, entryB)) {
            clashedMatches.push(k);
          }
        }
      }
      return clashedMatches;
    }

    // Invalid placement: A2 and A3 in match 2 (positions 3 and 4)
    const invalidSlots: SlotValue[] = ['A1', null, 'A2', 'A3', 'B1', null, 'C1', 'B2'];
    expect(findClashes(invalidSlots)).toEqual([2]);

    // Valid placement: A2 in match 2, A3 in match 4
    const validSlots: SlotValue[] = ['A1', null, 'A2', 'C1', 'B1', null, 'B2', 'A3'];
    expect(findClashes(validSlots)).toEqual([]);
  });
});
