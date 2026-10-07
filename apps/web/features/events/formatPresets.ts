import type { components } from '@/lib/api/schema';

export type EventFormat = components['schemas']['EventFormat'];
export type MatchFormat = components['schemas']['MatchFormat'];

export type FormatPresetKey = 'knockout' | 'groups_knockout';

export const BO3_21: MatchFormat = {
  preset: 'bo3_21',
  mode: 'best_of',
  games: 3,
  pointsPerGame: 21,
  deuce: true,
  cap: 30,
  drawAllowed: false,
};

export const GROUP_2X15: MatchFormat = {
  preset: 'group_2x15',
  mode: 'fixed_games',
  games: 2,
  pointsPerGame: 15,
  deuce: false,
  cap: null,
  drawAllowed: true,
};

export const FORMAT_PRESETS: Record<
  FormatPresetKey,
  { label: string; hint: string; format: EventFormat }
> = {
  knockout: {
    label: 'น็อคเอาท์อย่างเดียว',
    hint: 'แพ้คัดออกทันที แข่งขัน 2 ใน 3 เกม 21 แต้ม',
    format: {
      type: 'knockout',
      groupSize: 4,
      advancePerGroup: 2,
      bestThirds: 0,
      thirdPlacePlayoff: true,
      knockoutMatchFormat: BO3_21,
    },
  },
  groups_knockout: {
    label: 'แบ่งกลุ่ม + น็อคเอาท์ (แนะนำเมื่อ ≥ 6 คู่)',
    hint: 'กลุ่มละ 4 คู่ แข่งขัน 2 เกม 15 แต้ม อันดับ 1–2 เข้ารอบ',
    format: {
      type: 'groups_knockout',
      groupSize: 4,
      advancePerGroup: 2,
      bestThirds: 0,
      thirdPlacePlayoff: true,
      groupMatchFormat: GROUP_2X15,
      knockoutMatchFormat: BO3_21,
    },
  },
};
