import { describe, it, expect } from 'vitest';
import {
  isValidGame,
  validateMatchScore,
  walkoverGames,
  type GameScore,
  type MatchFormat,
} from './match-score';

const PRESETS = {
  group_2x15: {
    preset: 'group_2x15',
    mode: 'fixed_games',
    games: 2,
    pointsPerGame: 15,
    deuce: false,
    drawAllowed: true,
  } as MatchFormat,
  single_30: {
    preset: 'single_30',
    mode: 'best_of',
    games: 1,
    pointsPerGame: 30,
    deuce: false,
  } as MatchFormat,
  bo3_21: {
    preset: 'bo3_21',
    mode: 'best_of',
    games: 3,
    pointsPerGame: 21,
    deuce: true,
    cap: 30,
  } as MatchFormat,
  single_21: {
    preset: 'single_21',
    mode: 'best_of',
    games: 1,
    pointsPerGame: 21,
    deuce: true,
    cap: 30,
  } as MatchFormat,
};

describe('isValidGame', () => {
  it('accepts valid game without deuce', () => {
    const f = PRESETS.group_2x15;
    expect(isValidGame([15, 10], f)).toBe(true);
    expect(isValidGame([15, 0], f)).toBe(true);
    expect(isValidGame([15, 14], f)).toBe(true);
  });

  it('rejects equal scores', () => {
    expect(isValidGame([15, 15], PRESETS.group_2x15)).toBe(false);
    expect(isValidGame([0, 0], PRESETS.group_2x15)).toBe(false);
  });

  it('accepts loser with less than pointsPerGame', () => {
    expect(isValidGame([14, 15], PRESETS.group_2x15)).toBe(true);
  });

  it('accepts valid deuce games', () => {
    const f = PRESETS.bo3_21;
    expect(isValidGame([21, 19], f)).toBe(true);
    expect(isValidGame([23, 21], f)).toBe(true);
    expect(isValidGame([30, 29], f)).toBe(true); // cap
    expect(isValidGame([21, 20], f)).toBe(false);
  });

  it('rejects cap violations', () => {
    const f = PRESETS.bo3_21;
    expect(isValidGame([31, 29], f)).toBe(false);
  });

  it('rejects negative and fractional', () => {
    expect(isValidGame([-1, 10], PRESETS.group_2x15)).toBe(false);
    expect(isValidGame([15.5, 10], PRESETS.group_2x15)).toBe(false);
  });
});

describe('validateMatchScore – fixed_games', () => {
  const f = PRESETS.group_2x15;

  it('accepts valid complete score (group_2x15: 15-10, 15-8)', () => {
    const result = validateMatchScore(
      [
        [15, 10],
        [15, 8],
      ],
      f,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.winner).toBe('a');
      expect(result.gamesA).toBe(2);
      expect(result.gamesB).toBe(0);
      expect(result.pointsA).toBe(30);
      expect(result.pointsB).toBe(18);
    }
  });

  it('accepts draw when drawAllowed (group_2x15: 15-10, 10-15)', () => {
    const result = validateMatchScore(
      [
        [15, 10],
        [10, 15],
      ],
      f,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.winner).toBe(null);
    }
  });

  it('rejects draw when drawAllowed=false', () => {
    const f2 = { ...f, drawAllowed: false };
    const result = validateMatchScore(
      [
        [15, 10],
        [10, 15],
      ],
      f2,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('DRAW_NOT_ALLOWED');
    }
  });

  it('rejects incomplete score (one game)', () => {
    const result = validateMatchScore([[15, 10]], f);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('GAMES_INCOMPLETE');
    }
  });

  it('rejects extra games', () => {
    const result = validateMatchScore(
      [
        [15, 10],
        [15, 8],
        [15, 12],
      ],
      f,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('GAMES_EXTRA');
    }
  });

  it('rejects invalid game (GS-17: 16-14 bad)', () => {
    const result = validateMatchScore(
      [
        [16, 14],
        [15, 10],
      ],
      f,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('GAME_SCORE_INVALID');
      expect(result.gameIndex).toBe(0);
    }
  });

  it('accepts 15-14 (GS-17)', () => {
    const result = validateMatchScore(
      [
        [15, 14],
        [15, 12],
      ],
      f,
    );
    expect(result.ok).toBe(true);
  });
});

describe('validateMatchScore – best_of', () => {
  const f = PRESETS.bo3_21;

  it('accepts bo3_21: [21,10],[21,15],[21,3] -> GAMES_EXTRA at index 2', () => {
    const result = validateMatchScore(
      [
        [21, 10],
        [21, 15],
        [21, 3],
      ],
      f,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('GAMES_EXTRA');
      expect(result.gameIndex).toBe(2);
    }
  });

  it('accepts bo3_21: [21,10],[10,21] -> GAMES_INCOMPLETE (need 2 wins)', () => {
    const result = validateMatchScore(
      [
        [21, 10],
        [10, 21],
      ],
      f,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('GAMES_INCOMPLETE');
    }
  });

  it('accepts valid bo3_21 with 2 wins', () => {
    const result = validateMatchScore(
      [
        [21, 10],
        [21, 15],
      ],
      f,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.winner).toBe('a');
      expect(result.gamesA).toBe(2);
    }
  });

  it('rejects bo3_21: [21,20] (needs 2-point lead)', () => {
    const result = validateMatchScore([[21, 20]], f);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('GAME_SCORE_INVALID');
    }
  });

  it('accepts single_30 (best_of=1) with complete score', () => {
    const result = validateMatchScore([[30, 15]], PRESETS.single_30);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.winner).toBe('a');
    }
  });

  it('rejects single_30 with incomplete score', () => {
    const result = validateMatchScore([], PRESETS.single_30);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('GAMES_INCOMPLETE');
    }
  });
});

describe('validateMatchScore – GS-17 examples', () => {
  it('group_2x15: 15-8 ok', () => {
    const result = validateMatchScore(
      [
        [15, 8],
        [15, 10],
      ],
      PRESETS.group_2x15,
    );
    expect(result.ok).toBe(true);
  });

  it('group_2x15: 15-14 ok', () => {
    const result = validateMatchScore(
      [
        [15, 14],
        [15, 12],
      ],
      PRESETS.group_2x15,
    );
    expect(result.ok).toBe(true);
  });

  it('group_2x15: 16-14 bad', () => {
    const result = validateMatchScore(
      [
        [16, 14],
        [15, 10],
      ],
      PRESETS.group_2x15,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('GAME_SCORE_INVALID');
    }
  });

  it('group_2x15: 14-14 bad', () => {
    const result = validateMatchScore(
      [
        [14, 14],
        [15, 10],
      ],
      PRESETS.group_2x15,
    );
    expect(result.ok).toBe(false);
  });

  it('group_2x15: 15-15 bad', () => {
    const result = validateMatchScore(
      [
        [15, 15],
        [15, 10],
      ],
      PRESETS.group_2x15,
    );
    expect(result.ok).toBe(false);
  });

  it('bo3_21: 22-20 ok', () => {
    const result = validateMatchScore(
      [
        [22, 20],
        [21, 19],
      ],
      PRESETS.bo3_21,
    );
    expect(result.ok).toBe(true);
  });

  it('bo3_21: 21-20 bad', () => {
    const result = validateMatchScore(
      [
        [21, 20],
        [21, 19],
      ],
      PRESETS.bo3_21,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('GAME_SCORE_INVALID');
    }
  });

  it('bo3_21: 30-29 ok (cap)', () => {
    const result = validateMatchScore(
      [
        [30, 29],
        [21, 10],
      ],
      PRESETS.bo3_21,
    );
    expect(result.ok).toBe(true);
  });

  it('bo3_21: 31-29 bad', () => {
    const result = validateMatchScore(
      [
        [31, 29],
        [21, 10],
      ],
      PRESETS.bo3_21,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('GAME_SCORE_INVALID');
    }
  });
});

describe('walkoverGames', () => {
  it('group_2x15 walkover = [15,0], [15,0]', () => {
    const result = walkoverGames(PRESETS.group_2x15, 'a');
    expect(result).toEqual([
      [15, 0],
      [15, 0],
    ]);
  });

  it('single_30 walkover = [30,0]', () => {
    const result = walkoverGames(PRESETS.single_30, 'a');
    expect(result).toEqual([[30, 0]]);
  });

  it('bo3_21 walkover = [21,0], [21,0]', () => {
    const result = walkoverGames(PRESETS.bo3_21, 'a');
    expect(result).toEqual([
      [21, 0],
      [21, 0],
    ]);
  });

  it('single_21 walkover = [21,0]', () => {
    const result = walkoverGames(PRESETS.single_21, 'a');
    expect(result).toEqual([[21, 0]]);
  });

  it('walkover for winner b', () => {
    const result = walkoverGames(PRESETS.group_2x15, 'b');
    expect(result).toEqual([
      [0, 15],
      [0, 15],
    ]);
  });

  it('walkover games pass validation', () => {
    for (const [preset, format] of Object.entries(PRESETS)) {
      for (const winner of ['a', 'b'] as const) {
        const games = walkoverGames(format, winner);
        const result = validateMatchScore(games, format);
        expect(result.ok).toBe(true, `${preset} walkover for ${winner} should pass validation`);
        if (result.ok) {
          expect(result.winner).toBe(winner);
        }
      }
    }
  });
});

describe('validateMatchScore – edge cases', () => {
  it('handles empty games array', () => {
    const result = validateMatchScore([], PRESETS.group_2x15);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('GAMES_INCOMPLETE');
    }
  });

  it('rejects invalid game code error includes message', () => {
    const result = validateMatchScore([[20, 10]], PRESETS.group_2x15);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('ไม่ถูกต้องตามกติกา');
    }
  });

  it('incomplete error includes Thai message', () => {
    const result = validateMatchScore([[15, 10]], PRESETS.group_2x15);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('ไม่ครบ');
    }
  });

  it('extra games error includes Thai message', () => {
    const result = validateMatchScore(
      [
        [15, 10],
        [15, 8],
        [15, 12],
      ],
      PRESETS.group_2x15,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('เกิน');
    }
  });

  it('draw not allowed error includes Thai message', () => {
    const f = { ...PRESETS.group_2x15, drawAllowed: false };
    const result = validateMatchScore(
      [
        [15, 10],
        [10, 15],
      ],
      f,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('เสมอ');
    }
  });
});
