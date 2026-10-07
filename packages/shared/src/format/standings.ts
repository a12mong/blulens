import { createRng, shuffle } from '../draw/prng';

export interface GroupMatch {
  a: string;
  b: string;
  status: 'scheduled' | 'bye' | 'reported' | 'confirmed' | 'walkover' | 'void';
  games: [number, number][];
}

export interface StandingRow {
  entryId: string;
  rank: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
  pointsFor: number;
  pointsAgainst: number;
  diff: number;
  decidedBy: 'points' | 'diff' | 'h2h' | 'pointsFor' | 'lot' | null;
}

interface EntryStats {
  entryId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
  pointsFor: number;
  pointsAgainst: number;
}

export function computeGroupStandings(
  entryIds: readonly string[],
  matches: readonly GroupMatch[],
  pointsCfg: { win: number; draw: number; loss: number } = { win: 3, draw: 1, loss: 0 },
  seed: string,
): StandingRow[] {
  const countedStatuses = new Set(['confirmed', 'walkover']);

  const stats = new Map<string, EntryStats>();
  for (const id of entryIds) {
    stats.set(id, {
      entryId: id,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      points: 0,
      pointsFor: 0,
      pointsAgainst: 0,
    });
  }

  for (const match of matches) {
    if (!countedStatuses.has(match.status)) {
      continue;
    }

    const statsA = stats.get(match.a);
    const statsB = stats.get(match.b);
    if (!statsA || !statsB) continue;

    let aTotal = 0;
    let bTotal = 0;
    let aGamesWon = 0;
    let bGamesWon = 0;
    for (const [aPoints, bPoints] of match.games) {
      aTotal += aPoints;
      bTotal += bPoints;
      if (aPoints > bPoints) aGamesWon += 1;
      else if (bPoints > aPoints) bGamesWon += 1;
    }

    statsA.pointsFor += aTotal;
    statsA.pointsAgainst += bTotal;
    statsB.pointsFor += bTotal;
    statsB.pointsAgainst += aTotal;
    statsA.played += 1;
    statsB.played += 1;

    if (aGamesWon > bGamesWon) {
      statsA.won += 1;
      statsA.points += pointsCfg.win;
      statsB.lost += 1;
      statsB.points += pointsCfg.loss;
    } else if (bGamesWon > aGamesWon) {
      statsB.won += 1;
      statsB.points += pointsCfg.win;
      statsA.lost += 1;
      statsA.points += pointsCfg.loss;
    } else {
      statsA.drawn += 1;
      statsA.points += pointsCfg.draw;
      statsB.drawn += 1;
      statsB.points += pointsCfg.draw;
    }
  }

  const standings = Array.from(stats.values());
  const ranked = rankEntries(standings, matches, pointsCfg, seed);

  return ranked;
}

function rankEntries(
  standings: EntryStats[],
  matches: readonly GroupMatch[],
  pointsCfg: { win: number; draw: number; loss: number },
  seed: string,
): StandingRow[] {
  const sorted = tiebreakEntries(standings, matches, pointsCfg, seed);
  const rows: StandingRow[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const entry = sorted[i];
    if (!entry) continue;
    const nextEntry = i < sorted.length - 1 ? sorted[i + 1] : null;
    const decidedBy = nextEntry ? compareEntries(entry, nextEntry, matches, pointsCfg) : null;

    rows.push({
      entryId: entry.entryId,
      rank: i + 1,
      played: entry.played,
      won: entry.won,
      drawn: entry.drawn,
      lost: entry.lost,
      points: entry.points,
      pointsFor: entry.pointsFor,
      pointsAgainst: entry.pointsAgainst,
      diff: entry.pointsFor - entry.pointsAgainst,
      decidedBy,
    });
  }

  return rows;
}

function compareEntries(
  a: EntryStats,
  b: EntryStats,
  matches: readonly GroupMatch[],
  pointsCfg: { win: number; draw: number; loss: number },
): 'points' | 'diff' | 'h2h' | 'pointsFor' | 'lot' {
  const aPoints = a.points;
  const bPoints = b.points;
  if (aPoints !== bPoints) return 'points';

  const aDiff = a.pointsFor - a.pointsAgainst;
  const bDiff = b.pointsFor - b.pointsAgainst;
  if (aDiff !== bDiff) return 'diff';

  if (a.pointsFor !== b.pointsFor) return 'pointsFor';

  return 'lot';
}

function tiebreakEntries(
  entries: EntryStats[],
  matches: readonly GroupMatch[],
  pointsCfg: { win: number; draw: number; loss: number },
  seed: string,
): EntryStats[] {
  const sorted = [...entries].sort((a, b) => {
    const aPoints = a.points;
    const bPoints = b.points;
    if (aPoints !== bPoints) return bPoints - aPoints;

    const aDiff = a.pointsFor - a.pointsAgainst;
    const bDiff = b.pointsFor - b.pointsAgainst;
    if (aDiff !== bDiff) return bDiff - aDiff;

    if (a.pointsFor !== b.pointsFor) return b.pointsFor - a.pointsFor;

    return 0;
  });

  const groups = groupByTiebreaker(sorted);
  const result: EntryStats[] = [];

  for (const group of groups) {
    if (group.length === 1) {
      result.push(group[0]!);
    } else {
      const tiebroken = resolveHeadToHead(group, matches, pointsCfg, seed);
      result.push(...tiebroken);
    }
  }

  return result;
}

function groupByTiebreaker(entries: EntryStats[]): EntryStats[][] {
  const groups: EntryStats[][] = [];
  let currentGroup: EntryStats[] = [];

  for (const entry of entries) {
    if (currentGroup.length === 0) {
      currentGroup.push(entry);
    } else {
      const prev = currentGroup[0];
      if (!prev) continue;
      const aPoints = prev.points;
      const bPoints = entry.points;
      if (aPoints === bPoints) {
        const aDiff = prev.pointsFor - prev.pointsAgainst;
        const bDiff = entry.pointsFor - entry.pointsAgainst;
        if (aDiff === bDiff) {
          currentGroup.push(entry);
        } else {
          groups.push(currentGroup);
          currentGroup = [entry];
        }
      } else {
        groups.push(currentGroup);
        currentGroup = [entry];
      }
    }
  }

  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  return groups;
}

function resolveHeadToHead(
  entries: EntryStats[],
  matches: readonly GroupMatch[],
  pointsCfg: { win: number; draw: number; loss: number },
  seed: string,
): EntryStats[] {
  const countedStatuses = new Set(['confirmed', 'walkover']);
  const entryIds = new Set(entries.map((e) => e.entryId));

  if (entries.length === 2) {
    const a = entries[0];
    const b = entries[1];
    if (!a || !b) return entries;

    const h2hMatch = Array.from(matches).find(
      (m) =>
        countedStatuses.has(m.status) &&
        ((m.a === a.entryId && m.b === b.entryId) || (m.a === b.entryId && m.b === a.entryId)),
    );

    if (h2hMatch) {
      let aGamesWon = 0;
      let bGamesWon = 0;
      for (const [gameA, gameB] of h2hMatch.games) {
        if (h2hMatch.a === a.entryId) {
          if (gameA > gameB) aGamesWon += 1;
          else if (gameB > gameA) bGamesWon += 1;
        } else {
          if (gameB > gameA) aGamesWon += 1;
          else if (gameA > gameB) bGamesWon += 1;
        }
      }

      if (aGamesWon > bGamesWon) return [a, b];
      if (bGamesWon > aGamesWon) return [b, a];
    }

    if (a.pointsFor !== b.pointsFor) {
      return a.pointsFor > b.pointsFor ? [a, b] : [b, a];
    }

    return applyLot(entries, seed);
  }

  const subMatches = Array.from(matches).filter(
    (m) =>
      countedStatuses.has(m.status) &&
      entryIds.has(m.a) &&
      entryIds.has(m.b),
  );

  const subStats = new Map<string, EntryStats>();
  for (const entry of entries) {
    subStats.set(entry.entryId, {
      entryId: entry.entryId,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      points: 0,
      pointsFor: 0,
      pointsAgainst: 0,
    });
  }

  for (const match of subMatches) {
    const statsA = subStats.get(match.a);
    const statsB = subStats.get(match.b);
    if (!statsA || !statsB) continue;

    let aTotal = 0;
    let bTotal = 0;
    let aGamesWon = 0;
    let bGamesWon = 0;
    for (const [aPoints, bPoints] of match.games) {
      aTotal += aPoints;
      bTotal += bPoints;
      if (aPoints > bPoints) aGamesWon += 1;
      else if (bPoints > aPoints) bGamesWon += 1;
    }

    statsA.pointsFor += aTotal;
    statsA.pointsAgainst += bTotal;
    statsB.pointsFor += bTotal;
    statsB.pointsAgainst += aTotal;
    statsA.played += 1;
    statsB.played += 1;

    if (aGamesWon > bGamesWon) {
      statsA.won += 1;
      statsA.points += pointsCfg.win;
      statsB.lost += 1;
      statsB.points += pointsCfg.loss;
    } else if (bGamesWon > aGamesWon) {
      statsB.won += 1;
      statsB.points += pointsCfg.win;
      statsA.lost += 1;
      statsA.points += pointsCfg.loss;
    } else {
      statsA.drawn += 1;
      statsA.points += pointsCfg.draw;
      statsB.drawn += 1;
      statsB.points += pointsCfg.draw;
    }
  }

  const subEntries = Array.from(subStats.values());
  const subSorted = [...subEntries].sort((a, b) => {
    const aPoints = a.points;
    const bPoints = b.points;
    if (aPoints !== bPoints) return bPoints - aPoints;

    const aDiff = a.pointsFor - a.pointsAgainst;
    const bDiff = b.pointsFor - b.pointsAgainst;
    if (aDiff !== bDiff) return bDiff - aDiff;

    if (a.pointsFor !== b.pointsFor) return b.pointsFor - a.pointsFor;

    return 0;
  });

  const subGroups = groupByTiebreaker(subSorted);
  const result: EntryStats[] = [];

  for (const subGroup of subGroups) {
    if (subGroup.length === 1) {
      const found = entries.find((e) => e.entryId === subGroup[0]?.entryId);
      if (found) result.push(found);
    } else {
      const stillTied = entries.filter((e) => subGroup.some((s) => s.entryId === e.entryId));
      if (stillTied.length === subGroup.length) {
        result.push(...applyLot(stillTied, seed));
      } else {
        const resolved = resolveHeadToHead(stillTied, matches, pointsCfg, seed);
        result.push(...resolved);
      }
    }
  }

  return result;
}

function applyLot(entries: EntryStats[], seed: string): EntryStats[] {
  const sortedIds = Array.from(entries.map((e) => e.entryId)).sort();
  const rng = createRng(`${seed}:lot:${sortedIds.join(',')}`);
  const shuffled = shuffle([...sortedIds], rng);

  return shuffled
    .map((id) => entries.find((e) => e.entryId === id))
    .filter((e) => e !== undefined) as EntryStats[];
}
