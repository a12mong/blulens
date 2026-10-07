import { z } from 'zod';

/** Mirrors openapi MatchFormat / EventFormat (tournament-format.md §2 + §5; drift-tested in apps/api). */

export const matchFormatSchema = z
  .object({
    preset: z.enum(['group_2x15', 'single_30', 'bo3_21', 'single_21', 'custom']).optional(),
    mode: z.enum(['fixed_games', 'best_of']),
    games: z.number().int().min(1).max(5),
    pointsPerGame: z.number().int().min(5).max(31),
    deuce: z.boolean(),
    cap: z.number().int().nullable().optional(),
    drawAllowed: z.boolean().default(false),
  })
  .refine((f) => !f.deuce || f.cap == null || f.cap > f.pointsPerGame, {
    message: 'เพดานแต้มต้องมากกว่าแต้มที่ชนะเกม',
    path: ['cap'],
  })
  .refine((f) => !f.drawAllowed || (f.mode === 'fixed_games' && f.games % 2 === 0), {
    message: 'เสมอได้เฉพาะแบบเล่นครบทุกเกมและจำนวนเกมเป็นเลขคู่',
    path: ['drawAllowed'],
  })
  .refine((f) => f.mode !== 'best_of' || f.games % 2 === 1, {
    message: 'แบบชนะก่อนต้องมีจำนวนเกมเป็นเลขคี่',
    path: ['games'],
  });
export type MatchFormat = z.infer<typeof matchFormatSchema>;

export const TIEBREAKERS = ['points', 'point_diff', 'head_to_head', 'points_for', 'game_diff', 'lot'] as const;

export const eventFormatSchema = z
  .object({
    type: z.enum(['knockout', 'groups_knockout']),
    groupSize: z.number().int().min(3).max(5).default(4),
    advancePerGroup: z.number().int().min(1).max(2).default(2),
    bestThirds: z.number().int().min(0).default(0),
    groupMatchFormat: matchFormatSchema.optional(),
    knockoutMatchFormat: matchFormatSchema.optional(),
    points: z
      .object({
        win: z.number().int().default(3),
        draw: z.number().int().default(1),
        loss: z.number().int().default(0),
      })
      .optional(),
    tiebreakers: z.array(z.enum(TIEBREAKERS)).optional(),
    thirdPlacePlayoff: z.boolean().default(true),
  })
  .refine((f) => f.advancePerGroup <= f.groupSize - 1, {
    message: 'จำนวนผู้เข้ารอบต่อกลุ่มต้องน้อยกว่าขนาดกลุ่ม',
    path: ['advancePerGroup'],
  })
  // knockout rounds never end in a draw (tournament-format §5)
  .refine((f) => !f.knockoutMatchFormat?.drawAllowed, {
    message: 'รอบน็อคเอาท์ต้องมีผู้ชนะ (ห้ามเสมอ)',
    path: ['knockoutMatchFormat', 'drawAllowed'],
  });
export type EventFormat = z.infer<typeof eventFormatSchema>;
