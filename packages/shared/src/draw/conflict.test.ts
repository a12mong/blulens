import { describe, expect, it } from 'vitest';
import { sharesTeam } from './conflict';

describe('sharesTeam (D7)', () => {
  it('clashes when the team sets share at least one id', () => {
    expect(sharesTeam({ teamIds: ['A'] }, { teamIds: ['A'] })).toBe(true);
    expect(sharesTeam({ teamIds: ['A', 'B'] }, { teamIds: ['B', 'C'] })).toBe(true);
  });

  it('does not clash for disjoint sets or teamless entries', () => {
    expect(sharesTeam({ teamIds: ['A'] }, { teamIds: ['B'] })).toBe(false);
    expect(sharesTeam({ teamIds: [] }, { teamIds: ['A'] })).toBe(false);
    expect(sharesTeam({ teamIds: [] }, { teamIds: [] })).toBe(false);
  });
});
