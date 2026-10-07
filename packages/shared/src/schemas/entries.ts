import { z } from 'zod';

/** Mirrors openapi EntryInput / EntryStatus and the entry decision bodies (architecture §6.10). */

export const ENTRY_STATUSES = ['draft', 'pending_committee', 'approved', 'rejected', 'withdrawn'] as const;
export const entryStatusSchema = z.enum(ENTRY_STATUSES);
export type EntryStatus = z.infer<typeof entryStatusSchema>;

/** Warnings shown to the Committee; they never block creating an entry. */
export const ENTRY_WARNINGS = ['MULTI_TEAM', 'NO_APPROVED_GRADE', 'GRADE_OUT_OF_BAND', 'FRESH_ASSESSMENT_REQUIRED'] as const;
export type EntryWarning = (typeof ENTRY_WARNINGS)[number];

export const entryInputSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  players: z
    .array(
      z.object({
        userId: z.string().uuid(),
        teamId: z.string().uuid().optional(),
      }),
    )
    .min(1)
    .max(2),
});
export type EntryInput = z.infer<typeof entryInputSchema>;

export const entryApproveInputSchema = z.object({
  reason: z.string().trim().min(20).max(2000).optional(),
});

/** openapi ReasonInput. */
export const reasonInputSchema = z.object({
  reason: z.string().trim().min(5).max(2000),
});

/** openapi EntryRejectInput: entry reject reason is at least 10 chars (decision 2026-10-07; other reasons stay at 5). */
export const entryRejectInputSchema = z.object({
  reason: z.string().trim().min(10).max(2000),
});
