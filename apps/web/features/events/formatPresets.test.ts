import { describe, expect, it } from 'vitest';
import {
  BO3_21,
  FORMAT_PRESETS,
  GROUP_2X15,
} from './formatPresets';

describe('formatPresets', () => {
  it('groups_knockout has groupMatchFormat with pointsPerGame 15 and knockoutMatchFormat with 3 games', () => {
    const groupsFormat = FORMAT_PRESETS.groups_knockout.format;
    expect(groupsFormat.groupMatchFormat?.pointsPerGame).toBe(15);
    expect(groupsFormat.knockoutMatchFormat?.games).toBe(3);
    expect(groupsFormat.type).toBe('groups_knockout');
    expect(groupsFormat.groupSize).toBe(4);
    expect(groupsFormat.advancePerGroup).toBe(2);
    expect(groupsFormat.thirdPlacePlayoff).toBe(true);
  });

  it('knockout format preset has knockoutMatchFormat with 3 games and 21 points', () => {
    const koFormat = FORMAT_PRESETS.knockout.format;
    expect(koFormat.type).toBe('knockout');
    expect(koFormat.knockoutMatchFormat?.games).toBe(3);
    expect(koFormat.knockoutMatchFormat?.pointsPerGame).toBe(21);
    expect(koFormat.thirdPlacePlayoff).toBe(true);
  });

  it('BO3_21 and GROUP_2X15 match tournament format spec presets', () => {
    expect(BO3_21.preset).toBe('bo3_21');
    expect(BO3_21.mode).toBe('best_of');
    expect(BO3_21.games).toBe(3);
    expect(BO3_21.pointsPerGame).toBe(21);
    expect(BO3_21.deuce).toBe(true);
    expect(BO3_21.cap).toBe(30);
    expect(BO3_21.drawAllowed).toBe(false);

    expect(GROUP_2X15.preset).toBe('group_2x15');
    expect(GROUP_2X15.mode).toBe('fixed_games');
    expect(GROUP_2X15.games).toBe(2);
    expect(GROUP_2X15.pointsPerGame).toBe(15);
    expect(GROUP_2X15.deuce).toBe(false);
    expect(GROUP_2X15.cap).toBeNull();
    expect(GROUP_2X15.drawAllowed).toBe(true);
  });
});
