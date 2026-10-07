import { describe, it, expect } from 'vitest';
import { computeGroupStandings, GroupMatch } from './standings';
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
