export interface RoundRobinRound {
  round: number;
  matches: [number, number][];
  bye: number | null;
}

export function roundRobinSchedule(
  size: number,
  lastRoundPairs: readonly [number, number][] = [],
): RoundRobinRound[] {
  if (!Number.isInteger(size) || size < 3 || size > 5) {
    throw new RangeError(`size must be an integer between 3 and 5, got ${size}`);
  }

  const isOdd = size % 2 === 1;
  const m = isOdd ? size + 1 : size;
  let L = Array.from({ length: m - 1 }, (_, i) => i + 2);

  const rounds: RoundRobinRound[] = [];

  for (let r = 0; r < m - 1; r++) {
    const pairs: Array<[number, number]> = [];
    let bye: number | null = null;

    const lastElement = L[L.length - 1];
    if (lastElement === undefined) throw new Error('L should not be empty');
    pairs.push([1, lastElement]);

    const remaining = L.slice(0, -1);
    for (let i = 0; i < Math.floor(remaining.length / 2); i++) {
      const a = remaining[i];
      const b = remaining[remaining.length - 1 - i];
      if (a === undefined || b === undefined) throw new Error('Invalid pairing');
      pairs.push([a, b]);
    }

    const matches: [number, number][] = [];
    for (const [a, b] of pairs) {
      if (isOdd && (a === m || b === m)) {
        bye = a === m ? b : a;
      } else {
        matches.push([a, b]);
      }
    }

    rounds.push({ round: r + 1, matches, bye });

    const first = L[L.length - 1];
    if (first === undefined) throw new Error('L should not be empty');
    L = [first, ...L.slice(0, L.length - 1)];
  }

  if (lastRoundPairs.length > 0) {
    const lastRoundPairsSet = new Set(
      lastRoundPairs.map(([a, b]) => JSON.stringify([Math.min(a, b), Math.max(a, b)])),
    );

    let maxCount = -1;
    let maxRoundIndex = -1;

    for (let i = 0; i < rounds.length; i++) {
      let count = 0;
      const round = rounds[i];
      if (round === undefined) continue;
      for (const match of round.matches) {
        const key = JSON.stringify([Math.min(match[0], match[1]), Math.max(match[0], match[1])]);
        if (lastRoundPairsSet.has(key)) {
          count++;
        }
      }
      if (count > maxCount || (count === maxCount && i > maxRoundIndex)) {
        maxCount = count;
        maxRoundIndex = i;
      }
    }

    if (maxCount > 0 && maxRoundIndex >= 0) {
      const movedRound = rounds.splice(maxRoundIndex, 1)[0];
      if (movedRound === undefined) throw new Error('Spliced round should exist');
      rounds.push(movedRound);

      for (let i = 0; i < rounds.length; i++) {
        const round = rounds[i];
        if (round === undefined) throw new Error('Round should exist');
        round.round = i + 1;
      }
    }
  }

  return rounds;
}
