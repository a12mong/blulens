import { describe, expect, it } from 'vitest';
import {
  validateGame,
  validateMatch,
  type MatchFormat,
} from './scoreRules';

describe('scoreRules', () => {
  const bo3_21: MatchFormat = {
    preset: 'bo3_21',
    mode: 'best_of',
    games: 3,
    pointsPerGame: 21,
    deuce: true,
    cap: 30,
    drawAllowed: false,
  };

  const group_2x15: MatchFormat = {
    preset: 'group_2x15',
    mode: 'fixed_games',
    games: 2,
    pointsPerGame: 15,
    deuce: false,
    cap: null,
    drawAllowed: true,
  };

  it('validates games per the format (proving test)', () => {
    // Examples with pointsPerGame 21, deuce true, cap 30
    expect(validateGame({ a: 21, b: 19 }, bo3_21)).toBeNull();
    expect(validateGame({ a: 21, b: 20 }, bo3_21)).toBe('ต้องห่างกัน 2 แต้ม');
    expect(validateGame({ a: 22, b: 20 }, bo3_21)).toBeNull();
    expect(validateGame({ a: 30, b: 29 }, bo3_21)).toBeNull();
    expect(validateGame({ a: 31, b: 29 }, bo3_21)).toBe('เกินแต้มสูงสุด 30');
    expect(validateGame({ a: 20, b: 18 }, bo3_21)).toBe('ยังไม่ครบ 21 แต้ม');

    // Examples with pointsPerGame 15, deuce false
    expect(validateGame({ a: 15, b: 13 }, group_2x15)).toBeNull();
    expect(validateGame({ a: 16, b: 14 }, group_2x15)).toBe(
      'ผู้ชนะต้องได้ 15 แต้มพอดี',
    );

    // validateMatch for bo3_21 (games 3)
    const match1 = validateMatch(
      [
        { a: 21, b: 15 },
        { a: 18, b: 21 },
        { a: 21, b: 19 },
      ],
      bo3_21,
    );
    expect(match1.ok).toBe(true);
    expect(match1.winner).toBe('a');
    expect(match1.visibleGames).toBe(3);

    // 2-0 win hides third game
    const match2 = validateMatch(
      [
        { a: 21, b: 15 },
        { a: 21, b: 10 },
      ],
      bo3_21,
    );
    expect(match2.ok).toBe(true);
    expect(match2.winner).toBe('a');
    expect(match2.visibleGames).toBe(2);

    // [21-15] only 1 win, not ok
    const match3 = validateMatch([{ a: 21, b: 15 }], bo3_21);
    expect(match3.ok).toBe(false);

    // group_2x15 fixed 2 games with drawAllowed: [15-10, 10-15] ok winner 'draw'
    const matchDraw = validateMatch(
      [
        { a: 15, b: 10 },
        { a: 10, b: 15 },
      ],
      group_2x15,
    );
    expect(matchDraw.ok).toBe(true);
    expect(matchDraw.winner).toBe('draw');
    expect(matchDraw.visibleGames).toBe(2);
  });

  describe('validateGame edge cases', () => {
    it('returns "ผลเสมอไม่ได้" when scores are equal at or above target', () => {
      expect(validateGame({ a: 21, b: 21 }, bo3_21)).toBe('ผลเสมอไม่ได้');
      expect(validateGame({ a: 15, b: 15 }, group_2x15)).toBe('ผลเสมอไม่ได้');
    });

    it('returns "ยังไม่ครบ {pointsPerGame} แต้ม" when below target even if equal', () => {
      expect(validateGame({ a: 0, b: 0 }, bo3_21)).toBe('ยังไม่ครบ 21 แต้ม');
      expect(validateGame({ a: 10, b: 10 }, group_2x15)).toBe('ยังไม่ครบ 15 แต้ม');
    });

    it('validates side B winning correctly', () => {
      expect(validateGame({ a: 19, b: 21 }, bo3_21)).toBeNull();
      expect(validateGame({ a: 20, b: 21 }, bo3_21)).toBe('ต้องห่างกัน 2 แต้ม');
      expect(validateGame({ a: 20, b: 22 }, bo3_21)).toBeNull();
      expect(validateGame({ a: 29, b: 30 }, bo3_21)).toBeNull();
      expect(validateGame({ a: 13, b: 15 }, group_2x15)).toBeNull();
    });

    it('flags deuce difference exceeding 2 when without cap or before cap', () => {
      expect(validateGame({ a: 22, b: 19 }, bo3_21)).toBe(
        'ผู้ชนะต้องได้ 21 แต้มพอดี',
      );
      expect(validateGame({ a: 23, b: 20 }, bo3_21)).toBe('ต้องห่างกัน 2 แต้ม');
    });
  });

  describe('validateMatch edge cases', () => {
    it('handles best_of winner B', () => {
      const match = validateMatch(
        [
          { a: 10, b: 21 },
          { a: 12, b: 21 },
        ],
        bo3_21,
      );
      expect(match.ok).toBe(true);
      expect(match.winner).toBe('b');
      expect(match.visibleGames).toBe(2);
    });

    it('handles fixed_games winner A and winner B', () => {
      const matchA = validateMatch(
        [
          { a: 15, b: 10 },
          { a: 15, b: 12 },
        ],
        group_2x15,
      );
      expect(matchA.ok).toBe(true);
      expect(matchA.winner).toBe('a');
      expect(matchA.visibleGames).toBe(2);

      const matchB = validateMatch(
        [
          { a: 10, b: 15 },
          { a: 12, b: 15 },
        ],
        group_2x15,
      );
      expect(matchB.ok).toBe(true);
      expect(matchB.winner).toBe('b');
      expect(matchB.visibleGames).toBe(2);
    });

    it('handles fixed_games when drawAllowed is false and result is a draw', () => {
      const fixedNoDraw: MatchFormat = {
        ...group_2x15,
        drawAllowed: false,
      };

      const match = validateMatch(
        [
          { a: 15, b: 10 },
          { a: 10, b: 15 },
        ],
        fixedNoDraw,
      );
      expect(match.ok).toBe(false);
      expect(match.winner).toBeNull();
      expect(match.matchError).toBe('ผลเสมอไม่ได้');
    });

    it('returns ok false when any visible game is invalid', () => {
      const match = validateMatch(
        [
          { a: 21, b: 15 },
          { a: 20, b: 20 }, // invalid: diff 0, below target
        ],
        bo3_21,
      );
      expect(match.ok).toBe(false);
      expect(match.winner).toBeNull();
      expect(match.errors[1]).toBe('ยังไม่ครบ 21 แต้ม');
    });
  });
});
