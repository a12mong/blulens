import { describe, expect, it } from 'vitest';
import { matchFormatSchema } from '../schemas/format';
import { MATCH_FORMAT_PRESETS, resolveMatchFormat } from './match-format';

describe('match-format (bl-25-1b)', () => {
  describe('MATCH_FORMAT_PRESETS', () => {
    it('group_2x15 matches tournament-format §5 and passes matchFormatSchema', () => {
      const preset = MATCH_FORMAT_PRESETS.group_2x15;
      expect(preset).toEqual({
        preset: 'group_2x15',
        mode: 'fixed_games',
        games: 2,
        pointsPerGame: 15,
        deuce: false,
        cap: null,
        drawAllowed: true,
      });
      const parsed = matchFormatSchema.safeParse(preset);
      expect(parsed.success).toBe(true);
    });

    it('bo3_21 matches tournament-format §5 and passes matchFormatSchema', () => {
      const preset = MATCH_FORMAT_PRESETS.bo3_21;
      expect(preset).toEqual({
        preset: 'bo3_21',
        mode: 'best_of',
        games: 3,
        pointsPerGame: 21,
        deuce: true,
        cap: 30,
        drawAllowed: false,
      });
      const parsed = matchFormatSchema.safeParse(preset);
      expect(parsed.success).toBe(true);
    });
  });

  describe('resolveMatchFormat', () => {
    it('returns default preset when eventFormat is null or undefined for each stage', () => {
      expect(resolveMatchFormat(null, 'group')).toEqual(MATCH_FORMAT_PRESETS.group_2x15);
      expect(resolveMatchFormat(null, 'knockout')).toEqual(MATCH_FORMAT_PRESETS.bo3_21);
      expect(resolveMatchFormat(null, 'third_place')).toEqual(MATCH_FORMAT_PRESETS.bo3_21);

      expect(resolveMatchFormat(undefined, 'group')).toEqual(MATCH_FORMAT_PRESETS.group_2x15);
      expect(resolveMatchFormat(undefined, 'knockout')).toEqual(MATCH_FORMAT_PRESETS.bo3_21);
      expect(resolveMatchFormat(undefined, 'third_place')).toEqual(MATCH_FORMAT_PRESETS.bo3_21);
    });

    it('returns default preset when eventFormat is invalid JSON string', () => {
      expect(resolveMatchFormat('{ not valid json', 'group')).toEqual(
        MATCH_FORMAT_PRESETS.group_2x15,
      );
      expect(resolveMatchFormat('{"type": "broken"', 'knockout')).toEqual(
        MATCH_FORMAT_PRESETS.bo3_21,
      );
      expect(resolveMatchFormat('foo', 'third_place')).toEqual(MATCH_FORMAT_PRESETS.bo3_21);
    });

    it('returns default preset when eventFormat fails schema validation', () => {
      expect(resolveMatchFormat({}, 'group')).toEqual(MATCH_FORMAT_PRESETS.group_2x15);
      expect(resolveMatchFormat({ type: 'invalid_type' }, 'knockout')).toEqual(
        MATCH_FORMAT_PRESETS.bo3_21,
      );
      expect(resolveMatchFormat(12345, 'third_place')).toEqual(MATCH_FORMAT_PRESETS.bo3_21);
      expect(resolveMatchFormat(true, 'group')).toEqual(MATCH_FORMAT_PRESETS.group_2x15);
    });

    it('returns default presets when valid eventFormat has missing format fields', () => {
      const format = { type: 'groups_knockout', groupSize: 4, advancePerGroup: 2 };
      expect(resolveMatchFormat(format, 'group')).toEqual(MATCH_FORMAT_PRESETS.group_2x15);
      expect(resolveMatchFormat(format, 'knockout')).toEqual(MATCH_FORMAT_PRESETS.bo3_21);
      expect(resolveMatchFormat(format, 'third_place')).toEqual(MATCH_FORMAT_PRESETS.bo3_21);
    });

    it('returns custom groupMatchFormat for group stage, preset for knockout and third_place', () => {
      const customGroupFormat = {
        preset: 'custom' as const,
        mode: 'fixed_games' as const,
        games: 2,
        pointsPerGame: 21,
        deuce: false,
        cap: null,
        drawAllowed: true,
      };
      const eventFormat = {
        type: 'groups_knockout' as const,
        groupMatchFormat: customGroupFormat,
      };

      expect(resolveMatchFormat(eventFormat, 'group')).toEqual(customGroupFormat);
      expect(resolveMatchFormat(eventFormat, 'knockout')).toEqual(MATCH_FORMAT_PRESETS.bo3_21);
      expect(resolveMatchFormat(eventFormat, 'third_place')).toEqual(MATCH_FORMAT_PRESETS.bo3_21);
    });

    it('returns custom knockoutMatchFormat for knockout and third_place, preset for group stage', () => {
      const customKnockoutFormat = {
        preset: 'single_30' as const,
        mode: 'best_of' as const,
        games: 1,
        pointsPerGame: 30,
        deuce: false,
        cap: null,
        drawAllowed: false,
      };
      const eventFormat = {
        type: 'groups_knockout' as const,
        knockoutMatchFormat: customKnockoutFormat,
      };

      expect(resolveMatchFormat(eventFormat, 'group')).toEqual(MATCH_FORMAT_PRESETS.group_2x15);
      expect(resolveMatchFormat(eventFormat, 'knockout')).toEqual(customKnockoutFormat);
      expect(resolveMatchFormat(eventFormat, 'third_place')).toEqual(customKnockoutFormat);
    });

    it('parses valid stringified JSON eventFormat correctly', () => {
      const customGroupFormat = {
        preset: 'group_2x15',
        mode: 'fixed_games',
        games: 2,
        pointsPerGame: 15,
        deuce: false,
        cap: null,
        drawAllowed: true,
      };
      const eventFormatJson = JSON.stringify({
        type: 'groups_knockout',
        groupMatchFormat: customGroupFormat,
      });

      expect(resolveMatchFormat(eventFormatJson, 'group')).toEqual(customGroupFormat);
      expect(resolveMatchFormat(eventFormatJson, 'knockout')).toEqual(MATCH_FORMAT_PRESETS.bo3_21);
    });

    it('is a pure function that does not mutate inputs', () => {
      const eventFormat = {
        type: 'groups_knockout' as const,
        groupSize: 4,
        advancePerGroup: 2,
      };
      const snapshot = JSON.stringify(eventFormat);

      const r1 = resolveMatchFormat(eventFormat, 'group');
      const r2 = resolveMatchFormat(eventFormat, 'group');

      expect(r1).toEqual(r2);
      expect(JSON.stringify(eventFormat)).toBe(snapshot);
    });
  });
});
