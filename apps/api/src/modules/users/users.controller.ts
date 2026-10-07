import { Controller, Get, Query } from '@nestjs/common';
import { roleSchema } from '@blulens/shared';
import { z } from 'zod';
import { Roles } from '../../common/auth/decorators';
import { createZodDto } from '../../common/zod/zod';
import { type UserPickerItem, UsersService } from './users.service';

const listUsersQuery = z.object({
  role: roleSchema.optional(),
  q: z.string().trim().min(1).max(80).optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export class ListUsersQueryDto extends createZodDto(listUsersQuery) {}

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Roles('Committee', 'Admin')
  @Get()
  async listUsers(
    @Query() query: ListUsersQueryDto,
  ): Promise<{ items: UserPickerItem[]; nextCursor: string | null }> {
    return this.usersService.listUsers(query);
  }
}
