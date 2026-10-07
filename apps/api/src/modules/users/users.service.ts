import { Injectable } from '@nestjs/common';
import { type Role, type UserSummary } from '@blulens/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface ListUsersParams {
  role?: Role;
  q?: string;
  cursor?: string;
  limit: number;
}

export interface ListUsersResult {
  items: UserSummary[];
  nextCursor: string | null;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async listUsers(params: ListUsersParams): Promise<ListUsersResult> {
    const now = new Date();
    const q = params.q?.trim().replace(/\s+/g, ' ');
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      status: 'active',
      ...(params.role ? { roles: { some: { role: params.role } } } : {}),
      // Pam N3: the start of ANY word of the display name (first name, surname, Thai included), or an email prefix
      ...(q
        ? {
            OR: [
              { displayName: { startsWith: q, mode: 'insensitive' } },
              { displayName: { contains: ` ${q}`, mode: 'insensitive' } },
              { email: { startsWith: q.toLowerCase() } },
            ],
          }
        : {}),
    };

    const take = params.limit + 1;
    const users = await this.prisma.user.findMany({
      where,
      orderBy: [{ displayName: 'asc' }, { id: 'asc' }],
      take,
      ...(params.cursor
        ? {
            cursor: { id: params.cursor },
            skip: 1,
          }
        : {}),
      include: {
        roles: true,
        memberships: {
          where: {
            validFrom: { lte: now },
            OR: [{ validTo: null }, { validTo: { gt: now } }],
          },
        },
      },
    });

    const hasMore = users.length > params.limit;
    const rows = hasMore ? users.slice(0, params.limit) : users;
    const lastItem = rows[rows.length - 1];
    const nextCursor = hasMore && lastItem ? lastItem.id : null;

    const items: UserSummary[] = rows.map((u) => ({
      id: u.id,
      displayName: u.displayName,
      roles: u.roles.map((r) => r.role as Role),
      teamIds: u.memberships.map((m) => m.teamId),
    }));

    return {
      items,
      nextCursor,
    };
  }
}
