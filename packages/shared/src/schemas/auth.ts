import { z } from 'zod';

/**
 * Identity request/response schemas — must match docs/api/openapi.yaml components.schemas
 * (Role, RegisterInput, LoginInput, UserSummary, Me, GradeView). A drift test in apps/api checks this.
 */

/** Stored roles (A2). Guest = not logged in, never stored. */
export const ROLES = ['Admin', 'Committee', 'Umpire', 'Reviewer', 'Member'] as const;
export const roleSchema = z.enum(ROLES);
export type Role = z.infer<typeof roleSchema>;

export const registerInputSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(10).max(200),
  displayName: z.string().trim().min(1).max(80),
});
export type RegisterInput = z.infer<typeof registerInputSchema>;

export const loginInputSchema = z.object({
  /** Email for now (architecture §9: social login later). */
  identifier: z.string().trim().toLowerCase().min(1).max(254),
  password: z.string().min(1).max(200),
});
export type LoginInput = z.infer<typeof loginInputSchema>;

export const GRADE_KEYS = ['RK1', 'RK2', 'RK3', 'BG1', 'BG2', 'BG3', 'S-', 'S', 'S+', 'N-', 'N', 'N+', 'P-', 'P', 'P+'] as const;
export const gradeKeySchema = z.enum(GRADE_KEYS);

export const gradeViewSchema = z.object({
  score: z.number().min(0).max(15),
  margin: z.number().min(0).optional(),
  lower: gradeKeySchema,
  upper: gradeKeySchema,
  center: gradeKeySchema,
  tier: z.enum(['Rookie', 'Beginner', 'Standard', 'Neutral', 'Professional']).optional(),
  kind: z.enum(['exact', 'straddle', 'wide']),
  label: z.string(),
});

export const userSummarySchema = z.object({
  id: z.string().uuid(),
  displayName: z.string(),
  roles: z.array(roleSchema),
  teamIds: z.array(z.string().uuid()).optional(),
});
export type UserSummary = z.infer<typeof userSummarySchema>;

export const meSchema = userSummarySchema.extend({
  email: z.string().email().optional(),
  permissions: z.array(z.string()).optional(),
  currentGrade: gradeViewSchema.nullable().optional(),
});
export type Me = z.infer<typeof meSchema>;

export const replaceRolesInputSchema = z.object({
  roles: z.array(roleSchema).min(1),
});
