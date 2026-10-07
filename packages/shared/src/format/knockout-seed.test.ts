import { describe, expect, it } from 'vitest';
import { seedKnockout, type Qualifier } from './knockout-seed';

describe('seedKnockout (bl-20-5)', () => {
  it('places 4 group winners and 4 runners-up (Q = 8) avoiding same-group clashes', () => {
    // 4 groups (0..3), 1 winner and 1 runner-up each
    // Set tierRank so initial placement produces 4 same-group clashes:
    // W0 (seed 1) vs R0 (seed 8), W3 (seed 4) vs R3 (seed 5), etc.
    const qualifiers: Qualifier[] = [
      { entryId: 'W0', teamIds: ['T1'], groupIndex: 0, tier: 1, tierRank: 1 },
      { entryId: 'W1', teamIds: ['T2'], groupIndex: 1, tier: 1, tierRank: 2 },
      { entryId: 'W2', teamIds: ['T3'], groupIndex: 2, tier: 1, tierRank: 3 },
      { entryId: 'W3', teamIds: ['T4'], groupIndex: 3, tier: 1, tierRank: 4 },
      { entryId: 'R3', teamIds: ['T5'], groupIndex: 3, tier: 2, tierRank: 1 }, // Seed 5
      { entryId: 'R2', teamIds: ['T6'], groupIndex: 2, tier: 2, tierRank: 2 }, // Seed 6
      { entryId: 'R1', teamIds: ['T7'], groupIndex: 1, tier: 2, tierRank: 3 }, // Seed 7
      { entryId: 'R0', teamIds: ['T8'], groupIndex: 0, tier: 2, tierRank: 4 }, // Seed 8
    ];

    const plan = seedKnockout(qualifiers, 'test-seed');

    expect(plan.size).toBe(8);
    expect(plan.teamClashes).toBe(0);
    expect(plan.groupClashes).toBe(0);
    expect(plan.slots).toHaveLength(8);

    const qMap = new Map(qualifiers.map((q) => [q.entryId, q]));

    // Check each first-round pair:
    // 1. One tier 1 (winner) and one tier 2 (runner-up)
    // 2. Different groups
    for (let m = 0; m < 8; m += 2) {
      const a = qMap.get(plan.slots[m]!)!;
      const b = qMap.get(plan.slots[m + 1]!)!;

      const tiers = [a.tier, b.tier].sort();
      expect(tiers).toEqual([1, 2]);

      expect(a.groupIndex).not.toBe(b.groupIndex);
    }
  });

  it('allocates byes to seeds 1 and 2 when Q = 6 (S = 8)', () => {
    // 6 qualifiers: 4 winners (tier 1), 2 runners-up (tier 2)
    const qualifiers: Qualifier[] = [
      { entryId: 'W0', teamIds: ['T1'], groupIndex: 0, tier: 1, tierRank: 1 },
      { entryId: 'W1', teamIds: ['T2'], groupIndex: 1, tier: 1, tierRank: 2 },
      { entryId: 'W2', teamIds: ['T3'], groupIndex: 2, tier: 1, tierRank: 3 },
      { entryId: 'W3', teamIds: ['T4'], groupIndex: 3, tier: 1, tierRank: 4 },
      { entryId: 'R0', teamIds: ['T5'], groupIndex: 0, tier: 2, tierRank: 1 },
      { entryId: 'R1', teamIds: ['T6'], groupIndex: 1, tier: 2, tierRank: 2 },
    ];

    const plan = seedKnockout(qualifiers, 'seed-q6');

    expect(plan.size).toBe(8);
    expect(plan.slots).toHaveLength(8);

    // Count byes (null slots)
    const nullSlots = plan.slots.filter((s) => s === null);
    expect(nullSlots).toHaveLength(2);

    // Seed 1 is W0, Seed 2 is W1
    // In bracketOrder(8), Seed 1 is at slot 0 (pair 0: slots 0, 1)
    // Seed 2 is at slot 4 (pair 2: slots 4, 5)
    // The two byes must be the opponents of Seed 1 and Seed 2
    const w0Index = plan.slots.indexOf('W0');
    const w1Index = plan.slots.indexOf('W1');

    const w0OpponentIndex = w0Index % 2 === 0 ? w0Index + 1 : w0Index - 1;
    const w1OpponentIndex = w1Index % 2 === 0 ? w1Index + 1 : w1Index - 1;

    expect(plan.slots[w0OpponentIndex]).toBeNull();
    expect(plan.slots[w1OpponentIndex]).toBeNull();
  });

  it('minimizes team clashes first and accepts group clashes when forced', () => {
    // Q = 4, S = 4.
    // Tier 1: E1 (team-A, group 0), E2 (team-B, group 1)
    // Tier 2: E3 (team-B, group 0), E4 (team-A, group 1)
    // Initial pairs without swap:
    // (E1, E4) -> team-A vs team-A (1 team clash), group 0 vs 1 (0 group clash)
    // (E2, E3) -> team-B vs team-B (1 team clash), group 1 vs 0 (0 group clash)
    // Total: team = 2, group = 0.
    // With swap of E3 and E4 (same tier 2):
    // (E1, E3) -> team-A vs team-B (0 team clash), group 0 vs 0 (1 group clash)
    // (E2, E4) -> team-B vs team-A (0 team clash), group 1 vs 1 (1 group clash)
    // Total: team = 0, group = 2.
    // Lexicographical order prefers (0, 2) over (2, 0).
    const qualifiers: Qualifier[] = [
      { entryId: 'E1', teamIds: ['team-A'], groupIndex: 0, tier: 1, tierRank: 1 },
      { entryId: 'E2', teamIds: ['team-B'], groupIndex: 1, tier: 1, tierRank: 2 },
      { entryId: 'E3', teamIds: ['team-B'], groupIndex: 0, tier: 2, tierRank: 1 },
      { entryId: 'E4', teamIds: ['team-A'], groupIndex: 1, tier: 2, tierRank: 2 },
    ];

    const plan = seedKnockout(qualifiers, 'seed-team-first');

    expect(plan.size).toBe(4);
    expect(plan.teamClashes).toBe(0);
    expect(plan.groupClashes).toBe(2);

    // Verify pairings
    const pairs = [
      [plan.slots[0], plan.slots[1]].sort(),
      [plan.slots[2], plan.slots[3]].sort(),
    ].sort((a, b) => a[0]!.localeCompare(b[0]!));

    expect(pairs).toEqual([
      ['E1', 'E3'],
      ['E2', 'E4'],
    ]);
  });

  it('is identical for every permutation of input qualifiers', () => {
    const qualifiers: Qualifier[] = [
      { entryId: 'W0', teamIds: ['T1'], groupIndex: 0, tier: 1, tierRank: 1 },
      { entryId: 'W1', teamIds: ['T2'], groupIndex: 1, tier: 1, tierRank: 2 },
      { entryId: 'W2', teamIds: ['T3'], groupIndex: 2, tier: 1, tierRank: 3 },
      { entryId: 'W3', teamIds: ['T4'], groupIndex: 3, tier: 1, tierRank: 4 },
      { entryId: 'R3', teamIds: ['T5'], groupIndex: 3, tier: 2, tierRank: 1 },
      { entryId: 'R2', teamIds: ['T6'], groupIndex: 2, tier: 2, tierRank: 2 },
      { entryId: 'R1', teamIds: ['T7'], groupIndex: 1, tier: 2, tierRank: 3 },
      { entryId: 'R0', teamIds: ['T8'], groupIndex: 0, tier: 2, tierRank: 4 },
    ];

    const baseline = seedKnockout(qualifiers, 'fixed-seed');

    // Reversed
    const reversed = [...qualifiers].reverse();
    const planReversed = seedKnockout(reversed, 'fixed-seed');
    expect(planReversed).toEqual(baseline);

    // Rotated
    const rotated = [...qualifiers.slice(3), ...qualifiers.slice(0, 3)];
    const planRotated = seedKnockout(rotated, 'fixed-seed');
    expect(planRotated).toEqual(baseline);
  });

  it('never swaps entries across tiers', () => {
    // 3 tiers: 2 in tier 1, 2 in tier 2, 2 in tier 3 (Q = 6, S = 8)
    const qualifiers: Qualifier[] = [
      { entryId: 'T1_A', teamIds: ['TA'], groupIndex: 0, tier: 1, tierRank: 1 },
      { entryId: 'T1_B', teamIds: ['TB'], groupIndex: 1, tier: 1, tierRank: 2 },
      { entryId: 'T2_A', teamIds: ['TA'], groupIndex: 0, tier: 2, tierRank: 1 },
      { entryId: 'T2_B', teamIds: ['TB'], groupIndex: 1, tier: 2, tierRank: 2 },
      { entryId: 'T3_A', teamIds: ['TA'], groupIndex: 0, tier: 3, tierRank: 1 },
      { entryId: 'T3_B', teamIds: ['TB'], groupIndex: 1, tier: 3, tierRank: 2 },
    ];

    const plan = seedKnockout(qualifiers, 'seed-tier-guard');
    const qMap = new Map(qualifiers.map((q) => [q.entryId, q]));

    // bracketOrder(8) has:
    // Slot 0: Seed 1 (tier 1)
    // Slot 1: Seed 8 (null)
    // Slot 2: Seed 4 (tier 2)
    // Slot 3: Seed 5 (tier 3)
    // Slot 4: Seed 2 (tier 1)
    // Slot 5: Seed 7 (null)
    // Slot 6: Seed 3 (tier 2)
    // Slot 7: Seed 6 (tier 3)
    // Since swaps only happen within the same tier, slots {0, 4} must hold tier 1,
    // slots {2, 6} must hold tier 2, and slots {3, 7} must hold tier 3.
    const tierAt = (idx: number) => (plan.slots[idx] ? qMap.get(plan.slots[idx]!)!.tier : null);

    expect(tierAt(0)).toBe(1);
    expect(tierAt(4)).toBe(1);
    expect(tierAt(2)).toBe(2);
    expect(tierAt(6)).toBe(2);
    expect(tierAt(3)).toBe(3);
    expect(tierAt(7)).toBe(3);
  });

  it('throws RangeError when Q < 2', () => {
    expect(() => seedKnockout([], 'seed')).toThrow(RangeError);
    expect(() =>
      seedKnockout([{ entryId: 'E1', teamIds: [], groupIndex: 0, tier: 1, tierRank: 1 }], 'seed'),
    ).toThrow(RangeError);
  });
});
