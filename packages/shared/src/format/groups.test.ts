import { describe, expect, it } from 'vitest';
import type { DrawEntry } from '../draw';
import { groupSizes, planGroups } from './groups';

describe('groupSizes (bl-20-1)', () => {
  it('reproduces spec table examples for groupSize 4', () => {
    expect(groupSizes(12, 4)).toEqual([4, 4, 4]);
    expect(groupSizes(10, 4)).toEqual([4, 3, 3]);
    expect(groupSizes(9, 4)).toEqual([5, 4]);
    expect(groupSizes(6, 4)).toEqual([3, 3]);
    expect(groupSizes(16, 4)).toEqual([4, 4, 4, 4]);
    expect(groupSizes(17, 4)).toEqual([5, 4, 4, 4]);
    expect(groupSizes(13, 4)).toEqual([5, 4, 4]);
  });

  it('returns GROUP_SIZES_IMPOSSIBLE when any group size is outside 3..5', () => {
    expect(groupSizes(2, 4)).toEqual({ error: 'GROUP_SIZES_IMPOSSIBLE' });
    expect(groupSizes(0, 4)).toEqual({ error: 'GROUP_SIZES_IMPOSSIBLE' });
    expect(groupSizes(-5, 4)).toEqual({ error: 'GROUP_SIZES_IMPOSSIBLE' });
    // N = 18 with groupSize 4: g = floor(18/4 + 0.5) = floor(5.0) = 5. Sizes: [4, 4, 4, 3, 3] -> ok
    // But check when size < 3 or > 5:
    expect(groupSizes(1, 4)).toEqual({ error: 'GROUP_SIZES_IMPOSSIBLE' });
  });
});

describe('planGroups (bl-20-1)', () => {
  function makeEntries(n: number, teamFn?: (i: number) => string[]): DrawEntry[] {
    return Array.from({ length: n }, (_, i) => ({
      id: `entry-${i + 1}`,
      teamIds: teamFn ? teamFn(i) : [`team-${i + 1}`],
      seedScore: (n - i) * 10,
    }));
  }

  it('for N in 6..17: group count and sizes match groupSizes and every entry is placed exactly once', () => {
    for (let n = 6; n <= 17; n++) {
      const expectedSizes = groupSizes(n, 4);
      expect(Array.isArray(expectedSizes)).toBe(true);
      if (!Array.isArray(expectedSizes)) continue;

      const entries = makeEntries(n);
      const res = planGroups(entries, 4, `test-seed-${n}`);
      expect('error' in res).toBe(false);
      if ('error' in res) continue;

      expect(res.groups.length).toBe(expectedSizes.length);
      for (let i = 0; i < expectedSizes.length; i++) {
        expect(res.groups[i]!.length).toBe(expectedSizes[i]!);
      }

      // Check all entries placed exactly once
      const placed = res.groups.flat();
      expect(placed.length).toBe(n);
      expect(new Set(placed).size).toBe(n);
    }
  });

  it('pot 1 seeds land in groups 0,1,2,...; every group gets at most one member of each pot', () => {
    const entries = makeEntries(16);
    const res = planGroups(entries, 4, 'pot-order-seed');
    expect('error' in res).toBe(false);
    if ('error' in res) return;

    // Pot 1 top 4 seeds land in groups 0, 1, 2, 3
    expect(res.groups[0]![0]).toBe('entry-1');
    expect(res.groups[1]![0]).toBe('entry-2');
    expect(res.groups[2]![0]).toBe('entry-3');
    expect(res.groups[3]![0]).toBe('entry-4');

    // Pot 2 entries (entry-5..8) are at index 1 of each group
    const pot2 = new Set(['entry-5', 'entry-6', 'entry-7', 'entry-8']);
    for (let g = 0; g < 4; g++) {
      expect(pot2.has(res.groups[g]![1]!)).toBe(true);
    }

    // Pot 3 entries (entry-9..12) are at index 2
    const pot3 = new Set(['entry-9', 'entry-10', 'entry-11', 'entry-12']);
    for (let g = 0; g < 4; g++) {
      expect(pot3.has(res.groups[g]![2]!)).toBe(true);
    }

    // Pot 4 entries (entry-13..16) are at index 3
    const pot4 = new Set(['entry-13', 'entry-14', 'entry-15', 'entry-16']);
    for (let g = 0; g < 4; g++) {
      expect(pot4.has(res.groups[g]![3]!)).toBe(true);
    }
  });

  it('GS-04: 16 entries, 4 teams with 4 entries each, distinct seedScores: 0 same-team pairs, for 200 different seeds', () => {
    // 4 teams (A, B, C, D) with 4 entries each, distinct seed scores 16..1
    const entries: DrawEntry[] = [];
    const teams = ['team-A', 'team-B', 'team-C', 'team-D'];
    for (let i = 0; i < 16; i++) {
      entries.push({
        id: `e-${i + 1}`,
        teamIds: [teams[i % 4]!],
        seedScore: 16 - i,
      });
    }

    for (let s = 0; s < 200; s++) {
      const res = planGroups(entries, 4, `gs04-seed-${s}`);
      expect('error' in res).toBe(false);
      if ('error' in res) continue;

      expect(res.sameTeamPairs).toEqual([]);
    }
  });

  it('GS-05: one team with 5 entries but only 4 groups: exactly 1 same-team pair reported (minimum)', () => {
    // Team A has 5 entries, Team B has 4, Team C has 4, Team D has 3 -> 16 entries total
    const entries: DrawEntry[] = [
      // 5 from Team A
      { id: 'e-A1', teamIds: ['team-A'], seedScore: 160 },
      { id: 'e-A2', teamIds: ['team-A'], seedScore: 120 },
      { id: 'e-A3', teamIds: ['team-A'], seedScore: 80 },
      { id: 'e-A4', teamIds: ['team-A'], seedScore: 40 },
      { id: 'e-A5', teamIds: ['team-A'], seedScore: 10 },
      // 4 from Team B
      { id: 'e-B1', teamIds: ['team-B'], seedScore: 150 },
      { id: 'e-B2', teamIds: ['team-B'], seedScore: 110 },
      { id: 'e-B3', teamIds: ['team-B'], seedScore: 70 },
      { id: 'e-B4', teamIds: ['team-B'], seedScore: 30 },
      // 4 from Team C
      { id: 'e-C1', teamIds: ['team-C'], seedScore: 140 },
      { id: 'e-C2', teamIds: ['team-C'], seedScore: 100 },
      { id: 'e-C3', teamIds: ['team-C'], seedScore: 60 },
      { id: 'e-C4', teamIds: ['team-C'], seedScore: 20 },
      // 3 from Team D
      { id: 'e-D1', teamIds: ['team-D'], seedScore: 130 },
      { id: 'e-D2', teamIds: ['team-D'], seedScore: 90 },
      { id: 'e-D3', teamIds: ['team-D'], seedScore: 50 },
    ];

    const res = planGroups(entries, 4, 'gs05-seed-fixed');
    expect('error' in res).toBe(false);
    if ('error' in res) return;

    expect(res.sameTeamPairs.length).toBe(1);
    const [pairA, pairB] = res.sameTeamPairs[0]!;
    expect(pairA < pairB).toBe(true);
    expect(pairA.startsWith('e-A')).toBe(true);
    expect(pairB.startsWith('e-A')).toBe(true);
  });

  it('same seed gives the same plan; input order of entries does not change the plan', () => {
    const entries = makeEntries(12, (i) => [`team-${(i % 3) + 1}`]);
    const reversed = [...entries].reverse();
    const shuffled = [
      entries[3]!,
      entries[0]!,
      entries[7]!,
      entries[1]!,
      entries[11]!,
      entries[2]!,
      entries[8]!,
      entries[4]!,
      entries[10]!,
      entries[5]!,
      entries[9]!,
      entries[6]!,
    ];

    const plan1 = planGroups(entries, 4, 'deterministic-seed');
    const plan2 = planGroups(reversed, 4, 'deterministic-seed');
    const plan3 = planGroups(shuffled, 4, 'deterministic-seed');

    expect(plan1).toEqual(plan2);
    expect(plan1).toEqual(plan3);
  });

  it('breaks ties deterministically using PRNG', () => {
    // 4 entries with identical seedScores
    const tiedEntries: DrawEntry[] = [
      { id: 'e-d', teamIds: [], seedScore: 50 },
      { id: 'e-b', teamIds: [], seedScore: 50 },
      { id: 'e-a', teamIds: [], seedScore: 50 },
      { id: 'e-c', teamIds: [], seedScore: 50 },
      { id: 'e-e', teamIds: [], seedScore: 30 },
      { id: 'e-f', teamIds: [], seedScore: 30 },
    ];

    const planA = planGroups(tiedEntries, 3, 'tie-seed-1');
    const planB = planGroups([...tiedEntries].reverse(), 3, 'tie-seed-1');
    expect(planA).toEqual(planB);

    // With a different seed, placement may differ but remains valid
    const planC = planGroups(tiedEntries, 3, 'tie-seed-2');
    expect('error' in planC).toBe(false);
  });
});
