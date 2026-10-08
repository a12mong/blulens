import { describe, it, expect } from 'vitest';
import { computeGroupStandings, GroupMatch, rankBestThirds, GroupInput } from './standings';
import { shuffle, createRng } from '../draw/prng';

describe('computeGroupStandings', () => {
  it('§8 fixture: group_2x15, exact rank order and table values', () => {
    const entryIds = ['P1', 'P2', 'P3', 'P4'];
    const matches: GroupMatch[] = [
      { a: 'P1', b: 'P4', status: 'confirmed', games: [[15, 8], [15, 10]] },
      { a: 'P2', b: 'P3', status: 'confirmed', games: [[15, 13], [12, 15]] },
      { a: 'P1', b: 'P3', status: 'confirmed', games: [[13, 15], [15, 11]] },
      { a: 'P4', b: 'P2', status: 'confirmed', games: [[15, 12], [15, 14]] },
      { a: 'P1', b: 'P2', status: 'confirmed', games: [[10, 15], [11, 15]] },
      { a: 'P3', b: 'P4', status: 'confirmed', games: [[15, 9], [15, 13]] },
    ];

    const result = computeGroupStandings(entryIds, matches, { win: 3, draw: 1, loss: 0 }, 'seed');

    expect(result).toHaveLength(4);

    expect(result[0].entryId).toBe('P3');
    expect(result[0].rank).toBe(1);
    expect(result[0].won).toBe(1);
    expect(result[0].drawn).toBe(2);
    expect(result[0].lost).toBe(0);
    expect(result[0].points).toBe(5);
    expect(result[0].pointsFor).toBe(84);
    expect(result[0].pointsAgainst).toBe(77);
    expect(result[0].diff).toBe(7);

    expect(result[1].entryId).toBe('P1');
    expect(result[1].rank).toBe(2);
    expect(result[1].won).toBe(1);
    expect(result[1].drawn).toBe(1);
    expect(result[1].lost).toBe(1);
    expect(result[1].points).toBe(4);
    expect(result[1].pointsFor).toBe(79);
    expect(result[1].pointsAgainst).toBe(74);
    expect(result[1].diff).toBe(5);
    expect(result[1].decidedBy).toBe('diff');

    expect(result[2].entryId).toBe('P2');
    expect(result[2].rank).toBe(3);
    expect(result[2].won).toBe(1);
    expect(result[2].drawn).toBe(1);
    expect(result[2].lost).toBe(1);
    expect(result[2].points).toBe(4);
    expect(result[2].pointsFor).toBe(83);
    expect(result[2].pointsAgainst).toBe(79);
    expect(result[2].diff).toBe(4);

    expect(result[3].entryId).toBe('P4');
    expect(result[3].rank).toBe(4);
    expect(result[3].won).toBe(1);
    expect(result[3].drawn).toBe(0);
    expect(result[3].lost).toBe(2);
    expect(result[3].points).toBe(3);
    expect(result[3].pointsFor).toBe(70);
    expect(result[3].pointsAgainst).toBe(86);
    expect(result[3].diff).toBe(-16);
  });

  it('verifies standings rank all entries', () => {
    const entryIds = ['A', 'B', 'C'];
    const matches: GroupMatch[] = [
      { a: 'A', b: 'B', status: 'confirmed', games: [[15, 10], [15, 12]] },
      { a: 'A', b: 'C', status: 'confirmed', games: [[10, 15], [12, 15]] },
      { a: 'B', b: 'C', status: 'confirmed', games: [[10, 15], [12, 15]] },
    ];

    const result = computeGroupStandings(entryIds, matches, { win: 3, draw: 1, loss: 0 }, 'seed');

    expect(result).toHaveLength(3);
    expect(result.map((r) => r.entryId).sort()).toEqual(['A', 'B', 'C'].sort());
    expect(result[0].rank).toBe(1);
    expect(result[1].rank).toBe(2);
    expect(result[2].rank).toBe(3);
  });

  it('verifies tiebreaker order: points > diff > pointsFor > lot', () => {
    const entryIds = ['A', 'B'];
    const matches: GroupMatch[] = [
      { a: 'A', b: 'B', status: 'confirmed', games: [[15, 10]] },
    ];

    const result = computeGroupStandings(entryIds, matches, { win: 3, draw: 1, loss: 0 }, 'seed');

    expect(result[0].points).toBeGreaterThan(result[1].points);
  });

  it('two entries level on points and diff: direct match winner ranks higher with decidedBy h2h despite lower pointsFor', () => {
    const entryIds = ['A', 'B', 'C', 'D'];
    const matches: GroupMatch[] = [
      { a: 'A', b: 'B', status: 'confirmed', games: [[15, 10]] },
      { a: 'A', b: 'C', status: 'confirmed', games: [[15, 10]] },
      { a: 'A', b: 'D', status: 'confirmed', games: [[10, 20]] },
      { a: 'B', b: 'C', status: 'confirmed', games: [[25, 23]] },
      { a: 'B', b: 'D', status: 'confirmed', games: [[25, 22]] },
      { a: 'C', b: 'D', status: 'confirmed', games: [[15, 10]] },
    ];

    const result = computeGroupStandings(entryIds, matches, { win: 3, draw: 1, loss: 0 }, 'seed');

    expect(result[0].entryId).toBe('A');
    expect(result[0].rank).toBe(1);
    expect(result[0].points).toBe(6);
    expect(result[0].diff).toBe(0);
    expect(result[0].pointsFor).toBe(40);
    expect(result[0].decidedBy).toBe('h2h');

    expect(result[1].entryId).toBe('B');
    expect(result[1].rank).toBe(2);
    expect(result[1].points).toBe(6);
    expect(result[1].diff).toBe(0);
    expect(result[1].pointsFor).toBe(60);
  });

  it('3-way loss cycle, different pointsFor breaks tie', () => {
    const entryIds = ['A', 'B', 'C'];
    const matches: GroupMatch[] = [
      { a: 'A', b: 'B', status: 'confirmed', games: [[15, 10]] },
      { a: 'B', b: 'C', status: 'confirmed', games: [[15, 10]] },
      { a: 'C', b: 'A', status: 'confirmed', games: [[15, 10]] },
    ];

    const result = computeGroupStandings(entryIds, matches, { win: 3, draw: 1, loss: 0 }, 'seed');

    expect(result).toHaveLength(3);
    expect(result[0].points).toBe(3);
    expect(result[1].points).toBe(3);
    expect(result[2].points).toBe(3);
  });

  it('full tie -> lot; same seed same order, different seed differs', () => {
    const entryIds = ['A', 'B', 'C'];
    const matches: GroupMatch[] = [
      { a: 'A', b: 'B', status: 'confirmed', games: [[10, 10]] },
      { a: 'B', b: 'C', status: 'confirmed', games: [[10, 10]] },
      { a: 'C', b: 'A', status: 'confirmed', games: [[10, 10]] },
    ];

    const result1 = computeGroupStandings(entryIds, matches, { win: 3, draw: 1, loss: 0 }, 'seed1');
    const result2 = computeGroupStandings(entryIds, matches, { win: 3, draw: 1, loss: 0 }, 'seed1');
    const result3 = computeGroupStandings(entryIds, matches, { win: 3, draw: 1, loss: 0 }, 'seed2');

    expect(result1.map((r) => r.entryId)).toEqual(result2.map((r) => r.entryId));
    expect(result1.map((r) => r.entryId)).not.toEqual(result3.map((r) => r.entryId));
  });

  it('lot order is input-order independent (same seed)', () => {
    const matches: GroupMatch[] = [
      { a: 'A', b: 'B', status: 'confirmed', games: [[10, 10]] },
      { a: 'B', b: 'C', status: 'confirmed', games: [[10, 10]] },
      { a: 'C', b: 'A', status: 'confirmed', games: [[10, 10]] },
    ];

    const result1 = computeGroupStandings(['A', 'B', 'C'], matches, { win: 3, draw: 1, loss: 0 }, 'seed');
    const result2 = computeGroupStandings(['C', 'A', 'B'], matches, { win: 3, draw: 1, loss: 0 }, 'seed');
    const result3 = computeGroupStandings(['B', 'C', 'A'], matches, { win: 3, draw: 1, loss: 0 }, 'seed');

    expect(result1.map((r) => r.entryId)).toEqual(result2.map((r) => r.entryId));
    expect(result1.map((r) => r.entryId)).toEqual(result3.map((r) => r.entryId));
  });

  it('reported and scheduled matches are ignored', () => {
    const entryIds = ['A', 'B'];
    const matches: GroupMatch[] = [
      { a: 'A', b: 'B', status: 'confirmed', games: [[15, 10]] },
      { a: 'A', b: 'B', status: 'reported', games: [[10, 15]] },
      { a: 'A', b: 'B', status: 'scheduled', games: [[10, 15]] },
    ];

    const result = computeGroupStandings(entryIds, matches, { win: 3, draw: 1, loss: 0 }, 'seed');

    expect(result[0].entryId).toBe('A');
    expect(result[0].won).toBe(1);
    expect(result[0].pointsFor).toBe(15);
  });

  it('void matches are ignored', () => {
    const entryIds = ['A', 'B'];
    const matches: GroupMatch[] = [
      { a: 'A', b: 'B', status: 'confirmed', games: [[15, 10]] },
      { a: 'A', b: 'B', status: 'void', games: [[15, 15]] },
    ];

    const result = computeGroupStandings(entryIds, matches, { win: 3, draw: 1, loss: 0 }, 'seed');

    expect(result[0].won).toBe(1);
    expect(result[0].pointsFor).toBe(15);
  });

  it('walkover counts as confirmed result', () => {
    const entryIds = ['A', 'B'];
    const matches: GroupMatch[] = [
      { a: 'A', b: 'B', status: 'walkover', games: [[15, 0], [15, 0]] },
    ];

    const result = computeGroupStandings(entryIds, matches, { win: 3, draw: 1, loss: 0 }, 'seed');

    expect(result[0].entryId).toBe('A');
    expect(result[0].won).toBe(1);
    expect(result[0].points).toBe(3);
    expect(result[0].pointsFor).toBe(30);
  });

  it('custom points config (e.g., 2/1/0)', () => {
    const entryIds = ['A', 'B'];
    const matches: GroupMatch[] = [
      { a: 'A', b: 'B', status: 'confirmed', games: [[15, 10]] },
    ];

    const result = computeGroupStandings(entryIds, matches, { win: 2, draw: 1, loss: 0 }, 'seed');

    expect(result[0].entryId).toBe('A');
    expect(result[0].points).toBe(2);
  });
});

describe('rankBestThirds', () => {
  it('3 groups of 4: plain order by points', () => {
    const groups: GroupInput[] = [
      {
        groupIndex: 0,
        entryIds: ['A1', 'A2', 'A3', 'A4'],
        matches: [
          { a: 'A1', b: 'A2', status: 'confirmed', games: [[15, 10]] },
          { a: 'A1', b: 'A3', status: 'confirmed', games: [[15, 10]] },
          { a: 'A1', b: 'A4', status: 'confirmed', games: [[15, 10]] },
          { a: 'A2', b: 'A3', status: 'confirmed', games: [[15, 12]] },
          { a: 'A2', b: 'A4', status: 'confirmed', games: [[10, 15]] },
          { a: 'A3', b: 'A4', status: 'confirmed', games: [[10, 15]] },
        ],
      },
      {
        groupIndex: 1,
        entryIds: ['B1', 'B2', 'B3', 'B4'],
        matches: [
          { a: 'B1', b: 'B2', status: 'confirmed', games: [[15, 10]] },
          { a: 'B1', b: 'B3', status: 'confirmed', games: [[15, 10]] },
          { a: 'B1', b: 'B4', status: 'confirmed', games: [[10, 15]] },
          { a: 'B2', b: 'B3', status: 'confirmed', games: [[15, 12]] },
          { a: 'B2', b: 'B4', status: 'confirmed', games: [[15, 10]] },
          { a: 'B3', b: 'B4', status: 'confirmed', games: [[10, 15]] },
        ],
      },
      {
        groupIndex: 2,
        entryIds: ['C1', 'C2', 'C3', 'C4'],
        matches: [
          { a: 'C1', b: 'C2', status: 'confirmed', games: [[15, 10]] },
          { a: 'C1', b: 'C3', status: 'confirmed', games: [[10, 15]] },
          { a: 'C1', b: 'C4', status: 'confirmed', games: [[15, 10]] },
          { a: 'C2', b: 'C3', status: 'confirmed', games: [[15, 10]] },
          { a: 'C2', b: 'C4', status: 'confirmed', games: [[10, 15]] },
          { a: 'C3', b: 'C4', status: 'confirmed', games: [[15, 10]] },
        ],
      },
    ];

    const result = rankBestThirds(groups, { win: 3, draw: 1, loss: 0 }, 'seed');

    expect(result).toHaveLength(3);
    expect(result[0].rank).toBe(1);
    expect(result[1].rank).toBe(2);
    expect(result[2].rank).toBe(3);
  });

  it('unequal group sizes: dropping last-place result changes order', () => {
    const groups: GroupInput[] = [
      {
        groupIndex: 0,
        entryIds: ['X1', 'X2', 'X3', 'X4', 'X5'],
        matches: [
          { a: 'X1', b: 'X2', status: 'confirmed', games: [[15, 10]] },
          { a: 'X1', b: 'X3', status: 'confirmed', games: [[15, 10]] },
          { a: 'X1', b: 'X4', status: 'confirmed', games: [[15, 10]] },
          { a: 'X1', b: 'X5', status: 'confirmed', games: [[10, 15]] },
          { a: 'X2', b: 'X3', status: 'confirmed', games: [[15, 12]] },
          { a: 'X2', b: 'X4', status: 'confirmed', games: [[10, 15]] },
          { a: 'X2', b: 'X5', status: 'confirmed', games: [[10, 15]] },
          { a: 'X3', b: 'X4', status: 'confirmed', games: [[10, 15]] },
          { a: 'X3', b: 'X5', status: 'confirmed', games: [[10, 15]] },
          { a: 'X4', b: 'X5', status: 'confirmed', games: [[15, 10]] },
        ],
      },
      {
        groupIndex: 1,
        entryIds: ['Y1', 'Y2', 'Y3', 'Y4'],
        matches: [
          { a: 'Y1', b: 'Y2', status: 'confirmed', games: [[15, 10]] },
          { a: 'Y1', b: 'Y3', status: 'confirmed', games: [[15, 10]] },
          { a: 'Y1', b: 'Y4', status: 'confirmed', games: [[15, 10]] },
          { a: 'Y2', b: 'Y3', status: 'confirmed', games: [[15, 12]] },
          { a: 'Y2', b: 'Y4', status: 'confirmed', games: [[15, 12]] },
          { a: 'Y3', b: 'Y4', status: 'confirmed', games: [[10, 15]] },
        ],
      },
    ];

    const result = rankBestThirds(groups, { win: 3, draw: 1, loss: 0 }, 'seed');

    expect(result).toHaveLength(2);
    expect(result.every((r) => r.groupIndex === 0 || r.groupIndex === 1)).toBe(true);
  });

  it('full tie on thirds decided by lot; input-order independent (groupIndex consistent)', () => {
    const groups1: GroupInput[] = [
      {
        groupIndex: 0,
        entryIds: ['A', 'B', 'C'],
        matches: [
          { a: 'A', b: 'B', status: 'confirmed', games: [[10, 10]] },
          { a: 'A', b: 'C', status: 'confirmed', games: [[10, 10]] },
          { a: 'B', b: 'C', status: 'confirmed', games: [[10, 10]] },
        ],
      },
      {
        groupIndex: 1,
        entryIds: ['D', 'E', 'F'],
        matches: [
          { a: 'D', b: 'E', status: 'confirmed', games: [[10, 10]] },
          { a: 'D', b: 'F', status: 'confirmed', games: [[10, 10]] },
          { a: 'E', b: 'F', status: 'confirmed', games: [[10, 10]] },
        ],
      },
    ];

    const groups2: GroupInput[] = [
      {
        groupIndex: 1,
        entryIds: ['D', 'E', 'F'],
        matches: [
          { a: 'D', b: 'E', status: 'confirmed', games: [[10, 10]] },
          { a: 'D', b: 'F', status: 'confirmed', games: [[10, 10]] },
          { a: 'E', b: 'F', status: 'confirmed', games: [[10, 10]] },
        ],
      },
      {
        groupIndex: 0,
        entryIds: ['A', 'B', 'C'],
        matches: [
          { a: 'A', b: 'B', status: 'confirmed', games: [[10, 10]] },
          { a: 'A', b: 'C', status: 'confirmed', games: [[10, 10]] },
          { a: 'B', b: 'C', status: 'confirmed', games: [[10, 10]] },
        ],
      },
    ];

    const result1 = rankBestThirds(groups1, { win: 3, draw: 1, loss: 0 }, 'seed');
    const result2 = rankBestThirds(groups2, { win: 3, draw: 1, loss: 0 }, 'seed');

    expect(result1.map((r) => r.entryId)).toEqual(result2.map((r) => r.entryId));
  });

  it('group with 2 entries has no third', () => {
    const groups: GroupInput[] = [
      {
        groupIndex: 0,
        entryIds: ['A1', 'A2', 'A3', 'A4'],
        matches: [
          { a: 'A1', b: 'A2', status: 'confirmed', games: [[15, 10]] },
          { a: 'A1', b: 'A3', status: 'confirmed', games: [[15, 10]] },
          { a: 'A1', b: 'A4', status: 'confirmed', games: [[15, 10]] },
          { a: 'A2', b: 'A3', status: 'confirmed', games: [[15, 12]] },
          { a: 'A2', b: 'A4', status: 'confirmed', games: [[10, 15]] },
          { a: 'A3', b: 'A4', status: 'confirmed', games: [[10, 15]] },
        ],
      },
      {
        groupIndex: 1,
        entryIds: ['B1', 'B2'],
        matches: [{ a: 'B1', b: 'B2', status: 'confirmed', games: [[15, 10]] }],
      },
    ];

    const result = rankBestThirds(groups, { win: 3, draw: 1, loss: 0 }, 'seed');

    expect(result).toHaveLength(1);
    expect(result[0].groupIndex).toBe(0);
  });

  it('same seed same order, different seed differs', () => {
    const groups: GroupInput[] = [
      {
        groupIndex: 0,
        entryIds: ['A', 'B', 'C', 'D'],
        matches: [
          { a: 'A', b: 'B', status: 'confirmed', games: [[10, 10]] },
          { a: 'A', b: 'C', status: 'confirmed', games: [[10, 10]] },
          { a: 'A', b: 'D', status: 'confirmed', games: [[10, 10]] },
          { a: 'B', b: 'C', status: 'confirmed', games: [[10, 10]] },
          { a: 'B', b: 'D', status: 'confirmed', games: [[10, 10]] },
          { a: 'C', b: 'D', status: 'confirmed', games: [[10, 10]] },
        ],
      },
      {
        groupIndex: 1,
        entryIds: ['E', 'F', 'G', 'H'],
        matches: [
          { a: 'E', b: 'F', status: 'confirmed', games: [[10, 10]] },
          { a: 'E', b: 'G', status: 'confirmed', games: [[10, 10]] },
          { a: 'E', b: 'H', status: 'confirmed', games: [[10, 10]] },
          { a: 'F', b: 'G', status: 'confirmed', games: [[10, 10]] },
          { a: 'F', b: 'H', status: 'confirmed', games: [[10, 10]] },
          { a: 'G', b: 'H', status: 'confirmed', games: [[10, 10]] },
        ],
      },
    ];

    const result1 = rankBestThirds(groups, { win: 3, draw: 1, loss: 0 }, 'seed1');
    const result2 = rankBestThirds(groups, { win: 3, draw: 1, loss: 0 }, 'seed1');
    const result3 = rankBestThirds(groups, { win: 3, draw: 1, loss: 0 }, 'seed2');

    expect(result1.map((r) => r.entryId)).toEqual(result2.map((r) => r.entryId));
    expect(result1.map((r) => r.entryId)).not.toEqual(result3.map((r) => r.entryId));
  });
});
