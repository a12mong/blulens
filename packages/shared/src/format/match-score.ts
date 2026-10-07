import type { MatchFormat } from '../schemas/format';

export type GameScore = [number, number];

export type MatchScoreResult =
  | {
      ok: true;
      winner: 'a' | 'b' | null;
      gamesA: number;
      gamesB: number;
      pointsA: number;
      pointsB: number;
    }
  | {
      ok: false;
      code: 'GAME_SCORE_INVALID' | 'GAMES_INCOMPLETE' | 'GAMES_EXTRA' | 'DRAW_NOT_ALLOWED';
      gameIndex?: number;
      message: string;
    };

export function isValidGame(game: GameScore, f: MatchFormat): boolean {
  const [pointsA, pointsB] = game;

  if (!Number.isInteger(pointsA) || !Number.isInteger(pointsB) || pointsA < 0 || pointsB < 0) {
    return false;
  }

  const w = Math.max(pointsA, pointsB);
  const l = Math.min(pointsA, pointsB);
  const P = f.pointsPerGame;

  if (w === l) {
    return false;
  }

  if (!f.deuce) {
    return w === P && l < P;
  }

  if (w === P && l <= P - 2) {
    return true;
  }

  if (w > P && w - l === 2 && (f.cap == null || w <= f.cap)) {
    return true;
  }

  if (f.cap != null && w === f.cap && l === f.cap - 1) {
    return true;
  }

  return false;
}

export function validateMatchScore(games: readonly GameScore[], f: MatchFormat): MatchScoreResult {
  for (let i = 0; i < games.length; i++) {
    const game = games[i]!;
    if (!isValidGame(game, f)) {
      return {
        ok: false,
        code: 'GAME_SCORE_INVALID',
        gameIndex: i,
        message: `คะแนนเกมที่ ${i + 1} ไม่ถูกต้องตามกติกา`,
      };
    }
  }

  let gamesA = 0;
  let gamesB = 0;
  let pointsA = 0;
  let pointsB = 0;

  for (const game of games) {
    const [pA, pB] = game;
    pointsA += pA;
    pointsB += pB;
    if (pA > pB) {
      gamesA++;
    } else {
      gamesB++;
    }
  }

  if (f.mode === 'fixed_games') {
    if (games.length < f.games) {
      return {
        ok: false,
        code: 'GAMES_INCOMPLETE',
        message: 'กรอกผลไม่ครบทุกเกม',
      };
    }

    if (games.length > f.games) {
      return {
        ok: false,
        code: 'GAMES_EXTRA',
        message: 'กรอกเกมเกินจำนวนที่ต้องเล่น',
      };
    }

    const winner = gamesA > gamesB ? 'a' : gamesB > gamesA ? 'b' : null;

    if (winner === null && !f.drawAllowed) {
      return {
        ok: false,
        code: 'DRAW_NOT_ALLOWED',
        message: 'รูปแบบนี้ไม่อนุญาตให้เสมอ',
      };
    }

    return {
      ok: true,
      winner,
      gamesA,
      gamesB,
      pointsA,
      pointsB,
    };
  }

  const need = Math.ceil(f.games / 2);

  let aWinsAt = -1;
  let bWinsAt = -1;
  let a = 0;
  let b = 0;

  for (let i = 0; i < games.length; i++) {
    const [pA, pB] = games[i]!;
    if (pA > pB) {
      a++;
      if (a === need && aWinsAt === -1) {
        aWinsAt = i;
      }
    } else {
      b++;
      if (b === need && bWinsAt === -1) {
        bWinsAt = i;
      }
    }
  }

  const winnerAt = aWinsAt !== -1 ? aWinsAt : bWinsAt !== -1 ? bWinsAt : -1;

  if (winnerAt !== -1 && winnerAt < games.length - 1) {
    return {
      ok: false,
      code: 'GAMES_EXTRA',
      gameIndex: winnerAt + 1,
      message: 'กรอกเกมเกินจำนวนที่ต้องเล่น',
    };
  }

  if (gamesA < need && gamesB < need) {
    return {
      ok: false,
      code: 'GAMES_INCOMPLETE',
      message: 'กรอกผลไม่ครบทุกเกม',
    };
  }

  const winner = gamesA >= need ? 'a' : 'b';

  return {
    ok: true,
    winner,
    gamesA,
    gamesB,
    pointsA,
    pointsB,
  };
}

export function walkoverGames(f: MatchFormat, winner: 'a' | 'b'): GameScore[] {
  const P = f.pointsPerGame;
  const count = f.mode === 'fixed_games' ? f.games : Math.ceil(f.games / 2);

  const result: GameScore[] = [];
  for (let i = 0; i < count; i++) {
    result.push(winner === 'a' ? [P, 0] : [0, P]);
  }

  return result;
}
