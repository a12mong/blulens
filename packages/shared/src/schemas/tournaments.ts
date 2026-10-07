import { z } from 'zod';
import { GRADE_KEYS, gradeKeySchema } from './auth';

/** Mirrors openapi TournamentInput / EventInput (drift-tested in apps/api). */

export const TOURNAMENT_STATUSES = ['draft', 'open', 'closed', 'running', 'finished'] as const;
export const tournamentStatusSchema = z.enum(TOURNAMENT_STATUSES);
export type TournamentStatus = z.infer<typeof tournamentStatusSchema>;

export const tournamentInputSchema = z.object({
  name: z.string().trim().min(1).max(160),
  venue: z.string().trim().max(160).optional(),
  startsOn: z.string().date(),
  entriesCloseAt: z.string().datetime({ offset: true }),
});
export type TournamentInput = z.infer<typeof tournamentInputSchema>;

/** Allowed lifecycle moves (openapi POST /tournaments/{id}/status). */
export const TOURNAMENT_TRANSITIONS: Readonly<Record<TournamentStatus, readonly TournamentStatus[]>> = {
  draft: ['open'],
  open: ['closed'],
  closed: ['running'],
  running: ['finished'],
  finished: [],
};

export const tournamentStatusInputSchema = z.object({
  to: z.enum(['open', 'closed', 'running', 'finished']),
  reason: z.string().trim().max(2000).optional(),
});

export const DISCIPLINES = ['MS', 'WS', 'MD', 'WD', 'XD'] as const;
/** Doubles disciplines take 2 players per entry. */
export const DOUBLES_DISCIPLINES: readonly string[] = ['MD', 'WD', 'XD'];

export const eventInputSchema = z
  .object({
    discipline: z.enum(DISCIPLINES),
    gradeMin: gradeKeySchema,
    gradeMax: gradeKeySchema,
    maxEntries: z.number().int().min(2).max(256).optional(),
    requiresFreshAssessment: z.boolean().optional(),
    minReviewers: z.number().int().min(1).max(5).optional(),
  })
  .refine((e) => GRADE_KEYS.indexOf(e.gradeMin) <= GRADE_KEYS.indexOf(e.gradeMax), {
    message: 'เกรดต่ำสุดต้องไม่สูงกว่าเกรดสูงสุด',
    path: ['gradeMax'],
  });
export type EventInput = z.infer<typeof eventInputSchema>;
