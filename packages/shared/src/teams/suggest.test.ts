import { describe, expect, it } from 'vitest';
import { normalizeTeamName, editDistance, suggestTeams, type TeamNameCandidate } from './suggest';

describe('normalizeTeamName', () => {
  it('normalizes Unicode, Thai digits, zero-width chars, whitespace, and casing', () => {
    // Basic normalization
    expect(normalizeTeamName('Hello World')).toBe('hello world');

    // Thai digits → ASCII digits
    expect(normalizeTeamName('ทีม๑')).toBe('ทีม1');
    expect(normalizeTeamName('ทีม๐๑๒๓๔๕๖๗๘๙')).toBe('ทีม0123456789');

    // Zero-width characters removed
    expect(normalizeTeamName('Hello​World')).toBe('helloworld'); // Zero-width space (U+200B)
    expect(normalizeTeamName('Hello‌World')).toBe('helloworld'); // Zero-width non-joiner (U+200C)
    expect(normalizeTeamName('Hello‍World')).toBe('helloworld'); // Zero-width joiner (U+200D)
    expect(normalizeTeamName('Hello﻿World')).toBe('helloworld'); // Zero-width no-break space (U+FEFF)

    // Whitespace collapse
    expect(normalizeTeamName('Hello  \t\n  World')).toBe('hello world');
    expect(normalizeTeamName('Hello World')).toBe('hello world'); // NBSP

    // Trim
    expect(normalizeTeamName('  hello world  ')).toBe('hello world');

    // Empty/whitespace only
    expect(normalizeTeamName('   ')).toBe('');

    // Full-width characters are NOT converted (no NFKC)
    expect(normalizeTeamName('ＡＢＣ')).toBe('ａｂｃ');
  });
});

describe('editDistance', () => {
  it('calculates Levenshtein distance correctly', () => {
    expect(editDistance('kitten', 'sitting')).toBe(3);
    expect(editDistance('', 'abc')).toBe(3);
    expect(editDistance('abc', '')).toBe(3);
    expect(editDistance('', '')).toBe(0);
    expect(editDistance('abc', 'abc')).toBe(0);
    expect(editDistance('a', 'b')).toBe(1);
    expect(editDistance('ab', 'ba')).toBe(2); // swap
  });
});

describe('suggestTeams', () => {
  // Standard candidates from the spec
  const candidates: TeamNameCandidate[] = [
    { teamId: 'T1', name: 'Blue Wing', alias: null, key: 'blue wing' },
    { teamId: 'T1', name: 'Blue Wing', alias: 'บลูวิง', key: 'บลูวิง' },
    { teamId: 'T2', name: 'Red Phoenix', alias: null, key: 'red phoenix' },
    { teamId: 'T3', name: 'Green Valley', alias: null, key: 'green valley' },
    { teamId: 'T4', name: 'Blue Whale', alias: null, key: 'blue whale' },
  ];

  it('suggests teams by prefix, word prefix, alias and small typos, closest first', () => {
    // 'blue' -> [T4 Blue Whale d0, T1 Blue Wing d0] (name order)
    let result = suggestTeams('blue', candidates);
    expect(result).toEqual([
      { teamId: 'T4', name: 'Blue Whale', matchedAlias: null, distance: 0 },
      { teamId: 'T1', name: 'Blue Wing', matchedAlias: null, distance: 0 },
    ]);

    // '  Blue  Wing​ ' -> [T1 d0, matchedAlias null]
    result = suggestTeams('  Blue  Wing​', candidates);
    expect(result).toEqual([{ teamId: 'T1', name: 'Blue Wing', matchedAlias: null, distance: 0 }]);

    // 'bleu wing' -> [T1 d2]
    result = suggestTeams('bleu wing', candidates);
    expect(result).toEqual([{ teamId: 'T1', name: 'Blue Wing', matchedAlias: null, distance: 2 }]);

    // 'red phx' -> [T2 d1]
    result = suggestTeams('red phx', candidates);
    expect(result).toEqual([{ teamId: 'T2', name: 'Red Phoenix', matchedAlias: null, distance: 1 }]);

    // 'gren' -> [T3 d1]
    result = suggestTeams('gren', candidates);
    expect(result).toEqual([{ teamId: 'T3', name: 'Green Valley', matchedAlias: null, distance: 1 }]);

    // 'wing' -> [T1 d0] (word prefix)
    result = suggestTeams('wing', candidates);
    expect(result).toEqual([{ teamId: 'T1', name: 'Blue Wing', matchedAlias: null, distance: 0 }]);

    // 'บลู' -> [T1 d0, matchedAlias 'บลูวิง']
    result = suggestTeams('บลู', candidates);
    expect(result).toEqual([{ teamId: 'T1', name: 'Blue Wing', matchedAlias: 'บลูวิง', distance: 0 }]);
  });

  it('respects limit parameter', () => {
    // 'blu' with limit 1 -> [T4]
    let result = suggestTeams('blu', candidates, 1);
    expect(result.length).toBe(1);
    expect(result[0]!.teamId).toBe('T4');

    // Verify both match with limit 2
    result = suggestTeams('blu', candidates, 2);
    expect(result.length).toBe(2);
  });

  it('returns empty for no matches', () => {
    expect(suggestTeams('z', candidates)).toEqual([]);
    expect(suggestTeams('   ', candidates)).toEqual([]);
    expect(suggestTeams('xyz', candidates)).toEqual([]);
  });

  it('throws RangeError for invalid limit', () => {
    expect(() => suggestTeams('blue', candidates, 0)).toThrow(
      new RangeError('TEAM_SUGGEST_INVALID_LIMIT'),
    );
    expect(() => suggestTeams('blue', candidates, 21)).toThrow(
      new RangeError('TEAM_SUGGEST_INVALID_LIMIT'),
    );
    expect(() => suggestTeams('blue', candidates, 1.5)).toThrow(
      new RangeError('TEAM_SUGGEST_INVALID_LIMIT'),
    );
  });

  it('prefers team name over aliases when distance is equal', () => {
    const testCandidates: TeamNameCandidate[] = [
      { teamId: 'T1', name: 'Blue Wing', alias: null, key: 'blue wing' },
      { teamId: 'T1', name: 'Blue Wing', alias: 'BWing', key: 'bwing' },
    ];

    const result = suggestTeams('blue wing', testCandidates);
    expect(result).toHaveLength(1);
    expect(result[0]!.matchedAlias).toBeNull();
  });

  it('sorts by distance, then name, then teamId', () => {
    const testCandidates: TeamNameCandidate[] = [
      { teamId: 'T2', name: 'Apple Brown', alias: null, key: 'apple brown' },
      { teamId: 'T1', name: 'Apple', alias: null, key: 'apple' },
      { teamId: 'T3', name: 'Apple', alias: null, key: 'apple' },
    ];

    const result = suggestTeams('app', testCandidates);
    // All have distance 0, so sorted by name then teamId
    expect(result).toEqual([
      { teamId: 'T1', name: 'Apple', matchedAlias: null, distance: 0 },
      { teamId: 'T3', name: 'Apple', matchedAlias: null, distance: 0 },
      { teamId: 'T2', name: 'Apple Brown', matchedAlias: null, distance: 0 },
    ]);
  });
});
