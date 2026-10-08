import type { components } from '@/lib/api/schema';

export type MatchFormat = components['schemas']['MatchFormat'];

export type Game = {
  a: number;
  b: number;
};

export type MatchValidation = {
  ok: boolean;
  errors: (string | null)[];
  matchError?: string | null;
  winner: 'a' | 'b' | 'draw' | null;
  visibleGames: number;
};

/**
 * Validates whether an individual game score is a legal completed badminton game.
 *
 * Rules:
 * - 'ยังไม่ครบ {pointsPerGame} แต้ม' when nobody reached the target.
 * - 'ต้องห่างกัน 2 แต้ม' when deuce is on and the lead is 1 at/after target (unless a cap decides).
 * - 'เกินแต้มสูงสุด {cap}' when above cap.
 * - 'ผลเสมอไม่ได้' when both equal and not allowed.
 * - For no-deuce: 'ผู้ชนะต้องได้ {pointsPerGame} แต้มพอดี'.
 */
export function validateGame(g: Game, f: MatchFormat): string | null {
  const max = Math.max(g.a, g.b);
  const min = Math.min(g.a, g.b);
  const diff = max - min;

  // 1. Cap check
  if (f.cap != null && max > f.cap) {
    return `เกินแต้มสูงสุด ${f.cap}`;
  }

  // 2. Target check
  if (max < f.pointsPerGame) {
    return `ยังไม่ครบ ${f.pointsPerGame} แต้ม`;
  }

  // 3. Both equal check
  if (g.a === g.b) {
    return 'ผลเสมอไม่ได้';
  }

  // 4. No-deuce rule
  if (!f.deuce) {
    if (max !== f.pointsPerGame) {
      return `ผู้ชนะต้องได้ ${f.pointsPerGame} แต้มพอดี`;
    }
    return null;
  }

  // 5. Deuce rule
  // If cap is set and reached: first to cap wins even by 1
  if (f.cap != null && max === f.cap) {
    return null;
  }

  // Before cap or without cap:
  // Lead must be at least 2
  if (diff < 2) {
    return 'ต้องห่างกัน 2 แต้ม';
  }

  // If score exceeded pointsPerGame, the game ended at a 2-point lead
  if (max > f.pointsPerGame && diff > 2) {
    if (min < f.pointsPerGame - 1) {
      return `ผู้ชนะต้องได้ ${f.pointsPerGame} แต้มพอดี`;
    }
    return 'ต้องห่างกัน 2 แต้ม';
  }

  return null;
}

/**
 * Validates a series of game scores for a match against the MatchFormat.
 *
 * - fixed_games: needs exactly `games` games each valid; winner = more games won,
 *   draw only if equal and drawAllowed, equal and not allowed -> not ok with message 'ผลเสมอไม่ได้' on the match.
 * - best_of: games needed = ceil(games/2); visibleGames = games played until someone has
 *   the needed wins (hide later games); not ok until a side has the needed wins.
 */
export function validateMatch(games: Game[], f: MatchFormat): MatchValidation {
  const errors = games.map((g) => validateGame(g, f));

  if (f.mode === 'best_of') {
    const neededWins = Math.ceil(f.games / 2);
    let winsA = 0;
    let winsB = 0;
    let decidedAt = -1;

    for (let i = 0; i < games.length; i++) {
      if (errors[i] === null) {
        if (games[i].a > games[i].b) winsA++;
        else if (games[i].b > games[i].a) winsB++;

        if (winsA === neededWins || winsB === neededWins) {
          decidedAt = i;
          break;
        }
      } else {
        break;
      }
    }

    if (decidedAt !== -1) {
      const visibleGames = decidedAt + 1;
      const winner: 'a' | 'b' = winsA === neededWins ? 'a' : 'b';
      const visibleErrors = errors.slice(0, visibleGames);
      const allVisibleValid = visibleErrors.every((e) => e === null);

      return {
        ok: allVisibleValid,
        errors: errors.map((err, idx) => (idx < visibleGames ? err : null)),
        winner,
        visibleGames,
      };
    }

    // Nobody reached neededWins yet
    let visibleGames = 1;
    for (let i = 0; i < games.length; i++) {
      if (errors[i] === null) {
        visibleGames = Math.min(f.games, i + 2);
      } else {
        break;
      }
    }

    return {
      ok: false,
      errors: errors.map((err, idx) => (idx < visibleGames ? err : null)),
      winner: null,
      visibleGames,
    };
  }

  // Mode: fixed_games
  const visibleGames = f.games;
  const paddedErrors = Array.from({ length: f.games }, (_, i) => {
    if (i < games.length) {
      return errors[i];
    }
    return `ยังไม่ครบ ${f.pointsPerGame} แต้ม`;
  });

  if (games.length < f.games) {
    return {
      ok: false,
      errors: paddedErrors,
      winner: null,
      visibleGames,
    };
  }

  const firstGames = games.slice(0, f.games);
  const firstErrors = errors.slice(0, f.games);
  const allValid = firstErrors.every((e) => e === null);

  let winsA = 0;
  let winsB = 0;
  for (const g of firstGames) {
    if (g.a > g.b) winsA++;
    else if (g.b > g.a) winsB++;
  }

  if (winsA > winsB) {
    return {
      ok: allValid,
      errors: firstErrors,
      winner: 'a',
      visibleGames,
    };
  }

  if (winsB > winsA) {
    return {
      ok: allValid,
      errors: firstErrors,
      winner: 'b',
      visibleGames,
    };
  }

  // Equal wins (draw)
  if (f.drawAllowed) {
    return {
      ok: allValid,
      errors: firstErrors,
      winner: 'draw',
      visibleGames,
    };
  }

  // Equal and not allowed -> not ok with message 'ผลเสมอไม่ได้' on the match
  return {
    ok: false,
    errors: firstErrors,
    matchError: 'ผลเสมอไม่ได้',
    winner: null,
    visibleGames,
  };
}
