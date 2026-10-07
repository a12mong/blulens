import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Role } from '@blulens/shared';
import type { AuthedRequest, AuthUser } from './auth.types';

export const ROLES_KEY = 'roles';

/**
 * Roles allowed to call the endpoint (openapi x-roles). The user needs at least ONE of them (roles are a union,
 * not a hierarchy). Endpoints without @Roles and without @Public only require a logged-in user.
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

/** The logged-in user (AuthGuard guarantees it on non-@Public endpoints). */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser | undefined => {
  return ctx.switchToHttp().getRequest<AuthedRequest>().user;
});
