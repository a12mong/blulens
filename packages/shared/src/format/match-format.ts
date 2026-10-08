import { eventFormatSchema, type MatchFormat } from '../schemas/format';

export const MATCH_FORMAT_PRESETS: Record<'group_2x15' | 'bo3_21', MatchFormat> = {
  group_2x15: {
    preset: 'group_2x15',
    mode: 'fixed_games',
    games: 2,
    pointsPerGame: 15,
    deuce: false,
    cap: null,
    drawAllowed: true,
  },
  bo3_21: {
    preset: 'bo3_21',
    mode: 'best_of',
    games: 3,
    pointsPerGame: 21,
    deuce: true,
    cap: 30,
    drawAllowed: false,
  },
};

/**
 * Resolves the match format for a specific stage from an Event's format configuration.
 *
 * - stage 'group' -> groupMatchFormat (defaulting to preset group_2x15)
 * - stage 'knockout' | 'third_place' -> knockoutMatchFormat (defaulting to preset bo3_21)
 * - If eventFormat is null/undefined, invalid JSON, or schema validation fails -> default preset.
 *
 * Pure function.
 */
export function resolveMatchFormat(
  eventFormat: unknown,
  stage: 'group' | 'knockout' | 'third_place',
): MatchFormat {
  const isGroup = stage === 'group';
  const defaultPreset = isGroup ? MATCH_FORMAT_PRESETS.group_2x15 : MATCH_FORMAT_PRESETS.bo3_21;

  if (eventFormat == null) {
    return defaultPreset;
  }

  let raw = eventFormat;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      return defaultPreset;
    }
  }

  const parsed = eventFormatSchema.safeParse(raw);
  if (!parsed.success) {
    return defaultPreset;
  }

  const custom = isGroup ? parsed.data.groupMatchFormat : parsed.data.knockoutMatchFormat;
  return custom ?? defaultPreset;
}
