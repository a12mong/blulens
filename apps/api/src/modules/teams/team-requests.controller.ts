import { Controller, Get, Post, Body } from '@nestjs/common';
import { Roles, CurrentUser } from '../../common/auth/decorators';
import { createZodDto } from '../../common/zod/zod';
import { z } from 'zod';
import { TeamRequestsService } from './team-requests.service';
import type { AuthUser } from '../../common/auth/auth.types';

const CreateTeamRequestSchema = z.object({
  name: z.string().min(1).max(120),
});

class CreateTeamRequestDto extends createZodDto(CreateTeamRequestSchema) {}

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
}
