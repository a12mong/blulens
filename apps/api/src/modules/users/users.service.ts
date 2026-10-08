import { Injectable } from '@nestjs/common';
import { type Role } from '@blulens/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { officialResults } from '../../common/grades';

export interface ListUsersParams {
  role?: Role;
  q?: string;
  cursor?: string;
  limit: number;
}

export type UserPickerItem = {
  id: string;
  displayName: string;
  roles: Role[];
  teamIds: string[];
  teamNames: string[];
  gradeLabel: string | null;
  gradeProvisional: boolean;
};

export interface ListUsersResult {
  items: UserPickerItem[];
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
          include: {
            team: {
              select: { name: true },
            },
          },
        },
      },
    });

    const hasMore = users.length > params.limit;
    const rows = hasMore ? users.slice(0, params.limit) : users;
    const lastItem = rows[rows.length - 1];
    const nextCursor = hasMore && lastItem ? lastItem.id : null;

    const userIds = rows.map((u) => u.id);
    const official = await officialResults(this.prisma, userIds);

    const provisionalSet = new Set<string>();
    if (userIds.length > 0) {
      const provisional = await this.prisma.assessmentResult.findMany({
        where: {
          status: 'provisional',
          assessment: { subjectUserId: { in: userIds } },
        },
        select: {
          assessment: { select: { subjectUserId: true } },
        },
      });
      for (const r of provisional) {
        provisionalSet.add(r.assessment.subjectUserId);
      }
    }

    const items: UserPickerItem[] = rows.map((u: any) => {
      const memberships = u.memberships.sort((a: any, b: any) => (a.team.name < b.team.name ? -1 : a.team.name > b.team.name ? 1 : 0));
      return {
        id: u.id,
        displayName: u.displayName,
        roles: u.roles.map((r: any) => r.role as Role),
        teamIds: memberships.map((m: any) => m.teamId),
        teamNames: memberships.map((m: any) => m.team.name),
        gradeLabel: official.get(u.id)?.label ?? null,
        gradeProvisional: !official.has(u.id) && provisionalSet.has(u.id),
      };
    });

    return {
      items,
      nextCursor,
    };
  }
}
