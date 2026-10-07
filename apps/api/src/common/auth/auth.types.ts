import type { Role } from '@blulens/shared';
import type { Request } from 'express';

/** Attached to the request by AuthGuard from the bl_access cookie. Absent for Guest requests. */
export interface AuthUser {
  id: string;
  roles: Role[];
}

export type AuthedRequest = Request & { user?: AuthUser };

export const ACCESS_COOKIE = 'bl_access';
export const REFRESH_COOKIE = 'bl_refresh';
export const SESSION_COOKIE = 'bl_session';
/** bl_refresh is only sent to the auth endpoints (architecture §6.2). */
export const REFRESH_COOKIE_PATH = '/api/v1/auth';
