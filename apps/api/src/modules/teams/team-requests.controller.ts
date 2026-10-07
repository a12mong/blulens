import { Controller, Get, Post, Body, Param, HttpCode } from '@nestjs/common';
import { Roles, CurrentUser } from '../../common/auth/decorators';
import { createZodDto } from '../../common/zod/zod';
import { z } from 'zod';
import { TeamRequestsService } from './team-requests.service';
import type { AuthUser } from '../../common/auth/auth.types';

const CreateTeamRequestSchema = z.object({
  name: z.string().min(1).max(120),
});

class CreateTeamRequestDto extends createZodDto(CreateTeamRequestSchema) {}

const ResolveTeamRequestSchema = z
  .object({
    action: z.enum(['create_team', 'alias_to_team', 'reject']),
    teamId: z.string().uuid().optional(),
    reason: z.string().trim().max(2000).optional(),
  })
  .refine((b) => b.action !== 'alias_to_team' || !!b.teamId, {
    message: 'ต้องเลือกทีมที่จะผูกชื่อ',
    path: ['teamId'],
  })
  .refine((b) => b.action !== 'reject' || (b.reason?.length ?? 0) >= 5, {
    message: 'ต้องระบุเหตุผลอย่างน้อย 5 ตัวอักษร',
    path: ['reason'],
  });

class ResolveTeamRequestDto extends createZodDto(ResolveTeamRequestSchema) {}

@Controller('team-requests')
export class TeamRequestsController {
  constructor(private readonly teamRequestsService: TeamRequestsService) {}

  @Post()
  @Roles('Member', 'Reviewer', 'Committee', 'Admin')
  async create(@Body() { name }: CreateTeamRequestDto, @CurrentUser() user: AuthUser) {
    return this.teamRequestsService.createTeamRequest(name, user);
  }

  @Get()
  @Roles('Committee', 'Admin')
  async getPending() {
    return this.teamRequestsService.getPendingRequests();
  }

  @Post(':requestId/resolve')
  @HttpCode(200)
  @Roles('Committee', 'Admin')
  async resolve(
    @Param('requestId') requestId: string,
    @Body() body: ResolveTeamRequestDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.teamRequestsService.resolveTeamRequest(requestId, body, user);
  }
}
